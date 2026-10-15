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
import { findLeaks, formatVerifyLog } from '../core/audit'
import { parseFrontmatter, serializeFrontmatter } from '../core/frontmatter'
import { formatIssue, type Issue } from '../core/issues'
import { hasErrors, lintHandoff } from '../core/lint-handoff'
import { lintTask } from '../core/lint-task'
import { expandPacks } from '../core/packs'
import { disallowedChanges, handoffPathFor } from '../core/paths'
import { buildRewritePrompt, buildWorkerPrompt, type PromptSkill } from '../core/prompt'
import { HANDOFF_SECTIONS, type HandoffFrontmatter, type TaskFrontmatter } from '../core/schema'
import { addUsage, emptyUsage } from '../core/usage'
import { accountHome } from './account'
import { adapters } from './adapters'
import type { WorkerAdapter, WorkerRequest, WorkerResult } from './adapters/types'
import { writeAtomic } from './fsutil'
import { gateCheck, openGatesAfterRun } from './gates'
import {
  changedFiles,
  commitAll,
  commitPaths,
  differsFromBase,
  discardUncommitted,
  ensureWorktree,
  gitSnapshot,
  headCommit,
  resetTo,
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

/** run과 같은 작업별 잠금 안에서 fn을 돈다. 잡지 못하면 사유를 돌려준다(감사가 run과 겹치지 않게) */
export async function withTaskLock<T>(
  p: Project,
  taskId: string,
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
  const lock = join(paths.orch(p), 'private', `run-${taskId}.lock`)
  const held = acquireRunLock(lock)
  if (held !== true) return { ok: false, reason: held }
  try {
    return { ok: true, value: await fn() }
  } finally {
    rmSync(lock, { recursive: true, force: true })
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
    // 남의 저장소가 커밋해 둔 기록일 수 있다. git 옵션으로 읽히는 값을 쓰지 않는다(보안 감사 13차 높음 1)
    if (!/^[0-9a-f]{40,64}$/.test(base))
      return refuse(
        `${baseFile}의 기준 커밋 기록이 커밋 번호가 아니에요. 파일을 지운 뒤 다시 실행하세요.`,
      )
  } else {
    const head = await headCommit(p.root)
    if (!head)
      return refuse(
        '프로젝트에 커밋이 없습니다. 먼저 커밋 하나를 만드세요 (worktree의 기준점이 필요).',
      )
    base = head
    mkdirSync(dirname(wt), { recursive: true })
    writeAtomic(baseFile, `${base}\n`)
  }
  try {
    await ensureWorktree(p.root, wt, `gotechy/${task.id}`, base)
  } catch (e) {
    return refuse((e as Error).message)
  }
  updateFrontmatter(taskFile, { status: 'running' })
  appendEvent(p, { type: 'run.start', task: task.id, adapter: adapterName, base })
  log(`${task.id}: ${adapterName} 워커 실행 (worktree ${wt})`)

  const parsedTask = parseFrontmatter(taskText, taskFile)
  const body = parsedTask.ok ? parsedTask.value.body : ''
  const skills = workerSkills(p, task.packs)
  if (skills.missing.length > 0)
    log(
      `${task.id}: 이 프로젝트에 깔리지 않은 스킬은 지시문에 넣지 못했어요: ${skills.missing.join(', ')} (gotechy init --packs로 깔기)`,
    )
  const req = {
    taskId: task.id,
    cwd: wt,
    prompt: buildWorkerPrompt(task, body, gates.decisions, skills.found),
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
  if (skills.missing.length > 0)
    notes.push(`깔리지 않아 지시문에 넣지 못한 스킬: ${skills.missing.join(', ')}`)
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
    // 되돌리기가 조용히 실패하면 "되돌렸습니다" 기록이 거짓이 된다. 다시 계산해 남았으면 git을 더 부르지 않고 실패로 끝낸다(보안 감사 13차 중간 3)
    const left = (await differsFromBase(wt, base)).filter((f) => bad.includes(f))
    if (left.length > 0) {
      notes.push(`허용 밖 변경을 되돌리지 못했어요: ${left.join(', ')}`)
      return finishTampered(p, task, adapterName, result, notes, taskFile, log)
    }
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
  appendEvent(p, {
    type: 'verify',
    task: task.id,
    exit: verify.exitCode,
    sandboxed: verify.sandboxed,
  })
  notes.push(`리드 verify: \`${task.verify}\`: exit ${verify.exitCode}`)
  if (!verify.sandboxed) notes.push(UNSANDBOXED)
  // 계정 홈을 못 읽으면 HOME 기준 비밀 폴더만 막는다. 그 사실을 남긴다(보안 감사 13차 중간 5)
  else if (!accountHome())
    notes.push('계정 홈을 읽지 못해 verify 샌드박스가 HOME 기준 비밀 폴더만 막았어요.')

  const mainHandoff = paths.handoff(p, task.id)
  const prevRev = readRev(mainHandoff)
  saveVerifyLog(p, task.id, prevRev + 1, (await headCommit(wt)) ?? '', verify.stdout, verify.stderr)
  // verify 시각은 한 번만 찍는다. 다시 쓸 때마다 찍으면 verify 시각이 아니라 다시 쓴 시각이 된다(보안 감사 14차 낮음 3)
  const verifiedAt = new Date().toISOString()
  const allSecrets = WORKER_SECRET_VARS.map((k) => process.env[k] ?? '')
  const rewriteNotes: string[] = []
  // 워커 원문이 아니라 실제로 기록할 글(YAML을 다시 직렬화한 글)을 검사한다. 이스케이프로 숨긴 키가 직렬화로 살아난다
  // (보안 감사 14차 중간 2, 실험 확인). 걸리면 워커 HANDOFF를 버리고 빈 보고서로 실패 처리한다
  const finalize = (text: string | undefined, res: WorkerResult) => {
    const make = (t: string | undefined) =>
      finalizeHandoff({
        workerText: t,
        task,
        adapter: adapterName,
        result: res,
        verifyExit: verify.exitCode,
        blocked: bad.length > 0,
        notes,
        rev: prevRev + 1,
        changed: allowed,
        sandboxed: verify.sandboxed,
        verifiedAt,
      })
    const out = make(text)
    const leaks = findLeaks(out.text, allSecrets)
    if (leaks.length === 0) return out
    notes.push(
      `워커 HANDOFF에 로그인 값이나 키 모양(${[...new Set(leaks)].join(', ')})이 있어 버렸어요.`,
    )
    return make(undefined)
  }
  let res = result
  let fm = finalize(workerText, res)
  writeNoFollow(wt, handoffRel, fm.text)
  await commitPaths(wt, [handoffRel], `${task.id}: HANDOFF 확정`)
  const knownTerms = loadKnownTerms(p.root)
  let hl = lintHandoff(fm.text, handoffRel, { knownTerms })
  // 형식만 틀린 HANDOFF는 워커에게 HANDOFF만 다시 쓰게 한다(TD-016). 코드는 그대로라 verify는 다시 돌리지 않는다.
  // 워커가 실패했거나, 허용 밖 변경으로 막혔거나, verify가 실패한 실행은 하지 않는다(보안 감사 14차 낮음 1).
  // codex는 비용 상한이 없어 한 번만(TD-015, 보안 감사 14차 중간 4)
  const maxRewrites = adapterName === 'codex' ? 1 : MAX_REWRITES
  let rewrites = 0
  let rewriteBlocked = false
  for (
    let n = 1;
    n <= maxRewrites &&
    hasErrors(hl.issues) &&
    bad.length === 0 &&
    verify.exitCode === 0 &&
    res.exitCode === 0 &&
    !res.timedOut;
    n++
  ) {
    const issues = hl.issues.filter((i) => i.severity !== 'warning')
    log(
      `${task.id}: HANDOFF 형식 오류 ${issues.length}건, 워커에게 다시 쓰게 해요(${n}/${maxRewrites})`,
    )
    const committed = await headCommit(wt)
    if (!committed) break
    let again: RewriteOutcome
    try {
      again = await rewriteHandoff(
        p,
        task,
        adapter,
        adapterName,
        req,
        wt,
        handoffRel,
        issues,
        n,
        committed,
      )
    } catch (e) {
      // 예외로 끝나면 작업이 running으로 남고 기록이 어긋난다. 실패로 끝맺는다(보안 감사 14차 중간 3)
      const ok = await resetTo(wt, committed)
      const note = `다시 쓰기 중 오류로 멈췄어요: ${(e as Error).message}`
      notes.push(note)
      rewriteNotes.push(note)
      if (!ok) return finishTampered(p, task, adapterName, res, notes, taskFile, log)
      rewriteBlocked = true
      break
    }
    rewrites = n
    // 막히거나 실패한 다시 쓰기의 비용도 더한다(보안 감사 14차 중간 4)
    if (again.result)
      res = {
        ...res,
        usage: addUsage(res.usage ?? emptyUsage(), again.result.usage ?? emptyUsage()),
      }
    notes.push(...again.notes)
    rewriteNotes.push(...again.notes)
    if (again.kind !== 'ok') {
      if (again.kind === 'tampered')
        return finishTampered(p, task, adapterName, res, notes, taskFile, log)
      rewriteBlocked = true
      break
    }
    fm = finalize(again.text, res)
    writeNoFollow(wt, handoffRel, fm.text)
    await commitPaths(wt, [handoffRel], `${task.id}: HANDOFF 다시 쓰기 ${n}`)
    hl = lintHandoff(fm.text, handoffRel, { knownTerms })
  }
  // 다시 쓰기가 끝나 사용량이 바뀌었으면 마지막 HANDOFF에 반영한다(막힌 다시 쓰기의 비용 포함)
  if (rewriteBlocked) {
    // 작업 트리는 다시 쓰기 직전 커밋(리드가 확정한 HANDOFF)으로 되돌아가 있다
    fm = finalize(readRegularFile(wt, handoffRel), res)
    writeNoFollow(wt, handoffRel, fm.text)
    await commitPaths(wt, [handoffRel], `${task.id}: HANDOFF 사용량 반영`)
    hl = lintHandoff(fm.text, handoffRel, { knownTerms })
  }

  mkdirSync(dirname(mainHandoff), { recursive: true })
  writeFileSync(mainHandoff, fm.text)
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
      lead_note: ['HANDOFF lint 실패. 워커가 형식을 지키지 않았습니다.', ...rewriteNotes].join(
        ' / ',
      ),
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
    usage: res.usage,
    rewrites,
    rewrite_blocked: rewriteBlocked,
  })
  log(`${task.id}: ${status}`)
  return { status, messages, handoffFile: mainHandoff }
}

const MAX_REWRITES = 2

/** 한 번의 run에서 다시 쓰기가 더 쓸 수 있는 최대 비용. 무인 루프가 예산을 예약할 때 더한다(보안 감사 14차 중간 4) */
export function rewriteAllowance(task: Pick<TaskFrontmatter, 'agent' | 'budget_usd'>): number {
  const times = task.agent === 'codex' ? 1 : MAX_REWRITES
  return times * Math.min(task.budget_usd ?? 1, REWRITE_BUDGET_USD)
}
// 다시 쓰기는 형식만 고치는 일이라 상한을 작게 둔다(codex는 비용 상한이 없어 시간 상한만 걸린다, TD-015)
const REWRITE_BUDGET_USD = 0.25
const REWRITE_TIMEOUT_MS = 5 * 60_000

type RewriteOutcome =
  | { kind: 'ok'; text: string | undefined; result: WorkerResult; notes: string[] }
  | { kind: 'stop' | 'tampered'; result?: WorkerResult; notes: string[] }

/**
 * 워커에게 HANDOFF만 다시 쓰게 한다(TD-016). 끝나면 HANDOFF 글만 읽고 작업 트리를 다시 쓰기 직전 커밋으로 통째로 되돌린다.
 * 무시 파일과 빈 폴더까지 남지 않게 하기 위해서다(보안 감사 14차 중간 1). HANDOFF 밖 변경, 링크, 로그인 값이 생기면 멈춘다.
 * git 설정이 바뀌거나 되돌리기가 실패하면 git을 더 부르지 않는다(tampered)
 */
async function rewriteHandoff(
  p: Project,
  task: TaskFrontmatter,
  adapter: WorkerAdapter,
  adapterName: WorkerAdapter['name'],
  req: WorkerRequest,
  wt: string,
  handoffRel: string,
  issues: Issue[],
  n: number,
  committed: string,
): Promise<RewriteOutcome> {
  const snap = await gitSnapshot(p.root, wt)
  const r = await adapter.run({
    ...req,
    prompt: buildRewritePrompt(task.id, issues),
    budgetUsd: Math.min(req.budgetUsd, REWRITE_BUDGET_USD),
    timeoutMs: Math.min(req.timeoutMs, REWRITE_TIMEOUT_MS),
    rewrite: n,
  })
  saveRawLog(p, task.id, adapterName, r.rawOutput, r.stderr)
  const tampered = await restoreGitSnapshot(snap, wt)
  if (tampered.length > 0)
    return {
      kind: 'tampered',
      result: r,
      notes: [
        `다시 쓰기 중 git 설정이나 worktree 연결이 바뀌어 되돌렸어요: ${tampered.join(', ')}`,
      ],
    }
  const back = async (note: string): Promise<RewriteOutcome> =>
    (await resetTo(wt, committed))
      ? { kind: 'stop', result: r, notes: [note] }
      : {
          kind: 'tampered',
          result: r,
          notes: [note, '작업 트리를 다시 쓰기 전으로 되돌리지 못했어요.'],
        }
  if (r.exitCode !== 0 || r.timedOut)
    return back(`다시 쓰기 워커가 exit ${r.exitCode}${r.timedOut ? '(시간 초과)' : ''}로 끝났어요.`)
  const changed = await changedFiles(wt, committed)
  const path = join(wt, handoffRel)
  const secrets = WORKER_SECRET_VARS.map((k) => process.env[k] ?? '').filter((v) => v.length >= 16)
  const handoffBad =
    changed.includes(handoffRel) &&
    (isSymlink(path) || isHardLinked(path) || containsAny(path, secrets))
  const outside = changed.filter((f) => f !== handoffRel)
  if (outside.length > 0 || handoffBad)
    return back(
      `다시 쓰기에서 HANDOFF 밖 파일을 바꾸거나 링크, 로그인 값을 넣어 모두 되돌렸어요: ${[...outside, ...(handoffBad ? [handoffRel] : [])].join(', ')}`,
    )
  const text = readRegularFile(wt, handoffRel)
  if (!(await resetTo(wt, committed)))
    return { kind: 'tampered', result: r, notes: ['다시 쓰기 뒤 작업 트리를 되돌리지 못했어요.'] }
  return { kind: 'ok', text, result: r, notes: [`HANDOFF 다시 쓰기 ${n}회`] }
}

/**
 * 작업 팩의 스킬 본문을 메인 체크아웃의 설치본(.agents/skills, 없으면 .claude/skills)에서 읽는다(contract.md 10.8절).
 * owner-protocol의 규칙은 지시문에 이미 있다. 링크나 일반 파일이 아닌 것은 읽지 않는다(저장소 밖 글을 지시문에 넣지 않게).
 */
function workerSkills(p: Project, packs: string[]): { found: PromptSkill[]; missing: string[] } {
  const found: PromptSkill[] = []
  const missing: string[] = []
  for (const name of expandPacks(packs).skills) {
    if (name === 'owner-protocol') continue
    const file = ['.agents', '.claude']
      .map((d) => join(p.root, d, 'skills', name, 'SKILL.md'))
      .find((f) => lstatSync(f, { throwIfNoEntry: false })?.isFile())
    const parsed = file ? parseFrontmatter(readFileSync(file, 'utf8'), file) : undefined
    if (parsed?.ok) found.push({ name, body: parsed.value.body })
    else missing.push(name)
  }
  return { found, missing }
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
  /** verify를 마친 시각. 다시 쓰기로 여러 번 확정해도 같은 값을 쓴다 */
  verifiedAt?: string
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
    verified: {
      command: i.task.verify,
      exit_code: i.verifyExit,
      at: i.verifiedAt ?? new Date().toISOString(),
    },
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

/** 마지막 리드 verify 출력의 끝 20KB와 판본, 커밋. 감사관이 HANDOFF의 검증 주장과 대조한다(contract.md 13절) */
function saveVerifyLog(
  p: Project,
  id: string,
  rev: number,
  commit: string,
  out: string,
  err: string,
) {
  const dir = join(p.root, '.gotechy', 'runs')
  mkdirSync(dir, { recursive: true })
  writeAtomic(verifyLogFile(p, id), formatVerifyLog(rev, commit, out, err))
}

export const verifyLogFile = (p: Project, id: string) =>
  join(p.root, '.gotechy', 'runs', `${id}-verify.log`)

function saveRawLog(p: Project, id: string, adapter: string, out: string, err: string) {
  const dir = join(p.root, '.gotechy', 'runs')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  writeAtomic(join(dir, `${id}-${adapter}-${stamp}.log`), `${out}\n--- stderr ---\n${err}`)
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
  // 지난 실행의 verify 기록이 새 판본의 기록처럼 감사에 쓰이지 않게 지운다(보안 감사 12차 낮음 1)
  rmSync(verifyLogFile(p, task.id), { force: true })
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
  appendEvent(p, {
    type: 'run.end',
    task: task.id,
    status: 'failed',
    tampered: true,
    usage: result.usage,
  })
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
