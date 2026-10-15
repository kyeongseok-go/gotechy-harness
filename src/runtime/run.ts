// 작업 1건 실행: 검사 → worktree → 워커 → 허용 밖 변경 차단 → 리드 verify → HANDOFF 확정·반영 → lint.
// 워커의 주장(HANDOFF 본문)과 리드의 측정(verified·usage·changed_files)을 분리해 기록한다(contract.md 0절).
import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { parseFrontmatter, serializeFrontmatter } from '../core/frontmatter'
import { formatIssue, type Issue } from '../core/issues'
import { hasErrors, lintHandoff } from '../core/lint-handoff'
import { lintTask } from '../core/lint-task'
import { disallowedChanges, handoffPathFor } from '../core/paths'
import { buildWorkerPrompt } from '../core/prompt'
import { HANDOFF_SECTIONS, type HandoffFrontmatter, type TaskFrontmatter } from '../core/schema'
import { emptyUsage } from '../core/usage'
import { adapters } from './adapters'
import type { WorkerAdapter } from './adapters/types'
import { gateCheck, openGatesAfterRun } from './gates'
import {
  changedFiles,
  commitAll,
  commitPaths,
  discardUncommitted,
  ensureWorktree,
  gitSnapshot,
  headCommit,
  restoreFiles,
  restoreGitSnapshot,
} from './git'
import { gotechyHome } from './keys'
import { appendEvent, type Project, paths, updateFrontmatter } from './project'
import { runSandboxedShell } from './sandbox'
import { loadKnownTerms } from './terms'

export type RunOptions = {
  adapter?: WorkerAdapter['name']
  fixtureDir?: string
  log?: (s: string) => void
  /** 결정 서명 키 위치. 기본은 $GOTECHY_HOME 또는 ~/.gotechy */
  home?: string
}
export type RunOutcome = {
  /** blocked: 게이트(결정 대기, 검증 실패) 때문에 시작하지 않음 (contract.md 6.6절) */
  status: 'done' | 'failed' | 'needs-decision' | 'refused' | 'blocked'
  messages: string[]
  handoffFile?: string
}

export async function runTask(
  p: Project,
  taskId: string,
  opts: RunOptions = {},
): Promise<RunOutcome> {
  if (!/^T-\d{3,}$/.test(taskId)) return refuse(`작업 번호 형식이 아니에요: ${taskId} (예: T-001)`)
  // 같은 작업을 두 run이 같은 worktree에서 돌리지 않게 한다. serve의 자동 실행과 리드의 run이 겹칠 수 있다(감사 8차 중간 3)
  const lock = join(paths.orch(p), 'private', `run-${taskId}.lock`)
  const held = acquireRunLock(lock)
  if (held !== true) return refuse(held)
  try {
    return await runTaskLocked(p, taskId, opts)
  } finally {
    rmSync(lock, { recursive: true, force: true })
  }
}

const processAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** 작업별 실행 잠금. 살아 있는 프로세스가 잡고 있으면 사유를, 죽은 run의 잠금이면 회수한 뒤 잡는다 */
function acquireRunLock(lock: string): true | string {
  mkdirSync(dirname(lock), { recursive: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      mkdirSync(lock)
      writeFileSync(join(lock, 'pid'), String(process.pid))
      return true
    } catch {
      const pidFile = join(lock, 'pid')
      const pid = existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8').trim()) : Number.NaN
      if (!Number.isInteger(pid) || pid <= 0 || processAlive(pid))
        return `다른 run이 이 작업을 실행하고 있어요${Number.isInteger(pid) && pid > 0 ? ` (pid ${pid})` : ''}. 끝난 뒤 다시 실행하세요. 멈춘 것이 확실하면 ${lock} 폴더를 지우세요`
      rmSync(lock, { recursive: true, force: true })
    }
  }
  return `실행 잠금(${lock})을 잡지 못했어요`
}

async function runTaskLocked(p: Project, taskId: string, opts: RunOptions): Promise<RunOutcome> {
  const log = opts.log ?? (() => {})
  const taskFile = paths.task(p, taskId)
  if (!existsSync(taskFile)) return refuse(`작업 파일이 없습니다: ${taskFile}`)
  const taskText = readFileSync(taskFile, 'utf8')
  const lint = lintTask(taskText, `orchestration/tasks/${taskId}.md`)
  if (!lint.task || lint.issues.length > 0)
    return refuse('작업 명세가 계약을 어깁니다.', lint.issues)
  const task = lint.task

  const pre = preflight(task, opts)
  if (pre) return refuse(pre)
  const adapterName = (opts.adapter ?? task.agent) as WorkerAdapter['name']
  const adapter = adapters[adapterName]
  const gates = gateCheck(p, opts.home ?? gotechyHome(), task)
  if (gates.blockers.length > 0)
    return {
      status: 'blocked',
      messages: ['결정이 필요해서 시작하지 않았어요:', ...gates.blockers],
    }

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
    prompt: buildWorkerPrompt(task, body, gates.decisions),
    model: task.model ?? null,
    effort: task.effort ?? null,
    budgetUsd: task.budget_usd ?? 1,
    timeoutMs: (task.timeout_min ?? 20) * 60_000,
    ...(opts.fixtureDir ? { fixtureDir: opts.fixtureDir } : {}),
  }
  const gitBefore = await gitSnapshot(p.root, wt)
  const result = await adapter.run(req)
  saveRawLog(p, task.id, adapterName, result.rawOutput, result.stderr)

  const notes: string[] = []
  if (result.timedOut)
    notes.push(`워커가 시간 상한(${task.timeout_min ?? 20}분)을 넘겨 중단됐습니다.`)
  if (result.exitCode !== 0)
    notes.push(`워커가 exit ${result.exitCode}로 끝났습니다: ${result.stderr.trim().slice(0, 300)}`)

  const home = opts.home ?? gotechyHome()
  // git을 한 번이라도 더 부르기 전에 확인한다. worktree의 .git 연결이나 저장소 설정(포함 파일까지)이 바뀌었으면
  // 리드의 git이 워커가 준비한 설정(필터, 드라이버)을 오너 권한으로 실행할 수 있다(보안 감사 3차 높음).
  const tampered = await restoreGitSnapshot(gitBefore, wt)
  if (tampered.length > 0) {
    notes.push(
      `워커 실행 중 git 설정이나 worktree 연결이 바뀌어 되돌렸고, 이 실행에서는 git을 더 부르지 않았습니다: ${tampered.join(', ')}`,
    )
    return finishTampered(p, task, adapterName, result, notes, taskFile, log)
  }

  const changed = await changedFiles(wt, base)
  // 링크와 하드 링크는 ownership 안이라도 허용하지 않는다. 리드가 그 경로를 읽고 쓸 때 링크를 따라가
  // 게이트나 키 같은 다른 파일을 건드리거나, 바깥 파일 내용을 커밋하게 된다(보안 감사 1차 높음 2, 2차 중간 D).
  const links = changed.filter((f) => isSymlink(join(wt, f)))
  const hard = changed.filter((f) => !links.includes(f) && isHardLinked(join(wt, f)))
  // 워커에 넘긴 로그인 값(contract.md 6.3절 워커 환경 변수)이 결과 파일에 들어가면 되돌린다. 리드의 커밋은 hook을 끄고 돌아
  // gitleaks가 보지 못한다(보안 감사 6차 낮음 6). 오너 키는 Secure Enclave 안에 있어 파일에 들어갈 비밀 값이 없다
  const secrets = WORKER_SECRET_VARS.map((k) => process.env[k] ?? '').filter((v) => v.length >= 16)
  const leaks = changed.filter(
    (f) => !links.includes(f) && !hard.includes(f) && containsAny(join(wt, f), secrets),
  )
  const outside = disallowedChanges(changed, task.ownership, task.id)
  const bad = [...new Set([...outside, ...links, ...hard, ...leaks])]
  if (bad.length > 0) {
    await restoreFiles(wt, base, bad)
    const only = outside.filter((f) => !links.includes(f) && !hard.includes(f))
    if (only.length > 0) notes.push(`허용 밖 파일을 바꿔 되돌렸습니다: ${only.join(', ')}`)
    if (links.length > 0) notes.push(`심볼릭 링크를 만들어 되돌렸습니다: ${links.join(', ')}`)
    if (hard.length > 0) notes.push(`하드 링크를 만들어 되돌렸습니다: ${hard.join(', ')}`)
    if (leaks.length > 0)
      notes.push(`워커에 넘긴 로그인 값이 들어 있어 되돌렸습니다: ${leaks.join(', ')}`)
  }
  const allowed = changed.filter((f) => !bad.includes(f))

  // 워커의 HANDOFF(주장)는 verify 전에 읽고, 워커 변경은 verify 전에 커밋한다.
  // verify가 만든 파일은 아래에서 모두 지운다. 그래야 verify가 쓴 보호 경로 파일이 브랜치에 들어가지 않는다(2차 높음 B).
  const handoffRel = handoffPathFor(task.id)
  const workerText = readRegularFile(wt, handoffRel)
  await commitAll(wt, `${task.id}: ${task.title} (워커 변경)`)

  const tmp = join(p.root, '.gotechy', 'tmp', `${task.id}-${process.pid}-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
  const verify = await runSandboxedShell(task.verify, wt, {
    writable: wt,
    tmp,
    secret: [home, paths.privateDir(p)],
  }).finally(() => rmSync(tmp, { recursive: true, force: true }))
  await discardUncommitted(wt)
  saveVerifyLog(p, task.id, verify.stdout, verify.stderr)
  notes.push(`리드 verify: \`${task.verify}\`: exit ${verify.exitCode}`)
  if (!verify.sandboxed) notes.push(UNSANDBOXED)

  const mainHandoff = paths.handoff(p, task.id)
  const prevRev = readRev(mainHandoff)
  const fm = finalizeHandoff({
    workerText,
    task,
    adapter: adapterName,
    result,
    verifyExit: verify.exitCode,
    blocked: bad.length > 0,
    notes,
    rev: prevRev + 1,
    changed: allowed,
    sandboxed: verify.sandboxed,
  })
  writeNoFollow(wt, handoffRel, fm.text)
  await commitPaths(wt, [handoffRel], `${task.id}: HANDOFF 확정`)

  mkdirSync(dirname(mainHandoff), { recursive: true })
  writeFileSync(mainHandoff, fm.text)
  const hl = lintHandoff(fm.text, handoffRel, { knownTerms: loadKnownTerms(p.root) })
  let status = fm.status
  const messages = [...notes]
  const warnings = hl.issues.filter((i) => i.severity === 'warning')
  if (hasErrors(hl.issues)) {
    status = 'failed'
    messages.push(
      'HANDOFF가 계약을 어깁니다:',
      ...hl.issues.filter((i) => i.severity !== 'warning').map(formatIssue),
    )
    updateFrontmatter(mainHandoff, {
      status: 'failed',
      lead_note: 'HANDOFF lint 실패. 워커가 형식을 지키지 않았습니다.',
    })
  }
  if (warnings.length > 0)
    messages.push(`HANDOFF 경고 ${warnings.length}건:`, ...warnings.map(formatIssue))
  // 게이트를 먼저 연다. 열다가 실패했는데 작업이 done으로 남으면 승인 없이 다음 작업이 진행될 수 있다.
  if (status !== 'failed') {
    try {
      for (const g of openGatesAfterRun(p, task))
        messages.push(
          `${g.id} 결정 대기: ${g.question} (gotechy decide ${g.id} ${g.options.join('|')})`,
        )
    } catch (e) {
      status = 'failed'
      const note = `게이트를 열지 못해 실패로 처리했어요: ${(e as Error).message}`
      messages.push(note)
      updateFrontmatter(mainHandoff, { status: 'failed', lead_note: note })
    }
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

function preflight(task: TaskFrontmatter, opts: RunOptions): string | undefined {
  if (task.status !== 'ready' && task.status !== 'running') {
    return `상태가 ${task.status}인 작업은 실행하지 않습니다. 준비가 끝났으면 status를 ready로 바꾸세요.`
  }
  if (task.data_class !== 'public') {
    return `1a 단계는 공개 데이터 작업만 실행합니다 (data_class: ${task.data_class}). 데이터 경계 배치는 1b에서 지원합니다.`
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
  /** verify를 샌드박스 안에서 돌렸는가(macOS 밖이면 false) */
  sandboxed: boolean
}

const UNSANDBOXED =
  'verify를 샌드박스 없이 실행했어요 (macOS가 아님). 워커가 쓴 코드가 오너 권한으로 돌았어요.'

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
      // lead_note는 리드만 쓴다. 워커가 적은 값은 인박스에 "리드:"로 보여 리드인 척할 수 있어 버린다(doc-gardener 2026-10-15)
      delete data.lead_note
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
  // 성공해도 샌드박스 없이 돈 verify는 기록한다(contract.md 6.3절)
  else if (!i.sandboxed) out.lead_note = UNSANDBOXED
  return { text: serializeFrontmatter(out, body), status }
}

function stubBody(reason: string): string {
  return `${HANDOFF_SECTIONS.map((s) => `## ${s}\n${s === '한 줄 요약' ? reason.slice(0, 60) : '없음'}\n`).join('\n')}`
}

/** 마지막 리드 verify 출력의 끝 20KB. 감사관이 HANDOFF의 검증 주장과 대조한다(contract.md 13절) */
function saveVerifyLog(p: Project, id: string, out: string, err: string) {
  const dir = join(p.root, '.gotechy', 'runs')
  mkdirSync(dir, { recursive: true })
  const text = `${out}\n--- stderr ---\n${err}`
  writeFileSync(join(dir, `${id}-verify.log`), text.length > 20_000 ? text.slice(-20_000) : text)
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

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

function isHardLinked(path: string): boolean {
  try {
    const st = lstatSync(path)
    return st.isFile() && st.nlink > 1
  } catch {
    return false
  }
}

/** 경로의 어느 요소도 링크가 아니고, 하드 링크도 아닌 일반 파일일 때만 읽는다. */
function readRegularFile(root: string, rel: string): string | undefined {
  const parts = rel.split('/')
  for (let i = 1; i <= parts.length; i++) {
    const at = join(root, ...parts.slice(0, i))
    if (!existsSync(at) || isSymlink(at)) return undefined
  }
  const full = join(root, rel)
  if (!statSync(full).isFile() || isHardLinked(full)) return undefined
  return readFileSync(full, 'utf8')
}

/** 링크를 따라가지 않고 쓴다. 자리에 링크나 파일이 있으면 그 이름만 지우고 새로 만든다. */
function writeNoFollow(root: string, rel: string, text: string): void {
  const full = join(root, rel)
  const parts = rel.split('/')
  for (let i = 1; i < parts.length; i++) {
    const at = join(root, ...parts.slice(0, i))
    if (isSymlink(at)) unlinkSync(at)
  }
  mkdirSync(dirname(full), { recursive: true })
  if (existsSync(full) || isSymlink(full)) unlinkSync(full)
  const fd = openSync(
    full,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o644,
  )
  try {
    writeSync(fd, text)
  } finally {
    closeSync(fd)
  }
}

/** 워커가 git 연결이나 설정을 바꾼 실행: worktree에서는 git을 부르지 않고, 메인에 실패 HANDOFF만 남긴다. */
function finishTampered(
  p: Project,
  task: TaskFrontmatter,
  adapter: WorkerAdapter['name'],
  result: Awaited<ReturnType<WorkerAdapter['run']>>,
  notes: string[],
  taskFile: string,
  log: (s: string) => void,
): RunOutcome {
  notes.push('verify를 돌리지 않았습니다 (exit_code -1).')
  const mainHandoff = paths.handoff(p, task.id)
  const fm = finalizeHandoff({
    workerText: undefined,
    task,
    adapter,
    result,
    verifyExit: -1,
    blocked: true,
    notes,
    rev: readRev(mainHandoff) + 1,
    changed: [],
    sandboxed: true,
  })
  mkdirSync(dirname(mainHandoff), { recursive: true })
  writeFileSync(mainHandoff, fm.text)
  updateFrontmatter(taskFile, { status: 'failed' })
  appendEvent(p, { type: 'run.end', task: task.id, status: 'failed', tampered: true })
  log(`${task.id}: failed (git 설정 변경)`)
  return { status: 'failed', messages: notes, handoffFile: mainHandoff }
}

/** 워커에 넘기는 로그인 변수(src/runtime/adapters의 허용 목록). 값이 결과에 들어가면 안 된다 */
const WORKER_SECRET_VARS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']

/** 10MB 이하 일반 파일에 비밀 값이 들어 있는가. */
function containsAny(path: string, needles: string[]): boolean {
  if (needles.length === 0) return false
  try {
    const st = lstatSync(path)
    if (!st.isFile() || st.size > 10 * 1024 * 1024) return false
    return needles.some((n) =>
      readFileSync(path, 'latin1').includes(Buffer.from(n).toString('latin1')),
    )
  } catch {
    return false
  }
}
