// 게이트 파일 열기, 결정, 검증, run과 accept의 강제(contract.md 6절, 9절). 게이트는 리드와 decide만 쓴다.
// 필요한 게이트는 원천(작업 명세, 현재 HANDOFF)에서 정한다. 게이트 파일 목록에서 정하면 파일을 지우거나
// 깨뜨리는 것만으로 검사를 피할 수 있다(fail-open, 보안 감사 2026-10-14 높음 3).
import { randomBytes } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
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
  ledgerLinePayload,
  ledgerSigned,
  parsePinnedKey,
  sha256,
  signingPayload,
  taskSpecDigest,
  type Verdict,
  type VerifyContext,
  verifySignature,
} from '../core/gate'
import { displayText } from '../core/inbox'
import { impliesIrreversible } from '../core/paths'
import { HandoffFrontmatter, TaskFrontmatter } from '../core/schema'
import { extractSections, isNone, topItems } from '../core/sections'
import { loadOwnerKey, ownerPub, signWithOwnerKey } from './keys'
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
  return parseGateText(file, readFileSync(file, 'utf8'))
}

/** 이미 읽은 문자열에서 게이트를 읽는다. 해시를 잴 문자열과 결정에 쓸 값이 같은 읽기에서 나오게 한다(감사 8차 낮음 5) */
function parseGateText(file: string, text: string): GateFile {
  const id = file.replace(/^.*\/|\.md$/g, '')
  const parsed = parseFrontmatter(text, file)
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
/**
 * 같은 폴더의 임시 파일 이름. 난수를 붙이고 'wx'로 만들어, 미리 심어 둔 링크를 따라 저장소 밖 파일을 쓰지 않는다
 * (보안 감사 11차 중간 2).
 */
const tmpName = (file: string) => `${file}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`

function replaceGate(p: Project, gate: Gate, body: string): void {
  const file = paths.gate(p, gate.id)
  const tmp = tmpName(file)
  writeFileSync(tmp, serializeGate(gate, body), { flag: 'wx' })
  renameSync(tmp, file)
}

/** 새 게이트: 같은 이름의 파일이 이미 있으면 실패한다. 번호가 겹쳐도 남의 게이트를 덮어쓰지 않는다. */
function createGateFile(p: Project, gate: Gate, body: string): void {
  const file = paths.gate(p, gate.id)
  mkdirSync(dirname(file), { recursive: true })
  const tmp = tmpName(file)
  writeFileSync(tmp, serializeGate(gate, body), { flag: 'wx' })
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
  return text ? parseTaskText(id, text) : undefined
}

function parseTaskText(id: string, text: string): TaskFrontmatter | undefined {
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

/** 보이지 않는 글자, 공백, 호환 글자를 지운 모양. 이 모양이 같은 선택지는 화면과 Touch ID 창에서 구분되지 않는다 */
const looks = (o: string) => o.normalize('NFKC').replace(/[\p{Cc}\p{Cf}\s]/gu, '')

function openFor(p: Project, r: Requirement): Gate {
  const shapes = r.options.map(looks)
  if (new Set(shapes).size !== shapes.length || shapes.some((x) => x === ''))
    throw new Error(
      `${r.task}의 결정 "${displayText(r.question)}"의 선택지가 화면에서 서로 구분되지 않아요(보이지 않는 글자나 공백만 다름). 게이트를 열지 않았어요. HANDOFF의 선택지를 고치게 하세요`,
    )
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

type Ledger = { entries: LedgerEntry[]; broken: boolean; problem?: string }

function parseLedger(text: string): Ledger {
  if (!text) return { entries: [], broken: false }
  const entries: LedgerEntry[] = []
  let broken = false
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      // 객체가 아니거나 필드가 문자열이 아니면 깨진 줄이다(보안 감사 6차 낮음 4: null 줄에서 예외로 멈췄다)
      const r = JSON.parse(line) as Record<string, unknown> | null
      if (
        r === null ||
        typeof r !== 'object' ||
        Array.isArray(r) ||
        !['gate', 'nonce', 'key_id', 'decided_at'].every((k) => typeof r[k] === 'string')
      )
        broken = true
      else entries.push(r as unknown as LedgerEntry)
    } catch {
      broken = true
    }
  }
  return { entries, broken }
}

// TD-013: 프로젝트에 고정한 오너 공개 키. 검증은 이 키로 한다. 홈의 키를 사람 확인 없는 키로 바꾸는 것만으로는
// 결정을 만들 수 없고, 고정 파일까지 바꾸면 커밋된 파일이 바뀌어 git diff에 드러난다.
type Pin = { pinned?: { id: string; pub: string }; missing: boolean; problem?: string }

const PIN_MISSING =
  '이 프로젝트에 고정된 오너 키(orchestration/owner.pub)가 없어요. 키를 바꿨거나 파일을 잃었다면 확인한 뒤 터미널에서 gotechy keys pin을 실행하세요'

function readPin(p: Project): Pin {
  const f = paths.ownerPin(p)
  const st = lstatSync(f, { throwIfNoEntry: false })
  if (!st) return { missing: true, problem: PIN_MISSING }
  if (!st.isFile())
    return {
      missing: false,
      problem: '고정된 오너 키 파일(orchestration/owner.pub)이 일반 파일이 아니에요',
    }
  const pinned = parsePinnedKey(readFileSync(f, 'utf8'))
  return pinned
    ? { pinned, missing: false }
    : {
        missing: false,
        problem:
          '고정된 오너 키 파일(orchestration/owner.pub)의 형식이 틀렸어요. P-256 공개 키 한 줄이어야 해요',
      }
}

function writePin(p: Project, pub: string): void {
  const f = paths.ownerPin(p)
  const tmp = tmpName(f)
  writeFileSync(tmp, `${pub}\n`, { flag: 'wx' })
  renameSync(tmp, f)
}

// TD-014: 장부 끝 기록. 장부 파일 전체의 줄 수와 해시를 이 폴더 몫으로 $GOTECHY_HOME/owner/heads/에 따로 둔다.
// 프로젝트만 쓸 수 있는 쪽이 장부 줄을 지우거나(끝줄, 가운데 줄) 바꾸면 끝 기록과 달라진다.
type Head = { lines: number; sha256: string }

const HEAD_MISSING =
  '이 폴더의 장부 끝 기록이 없어요. 폴더를 옮겼거나 다른 컴퓨터라면 장부를 확인한 뒤 터미널에서 gotechy keys pin으로 다시 기록하세요'

function realRoot(root: string): string {
  try {
    return realpathSync(root)
  } catch {
    return root
  }
}

export function ledgerHeadFile(home: string, root: string): string {
  return join(home, 'owner', 'heads', `${sha256(realRoot(root)).slice(0, 32)}.json`)
}

function readHead(home: string, root: string): Head | 'missing' | 'bad' {
  const f = ledgerHeadFile(home, root)
  const st = lstatSync(f, { throwIfNoEntry: false })
  if (!st) return 'missing'
  if (!st.isFile()) return 'bad'
  try {
    const h = JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown> | null
    if (
      h !== null &&
      typeof h === 'object' &&
      Number.isInteger(h.lines) &&
      (h.lines as number) >= 0 &&
      typeof h.sha256 === 'string' &&
      /^[0-9a-f]{64}$/.test(h.sha256)
    )
      return { lines: h.lines as number, sha256: h.sha256 }
  } catch {}
  return 'bad'
}

const countLines = (text: string) => text.split('\n').filter((l) => l.trim()).length

function headProblem(home: string, root: string, text: string): string | undefined {
  return headProblemFor(readHead(home, root), text)
}

function headProblemFor(head: Head | 'missing' | 'bad', text: string): string | undefined {
  if (head === 'missing') return countLines(text) === 0 ? undefined : HEAD_MISSING
  if (head === 'bad')
    return '이 폴더의 장부 끝 기록을 읽을 수 없어요. 장부를 확인한 뒤 터미널에서 gotechy keys pin으로 다시 기록하세요'
  // 해시가 줄 수까지 덮는다. lines는 사람이 읽으라고 남긴다
  if (head.sha256 !== sha256(text))
    return '결정 장부가 이 폴더의 장부 끝 기록과 달라요. 장부 줄이 지워졌거나 바뀌었어요'
  return undefined
}

function writeHead(home: string, root: string, text: string): void {
  const f = ledgerHeadFile(home, root)
  mkdirSync(dirname(f), { recursive: true, mode: 0o700 })
  const tmp = `${f}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`
  writeFileSync(
    tmp,
    JSON.stringify({ root: realRoot(root), lines: countLines(text), sha256: sha256(text) }),
    { mode: 0o600, flag: 'wx' },
  )
  renameSync(tmp, f)
}

/** 장부에 줄을 더하고 끝 기록을 고치는 동안만 잡는 잠금. 오너 확인(Touch ID)을 기다리는 동안에는 잡지 않는다. */
async function withLedgerLock<T>(p: Project, fn: () => T): Promise<T> {
  const lock = `${paths.ledger(p)}.lock`
  mkdirSync(dirname(lock), { recursive: true })
  for (let i = 0; ; i++) {
    try {
      mkdirSync(lock)
      break
    } catch {
      if (i >= 150)
        throw new Error(
          `결정 장부를 다른 decide가 쓰는 중이에요. 그 decide가 멈춘 것이라면 ${lock} 폴더를 지우세요. 아무것도 기록하지 않았어요`,
        )
      await Bun.sleep(20)
    }
  }
  try {
    return fn()
  } finally {
    // 잠금 폴더를 누가 지웠거나 안에 파일을 넣어도, 이미 끝낸 기록을 실패로 바꾸지 않는다(감사 11차 낮음 3)
    try {
      rmdirSync(lock)
    } catch {}
  }
}

/** 장부를 원래 내용으로 되돌린다. 줄을 더한 뒤 끝 기록을 쓰지 못했을 때 쓴다 */
function restoreLedger(p: Project, text: string): void {
  const f = paths.ledger(p)
  const tmp = tmpName(f)
  writeFileSync(tmp, text, { flag: 'wx' })
  renameSync(tmp, f)
}

/**
 * 끝 기록, 장부, 끝 기록 순서로 읽어 둘이 같은 순간의 값인지 본다. 다른 decide가 그사이에 줄을 더했으면
 * 다시 읽는다(감사 11차 낮음 4: 따로 읽어 거짓 경보가 났다).
 */
function readLedgerAndHead(
  p: Project,
  home: string,
): { text: string; head: Head | 'missing' | 'bad' } {
  let head = readHead(home, p.root)
  for (let i = 0; ; i++) {
    const text = readText(paths.ledger(p)) ?? ''
    const again = readHead(home, p.root)
    if (JSON.stringify(again) === JSON.stringify(head) || i >= 3) return { text, head: again }
    head = again
  }
}

/**
 * 장부를 읽고, 줄마다 그 줄의 키로 서명이 맞는지 본다. 하나라도 어긋나면 장부 전체를 믿지 않는다(contract.md 6.3절).
 * 고정 키의 줄은 고정 파일의 공개 키로 본다. 장부가 이 폴더의 끝 기록과 다르면 problem(TD-014).
 */
function readSignedLedger(p: Project, home: string, pinned?: { id: string; pub: string }): Ledger {
  const { text, head } = readLedgerAndHead(p, home)
  const ledger = parseLedger(text)
  const signed = ledgerSigned(ledger.entries, (id) =>
    id === pinned?.id ? pinned.pub : ownerPub(home, id),
  )
  const problem = headProblemFor(head, text)
  return {
    entries: ledger.entries,
    broken: ledger.broken || !signed,
    ...(problem ? { problem } : {}),
  }
}

function contextFor(p: Project, gate: Gate, ledger: Ledger, pin: Pin): VerifyContext {
  const state = handoffState(p, gate.task)
  return {
    projectId: projectId(p),
    taskText: readText(paths.task(p, gate.task)),
    handoff: state ? { text: state.text, rev: state.rev } : undefined,
    pinned: pin.pinned,
    ...(pin.problem ? { pinProblem: pin.problem } : {}),
    ledger: ledger.entries,
    ledgerBroken: ledger.broken,
    ...(ledger.problem ? { ledgerProblem: ledger.problem } : {}),
  }
}

type Snapshot = { gates: Gate[]; broken: GateFile[]; verdicts: Map<string, Verdict> }

/** 게이트 파일을 한 번만 읽고, 판정과 지시문에 같은 값을 쓴다(검증과 사용 사이에 파일이 바뀌는 문제를 줄인다). */
function snapshot(p: Project, home: string): Snapshot {
  const pin = readPin(p)
  const ledger = readSignedLedger(p, home, pin.pinned)
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
    verdicts.set(f.id, judgeGate(f.gate, contextFor(p, f.gate, ledger, pin)))
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
  /**
   * 결정의 nonce. 주지 않으면 만든다. serve와 CLI는 미리 만들어 확인 코드(앞 4자리)를 화면과 Touch ID 창에
   * 함께 보여 준다(감사 8차 중간 5). 테스트는 nonce 재사용 공격을 재현할 때 쓴다
   */
  nonce?: string
  /** 화면(serve)에서 결정 화면을 보여 준 시각. active_seconds를 화면 기준으로 잰다(contract.md 8.3절) */
  shownAt?: Date
  /** 화면을 그릴 때의 gateView 값. 잠금을 잡은 뒤 다시 계산해 다르면 기록하지 않는다(낡은 화면 거부) */
  expectView?: string
}

/** 화면을 그린 뒤 게이트, 작업 명세, HANDOFF가 바뀌었다 */
export class StaleViewError extends Error {}

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

function viewDigest(
  gateText: string,
  taskText: string | undefined,
  handoff: HandoffState | undefined,
): string {
  return sha256(
    JSON.stringify({
      gate: gateText,
      task: taskText === undefined ? null : taskSpecDigest(taskText),
      handoff: handoff ? sha256(handoff.text) : null,
    }),
  )
}

/** 결정 화면에 보여 줄 것: 게이트, 이해 문항(되돌리기 어려울 때), 낡은 화면을 알아챌 값(contract.md 8.3절) */
export type GateView = {
  gate: Gate
  title: string
  summary: string
  questions: string[]
  view: string
  /** 화면에 보여 줄 HANDOFF 해시 앞 12자리(HANDOFF가 없으면 null) */
  handoffSha: string | null
  autonomy: TaskFrontmatter['autonomy'] | undefined
  budgetUsd: number | undefined
}

export function gateView(p: Project, id: string): GateView | undefined {
  if (!GateId.safeParse(id).success) return undefined
  const file = paths.gate(p, id)
  const text = readText(file)
  if (text === undefined) return undefined
  const gate = readGateFile(file).gate
  if (!gate) return undefined
  const taskText = readText(paths.task(p, gate.task))
  const task = readTask(p, gate.task)
  const handoff = handoffState(p, gate.task)
  const current = gate.handoff_rev !== null ? handoff : undefined
  const irreversible =
    gate.irreversible ||
    (task ? effectiveIrreversible(task, handoff?.handoff?.changed_files ?? []) : false)
  const sec = current
    ? extractSections(current.body, current.bodyLine).find((x) => x.title === '한 줄 요약')
    : undefined
  return {
    gate,
    title: task?.title ?? '(작업 명세 없음)',
    summary: sec?.content.trim().split('\n')[0] ?? '',
    questions: irreversible ? comprehensionQuestions(current).map((q) => q.question) : [],
    view: viewDigest(text, taskText, handoff),
    handoffSha: current ? sha256(current.text).slice(0, 12) : null,
    autonomy: task?.autonomy,
    budgetUsd: task?.budget_usd,
  }
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
  // 확인 질문에서 Ctrl-C를 눌러도 잠금이 남지 않게 한다. serve는 여러 decide를 함께 돌릴 수 있어서,
  // 처리기 하나가 잡고 있는 잠금을 모두 풀고 끝낸다(감사 8차 낮음 7)
  heldLocks.add(lock)
  if (heldLocks.size === 1) process.once('SIGINT', releaseLocksAndExit)
  try {
    return await decideLocked(p, home, id, file, opts)
  } finally {
    heldLocks.delete(lock)
    if (heldLocks.size === 0) process.off('SIGINT', releaseLocksAndExit)
    rmdirSync(lock)
  }
}

/** 이 nonce의 장부 줄이 있는가. serve가 기록 뒤 오류를 구분할 때 쓴다(감사 11차 낮음 3) */
export function nonceInLedger(p: Project, nonce: string): boolean {
  return parseLedger(readText(paths.ledger(p)) ?? '').entries.some((e) => e.nonce === nonce)
}

/**
 * `gotechy keys pin`: 이 맥의 오너 키를 프로젝트에 고정하고, 이 폴더의 장부 끝 기록을 지금 장부로 다시 쓴다(TD-013, TD-014).
 * 키를 바꾼 뒤, 다른 컴퓨터나 옮긴 폴더에서 쓴다. 지금 상태를 보여 주고 오너가 확정해야 바꾼다.
 */
export async function pinOwner(
  p: Project,
  home: string,
  opts: { confirm: (summary: string) => Promise<boolean> },
): Promise<{ keyId: string; previous: string | undefined }> {
  const key = loadOwnerKey(home)
  if (!key.ok) throw new Error(key.problem)
  const pin = readPin(p)
  const { text, head } = readLedgerAndHead(p, home)
  const ledger = parseLedger(text)
  const signed = ledgerSigned(ledger.entries, (id) =>
    id === pin.pinned?.id ? pin.pinned.pub : ownerPub(home, id),
  )
  // 장부에서 온 값은 형식을 본 것만 보여 준다. 줄바꿈을 넣어 가짜 줄을 끼우지 못하게 한다(감사 11차 낮음 2)
  const last = ledger.entries.at(-1)
  const lastShown = last
    ? `${GateId.safeParse(last.gate).success ? last.gate : '(형식이 틀린 게이트)'}, ${/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(String(last.decided_at)) ? last.decided_at : '(형식이 틀린 시각)'}`
    : ''
  const summary = [
    `프로젝트: ${projectId(p) ?? '(아직 없음)'}`,
    `고정된 오너 키: ${pin.pinned?.id ?? (pin.missing ? '없음' : '읽을 수 없음')}`,
    `이 맥의 오너 키: ${key.id}`,
    `결정 장부: ${countLines(text)}줄${last ? ` (마지막 줄: ${lastShown})` : ''}`,
    `장부 서명: ${ledger.broken || !signed ? '읽을 수 없거나 서명이 맞지 않는 줄이 있어요' : '모든 줄이 맞아요'}`,
    `장부 끝 기록: ${headProblemFor(head, text) ?? '장부와 맞아요'}`,
    '이 맥의 키를 이 프로젝트에 고정하고, 장부 끝 기록을 지금 보인 장부로 다시 써요. 고정 키가 바뀌면 이전 키의 결정은 다시 결정해야 해요.',
    '장부 줄이 지워진 것 같다면 확정하지 말고 원인부터 보세요.',
  ].join('\n')
  if (!(await opts.confirm(summary))) throw new Error('취소했어요. 아무것도 바꾸지 않았어요')
  // 오너가 본 장부와 지금 장부가 같을 때만 믿는다(감사 11차 낮음 1). 끝 기록을 먼저 쓰고 고정 파일을 쓴다
  await withLedgerLock(p, () => {
    if (sha256(readText(paths.ledger(p)) ?? '') !== sha256(text))
      throw new Error(
        '확인하는 사이에 결정 장부가 바뀌었어요. 아무것도 바꾸지 않았어요. 다시 실행하세요',
      )
    writeHead(home, p.root, text)
    writePin(p, key.pub)
  })
  appendEvent(p, { type: 'owner.pinned', key: key.id, previous: pin.pinned?.id ?? null })
  return { keyId: key.id, previous: pin.pinned?.id }
}

const heldLocks = new Set<string>()
function releaseLocksAndExit(): void {
  try {
    for (const l of heldLocks) rmdirSync(l)
  } finally {
    process.exit(130)
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
  const gateText = readText(file)
  const gf = gateText === undefined ? undefined : parseGateText(file, gateText)
  const gate = gf?.gate
  if (!gate) throw new Error(`${id}를 읽을 수 없어요: ${gf?.problem ?? '파일이 없어요'}`)
  const pin = readPin(p)
  const ledger = readSignedLedger(p, home, pin.pinned)
  const handoff = handoffState(p, gate.task)
  if (isSuperseded(gate, handoff?.rev))
    throw new Error(
      `${id}는 지난 판본(rev ${gate.handoff_rev})의 게이트라 기록으로만 남아요. 지금 판본의 게이트를 결정하세요 (gotechy inbox)`,
    )
  if (
    gate.status === 'resolved' &&
    judgeGate(gate, contextFor(p, gate, ledger, pin)).status === 'ok'
  )
    throw new Error(
      `${id}는 이미 결정됐고(${gate.resolution}) 검증도 통과해서 다시 결정할 수 없어요`,
    )
  if (!gate.options.includes(opts.choice))
    throw new Error(`선택은 다음 중 하나여야 해요: ${gate.options.join(', ')}`)
  const key = loadOwnerKey(home)
  if (!key.ok) throw new Error(key.problem)
  // TD-013: 고정 키와 이 맥의 키가 같아야 한다. 고정 파일이 없으면 결정 기록이 하나도 없을 때만 처음 고정한다
  let pinNow = false
  if (pin.pinned) {
    if (pin.pinned.id !== key.id)
      throw new Error(
        `이 프로젝트에 고정된 오너 키(${pin.pinned.id})와 이 맥의 오너 키(${key.id})가 달라요. 키를 바꿨다면 확인한 뒤 터미널에서 gotechy keys pin으로 다시 고정하세요. 아무것도 기록하지 않았어요`,
      )
  } else if (
    !pin.missing ||
    ledger.entries.length > 0 ||
    ledger.broken ||
    listGates(p).some((g) => g.status === 'resolved')
  )
    throw new Error(`${pin.problem}. 아무것도 기록하지 않았어요`)
  else pinNow = true
  // TD-014: 장부가 끝 기록과 다르면 결정을 더하지 않는다(지워진 줄 위에 쌓지 않는다)
  if (ledger.problem) throw new Error(`${ledger.problem}. 아무것도 기록하지 않았어요`)
  const pid = projectId(p, true) as string
  const taskText = readText(paths.task(p, gate.task))
  const task = taskText ? parseTaskText(gate.task, taskText) : undefined
  if (!taskText || !task) throw new Error(`작업 명세(${gate.task})가 없거나 읽을 수 없어요`)
  if (gate.handoff_rev !== null && !handoff) throw new Error(`${gate.task}의 HANDOFF가 없어요`)
  if (
    opts.expectView !== undefined &&
    viewDigest(gateText ?? '', taskText, handoff) !== opts.expectView
  )
    throw new StaleViewError(
      `${id}의 화면을 그린 뒤 게이트, 작업 명세, HANDOFF 중 하나가 바뀌었어요. 아무것도 기록하지 않았어요. 새로 고침해서 다시 보세요`,
    )
  // 게이트 파일의 irreversible만 믿지 않는다. 작업 명세와 경로 규칙으로 다시 계산한다.
  const irreversible =
    gate.irreversible || effectiveIrreversible(task, handoff?.handoff?.changed_files ?? [])

  const shownAt = opts.shownAt ?? now()
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
  const payload = signingPayload({
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
  })
  const entry: LedgerEntry = {
    gate: id,
    nonce: decided.nonce as string,
    key_id: key.id,
    decided_at: decided.decided_at as string,
    payload_sha256: sha256(payload),
  }
  // 게이트 서명과 장부 줄 서명을 한 번의 오너 확인(Touch ID)으로 받는다. 창 문구는 서명 도구가 서명 대상에서 만든다
  const [gateSig, lineSig] = await signWithOwnerKey(home, payload, ledgerLinePayload(entry))
  if (
    !gateSig ||
    !lineSig ||
    !verifySignature(key.pub, payload, gateSig) ||
    !verifySignature(key.pub, ledgerLinePayload(entry), lineSig)
  )
    throw new Error(
      '서명 도구가 돌려준 서명이 오너 공개 키로 검증되지 않아요. 아무것도 기록하지 않았어요',
    )
  decided.sig = gateSig
  entry.sig = lineSig
  // 소비 기록을 먼저 남긴다. 게이트를 쓰기 전에 멈추면 게이트는 pending으로 남아 다시 결정하면 된다.
  // 장부 줄과 끝 기록은 잠금 아래에서 함께 고친다. 오너 확인을 기다리는 사이에 다른 결정이 줄을 더했을 수 있어 다시 대조한다
  await withLedgerLock(p, () => {
    const text = readText(paths.ledger(p)) ?? ''
    const problem = headProblem(home, p.root, text)
    if (problem) throw new Error(`${problem}. 아무것도 기록하지 않았어요`)
    if (pinNow) {
      const now = readPin(p)
      if (now.pinned?.id !== key.id && !now.missing)
        throw new Error(
          `${now.problem ?? '고정된 오너 키가 바뀌었어요'}. 아무것도 기록하지 않았어요`,
        )
      if (now.missing) writePin(p, key.pub)
    }
    // 끝 기록은 다시 읽은 파일이 아니라 기대하는 내용(읽은 장부 + 이 줄)으로 쓴다. 끝 기록을 쓰지 못하면 장부를 되돌린다
    const line = `${JSON.stringify(entry)}\n`
    appendFileSync(paths.ledger(p), line)
    try {
      writeHead(home, p.root, text + line)
    } catch (e) {
      restoreLedger(p, text)
      throw new Error(
        `장부 끝 기록을 쓰지 못해 장부를 되돌렸어요. 아무것도 기록하지 않았어요: ${(e as Error).message}`,
      )
    }
  })
  // 이해 문항의 답과 핵심어는 private에만 남긴다(contract.md 9.1절)
  for (const r of rows) appendFileSync(paths.comprehension(p), `${JSON.stringify(r)}\n`)
  replaceGate(p, decided, gf?.body ?? '')
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
