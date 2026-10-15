// TD-030(보안 감사 15차 높음 1): 워커가 남긴 자손이 리드의 검사 뒤에 worktree의 .git 파일을 가짜 저장소로 바꿔도,
// 리드의 git은 워커 실행 전에 고정한 git 폴더를 쓴다(GIT_DIR, GIT_WORK_TREE). 가짜 저장소의 필터 명령이 돌지 않아야 한다.
import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { changedFiles, ensureWorktree, gitSnapshot, resetTo } from '../../src/runtime/git'
import { makeProject, sh } from './helpers'

async function worktree() {
  const root = makeProject()
  const base = sh(['git', 'rev-parse', 'HEAD'], root).trim()
  const wt = join(root, '.gotechy', 'worktrees', 'T-001')
  await ensureWorktree(root, wt, 'gotechy/T-001', base)
  return { root, base, wt }
}

/** 워커 자손이 하는 일: .git 파일을 필터가 심긴 가짜 저장소로 돌리고 .gitattributes를 심는다 */
function hijack(root: string, wt: string, base: string): string {
  const evil = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-evilgit-')))
  const marker = join(evil, 'PWNED')
  sh(['git', 'init', '-q', '--bare', join(evil, 'repo.git')], evil)
  mkdirSync(join(evil, 'repo.git', 'objects', 'info'), { recursive: true })
  writeFileSync(
    join(evil, 'repo.git', 'objects', 'info', 'alternates'),
    `${join(root, '.git', 'objects')}\n`,
  )
  writeFileSync(
    join(evil, 'repo.git', 'config'),
    `[core]\n\trepositoryformatversion = 0\n\tbare = false\n[filter "p"]\n\tsmudge = touch ${marker}; cat\n\tclean = touch ${marker}; cat\n`,
  )
  writeFileSync(join(evil, 'repo.git', 'HEAD'), `${base}\n`)
  writeFileSync(join(wt, '.git'), `gitdir: ${join(evil, 'repo.git')}\n`)
  writeFileSync(join(wt, '.gitattributes'), '* filter=p\n')
  return marker
}

describe('리드 git의 git 폴더 고정 (TD-030)', () => {
  test('스냅샷 뒤 .git 파일이 바뀌어도 리드의 git은 원래 저장소를 보고 가짜 필터를 돌리지 않는다', async () => {
    const { root, base, wt } = await worktree()
    await gitSnapshot(root, wt)
    writeFileSync(join(wt, 'README.md'), '# Sandbox\n바꿈\n')
    const marker = hijack(root, wt, base)
    const files = await changedFiles(wt, base)
    expect(files).toContain('README.md')
    // 고정한 git 폴더로 되돌린다. 심긴 .gitattributes는 지워지고, git은 .git이라는 이름을 늘 건너뛴다
    expect(await resetTo(wt, base)).toBe(true)
    expect(existsSync(join(wt, '.gitattributes'))).toBe(false)
    expect(existsSync(marker)).toBe(false)
  })
})
