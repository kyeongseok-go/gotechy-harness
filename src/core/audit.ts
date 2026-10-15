// 교차 검증 감사관의 순수 판정(contract.md 13절): 감사관 출력 읽기, 근거 경로 검사, 프롬프트 조립, 기록 글.
// 모델 호출과 git은 runtime/audit.ts가 한다.
import { z } from 'zod'
import { serializeFrontmatter } from './frontmatter'
import type { Card } from './inbox'

export const MAX_FINDINGS = 20
export const MAX_TEXT = 500
export const MAX_DIFF_BYTES = 200_000

const Text = z.string().min(1).max(MAX_TEXT)
export const AuditFinding = z
  .object({
    claim: Text,
    actual: Text,
    file: z.string().max(MAX_TEXT),
    line: z.number().int().min(1),
    severity: z.enum(['high', 'medium', 'low']),
  })
  .strict()
export type AuditFinding = z.infer<typeof AuditFinding>
const AuditOutput = z
  .object({
    findings: z.array(AuditFinding).max(MAX_FINDINGS),
    summary: z.string().max(MAX_TEXT),
  })
  .strict()

export type ParsedAudit =
  | { ok: true; findings: AuditFinding[]; summary: string }
  | { ok: false; error: string }

/** 마지막 답에서 첫 JSON 객체를 읽는다. 앞뒤 설명이나 코드 울타리는 건너뛴다. */
export function parseAuditOutput(text: string): ParsedAudit {
  const start = text.indexOf('{')
  if (start === -1) return { ok: false, error: '감사관 답에 JSON 객체가 없어요' }
  const json = firstObject(text, start)
  if (json === undefined) return { ok: false, error: '감사관 답의 JSON이 닫히지 않았어요' }
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (e) {
    return { ok: false, error: `감사관 답의 JSON을 읽지 못했어요: ${(e as Error).message}` }
  }
  const res = AuditOutput.safeParse(raw)
  if (!res.success) {
    const first = res.error.issues[0]
    return {
      ok: false,
      error: `감사관 답의 형식이 틀렸어요: ${first?.path.join('.') || '(전체)'} ${first?.message ?? ''}`,
    }
  }
  return { ok: true, findings: res.data.findings, summary: res.data.summary }
}

/** 문자열 안의 중괄호를 건너뛰며 짝이 맞는 첫 객체를 잘라 낸다. */
function firstObject(text: string, start: number): string | undefined {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return undefined
}

/** 근거 경로는 작업 폴더 안의 상대 경로여야 한다. 밖을 가리키면 감사관이 지어낸 근거로 본다. */
export function safeRelPath(p: string): boolean {
  if (p === '' || p.startsWith('/') || p.includes('\\') || /^[A-Za-z]:/.test(p)) return false
  return !p.split('/').some((part) => part === '..')
}

export type AuditorName = 'codex' | 'claude' | 'fake'

/** 작성 계열의 반대 계열. 모르는 계열(fake 등)은 정하지 않는다. */
export function defaultAuditor(author: string | null | undefined): 'codex' | 'claude' | undefined {
  if (author === 'claude') return 'codex'
  if (author === 'codex') return 'claude'
  return undefined
}

/** 데이터 블록 경계. 워커가 쓴 데이터에 같은 글이 있으면 다시 고른다(블록을 닫고 지시를 넣지 못하게). */
export function pickBoundary(inputs: string[], next: () => string): string {
  for (let i = 0; i < 100; i++) {
    const b = `GOTECHY-${next()}`
    if (!inputs.some((s) => s.includes(b))) return b
  }
  throw new Error('데이터와 겹치지 않는 경계를 고르지 못했어요')
}

export function buildAuditPrompt(
  template: string,
  input: { handoff: string; diff: string; verifyLog: string },
  next: () => string,
): string {
  const boundary = pickBoundary([input.handoff, input.diff, input.verifyLog], next)
  const block = (name: string, body: string) => `<<<${boundary} ${name}\n${body}\n${boundary}>>>`
  return template
    .replaceAll('{{BOUNDARY}}', boundary)
    .replace('{{HANDOFF}}', () => block('HANDOFF', input.handoff))
    .replace('{{DIFF}}', () => block('DIFF', input.diff))
    .replace('{{VERIFY_LOG}}', () => block('VERIFY_LOG', input.verifyLog))
}

/** diff가 너무 길면 바이트 기준으로 자른다(글자 중간에서 자르지 않는다). */
export function cutDiff(diff: string, max = MAX_DIFF_BYTES): { text: string; truncated: boolean } {
  const buf = Buffer.from(diff, 'utf8')
  if (buf.length <= max) return { text: diff, truncated: false }
  const cut = new TextDecoder('utf-8', { fatal: false })
    .decode(buf.subarray(0, max))
    .replace(/�+$/, '')
  return { text: `${cut}\n(diff가 200KB를 넘어 잘렸어요)`, truncated: true }
}

export type CheckedFinding = AuditFinding & { confirmed: boolean }

export type AuditRecord = {
  task: string
  handoff_rev: number | null
  at: string
  auditor: { adapter: AuditorName; model: string | null }
  author: { agent: string | null; model: string | null }
  cross_family: boolean
  input: { diff_bytes: number; diff_truncated: boolean; verify_log: boolean }
  findings: number
  confirmed: number
  cost_usd: number | null
}

const SEVERITY: Record<AuditFinding['severity'], string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
}

export function renderAudit(
  record: AuditRecord,
  checked: CheckedFinding[],
  summary: string,
): string {
  const one = (s: string) => s.replace(/\s*\n\s*/g, ' ')
  const items = checked.map(
    (f) =>
      `- [${SEVERITY[f.severity]}] \`${one(f.file)}:${f.line}\` ${f.confirmed ? '근거 확인됨' : '근거 확인 안 됨'}\n  - 주장: ${one(f.claim)}\n  - 실제: ${one(f.actual)}`,
  )
  const body = [
    '## 지적',
    items.length > 0 ? items.join('\n') : '없음',
    '',
    '## 감사관 요약',
    one(summary) || '없음',
    '',
  ].join('\n')
  return serializeFrontmatter(record as unknown as Record<string, unknown>, body)
}

/** 인박스 카드에 감사 기록을 붙인다. 판본이 다르면 지난 판본 기준이라고만 보여 준다. */
export function attachAudit(
  c: Card,
  record: { handoff_rev: number | null; confirmed: number },
): Card {
  const rev = c.handoff?.rev ?? null
  return { ...c, audit: { current: record.handoff_rev === rev, confirmed: record.confirmed } }
}
