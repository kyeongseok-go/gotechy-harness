// 워커 격리용 git 조작. 워커는 작업 브랜치의 별도 worktree에서만 일한다(contract.md 0절).
import { existsSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runProc } from './proc'

export const GIT_IDENTITY = ['-c', 'user.name=gotechy', '-c', 'user.email=gotechy@localhost']

// 리드가 부르는 git은 워커나 verify가 심었을지 모르는 설정을 따르지 않는다: 전역, 시스템 설정을 끄고
// 훅과 fsmonitor를 끈다(보안 감사 2차 높음 A, C). 저장소 설정 변조는 run이 따로 검사한다.
// 경로는 글롭이 아니라 글자 그대로 읽는다. 워커가 만든 파일 이름이 pathspec 문법으로 해석되지 않게(보안 감사 13차 중간 3)
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
  GIT_LITERAL_PATHSPECS: '1',
}
// core.quotePath를 끈다. 켜져 있으면 한글 같은 이름이 "\355..."로 감싸져 허용 범위 비교와 되돌리기가 틀린다(보안 감사 13차 중간 3)
const GIT_SAFE = [
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.quotePath=false',
]

/** 오너 셸의 GIT_* 변수(GIT_DIR, GIT_CONFIG_COUNT 같은)는 넘기지 않는다(보안 감사 5차 낮음 2) */
function gitEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && !k.startsWith('GIT_')) env[k] = v
  return { ...env, ...GIT_ENV }
}

/**
 * 워커 실행 전에 고정한 worktree별 git 폴더(TD-030, 보안 감사 15차 높음 1). 고정한 worktree에서 부르는 리드의 git은
 * worktree의 .git 파일을 읽지 않고 이 폴더를 쓴다. 워커가 남긴 자손이 검사 뒤에 .git 파일을 가짜 저장소로 바꿔
 * 필터 명령을 리드 권한으로 돌리게 하는 길을 막는다(2026-10-16 실험: 고정 전에는 가짜 저장소의 smudge가 실제로 돌았다)
 */
const pinnedGitDir = new Map<string, string>()

export function gitProc(args: string[], cwd: string) {
  const pin = pinnedGitDir.get(cwd)
  const env = pin ? { ...gitEnv(), GIT_DIR: pin, GIT_WORK_TREE: cwd } : gitEnv()
  return runProc(['git', ...GIT_SAFE, ...args], { cwd, env, replaceEnv: true })
}

/** 저장소의 공통 git 폴더 아래에서 이 worktree를 가리키는 관리 폴더를 찾는다(worktree의 .git 파일은 믿지 않는다) */
async function adminDirFor(root: string, wt: string): Promise<string | undefined> {
  const common = (
    await runProc(['git', ...GIT_SAFE, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: root,
      env: gitEnv(),
      replaceEnv: true,
    })
  ).stdout.trim()
  const dir = join(common, 'worktrees')
  if (!common || !existsSync(dir)) return undefined
  const want = realOrSelf(join(wt, '.git'))
  for (const name of readdirSync(dir)) {
    const gitdir = join(dir, name, 'gitdir')
    if (existsSync(gitdir) && realOrSelf(readFileSync(gitdir, 'utf8').trim()) === want)
      return join(dir, name)
  }
  return undefined
}

async function git(args: string[], cwd: string): Promise<string> {
  const r = await gitProc(args, cwd)
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} 실패 (exit ${r.exitCode}): ${r.stderr.trim()}`)
  }
  return r.stdout
}

export async function repoRoot(cwd: string): Promise<string | undefined> {
  const r = await gitProc(['rev-parse', '--show-toplevel'], cwd)
  return r.exitCode === 0 ? r.stdout.trim() : undefined
}

export async function headCommit(cwd: string): Promise<string | undefined> {
  const r = await gitProc(['rev-parse', 'HEAD'], cwd)
  return r.exitCode === 0 ? r.stdout.trim() : undefined
}

/** 작업 브랜치 worktree를 만들거나, 이미 있으면 그대로 돌려준다(재개). */
export async function ensureWorktree(root: string, path: string, branch: string, base: string) {
  if (existsSync(path)) {
    // 남의 저장소가 같은 자리에 둔 일반 폴더를 worktree로 믿지 않는다(보안 감사 13차 높음 1)
    if (!(await isRegisteredWorktree(root, path)))
      throw new Error(`${path}는 등록된 worktree가 아니에요. 폴더를 치운 뒤 다시 실행하세요`)
    return { created: false }
  }
  const branchExists = (await gitProc(['rev-parse', '--verify', branch], root)).exitCode === 0
  if (branchExists) await git(['worktree', 'add', path, branch], root)
  else await git(['worktree', 'add', '-b', branch, path, base], root)
  return { created: true }
}

/** git worktree list에 등록된 경로인가 */
export async function isRegisteredWorktree(root: string, path: string): Promise<boolean> {
  const r = await gitProc(['worktree', 'list', '--porcelain', '-z'], root)
  if (r.exitCode !== 0) return false
  const want = realOrSelf(path)
  return r.stdout
    .split('\0')
    .filter((l) => l.startsWith('worktree '))
    .some((l) => realOrSelf(l.slice('worktree '.length)) === want)
}

const realOrSelf = (p: string) => {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

/** git이 추적하는 파일 중 주어진 폴더 아래의 것(동기). git 저장소가 아니면 빈 목록 */
export function trackedUnder(root: string, dirs: string[]): string[] {
  const r = Bun.spawnSync({
    cmd: ['git', ...GIT_SAFE, 'ls-files', '-z', '--', ...dirs],
    cwd: root,
    env: gitEnv(),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (r.exitCode !== 0) return []
  return r.stdout.toString().split('\0').filter(Boolean)
}

/** base 이후 바뀐 모든 파일: 커밋된 변경 + 작업 트리 변경 + 추적되지 않은 파일. */
export async function changedFiles(wt: string, base: string): Promise<string[]> {
  // 이름 바꾸기 감지를 끈다. 켜 두면 보호 파일을 허용 범위 안으로 옮긴 커밋에서 옛 이름이 빠진다(보안 감사 7차 중간 3)
  const committed = (
    await git(['diff', '--name-only', '-z', '--no-renames', `${base}..HEAD`], wt)
  ).split('\0')
  const status = (await git(['status', '--porcelain=v1', '-uall', '-z'], wt)).split('\0')
  const working: string[] = []
  for (let i = 0; i < status.length; i++) {
    const entry = status[i]
    if (!entry || entry.length < 4) continue
    const code = entry.slice(0, 2)
    working.push(entry.slice(3))
    if (code.startsWith('R') || code.startsWith('C')) {
      const from = status[i + 1]
      if (from) working.push(from)
      i++
    }
  }
  // 이름을 trim하지 않는다. 앞뒤 공백도 이름의 일부다
  return [...new Set([...committed, ...working].filter(Boolean))].sort()
}

/**
 * 지금 작업 트리(스테이지 포함)가 base와 다른 파일과 추적되지 않은 파일. 되돌린 뒤 다시 볼 때 쓴다.
 * 커밋 기준(base..HEAD)으로 보면 아직 커밋하지 않은 되돌리기(스테이지한 삭제)를 남은 것으로 잘못 본다
 */
export async function differsFromBase(wt: string, base: string): Promise<string[]> {
  const tracked = (await git(['diff', '--name-only', '-z', '--no-renames', base], wt)).split('\0')
  const untracked = (await git(['ls-files', '--others', '--exclude-standard', '-z'], wt)).split(
    '\0',
  )
  return [...new Set([...tracked, ...untracked].filter(Boolean))].sort()
}

export async function commitAll(wt: string, message: string): Promise<boolean> {
  await git(['add', '-A'], wt)
  const staged = await gitProc(['diff', '--cached', '--quiet'], wt)
  if (staged.exitCode === 0) return false
  await git([...GIT_IDENTITY, 'commit', '-q', '-m', message], wt)
  return true
}

export async function restoreFiles(wt: string, base: string, files: string[]): Promise<void> {
  // 허용 밖 변경을 되돌린다: 추적 파일은 base로, 새 파일은 삭제.
  for (const f of files) {
    const tracked = (await gitProc(['cat-file', '-e', `${base}:${f}`], wt)).exitCode === 0
    if (tracked) await git(['checkout', base, '--', f], wt)
    else {
      // 워커가 직접 커밋한 새 파일은 추적 중이라 clean으로 지워지지 않는다
      const inHead = (await gitProc(['cat-file', '-e', `HEAD:${f}`], wt)).exitCode === 0
      if (inHead) await gitProc(['rm', '-fq', '--', f], wt)
      // -ff: 중첩 저장소 폴더도 지운다(보안 감사 13차 중간 3)
      else await gitProc(['clean', '-ffq', '--', f], wt)
    }
  }
}

/** verify가 남긴 부산물을 지운다. 커밋된 워커 변경만 남긴다(보안 감사 2차 높음 B). */
export async function discardUncommitted(wt: string): Promise<void> {
  await git(['reset', '-q', '--hard', 'HEAD'], wt)
  // -ff: verify가 만든 중첩 저장소 폴더까지 지운다
  await git(['clean', '-ffdxq'], wt)
}

/**
 * 작업 트리를 커밋 하나로 통째로 되돌린다(추적 파일, 새 파일, 무시 파일, 중첩 저장소까지). 예외를 던지지 않고,
 * 되돌린 뒤 작업 트리가 그 커밋과 같은지 다시 보아 결과를 돌려준다(보안 감사 14차 중간 3)
 */
export async function resetTo(wt: string, commit: string): Promise<boolean> {
  const reset = await gitProc(['reset', '-q', '--hard', commit], wt)
  const clean = await gitProc(['clean', '-ffdxq'], wt)
  if (reset.exitCode !== 0 || clean.exitCode !== 0) return false
  const left = await gitProc(['status', '--porcelain', '--ignored', '-uall', '-z'], wt)
  const head = await gitProc(['rev-parse', 'HEAD'], wt)
  return left.exitCode === 0 && left.stdout === '' && head.stdout.trim() === commit
}

/** 지정한 경로만 커밋한다. */
export async function commitPaths(wt: string, files: string[], message: string): Promise<boolean> {
  await git(['add', '--', ...files], wt)
  const staged = await gitProc(['diff', '--cached', '--quiet'], wt)
  if (staged.exitCode === 0) return false
  await git([...GIT_IDENTITY, 'commit', '-q', '-m', message], wt)
  return true
}

/** 워커 실행 전에 찍어 두는 git 연결과 설정. 워커가 바꾸면 리드의 git이 워커가 준비한 설정(필터 등)을 따르게 된다. */
export type GitSnapshot = { files: Map<string, string | null>; configList: string }

async function configList(wt: string): Promise<string> {
  return (await gitProc(['config', '--list', '--show-origin'], wt)).stdout
}

export async function gitSnapshot(root: string, wt: string): Promise<GitSnapshot> {
  const files = new Map<string, string | null>()
  const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : null)
  const dotGit = join(wt, '.git')
  const link = read(dotGit)
  files.set(dotGit, link)
  files.set(join(root, '.git', 'config'), read(join(root, '.git', 'config')))
  const meta = /^gitdir:\s*(.+)$/m.exec(link ?? '')?.[1]?.trim()
  if (meta)
    // HEAD도 지킨다. 바뀌면 리드의 reset과 commit이 다른 브랜치(main 등)에 작용한다(보안 감사 14차 낮음 5)
    for (const f of ['gitdir', 'commondir', 'config.worktree', 'HEAD'])
      files.set(join(meta, f), read(join(meta, f)))
  // 이후 이 worktree에서 부르는 리드의 git은 관리 폴더를 직접 쓴다(TD-030)
  const admin = await adminDirFor(root, wt)
  if (admin) pinnedGitDir.set(wt, admin)
  return { files, configList: await configList(wt) }
}

/** 스냅샷과 다른 파일은 되돌리고, 되돌린 뒤에도 설정 목록(포함 파일까지)이 다르면 그것도 문제로 돌려준다. */
export async function restoreGitSnapshot(snap: GitSnapshot, wt: string): Promise<string[]> {
  const problems: string[] = []
  for (const [path, content] of snap.files) {
    const now = existsSync(path) ? readFileSync(path, 'utf8') : null
    if (now === content) continue
    problems.push(path)
    if (content === null) rmSync(path, { force: true })
    else writeFileSync(path, content)
  }
  if ((await configList(wt)) !== snap.configList) problems.push('git 설정(포함 파일)')
  return problems
}
