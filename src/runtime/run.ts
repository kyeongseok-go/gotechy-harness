// 작업 1건 실행: 검사 → worktree → 워커 → 허용 밖 변경 차단 → 리드 verify → HANDOFF 확정·반영 → lint.
// 워커의 주장(HANDOFF 본문)과 리드의 측정(verified·usage·changed_files)을 분리해 기록한다(contract.md 0절).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseFrontmatter, serializeFrontmatter } from '../core/frontmatter'
import { formatIssue, type Issue } from '../core/issues'
import { lintHandoff } from '../core/lint-handoff'
import { lintTask } from '../core/lint-task'
import { disallowedChanges, handoffPathFor } from '../core/paths'
import { buildWorkerPrompt } from '../core/prompt'
import { HANDOFF_SECTIONS, type HandoffFrontmatter, type TaskFrontmatter } from '../core/schema'
import { emptyUsage } from '../core/usage'
import { adapters } from './adapters'
import type { WorkerAdapter } from './adapters/types'
import { changedFiles, commitAll, ensureWorktree, headCommit, restoreFiles } from './git'
import { runShell } from './proc'
import { appendEvent, type Project, paths, updateFrontmatter } from './project'

export type RunOptions = {
  adapter?: WorkerAdapter['name']
  fixtureDir?: string
  log?: (s: string) => void
}
export type RunOutcome = {
  status: 'done' | 'failed' | 'needs-decision' | 'refused'
  messages: string[]
  handoffFile?: string
}

export async function runTask(
  p: Project,
  taskId: string,
  opts: RunOptions = {},
): Promise<RunOutcome> {
  const log = opts.log ?? (() => {})
  const taskFile = paths.task(p, taskId)
  if (!existsSync(taskFile)) return refuse(`작업 파일이 없습니다: ${taskFile}`)
  const taskText = readFileSync(taskFile, 'utf8')
  const lint = lintTask(taskText, `orchestration/tasks/${taskId}.md`)
  if (!lint.task || lint.issues.length > 0)
    return refuse('작업 명세가 계약을 어깁니다.', lint.issues)
  const task = lint.task

  const pre = preflight(p, task, opts)
  if (pre) return refuse(pre)
  const adapterName = (opts.adapter ?? task.agent) as WorkerAdapter['name']
  const adapter = adapters[adapterName]

  const wt = paths.worktree(p, task.id)
  const baseFile = `${wt}.base`
  let base: string
  if (existsSync(baseFile)) {
    base = readFileSync(baseFile, 'utf8').trim()
  } else {
    const head = await headCommit(p.root)
    if (!head)
      return refuse(
        '프로젝트에 커밋이 없습니다. 먼저 커밋 하나를 만드세요 (worktree의 기준점이 필요).',
      )
    base = head
    mkdirSync(dirname(wt), { recursive: true })
    writeFileSync(baseFile, `${base}\n`)
  }
  await ensureWorktree(p.root, wt, `gotechy/${task.id}`, base)
  updateFrontmatter(taskFile, { status: 'running' })
  appendEvent(p, { type: 'run.start', task: task.id, adapter: adapterName, base })
  log(`${task.id}: ${adapterName} 워커 실행 (worktree ${wt})`)

  const parsedTask = parseFrontmatter(taskText, taskFile)
  const body = parsedTask.ok ? parsedTask.value.body : ''
  const req = {
    taskId: task.id,
    cwd: wt,
    prompt: buildWorkerPrompt(task, body),
    model: task.model ?? null,
    effort: task.effort ?? null,
    budgetUsd: task.budget_usd ?? 1,
    timeoutMs: (task.timeout_min ?? 20) * 60_000,
    ...(opts.fixtureDir ? { fixtureDir: opts.fixtureDir } : {}),
  }
  const result = await adapter.run(req)
  saveRawLog(p, task.id, adapterName, result.rawOutput, result.stderr)

  const notes: string[] = []
  if (result.timedOut)
    notes.push(`워커가 시간 상한(${task.timeout_min ?? 20}분)을 넘겨 중단됐습니다.`)
  if (result.exitCode !== 0)
    notes.push(`워커가 exit ${result.exitCode}로 끝났습니다: ${result.stderr.trim().slice(0, 300)}`)

  const changed = await changedFiles(wt, base)
  const bad = disallowedChanges(changed, task.ownership, task.id)
  if (bad.length > 0) {
    await restoreFiles(wt, base, bad)
    notes.push(`허용 밖 파일을 바꿔 되돌렸습니다: ${bad.join(', ')}`)
  }
  const allowed = changed.filter((f) => !bad.includes(f))

  const verify = await runShell(task.verify, wt)
  notes.push(`리드 verify: \`${task.verify}\` → exit ${verify.exitCode}`)

  const handoffRel = handoffPathFor(task.id)
  const workerHandoff = join(wt, handoffRel)
  const mainHandoff = paths.handoff(p, task.id)
  const prevRev = readRev(mainHandoff)
  const fm = finalizeHandoff({
    workerText: existsSync(workerHandoff) ? readFileSync(workerHandoff, 'utf8') : undefined,
    task,
    adapter: adapterName,
    result,
    verifyExit: verify.exitCode,
    blocked: bad.length > 0,
    notes,
    rev: prevRev + 1,
    changed: allowed,
  })
  mkdirSync(dirname(workerHandoff), { recursive: true })
  writeFileSync(workerHandoff, fm.text)
  await commitAll(wt, `${task.id}: ${task.title}`)

  mkdirSync(dirname(mainHandoff), { recursive: true })
  writeFileSync(mainHandoff, fm.text)
  const hl = lintHandoff(fm.text, handoffRel)
  let status = fm.status
  const messages = [...notes]
  if (hl.issues.length > 0) {
    status = 'failed'
    messages.push('HANDOFF가 계약을 어깁니다:', ...hl.issues.map(formatIssue))
    updateFrontmatter(mainHandoff, {
      status: 'failed',
      lead_note: 'HANDOFF lint 실패 — 워커가 형식을 지키지 않았습니다.',
    })
  }
  updateFrontmatter(taskFile, { status })
  appendEvent(p, {
    type: 'run.end',
    task: task.id,
    status,
    verify_exit: verify.exitCode,
    blocked: bad,
    usage: result.usage,
  })
  log(`${task.id}: ${status}`)
  return { status, messages, handoffFile: mainHandoff }
}

function preflight(p: Project, task: TaskFrontmatter, opts: RunOptions): string | undefined {
  if (task.status !== 'ready' && task.status !== 'running') {
    return `상태가 ${task.status}인 작업은 실행하지 않습니다. 준비가 끝났으면 status를 ready로 바꾸세요.`
  }
  if (task.data_class !== 'public') {
    return `1a 단계는 공개 데이터 작업만 실행합니다 (data_class: ${task.data_class}). 데이터 경계 배치는 1b에서 지원합니다.`
  }
  if (task.gate === 'before') return '실행 전 게이트(gate: before)는 M2의 결정 기능이 필요합니다.'
  for (const dep of task.deps) {
    const depFile = paths.task(p, dep)
    const parsed = existsSync(depFile)
      ? parseFrontmatter(readFileSync(depFile, 'utf8'), depFile)
      : undefined
    const st = parsed?.ok ? parsed.value.data.status : undefined
    if (st !== 'done') return `선행 작업 ${dep}가 done이 아닙니다 (현재 ${String(st ?? '없음')}).`
  }
  const name = opts.adapter ?? task.agent
  if (!name)
    return '실행할 워커를 정하세요: 작업에 agent를 쓰거나 --adapter claude|codex|fake 를 주세요.'
  if (!(name in adapters)) return `알 수 없는 워커: ${name}`
  return undefined
}

function readRev(file: string): number {
  if (!existsSync(file)) return 0
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'), file)
  const rev = parsed.ok ? parsed.value.data.rev : undefined
  return typeof rev === 'number' ? rev : 0
}

type FinalizeInput = {
  workerText: string | undefined
  task: TaskFrontmatter
  adapter: WorkerAdapter['name']
  result: Awaited<ReturnType<WorkerAdapter['run']>>
  verifyExit: number
  blocked: boolean
  notes: string[]
  rev: number
  changed: string[]
}

function finalizeHandoff(i: FinalizeInput): {
  text: string
  status: 'done' | 'failed' | 'needs-decision'
} {
  let data: Record<string, unknown> = {
    task: i.task.id,
    status: 'failed',
    packs: i.task.packs,
    skills_loaded: [],
    new_terms: [],
  }
  let body = stubBody('워커가 HANDOFF를 남기지 않았습니다.')
  if (i.workerText) {
    const parsed = parseFrontmatter(i.workerText, handoffPathFor(i.task.id))
    if (parsed.ok) {
      data = { ...parsed.value.data }
      body = parsed.value.body
    } else {
      body = stubBody(
        `워커 HANDOFF의 frontmatter를 읽을 수 없습니다: ${parsed.issues.map((x) => x.message).join(' / ')}`,
      )
    }
  }
  const claimed = data.status
  let status: 'done' | 'failed' | 'needs-decision' =
    claimed === 'done' || claimed === 'needs-decision' ? claimed : 'failed'
  const failed = i.blocked || i.verifyExit !== 0 || i.result.exitCode !== 0 || i.result.timedOut
  if (failed && status !== 'needs-decision') status = 'failed'
  if (i.blocked) status = 'failed'

  const lead: Partial<HandoffFrontmatter> = {
    rev: i.rev,
    agent: i.adapter,
    model: i.result.model ?? i.task.model ?? null,
    effort: i.task.effort ?? null,
    usage: i.result.usage ?? emptyUsage(),
    verified: { command: i.task.verify, exit_code: i.verifyExit, at: new Date().toISOString() },
    changed_files: i.changed,
  }
  const out = { ...data, task: i.task.id, status, ...lead } as Record<string, unknown>
  if (i.notes.length > 0 && (failed || i.blocked)) out.lead_note = i.notes.join(' / ')
  return { text: serializeFrontmatter(out, body), status }
}

function stubBody(reason: string): string {
  return `${HANDOFF_SECTIONS.map((s) => `## ${s}\n${s === '한 줄 요약' ? reason.slice(0, 60) : '없음'}\n`).join('\n')}`
}

function saveRawLog(p: Project, id: string, adapter: string, out: string, err: string) {
  const dir = join(p.root, '.gotechy', 'runs')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  writeFileSync(join(dir, `${id}-${adapter}-${stamp}.log`), `${out}\n--- stderr ---\n${err}`)
}

function refuse(message: string, issues: Issue[] = []): RunOutcome {
  return { status: 'refused', messages: [message, ...issues.map(formatIssue)] }
}
