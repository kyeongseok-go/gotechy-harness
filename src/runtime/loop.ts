// gotechy loop: 무인 루프(contract.md 11절, 1b N3). 결과를 만들기만 하고 결정과 반영(decide, accept, push)은 하지 않는다.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from '../core/frontmatter'
import { formatInbox } from '../core/inbox'
import { HandoffFrontmatter, type TaskFrontmatter } from '../core/schema'
import { extractSections } from '../core/sections'
import { gateCheck, listGates, readTask } from './gates'
import { loadCards } from './inbox'
import { appendEvent, type Project, paths, updateFrontmatter } from './project'
import type { RunOutcome } from './run'

export type LoopOutcome = 'done' | 'needs-decision' | 'waiting' | 'stopped' | 'budget'
export type LoopResult = {
  task: string
  outcome: LoopOutcome
  attempts: number
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

type TaskState = { attempts: number; lastFailure?: string; stopped?: string }
type State = { tasks: Record<string, TaskState> }

const LOOP_LEVELS = new Set(['L2', 'L3'])
const DEFAULT_BUDGET = 5
const DEFAULT_ATTEMPTS = 3

const stateFile = (p: Project) => join(p.root, '.gotechy', 'loop', 'state.json')

function readState(p: Project): State {
  try {
    const s = JSON.parse(readFileSync(stateFile(p), 'utf8')) as State
    return s && typeof s.tasks === 'object' ? s : { tasks: {} }
  } catch {
    return { tasks: {} }
  }
}

function writeState(p: Project, s: State): void {
  mkdirSync(join(p.root, '.gotechy', 'loop'), { recursive: true })
  writeFileSync(stateFile(p), `${JSON.stringify(s, null, 2)}\n`)
}

function taskIds(p: Project): string[] {
  const dir = join(paths.orch(p), 'tasks')
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => /^T-\d{3,}\.md$/.test(f))
        .map((f) => f.slice(0, -3))
        .sort()
    : []
}

function handoffOf(p: Project, id: string) {
  const file = paths.handoff(p, id)
  if (!existsSync(file)) return undefined
  const text = readFileSync(file, 'utf8')
  const parsed = parseFrontmatter(text, file)
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

/** 같은 실패인지 가리는 표시: 리드 메모 첫 줄과 verify 종료 코드 */
function failureMark(p: Project, id: string, out: RunOutcome): string {
  const h = handoffOf(p, id)?.h
  const note = (h?.lead_note ?? out.messages[0] ?? '').split('\n')[0]?.trim() ?? ''
  return `${note} (verify exit ${h?.verified?.exit_code ?? '없음'})`
}

export async function runLoop(p: Project, o: LoopOptions): Promise<LoopReport> {
  const log = o.log ?? (() => {})
  const now = o.now ?? (() => new Date())
  const budget = o.budgetUsd ?? DEFAULT_BUDGET
  const maxAttempts = o.maxAttempts ?? DEFAULT_ATTEMPTS
  let state = readState(p)
  if (o.reset) {
    // 루프가 멈춘 작업을 다시 시도할 수 있게 ready로 돌린다
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
      ...(reason ? { reason } : {}),
    })
  let reserved = 0
  const skipped = new Set<string>()

  for (;;) {
    const next = pickNext(p, o.home, state, skipped, budget, reserved, note)
    if (!next) break
    const id = next.id
    const t = state.tasks[id] ?? { attempts: 0 }
    state.tasks[id] = t
    t.attempts++
    reserved += next.budget_usd ?? 1
    writeState(p, state)
    log(`${id} 실행 (${t.attempts}번째 시도)`)
    const out = await o.run(id)
    const after = readTask(p, id)?.status
    if (out.status === 'done' || after === 'done') {
      note(id, 'done')
      skipped.add(id)
    } else if (out.status === 'needs-decision' || after === 'needs-decision') {
      note(id, 'needs-decision', '결정이 필요해요')
      skipped.add(id)
    } else if (out.status === 'refused' || out.status === 'blocked') {
      t.stopped = `run이 시작하지 않았어요: ${out.messages[0] ?? out.status}`
      note(id, 'stopped', t.stopped)
      skipped.add(id)
    } else {
      const mark = failureMark(p, id, out)
      if (t.lastFailure === mark) t.stopped = `같은 실패가 두 번 이어졌어요: ${mark}`
      else if (t.attempts >= maxAttempts)
        t.stopped = `시도 ${t.attempts}번 모두 실패했어요: ${mark}`
      t.lastFailure = mark
      if (t.stopped) {
        note(id, 'stopped', t.stopped)
        skipped.add(id)
      } else if (readTask(p, id)?.status === 'failed') {
        // 다시 시도한다. 워커의 결과는 매번 달라질 수 있다
        updateFrontmatter(paths.task(p, id), { status: 'ready' })
      }
    }
    writeState(p, state)
  }

  appendEvent(p, { type: 'loop.end', results: [...results.values()].map((r) => r.outcome) })
  const digest = writeDigest(p, [...results.values()], reserved, now())
  log(`루프 끝: 보고서 ${digest}`)
  return { digest, results: [...results.values()] }
}

/** 다음에 돌릴 작업. 기다림과 예산 초과는 결과에 적고 건너뛴다 */
function pickNext(
  p: Project,
  home: string,
  state: State,
  skipped: Set<string>,
  budget: number,
  reserved: number,
  note: (task: string, outcome: LoopOutcome, reason?: string) => void,
): TaskFrontmatter | undefined {
  for (const id of taskIds(p)) {
    if (skipped.has(id)) continue
    const task = readTask(p, id)
    if (task?.status !== 'ready' || !LOOP_LEVELS.has(task.autonomy)) continue
    // 멈춘 작업은 failed로 남는다. 다시 ready라면 오너가 원인을 고치고 돌려놓은 것이라 새로 시작한다(작업 상태가 원천)
    if (state.tasks[id]?.stopped) delete state.tasks[id]
    const blockers = gateCheck(p, home, task).blockers
    if (blockers.length > 0) {
      note(id, 'waiting', blockers[0])
      skipped.add(id)
      continue
    }
    const cost = task.budget_usd ?? 1
    if (reserved + cost > budget) {
      note(
        id,
        'budget',
        `예산 $${budget.toFixed(2)} 중 $${reserved.toFixed(2)}를 썼어요(최악의 경우)`,
      )
      skipped.add(id)
      continue
    }
    return task
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

function writeDigest(p: Project, results: LoopResult[], reserved: number, at: Date): string {
  const dir = join(p.root, '.gotechy', 'digest')
  mkdirSync(dir, { recursive: true })
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\..*$/, 'Z')
  const file = join(dir, `${stamp}.md`)
  let actual = 0
  const lines = [`# 아침 보고서 ${at.toISOString()}`, '']
  lines.push('| 작업 | 결과 | 시도 | 비용 | 메모 |', '|---|---|---|---|---|')
  for (const r of results) {
    const h = handoffOf(p, r.task)
    const cost = h?.h.usage?.cost_usd ?? null
    if (cost) actual += cost
    lines.push(
      `| ${r.task} | ${LABEL[r.outcome]} | ${r.attempts} | ${cost === null ? '모름' : `$${cost.toFixed(2)}`} | ${(r.reason ?? h?.summary ?? '').replaceAll('|', '/')} |`,
    )
  }
  lines.push(
    '',
    `시작한 작업의 최악 비용 합 $${reserved.toFixed(2)}, 실제 비용 합 $${actual.toFixed(2)}.`,
    '',
  )
  const withHandoff = results.filter((r) => r.outcome === 'done' || r.outcome === 'needs-decision')
  if (withHandoff.length > 0) {
    lines.push('## HANDOFF', '')
    for (const r of withHandoff) {
      const h = handoffOf(p, r.task)
      lines.push(`- ${r.task}: \`orchestration/handoffs/${r.task}.md\` ${h?.summary ?? ''}`)
    }
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
      lines.push(`- ${g.id} (${g.task}): ${g.question} [${g.options.join(', ')}]`)
    lines.push('')
  }
  lines.push('## 인박스', '', '```text', formatInbox(loadCards(p, p.root)).trimEnd(), '```', '')
  writeFileSync(file, lines.join('\n'))
  return file
}
