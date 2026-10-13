// 게이트 파일 열기, 결정, 검증, run과 accept의 강제(contract.md 6절, 9절). 게이트는 리드와 decide만 쓴다.
// 필요한 게이트는 원천(작업 명세, 현재 HANDOFF)에서 정한다. 게이트 파일 목록에서 정하면 파일을 지우거나
// 깨뜨리는 것만으로 검사를 피할 수 있다(fail-open, 보안 감사 2026-10-14 높음 3).
import { randomBytes } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { parseDecisions } from '../core/decisions'
import { parseFrontmatter, serializeFrontmatter } from '../core/frontmatter'
import {
  APPROVAL_OPTIONS,
  type Gate,
  type GateClass,
  GateFrontmatter,
  GateId,
  isSuperseded,
  judgeGate,
  type LedgerEntry,
  sha256,
  signingPayload,
  signPayload,
  taskSpecDigest,
  type Verdict,
  type VerifyContext,
} from '../core/gate'
import { displayText } from '../core/inbox'
import { impliesIrreversible } from '../core/paths'
import { HandoffFrontmatter, TaskFrontmatter } from '../core/schema'
import { extractSections, isNone, topItems } from '../core/sections'
import { loadActiveKey } from './keys'
import {
  allocateGateId,
  appendEvent,
  type Project,
  paths,
  projectId,
  updateFrontmatter,
} from './project'

type GateFile = { id: string; file: string; gate?: Gate; body: string; problem?: string }

function readGateFile(file: string): GateFile {
  const id = file.replace(/^.*\/|\.md$/g, '')
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'), file)
  if (!parsed.ok)
    return { id, file, body: '', problem: parsed.issues[0]?.message ?? '읽을 수 없어요' }
  const res = GateFrontmatter.safeParse(parsed.value.data)
  if (!res.success)
    return {
      id,
      file,
      body: parsed.value.body,
      problem: `게이트 형식 오류: ${res.error.issues[0]?.message}`,
    }
  if (res.data.id !== id)
    return { id, file, body: parsed.value.body, problem: `파일 이름과 id(${res.data.id})가 달라요` }
  return { id, file, gate: res.data, body: parsed.value.body }
}

function gateFiles(p: Project): GateFile[] {
  const dir = paths.gates(p)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^G-\d{3,}\.md$/.test(f))
    .sort()
    .map((f) => readGateFile(`${dir}/${f}`))
}

export function listGates(p: Project): Gate[] {
  return gateFiles(p).flatMap((g) => (g.gate ? [g.gate] : []))
}

function serializeGate(gate: Gate, body: string): string {
  return serializeFrontmatter(gate as unknown as Record<string, unknown>, body)
}

/** 결정을 기록할 때: 임시 파일에 쓴 뒤 이름을 바꾼다. 쓰다 멈춰도 반쯤 쓴 게이트가 남지 않는다. */
function replaceGate(p: Project, gate: Gate, body: string): void {
  const file = paths.gate(p, gate.id)
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, serializeGate(gate, body))
  renameSync(tmp, file)
}

/** 새 게이트: 같은 이름의 파일이 이미 있으면 실패한다. 번호가 겹쳐도 남의 게이트를 덮어쓰지 않는다. */
function createGateFile(p: Project, gate: Gate, body: string): void {
  const file = paths.gate(p, gate.id)
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, serializeGate(gate, body))
  try {
    linkSync(tmp, file)
  } finally {
    unlinkSync(tmp)
  }
}

function readText(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

type HandoffState = {
  text: string
  rev: number | undefined
  handoff?: HandoffFrontmatter
  body: string
  bodyLine: number
}

function handoffState(p: Project, taskId: string): HandoffState | undefined {
  const text = readText(paths.handoff(p, taskId))
  if (text === undefined) return undefined
  const parsed = parseFrontmatter(text, taskId)
  if (!parsed.ok) return { text, rev: undefined, body: '', bodyLine: 1 }
  const h = HandoffFrontmatter.safeParse(parsed.value.data)
  const rev = parsed.value.data.rev
  return {
    text,
    rev: typeof rev === 'number' ? rev : undefined,
    ...(h.success ? { handoff: h.data } : {}),
    body: parsed.value.body,
    bodyLine: parsed.value.bodyLine,
  }
}

export function readTask(p: Project, id: string): TaskFrontmatter | undefined {
  const text = readText(paths.task(p, id))
  if (!text) return undefined
  const parsed = parseFrontmatter(text, id)
  if (!parsed.ok) return undefined
  const t = TaskFrontmatter.safeParse(parsed.value.data)
  return t.success ? t.data : undefined
}

/** 명세 값, ownership, 실제로 바뀐 파일 중 하나라도 되돌리기 어려운 경로면 참(contract.md 9.1절). */
export function effectiveIrreversible(task: TaskFrontmatter, changed: string[] = []): boolean {
  return task.irreversible || impliesIrreversible([...task.ownership, ...changed])
}

type Requirement = {
  task: string
  class: GateClass
  question: string
  options: string[]
  recommended: string | null
  handoff_rev: number | null
  irreversible: boolean
}

/** 원천에서 정한, 이 작업에 있어야 하는 게이트. */
function requiredGates(p: Project, task: TaskFrontmatter): Requirement[] {
  const state = handoffState(p, task.id)
  const irreversible = effectiveIrreversible(task, state?.handoff?.changed_files ?? [])
  const reqs: Requirement[] = []
  if (task.gate === 'before')
    reqs.push({
      task: task.id,
      class: 'approval-before',
      question: `${task.id} ${task.title}을 시작할까요?`,
      options: [...APPROVAL_OPTIONS['approval-before']],
      recommended: null,
      handoff_rev: null,
      irreversible,
    })
  if (!state?.handoff || state.rev === undefined) return reqs
  const decisions = parseDecisions(
    extractSections(state.body, state.bodyLine).find((s) => s.title === '결정 필요'),
  ).items
  for (const d of decisions.filter((d) => d.marker === '막는' && (d.options?.length ?? 0) >= 2))
    reqs.push({
      task: task.id,
      class: 'decision',
      question: d.question,
      options: d.options ?? [],
      recommended: d.pick ?? null,
      handoff_rev: state.rev,
      irreversible,
    })
  if (task.gate === 'after' && state.handoff.status === 'done')
    reqs.push({
      task: task.id,
      class: 'approval-after',
      question: `${task.id} ${task.title}의 결과를 승인할까요?`,
      options: [...APPROVAL_OPTIONS['approval-after']],
      recommended: null,
      handoff_rev: state.rev,
      irreversible,
    })
  return reqs
}

const matches = (g: Gate, r: Requirement) =>
  g.task === r.task &&
  g.class === r.class &&
  g.handoff_rev === r.handoff_rev &&
  g.question === r.question

function openFor(p: Project, r: Requirement): Gate {
  projectId(p, true)
  const gate = GateFrontmatter.parse({ id: allocateGateId(p), status: 'pending', ...r })
  const body = [
    `# ${gate.id} ${gate.question}`,
    '',
    `- 작업: ${gate.task}`,
    `- 선택지: ${gate.options.join(', ')}`,
    ...(gate.recommended ? [`- 추천: ${gate.recommended}`] : []),
    '',
    `결정하려면 터미널에서: \`gotechy decide ${gate.id} <선택> ["다음 지시"]\``,
    '',
  ].join('\n')
  createGateFile(p, gate, body)
  appendEvent(p, { type: 'gate.open', gate: gate.id, task: gate.task, class: gate.class })
  return gate
}

/** 필요한 게이트마다 맞는 게이트를 찾고, 없으면 대기 상태로 연다. 같은 요구에는 두 번 열지 않는다. */
export function ensureGates(p: Project, task: TaskFrontmatter): Gate[] {
  const existing = listGates(p)
  return requiredGates(p, task).map((r) => existing.find((g) => matches(g, r)) ?? openFor(p, r))
}

/** run이 HANDOFF를 확정한 뒤 부른다. */
export function openGatesAfterRun(p: Project, task: TaskFrontmatter): Gate[] {
  return ensureGates(p, task).filter((g) => g.class !== 'approval-before' && g.status === 'pending')
}

type Ledger = { entries: LedgerEntry[]; broken: boolean }

function readLedger(p: Project): Ledger {
  const text = readText(paths.ledger(p))
  if (!text) return { entries: [], broken: false }
  const entries: LedgerEntry[] = []
  let broken = false
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      entries.push(JSON.parse(line) as LedgerEntry)
    } catch {
      broken = true
    }
  }
  return { entries, broken }
}

function contextFor(p: Project, gate: Gate, home: string, ledger: Ledger): VerifyContext {
  const key = loadActiveKey(home)
  const state = handoffState(p, gate.task)
  return {
    projectId: projectId(p),
    taskText: readText(paths.task(p, gate.task)),
    handoff: state ? { text: state.text, rev: state.rev } : undefined,
    activeKey: key.ok ? { id: key.id, key: key.key } : undefined,
    ...(key.ok ? {} : { keyProblem: key.problem }),
    ledger: ledger.entries,
    ledgerBroken: ledger.broken,
  }
}

type Snapshot = { gates: Gate[]; broken: GateFile[]; verdicts: Map<string, Verdict> }

/** 게이트 파일을 한 번만 읽고, 판정과 지시문에 같은 값을 쓴다(검증과 사용 사이에 파일이 바뀌는 문제를 줄인다). */
function snapshot(p: Project, home: string): Snapshot {
  const ledger = readLedger(p)
  const files = gateFiles(p)
  const gates: Gate[] = []
  const broken: GateFile[] = []
  const verdicts = new Map<string, Verdict>()
  for (const f of files) {
    if (!f.gate) {
      broken.push(f)
      verdicts.set(f.id, { id: f.id, status: 'fail', reasons: [f.problem ?? '읽을 수 없어요'] })
      continue
    }
    gates.push(f.gate)
    verdicts.set(f.id, judgeGate(f.gate, contextFor(p, f.gate, home, ledger)))
  }
  return { gates, broken, verdicts }
}

export function verifyGates(p: Project, home: string, ids?: string[]): Verdict[] {
  const snap = snapshot(p, home)
  return [...snap.verdicts.values()].filter((v) => !ids || ids.includes(v.id))
}

export type DecideOptions = {
  choice: string
  instruction?: string | null
  /** 오너에게 요약을 보여 주고 확정 여부를 받는다. CLI는 TTY 질문, 테스트는 함수 */
  confirm: (summary: string) => Promise<boolean>
  now?: () => Date
  /** 되돌리기 어려운 결정의 이해 문항에 답을 받는다(contract.md 9.1절). 없으면 그런 결정은 거부한다 */
  answer?: (question: string) => Promise<string>
  /** 테스트용: nonce 재사용 공격을 재현할 때만 쓴다 */
  nonce?: string
}

const GENERIC_QUESTION = '이 작업이 되돌리기 어려운 이유를 자기 말로 설명해 보세요'

type ComprehensionRow = {
  gate: string
  question: string
  answer: string
  keys: string[]
  hits: number
  at: string
}

/** HANDOFF "말해 보기" 질문과 핵심어. HANDOFF가 없거나 질문이 없으면 일반 문항 하나. */
function comprehensionQuestions(
  state: HandoffState | undefined,
): { question: string; keys: string[] }[] {
  if (state?.handoff) {
    const sec = extractSections(state.body, state.bodyLine).find((s) => s.title === '말해 보기')
    const allKeys = state.handoff.comprehension_keys ?? []
    const qs =
      sec && !isNone(sec.content)
        ? topItems(sec).map((l) => displayText(l.text.replace(/^[-*]\s+/, '').trim()))
        : []
    if (qs.length > 0) return qs.map((question, i) => ({ question, keys: allKeys[i] ?? [] }))
  }
  return [{ question: GENERIC_QUESTION, keys: [] }]
}

function firstShown(p: Project, gateId: string): string | undefined {
  const text = readText(paths.events(p))
  if (!text) return undefined
  const times: string[] = []
  for (const l of text.split('\n')) {
    if (!l.includes('"gate.shown"')) continue
    try {
      const e = JSON.parse(l) as { at: string; type: string; gate: string }
      if (e.type === 'gate.shown' && e.gate === gateId) times.push(e.at)
    } catch {
      // 깨진 이벤트 줄은 측정에서만 빠진다
    }
  }
  return times.sort()[0]
}

export async function decideGate(
  p: Project,
  home: string,
  id: string,
  opts: DecideOptions,
): Promise<Gate> {
  // 번호를 경로에 넣기 전에 형식을 본다. `../tasks/T-001` 같은 값으로 게이트 폴더 밖을 가리키지 못하게 한다.
  if (!GateId.safeParse(id).success)
    throw new Error(`게이트 번호 형식이 아니에요: ${id} (예: G-001)`)
  const file = paths.gate(p, id)
  if (!existsSync(file))
    throw new Error(`게이트 ${id}가 없어요 (gotechy inbox로 열린 결정을 보세요)`)
  const lock = `${file}.lock`
  try {
    mkdirSync(lock)
  } catch {
    throw new Error(
      `${id}는 다른 decide가 잠금 중이에요. 그 decide가 끝나지 않았는데 멈춘 것이라면 ${lock} 폴더를 지우세요`,
    )
  }
  // 확인 질문에서 Ctrl-C를 눌러도 잠금이 남지 않게 한다
  const onSigint = () => {
    try {
      rmdirSync(lock)
    } finally {
      process.exit(130)
    }
  }
  process.once('SIGINT', onSigint)
  try {
    return await decideLocked(p, home, id, file, opts)
  } finally {
    process.off('SIGINT', onSigint)
    rmdirSync(lock)
  }
}

async function decideLocked(
  p: Project,
  home: string,
  id: string,
  file: string,
  opts: DecideOptions,
): Promise<Gate> {
  const now = opts.now ?? (() => new Date())
  const gf = readGateFile(file)
  const gate = gf.gate
  if (!gate) throw new Error(`${id}를 읽을 수 없어요: ${gf.problem}`)
  const ledger = readLedger(p)
  const handoff = handoffState(p, gate.task)
  if (isSuperseded(gate, handoff?.rev))
    throw new Error(
      `${id}는 지난 판본(rev ${gate.handoff_rev})의 게이트라 기록으로만 남아요. 지금 판본의 게이트를 결정하세요 (gotechy inbox)`,
    )
  if (
    gate.status === 'resolved' &&
    judgeGate(gate, contextFor(p, gate, home, ledger)).status === 'ok'
  )
    throw new Error(
      `${id}는 이미 결정됐고(${gate.resolution}) 검증도 통과해서 다시 결정할 수 없어요`,
    )
  if (!gate.options.includes(opts.choice))
    throw new Error(`선택은 다음 중 하나여야 해요: ${gate.options.join(', ')}`)
  const key = loadActiveKey(home)
  if (!key.ok) throw new Error(key.problem)
  const pid = projectId(p, true) as string
  const taskText = readText(paths.task(p, gate.task))
  const task = readTask(p, gate.task)
  if (!taskText || !task) throw new Error(`작업 명세(${gate.task})가 없거나 읽을 수 없어요`)
  if (gate.handoff_rev !== null && !handoff) throw new Error(`${gate.task}의 HANDOFF가 없어요`)
  // 게이트 파일의 irreversible만 믿지 않는다. 작업 명세와 경로 규칙으로 다시 계산한다.
  const irreversible =
    gate.irreversible || effectiveIrreversible(task, handoff?.handoff?.changed_files ?? [])

  const shownAt = now()
  const rows: ComprehensionRow[] = []
  if (irreversible) {
    if (!opts.answer)
      throw new Error(
        '되돌리기 어려운 결정이라 이해 문항에 먼저 답해야 해요. 터미널에서 gotechy decide를 실행하면 질문을 보여 줘요',
      )
    for (const q of comprehensionQuestions(gate.handoff_rev !== null ? handoff : undefined)) {
      const answer = await opts.answer(q.question)
      const lower = answer.toLowerCase()
      rows.push({
        gate: id,
        question: q.question,
        answer,
        keys: q.keys,
        hits: q.keys.filter((k) => k.trim() && lower.includes(k.toLowerCase())).length,
        at: now().toISOString(),
      })
    }
  }
  const confirmed = await opts.confirm(decisionSummary(gate, task, handoff, opts))
  const answeredAt = now()
  if (!confirmed) throw new Error('취소했어요. 아무것도 기록하지 않았어요')

  const decided: Gate = {
    ...gate,
    status: 'resolved',
    irreversible,
    resolution: opts.choice,
    instruction: opts.instruction?.trim() || null,
    project_id: pid,
    task_spec_sha256: taskSpecDigest(taskText),
    handoff_sha256: gate.handoff_rev !== null && handoff ? sha256(handoff.text) : null,
    key_id: key.id,
    nonce: opts.nonce ?? randomBytes(16).toString('hex'),
    decided_at: answeredAt.toISOString(),
    opened_at: firstShown(p, id) ?? gate.opened_at ?? shownAt.toISOString(),
    comprehension:
      rows.length > 0
        ? {
            questions: rows.length,
            hits: rows.reduce((n, r) => n + r.hits, 0),
            keys: rows.reduce((n, r) => n + r.keys.length, 0),
          }
        : null,
    active_seconds: Math.max(0, Math.round((answeredAt.getTime() - shownAt.getTime()) / 1000)),
    sig: null,
  }
  decided.sig = signPayload(
    key.key,
    signingPayload({
      project_id: pid,
      task_id: decided.task,
      gate_id: decided.id,
      class: decided.class,
      question: decided.question,
      options: decided.options,
      handoff_rev: decided.handoff_rev,
      irreversible,
      task_spec_sha256: decided.task_spec_sha256 as string,
      handoff_sha256: decided.handoff_sha256,
      choice: opts.choice,
      instruction: decided.instruction,
      key_id: key.id,
      nonce: decided.nonce as string,
      decided_at: decided.decided_at as string,
    }),
  )
  // 소비 기록을 먼저 남긴다. 게이트를 쓰기 전에 멈추면 게이트는 pending으로 남아 다시 결정하면 된다.
  mkdirSync(dirname(paths.ledger(p)), { recursive: true })
  const entry: LedgerEntry = {
    gate: id,
    nonce: decided.nonce as string,
    key_id: key.id,
    decided_at: decided.decided_at as string,
  }
  appendFileSync(paths.ledger(p), `${JSON.stringify(entry)}\n`)
  // 이해 문항의 답과 핵심어는 private에만 남긴다(contract.md 9.1절)
  for (const r of rows) appendFileSync(paths.comprehension(p), `${JSON.stringify(r)}\n`)
  replaceGate(p, decided, gf.body)
  appendEvent(p, { type: 'gate.decided', gate: id, task: gate.task, choice: opts.choice })
  updateTaskAfterDecision(p, task)
  return decided
}

/** 확인 질문에 보여 줄 요약. 질문과 요약은 워커가 쓴 글이라 제어 문자를 지운다. */
function decisionSummary(
  gate: Gate,
  task: TaskFrontmatter,
  handoff: HandoffState | undefined,
  opts: DecideOptions,
): string {
  const sec = handoff
    ? extractSections(handoff.body, handoff.bodyLine).find((s) => s.title === '한 줄 요약')
    : undefined
  const summary = sec?.content.trim().split('\n')[0] ?? ''
  return displayText(
    [
      `${gate.id} (${gate.task} ${task.title})`,
      `질문: ${gate.question}`,
      `선택지: ${gate.options.join(', ')}${gate.recommended ? ` (추천 ${gate.recommended})` : ''}`,
      ...(summary ? [`작업 요약: ${summary}`] : []),
      `고른 것: ${opts.choice}${opts.instruction ? `, 다음 지시: ${opts.instruction}` : ''}`,
    ].join('\n'),
  )
}

/** 현재 HANDOFF의 막는 결정이 모두 닫혔거나 승인 게이트에서 "다시"를 골랐으면 작업을 ready로. */
function updateTaskAfterDecision(p: Project, task: TaskFrontmatter): void {
  const gates = listGates(p)
  const reqs = requiredGates(p, task)
  const resolved = (r: Requirement) =>
    gates.find((g) => matches(g, r) && g.status === 'resolved')?.resolution ?? undefined
  const decisions = reqs.filter((r) => r.class === 'decision')
  if (
    task.status === 'needs-decision' &&
    decisions.length > 0 &&
    decisions.every((r) => resolved(r) !== undefined)
  )
    updateFrontmatter(paths.task(p, task.id), { status: 'ready' })
  const after = reqs.find((r) => r.class === 'approval-after')
  if (after && resolved(after) === '다시')
    updateFrontmatter(paths.task(p, task.id), { status: 'ready' })
}

export type OwnerDecision = {
  gate: string
  question: string
  choice: string
  instruction: string | null
}

type GateStatus = { gate: Gate; verdict: Verdict | undefined }

function describe(s: GateStatus): string {
  const g = s.gate
  if (!s.verdict || s.verdict.status === 'pending')
    return `${g.id} 결정 대기: ${g.question} (gotechy decide ${g.id} ${g.options.join('|')})`
  return `${g.id} 검증 실패: ${s.verdict.reasons.join(', ')} (gotechy gate verify ${g.id}로 확인하고 다시 결정하세요)`
}

const usable = (s: GateStatus) => s.verdict?.status === 'ok'
/** 승인 계열 게이트에서 "앞으로 가도 된다"는 선택 */
const PASSING: Partial<Record<GateClass, string>> = {
  'approval-before': '진행',
  'approval-after': '승인',
}

/** 작업의 필요한 게이트를 모두 열고 상태를 돌려준다. 읽을 수 없는 게이트 파일이 있으면 그것도 막는 사유다. */
function requiredStatus(
  p: Project,
  home: string,
  task: TaskFrontmatter,
): { statuses: GateStatus[]; broken: string[] } {
  const gates = ensureGates(p, task)
  const snap = snapshot(p, home)
  const byId = new Map(snap.gates.map((g) => [g.id, g]))
  return {
    statuses: gates.map((g) => ({ gate: byId.get(g.id) ?? g, verdict: snap.verdicts.get(g.id) })),
    broken: snap.broken.map(
      (f) =>
        `게이트 파일 ${f.id}를 읽을 수 없어요: ${f.problem}. 고치거나 지울지 오너가 정해야 해요`,
    ),
  }
}

/** run 전에: 멈춰야 할 사유와, 워커에게 넘길 오너 결정(contract.md 6.6절). */
export function gateCheck(
  p: Project,
  home: string,
  task: TaskFrontmatter,
): { blockers: string[]; decisions: OwnerDecision[] } {
  const { statuses, broken } = requiredStatus(p, home, task)
  const blockers = [...broken]
  const decisions: OwnerDecision[] = []
  for (const s of statuses) {
    if (!usable(s)) {
      blockers.push(describe(s))
      continue
    }
    const g = s.gate
    if (g.class === 'approval-before' && g.resolution !== PASSING['approval-before']) {
      blockers.push(
        `${g.id}에서 오너가 "${g.resolution}"을 골랐어요. 다시 하려면 작업 명세를 고치세요. 명세가 바뀌면 이 결정은 무효가 되고 같은 게이트를 다시 결정할 수 있어요`,
      )
      continue
    }
    decisions.push({
      gate: g.id,
      question: g.question,
      choice: g.resolution as string,
      instruction: g.instruction,
    })
  }
  for (const dep of task.deps) {
    const depTask = readTask(p, dep)
    // 선행 작업의 변경이 메인에 병합돼 있어야 뒤 작업이 그 결과 위에서 일한다(contract.md 3절)
    if (!depTask) {
      blockers.push(`선행 작업 ${dep}의 명세가 없거나 읽을 수 없어요`)
      continue
    }
    if (depTask.status === 'done')
      blockers.push(
        `선행 작업 ${dep}가 아직 병합되지 않았어요. 결과를 확인하고 gotechy accept ${dep}를 실행하세요`,
      )
    else if (depTask.status !== 'accepted')
      blockers.push(`선행 작업 ${dep}가 끝나지 않았어요 (현재 ${depTask.status})`)
    for (const s of requiredStatus(p, home, depTask).statuses) {
      const pass = PASSING[s.gate.class]
      if (!usable(s)) blockers.push(`선행 작업 ${dep}: ${describe(s)}`)
      else if (pass && s.gate.resolution !== pass)
        blockers.push(`선행 작업 ${dep}: ${s.gate.id}에서 "${s.gate.resolution}"을 골랐어요`)
    }
  }
  return { blockers, decisions }
}

/** accept 전에: 필요한 게이트가 모두 ok이고 승인 계열은 통과 선택이어야 한다(contract.md 9.4절). */
export function acceptBlockers(p: Project, home: string, task: TaskFrontmatter): string[] {
  const { statuses, broken } = requiredStatus(p, home, task)
  const blockers = [...broken]
  for (const s of statuses) {
    const pass = PASSING[s.gate.class]
    if (!usable(s)) blockers.push(describe(s))
    else if (pass && s.gate.resolution !== pass)
      blockers.push(`${s.gate.id}에서 "${s.gate.resolution}"을 골라 병합하지 않아요`)
  }
  return blockers
}
