// 게이트와 결정 서명(contract.md 6절). 키와 파일 입출력은 runtime이 맡고, 여기서는 계산과 판정만 한다.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { parseFrontmatter } from './frontmatter'
import { TaskId } from './schema'

export const GateId = z.string().regex(/^G-\d{3,}$/, 'G- 뒤에 3자리 이상 숫자 (예: G-001)')
export const GateClass = z.enum(['approval-before', 'decision', 'approval-after'])
export type GateClass = z.infer<typeof GateClass>

export const GateFrontmatter = z
  .object({
    id: GateId,
    task: TaskId,
    class: GateClass,
    status: z.enum(['pending', 'resolved']),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    recommended: z.string().nullable().default(null),
    handoff_rev: z.number().int().positive().nullable(),
    irreversible: z.boolean().default(false),
    opened_at: z.string().nullable().default(null),
    resolution: z.string().nullable().default(null),
    instruction: z.string().nullable().default(null),
    project_id: z.string().nullable().default(null),
    task_spec_sha256: z.string().nullable().default(null),
    handoff_sha256: z.string().nullable().default(null),
    key_id: z.string().nullable().default(null),
    nonce: z.string().nullable().default(null),
    decided_at: z.string().nullable().default(null),
    active_seconds: z.number().nonnegative().nullable().default(null),
    /** 이해 게이트 결과 요약. 답과 핵심어는 private에만 둔다(contract.md 9.1절) */
    comprehension: z
      .object({ questions: z.number().int(), hits: z.number().int(), keys: z.number().int() })
      .strict()
      .nullable()
      .default(null),
    sig: z.string().nullable().default(null),
  })
  .strict()
export type Gate = z.infer<typeof GateFrontmatter>

export const APPROVAL_OPTIONS: Record<Exclude<GateClass, 'decision'>, [string, string]> = {
  'approval-before': ['진행', '중단'],
  'approval-after': ['승인', '다시'],
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/** 키를 모든 깊이에서 정렬한 공백 없는 JSON. 같은 값이면 언제나 같은 문자열이 나와야 서명이 재현된다. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/** status를 뺀 작업 명세의 요약값. run이 상태를 바꿀 때마다 결정이 깨지지 않게 한다. */
export function taskSpecDigest(taskText: string): string {
  const parsed = parseFrontmatter(taskText, 'task')
  if (!parsed.ok) return sha256(taskText)
  const { status: _status, ...rest } = parsed.value.data
  return sha256(`${canonicalJson(rest)}\n${parsed.value.body}`)
}

export type SignedFields = {
  project_id: string
  task_id: string
  gate_id: string
  class: GateClass
  question: string
  options: string[]
  /** 판본과 되돌리기 어려움도 서명한다. 고쳐서 지난 판본인 척하거나 이해 게이트를 끄지 못하게 */
  handoff_rev: number | null
  irreversible: boolean
  task_spec_sha256: string
  handoff_sha256: string | null
  choice: string
  instruction: string | null
  key_id: string
  nonce: string
  decided_at: string
}

export function signingPayload(f: SignedFields): string {
  return canonicalJson(f)
}

export function signPayload(key: Buffer, payload: string): string {
  return createHmac('sha256', key).update(payload).digest('hex')
}

export function verifyPayload(key: Buffer, payload: string, sig: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(sig)) return false
  return timingSafeEqual(Buffer.from(signPayload(key, payload), 'hex'), Buffer.from(sig, 'hex'))
}

export type LedgerEntry = { gate: string; nonce: string; key_id: string; decided_at: string }
export type VerdictStatus = 'ok' | 'pending' | 'superseded' | 'fail'
export type Verdict = { id: string; status: VerdictStatus; reasons: string[] }

export type VerifyContext = {
  projectId: string | undefined
  taskText: string | undefined
  /** 현재 HANDOFF 파일 내용과 판본 */
  handoff: { text: string; rev: number | undefined } | undefined
  activeKey: { id: string; key: Buffer } | undefined
  /** 키를 못 읽은 사유 (권한, 없음) */
  keyProblem?: string
  ledger: LedgerEntry[]
  /** 장부에 읽을 수 없는 줄이 있다 */
  ledgerBroken?: boolean
}

/** 지난 판본의 게이트인가. 기록으로만 남고 검증 대상이 아니다. */
export function isSuperseded(g: Gate, currentRev: number | undefined): boolean {
  return g.handoff_rev !== null && currentRev !== undefined && g.handoff_rev < currentRev
}

export function judgeGate(g: Gate, ctx: VerifyContext): Verdict {
  const v = (status: VerdictStatus, reasons: string[] = []): Verdict => ({
    id: g.id,
    status,
    reasons,
  })
  if (isSuperseded(g, ctx.handoff?.rev)) return v('superseded')
  if (g.status === 'pending') return v('pending')
  const reasons: string[] = []
  if (!g.resolution || !g.options.includes(g.resolution)) reasons.push('선택이 선택지에 없어요')
  if (!ctx.projectId || g.project_id !== ctx.projectId)
    reasons.push(`다른 프로젝트(${g.project_id ?? '없음'})의 결정이에요`)
  if (!ctx.activeKey) {
    reasons.push(ctx.keyProblem ?? '서명 키가 없어요. gotechy keys init을 실행하세요')
  } else if (g.key_id !== ctx.activeKey.id) {
    reasons.push(`이전 키(${g.key_id ?? '없음'})로 서명한 결정이에요. 다시 결정하세요`)
  } else if (ctx.projectId && g.resolution && g.task_spec_sha256 && g.nonce && g.decided_at) {
    const payload = signingPayload({
      project_id: ctx.projectId,
      task_id: g.task,
      gate_id: g.id,
      class: g.class,
      question: g.question,
      options: g.options,
      handoff_rev: g.handoff_rev,
      irreversible: g.irreversible,
      task_spec_sha256: g.task_spec_sha256,
      handoff_sha256: g.handoff_sha256,
      choice: g.resolution,
      instruction: g.instruction,
      key_id: g.key_id,
      nonce: g.nonce,
      decided_at: g.decided_at,
    })
    if (!g.sig || !verifyPayload(ctx.activeKey.key, payload, g.sig))
      reasons.push('서명이 맞지 않아요. 결정 파일이 결정 뒤에 바뀌었어요')
  } else {
    reasons.push('서명 정보가 비어 있어요')
  }
  if (ctx.ledgerBroken)
    reasons.push('결정 장부(orchestration/private/decisions.jsonl)에 읽을 수 없는 줄이 있어요')
  const mine = ctx.ledger.filter((e) => e.gate === g.id)
  if (mine.at(-1)?.nonce !== g.nonce)
    reasons.push(
      'nonce가 이 게이트의 마지막 결정 기록과 달라요. 되살린 옛 결정이거나 기록이 없어요',
    )
  const other = ctx.ledger.find((e) => e.nonce === g.nonce && e.gate !== g.id)
  if (other) reasons.push(`nonce가 다른 게이트(${other.gate})에 이미 쓰였어요`)
  if (!ctx.taskText) reasons.push(`작업 명세(${g.task})가 없어요`)
  else if (taskSpecDigest(ctx.taskText) !== g.task_spec_sha256)
    reasons.push('작업 명세가 결정 뒤에 바뀌었어요. 바뀐 명세로 다시 결정하세요')
  if (g.handoff_rev !== null) {
    if (!ctx.handoff) reasons.push('HANDOFF가 없어요')
    else if (sha256(ctx.handoff.text) !== g.handoff_sha256)
      reasons.push('HANDOFF 내용이 결정 뒤에 바뀌었어요. 바뀐 HANDOFF를 보고 다시 결정하세요')
  }
  return reasons.length > 0 ? v('fail', reasons) : v('ok')
}
