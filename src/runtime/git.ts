// 워커 격리용 git 조작. 워커는 작업 브랜치의 별도 worktree에서만 일한다(contract.md 0절).
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runProc } from './proc'

export const GIT_IDENTITY = ['-c', 'user.name=gotechy', '-c', 'user.email=gotechy@localhost']

// 리드가 부르는 git은 워커나 verify가 심었을지 모르는 설정을 따르지 않는다: 전역, 시스템 설정을 끄고
// 훅과 fsmonitor를 끈다(보안 감사 2차 높음 A, C). 저장소 설정 변조는 run이 따로 검사한다.
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
}
const GIT_SAFE = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false']

/** 오너 셸의 GIT_* 변수(GIT_DIR, GIT_CONFIG_COUNT 같은)는 넘기지 않는다(보안 감사 5차 낮음 2) */
function gitEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && !k.startsWith('GIT_')) env[k] = v
  return { ...env, ...GIT_ENV }
}

export function gitProc(args: string[], cwd: string) {
  return runProc(['git', ...GIT_SAFE, ...args], { cwd, env: gitEnv(), replaceEnv: true })
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
  if (existsSync(path)) return { created: false }
  const branchExists = (await gitProc(['rev-parse', '--verify', branch], root)).exitCode === 0
  if (branchExists) await git(['worktree', 'add', path, branch], root)
  else await git(['worktree', 'add', '-b', branch, path, base], root)
  return { created: true }
}

/** base 이후 바뀐 모든 파일: 커밋된 변경 + 작업 트리 변경 + 추적되지 않은 파일. */
export async function changedFiles(wt: string, base: string): Promise<string[]> {
  const committed = (await git(['diff', '--name-only', `${base}..HEAD`], wt)).split('\n')
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
  return [...new Set([...committed, ...working].map((f) => f.trim()).filter(Boolean))].sort()
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
      else await gitProc(['clean', '-fq', '--', f], wt)
    }
  }
}

/** verify가 남긴 부산물을 지운다. 커밋된 워커 변경만 남긴다(보안 감사 2차 높음 B). */
export async function discardUncommitted(wt: string): Promise<void> {
  await git(['reset', '-q', '--hard', 'HEAD'], wt)
  // -ff: verify가 만든 중첩 저장소 폴더까지 지운다
  await git(['clean', '-ffdxq'], wt)
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
    for (const f of ['gitdir', 'commondir', 'config.worktree'])
      files.set(join(meta, f), read(join(meta, f)))
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
