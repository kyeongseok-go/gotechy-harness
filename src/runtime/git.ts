// 워커 격리용 git 조작. 워커는 작업 브랜치의 별도 worktree에서만 일한다(contract.md 0절).
import { existsSync } from 'node:fs'
import { runProc } from './proc'

const GIT_IDENTITY = ['-c', 'user.name=gotechy', '-c', 'user.email=gotechy@localhost']

async function git(args: string[], cwd: string): Promise<string> {
  const r = await runProc(['git', ...args], { cwd })
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} 실패 (exit ${r.exitCode}): ${r.stderr.trim()}`)
  }
  return r.stdout
}

export async function repoRoot(cwd: string): Promise<string | undefined> {
  const r = await runProc(['git', 'rev-parse', '--show-toplevel'], { cwd })
  return r.exitCode === 0 ? r.stdout.trim() : undefined
}

export async function headCommit(cwd: string): Promise<string | undefined> {
  const r = await runProc(['git', 'rev-parse', 'HEAD'], { cwd })
  return r.exitCode === 0 ? r.stdout.trim() : undefined
}

/** 작업 브랜치 worktree를 만들거나, 이미 있으면 그대로 돌려준다(재개). */
export async function ensureWorktree(root: string, path: string, branch: string, base: string) {
  if (existsSync(path)) return { created: false }
  const branchExists =
    (await runProc(['git', 'rev-parse', '--verify', branch], { cwd: root })).exitCode === 0
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
  const staged = await runProc(['git', 'diff', '--cached', '--quiet'], { cwd: wt })
  if (staged.exitCode === 0) return false
  await git([...GIT_IDENTITY, 'commit', '-q', '-m', message], wt)
  return true
}

export async function restoreFiles(wt: string, base: string, files: string[]): Promise<void> {
  // 허용 밖 변경을 되돌린다: 추적 파일은 base로, 새 파일은 삭제.
  for (const f of files) {
    const tracked =
      (await runProc(['git', 'cat-file', '-e', `${base}:${f}`], { cwd: wt })).exitCode === 0
    if (tracked) await git(['checkout', base, '--', f], wt)
    else await runProc(['git', 'clean', '-fq', '--', f], { cwd: wt })
  }
}
