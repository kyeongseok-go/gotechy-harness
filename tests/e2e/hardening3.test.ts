// 보안 감사 3차(2026-10-14 밤, M2c 2차 수정의 재검토) 지적의 재현 테스트.
import { beforeEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runTask } from '../../src/runtime/run'
import { FAKE, fm, handoffFile, makeHome, makeProject, newTask, sh } from './helpers'

let root: string
let home: string
beforeEach(() => {
  root = makeProject()
  home = makeHome()
})
const okHandoff = readFileSync(join(FAKE, 'readme-ok', 'handoff.md'), 'utf8')
function fixture(
  files: Record<string, string>,
  opts: { writes?: unknown[]; commit?: boolean } = {},
) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fx3-')))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, 'files', rel)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content)
  }
  writeFileSync(join(dir, 'handoff.md'), okHandoff)
  if (opts.writes) writeFileSync(join(dir, 'writes.json'), JSON.stringify(opts.writes))
  if (opts.commit) writeFileSync(join(dir, 'commit'), '')
  return dir
}
const run = (id: string, dir: string) =>
  runTask({ root }, id, { adapter: 'fake', fixtureDir: dir, home })
const wtOf = (id: string) => join(root, '.gotechy', 'worktrees', id)

describe('높음: 워커가 git 설정이나 worktree 연결을 바꾸면 리드는 git을 더 부르지 않고 실패로 처리한다', () => {
  test('worktree의 .git 파일을 바꾸면 되돌리고 실패로 처리한다', async () => {
    const id = newTask(root, { ownership: ['a.txt'], verify: 'true' })
    const out = await run(
      id,
      fixture(
        { 'a.txt': 'A\n' },
        { writes: [{ path: '{{CWD}}/.git', content: 'gitdir: /tmp/evil-gitdir\n' }] },
      ),
    )
    expect(out.status).toBe('failed')
    expect(readFileSync(join(wtOf(id), '.git'), 'utf8')).not.toContain('/tmp/evil-gitdir')
    expect(String(fm(handoffFile(root, id)).lead_note)).toContain('git')
  })

  test('저장소 설정(.git/config)에 필터를 더하면 되돌리고 실패로 처리한다', async () => {
    const config = join(root, '.git', 'config')
    const before = readFileSync(config, 'utf8')
    const id = newTask(root, { ownership: ['a.txt'], verify: 'true' })
    const out = await run(
      id,
      fixture(
        { 'a.txt': 'A\n' },
        { writes: [{ path: config, content: '[filter "x"]\n\tclean = cat\n', append: true }] },
      ),
    )
    expect(out.status).toBe('failed')
    expect(readFileSync(config, 'utf8')).toBe(before)
  })

  test('저장소 설정이 포함하는 파일이 바뀌어도 알아차린다', async () => {
    const inc = join(realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-inc-'))), 'inc.cfg')
    writeFileSync(inc, '[user]\n\tname = t\n')
    sh(['git', 'config', 'include.path', inc], root)
    const id = newTask(root, { ownership: ['a.txt'], verify: 'true' })
    const out = await run(
      id,
      fixture(
        { 'a.txt': 'A\n' },
        { writes: [{ path: inc, content: '[filter "x"]\n\tclean = cat\n', append: true }] },
      ),
    )
    expect(out.status).toBe('failed')
    expect(String(fm(handoffFile(root, id)).lead_note)).toContain('설정')
  })
})

describe('낮음: 워커가 직접 커밋한 허용 밖 파일과 verify의 중첩 저장소', () => {
  test('워커가 커밋한 보호 경로의 새 파일도 브랜치 끝에서 지운다', async () => {
    const id = newTask(root, { ownership: ['a.txt'], verify: 'true' })
    const out = await run(
      id,
      fixture({ 'a.txt': 'A\n', '.claude/evil.md': 'x\n' }, { commit: true }),
    )
    expect(out.status).toBe('failed')
    const tip = sh(['git', 'ls-tree', '-r', '--name-only', `gotechy/${id}`], root)
    expect(tip).not.toContain('.claude/evil.md')
  })

  test('verify가 만든 중첩 저장소도 지운다', async () => {
    const id = newTask(root, { ownership: ['v.sh'], verify: 'sh v.sh' })
    await run(
      id,
      fixture({ 'v.sh': 'mkdir -p nested && cd nested && git init -q . && echo x > f; exit 0' }),
    )
    expect(existsSync(join(wtOf(id), 'nested'))).toBe(false)
  })
})

describe.skipIf(process.platform !== 'darwin')(
  '중간: verify 샌드박스는 다른 프로세스에 일을 시키는 명령을 막는다',
  () => {
    test('osascript를 실행하지 못한다', async () => {
      const id = newTask(root, { ownership: ['v.sh'], verify: 'sh v.sh' })
      await run(
        id,
        fixture({ 'v.sh': "/usr/bin/osascript -e 'return 1' >/dev/null 2>&1; exit $?" }),
      )
      expect((fm(handoffFile(root, id)).verified as { exit_code: number }).exit_code).toBe(126)
    })
  },
)
