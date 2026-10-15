// gotechy loop: 무인 루프(contract.md 11절, 1b N3). 결과를 만들기만 하고 결정과 반영(decide, accept, push)은 하지 않는다.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { parseFrontmatter } from '../core/frontmatter'
import { displayText, formatInbox } from '../core/inbox'
import { HandoffFrontmatter, type TaskFrontmatter } from '../core/schema'
import { extractSections } from '../core/sections'
import { gateCheck, listGates, readTask } from './gates'
import { loadCards } from './inbox'
import { appendEvent, linkedPaths, type Project, paths, updateFrontmatter } from './project'
import { type RunOutcome, rewriteAllowance } from './run'

export type LoopOutcome = 'done' | 'needs-decision' | 'waiting' | 'stopped' | 'budget'
export type LoopResult = {
  task: string
  outcome: LoopOutcome
  attempts: number
  costUsd: number
  reason?: string
}
export type LoopReport = { digest: string; results: LoopResult[] }
export type LoopOptions = {
  home: string
  /** 작업 하나를 돌린다. CLI는 runTask, 테스트는 녹화 재생 */
  run: (taskId: string) => Promise<RunOutcome>
  budgetUsd?: number
  maxAttempts?: number
  reset?: boolean
  log?: (s: string) => void
  now?: () => Date
}

const TaskState = z.object({
  attempts: z.number().int().nonnegative(),
  lastFailure: z.string().optional(),
  stopped: z.string().optional(),
  costUsd: z.number().nonnegative().optional(),
})
type TaskState = z.infer<typeof TaskState>
/** 상태 파일은 손이나 저장소로 바뀔 수 있어 읽을 때 검증한다(보안 감사 9차 낮음 9). 키는 작업 번호만 */
const State = z.object({ tasks: z.record(z.string().regex(/^T-\d{3,}$/), TaskState) })
type State = z.infer<typeof State>

const LOOP_LEVELS = new Set(['L2', 'L3'])
const DEFAULT_BUDGET = 5
const DEFAULT_ATTEMPTS = 3
/** CLI가 받는 예산 상한(달러) */
export const LOOP_BUDGET_CAP = 50
/** 아주 작은 budget_usd로 예산 계산을 피하지 못하게 시도마다 최소한 이만큼 예약한다(보안 감사 9차 낮음 6) */
const MIN_RESERVE = 0.1

const loopDir = (p: Project) => join(p.root, '.gotechy', 'loop')
const stateFile = (p: Project) => join(loopDir(p), 'state.json')

function readState(p: Project): State {
  try {
    const r = State.safeParse(JSON.parse(readFileSync(stateFile(p), 'utf8')))
    return r.success ? r.data : { tasks: {} }
  } catch {
    return { tasks: {} }
  }
}

/** 링크를 따라가지 않게 임시 파일에 쓰고 이름을 바꾼다(보안 감사 9차 중간 1) */
function writeState(p: Project, s: State): void {
  mkdirSync(loopDir(p), { recursive: true })
  const tmp = join(loopDir(p), `state.${process.pid}.tmp`)
  rmSync(tmp, { force: true })
  writeFileSync(tmp, `${JSON.stringify(s, null, 2)}\n`, { flag: 'wx' })
  renameSync(tmp, stateFile(p))
}

/** 작업 번호 순(숫자 순. 문자열 순이면 T-1000이 T-999보다 앞선다) */
function taskIds(p: Project): string[] {
  const dir = join(paths.orch(p), 'tasks')
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => /^T-\d{3,}\.md$/.test(f))
        .map((f) => f.slice(0, -3))
        .sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)))
    : []
}

function handoffOf(p: Project, id: string) {
  const file = paths.handoff(p, id)
  if (!existsSync(file) || lstatSync(file).isSymbolicLink()) return undefined
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'), file)
  if (!parsed.ok) return undefined
  const h = HandoffFrontmatter.safeParse(parsed.value.data)
  if (!h.success) return undefined
  const summary =
    extractSections(parsed.value.body, parsed.value.bodyLine)
      .find((s) => s.title === '한 줄 요약')
      ?.content.trim()
      .split('\n')[0] ?? ''
  return { h: h.data, summary }
}

/**
 * 같은 실패인지 가리는 표시. 리드가 잰 값으로만 만든다(verify 종료 코드, 시간 초과, 되돌린 변경).
 * 워커가 쓴 글이 들어가면 워커가 시도마다 표시를 바꿔 멈춤을 피할 수 있다(보안 감사 9차 중간 5)
 */
function failureMark(p: Project, id: string): string {
  const h = handoffOf(p, id)?.h
  const note = h?.lead_note ?? ''
  const parts = [`verify exit ${h?.verified?.exit_code ?? '없음'}`]
  if (note.includes('시간 상한')) parts.push('시간 초과')
  if (note.includes('되돌렸습니다') || note.includes('git을 더 부르지')) parts.push('변경 되돌림')
  if (note.includes('lint 실패')) parts.push('HANDOFF lint 실패')
  return parts.join(', ')
}

export async function runLoop(p: Project, o: LoopOptions): Promise<LoopReport> {
  const log = o.log ?? (() => {})
  const now = o.now ?? (() => new Date())
  const budget = o.budgetUsd ?? DEFAULT_BUDGET
  const maxAttempts = o.maxAttempts ?? DEFAULT_ATTEMPTS
  const linked = linkedPaths(p.root, ['.gotechy', '.gotechy/loop', '.gotechy/digest'])
  if (linked.length > 0)
    throw new Error(`심볼릭 링크라서 루프를 돌리지 않았어요: ${linked.join(', ')}`)
  // 루프는 하나만 돈다. 둘이 돌면 예산이 두 배가 되고 상태를 서로 덮어쓴다(보안 감사 9차 낮음 7)
  mkdirSync(loopDir(p), { recursive: true })
  const lock = join(loopDir(p), 'lock')
  try {
    mkdirSync(lock)
  } catch {
    throw new Error(`다른 루프가 돌고 있어요. 멈춘 것이 확실하면 ${lock} 폴더를 지우세요`)
  }
  try {
    return await loopLocked(p, o, log, now, budget, maxAttempts)
  } finally {
    rmSync(lock, { recursive: true, force: true })
  }
}

async function loopLocked(
  p: Project,
  o: LoopOptions,
  log: (s: string) => void,
  now: () => Date,
  budget: number,
  maxAttempts: number,
): Promise<LoopReport> {
  let state = readState(p)
  if (o.reset) {
    // 루프가 멈춘 작업을 다시 시도할 수 있게 ready로 돌린다. 키는 상태 검증에서 작업 번호로 걸렀다
    for (const [id, t] of Object.entries(state.tasks))
      if (t.stopped && readTask(p, id)?.status === 'failed')
        updateFrontmatter(paths.task(p, id), { status: 'ready' })
    state = { tasks: {} }
  }
  writeState(p, state)
  appendEvent(p, { type: 'loop.start', budget, max_attempts: maxAttempts })
  log(`루프 시작: 예산 $${budget.toFixed(2)}, 작업마다 시도 ${maxAttempts}번까지`)

  const results = new Map<string, LoopResult>()
  const note = (task: string, outcome: LoopOutcome, reason?: string) =>
    results.set(task, {
      task,
      outcome,
      attempts: state.tasks[task]?.attempts ?? 0,
      costUsd: state.tasks[task]?.costUsd ?? 0,
      ...(reason ? { reason } : {}),
    })
  /** 시작한 시도의 최악 비용(예약)과, 그보다 실제가 크면 실제를 더한 값 */
  let reserved = 0
  const skipped = new Set<string>()
  const stop = (id: string, t: TaskState, reason: string) => {
    t.stopped = reason
    state.tasks[id] = t
    note(id, 'stopped', reason)
    skipped.add(id)
    // 멈춘 작업은 failed로 남긴다. 오너가 원인을 고치고 ready로 돌리면 다시 돈다
    if (readTask(p, id)?.status !== 'failed')
      updateFrontmatter(paths.task(p, id), { status: 'failed' })
  }

  try {
    for (;;) {
      const next = pickNext(p, o.home, state, skipped, budget, reserved, maxAttempts, note, stop)
      if (!next) break
      const { id, task } = next
      const t = state.tasks[id] ?? { attempts: 0 }
      state.tasks[id] = t
      t.attempts++
      const reserve = Math.max(task.budget_usd ?? 1, MIN_RESERVE) + rewriteAllowance(task)
      reserved += reserve
      writeState(p, state)
      log(`${id} 실행 (${t.attempts}번째 시도)`)
      let out: RunOutcome
      try {
        out = await o.run(id)
      } catch (e) {
        // 예외 하나로 루프 전체가 멈추지 않게 그 작업만 멈춘다(보안 감사 9차 낮음 8)
        stop(id, t, `run이 예외로 끝났어요: ${displayText((e as Error).message).slice(0, 200)}`)
        writeState(p, state)
        continue
      }
      // 비용을 모르면 예약한 만큼 쓴 것으로 센다(보안 감사 14차 중간 4)
      const known = handoffOf(p, id)?.h.usage?.cost_usd
      const cost = typeof known === 'number' ? known : reserve
      t.costUsd = (t.costUsd ?? 0) + cost
      if (cost > reserve) reserved += cost - reserve
      const after = readTask(p, id)?.status
      if (out.status === 'done' || after === 'done') {
        note(id, 'done')
        skipped.add(id)
      } else if (out.status === 'needs-decision' || after === 'needs-decision') {
        note(id, 'needs-decision', '결정이 필요해요')
        skipped.add(id)
      } else if (out.status === 'refused' || out.status === 'blocked') {
        stop(
          id,
          t,
          `run이 시작하지 않았어요: ${displayText(out.messages[0] ?? out.status).slice(0, 200)}`,
        )
      } else {
        const mark = failureMark(p, id)
        if (t.lastFailure === mark) stop(id, t, `같은 실패가 두 번 이어졌어요: ${mark}`)
        else if (t.attempts >= maxAttempts)
          stop(id, t, `시도 ${t.attempts}번 모두 실패했어요: ${mark}`)
        else if (readTask(p, id)?.status === 'failed')
          // 다시 시도한다. 워커의 결과는 매번 달라질 수 있다
          updateFrontmatter(paths.task(p, id), { status: 'ready' })
        t.lastFailure = mark
      }
      writeState(p, state)
    }
  } finally {
    appendEvent(p, { type: 'loop.end', results: [...results.values()].map((r) => r.outcome) })
  }
  const digest = writeDigest(p, [...results.values()], reserved, now())
  log(`루프 끝: 보고서 ${digest}`)
  return { digest, results: [...results.values()] }
}

/** 다음에 돌릴 작업. 기다림, 예산 초과, 멈춤은 결과에 적고 건너뛴다 */
function pickNext(
  p: Project,
  home: string,
  state: State,
  skipped: Set<string>,
  budget: number,
  reserved: number,
  maxAttempts: number,
  note: (task: string, outcome: LoopOutcome, reason?: string) => void,
  stop: (id: string, t: TaskState, reason: string) => void,
): { id: string; task: TaskFrontmatter } | undefined {
  for (const id of taskIds(p)) {
    if (skipped.has(id)) continue
    const task = readTask(p, id)
    if (task?.status !== 'ready' || !LOOP_LEVELS.has(task.autonomy)) continue
    // 멈춘 작업은 failed로 남는다. 다시 ready라면 오너가 원인을 고치고 돌려놓은 것이라 새로 시작한다(작업 상태가 원천)
    if (state.tasks[id]?.stopped) delete state.tasks[id]
    const t = state.tasks[id] ?? { attempts: 0 }
    // 파일 이름과 명세의 id가 다르면 검사한 작업과 돌리는 작업이 달라진다(보안 감사 9차 중간 3)
    if (task.id !== id) {
      stop(id, t, `명세의 id(${displayText(task.id)})가 파일 이름과 달라요`)
      continue
    }
    if (task.agent === 'codex') {
      stop(id, t, 'Codex 워커에는 비용 상한이 없어 루프가 돌리지 않아요(TD-015). 직접 run하세요')
      continue
    }
    if (t.attempts >= maxAttempts) {
      stop(id, t, `시도 상한(${maxAttempts}번)에 닿았어요`)
      continue
    }
    const blockers = gateCheck(p, home, task).blockers
    if (blockers.length > 0) {
      note(id, 'waiting', displayText(blockers[0] ?? ''))
      skipped.add(id)
      continue
    }
    const cost = Math.max(task.budget_usd ?? 1, MIN_RESERVE) + rewriteAllowance(task)
    if (reserved + cost > budget) {
      note(
        id,
        'budget',
        `예산 $${budget.toFixed(2)} 중 $${reserved.toFixed(2)}를 썼어요(최악의 경우)`,
      )
      skipped.add(id)
      continue
    }
    return { id, task }
  }
  return undefined
}

const LABEL: Record<LoopOutcome, string> = {
  done: '완료',
  'needs-decision': '결정 필요',
  waiting: '기다림',
  stopped: '멈춤',
  budget: '예산으로 시작 안 함',
}

/**
 * 보고서에 들어가는 워커 글(요약, 질문, 선택지)은 제어 문자를 지우고 마크다운 문법을 무력화한다.
 * 미리 보기에서 바깥 주소를 부르거나 표, 울타리를 깨지 못하게 한다(보안 감사 9차 낮음 10)
 */
const md = (s: string) =>
  displayText(s)
    .replace(/[\r\n]+/g, ' ')
    .replace(/([\\`*_[\]()<>!|#])/g, '\\$1')

function writeDigest(p: Project, results: LoopResult[], reserved: number, at: Date): string {
  const dir = join(p.root, '.gotechy', 'digest')
  mkdirSync(dir, { recursive: true })
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\..*$/, 'Z')
  let file = join(dir, `${stamp}.md`)
  for (let n = 2; lstatSync(file, { throwIfNoEntry: false }); n++)
    file = join(dir, `${stamp}-${n}.md`)
  const actual = results.reduce((n, r) => n + r.costUsd, 0)
  const lines = [`# 아침 보고서 ${at.toISOString()}`, '']
  lines.push('| 작업 | 결과 | 시도 | 비용 | 메모 |', '|---|---|---|---|---|')
  for (const r of results) {
    const h = handoffOf(p, r.task)
    lines.push(
      `| ${r.task} | ${LABEL[r.outcome]} | ${r.attempts} | $${r.costUsd.toFixed(2)} | ${md(r.reason ?? h?.summary ?? '')} |`,
    )
  }
  lines.push(
    '',
    `시작한 시도의 최악 비용 합 $${reserved.toFixed(2)}, 기록된 실제 비용 합 $${actual.toFixed(2)}(비용을 모르는 시도는 0으로 셈).`,
    '',
  )
  const withHandoff = results.filter((r) => r.outcome === 'done' || r.outcome === 'needs-decision')
  if (withHandoff.length > 0) {
    lines.push('## HANDOFF', '')
    for (const r of withHandoff)
      lines.push(
        `- ${r.task}: \`orchestration/handoffs/${r.task}.md\` ${md(handoffOf(p, r.task)?.summary ?? '')}`,
      )
    lines.push('')
  }
  const open = listGates(p).filter((g) => g.status === 'pending')
  if (open.length > 0) {
    lines.push(
      '## 결정할 것',
      '',
      '터미널에서 `gotechy serve`로 화면을 열거나 `gotechy decide <게이트> <선택>`으로 결정하세요.',
      '',
    )
    for (const g of open)
      lines.push(`- ${g.id} (${g.task}): ${md(g.question)} \\[${g.options.map(md).join(', ')}\\]`)
    lines.push('')
  }
  const inbox = formatInbox(loadCards(p, p.root)).trimEnd()
  // 울타리는 내용 안의 가장 긴 백틱 연속보다 길게 한다
  const fence = '`'.repeat(Math.max(3, ...[...inbox.matchAll(/`+/g)].map((m) => m[0].length + 1)))
  lines.push('## 인박스', '', `${fence}text`, inbox, fence, '')
  writeFileSync(file, lines.join('\n'), { flag: 'wx' })
  return file
}
