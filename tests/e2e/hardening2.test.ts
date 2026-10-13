// 보안 감사 2차(2026-10-14 밤) 지적의 재현 테스트. 1차 수정에서 생긴 빈틈을 공격해 본다.
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
import { acceptTask } from '../../src/runtime/accept'
import { listGates } from '../../src/runtime/gates'
import { runTask } from '../../src/runtime/run'
import { FAKE, fm, handoffFile, makeHome, makeProject, newTask, sh } from './helpers'

let root: string
let home: string
beforeEach(() => {
  root = makeProject()
  home = makeHome()
})

function fixture(
  files: Record<string, string>,
  opts: { handoff?: string; hardlinks?: unknown[] } = {},
) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fx2-')))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, 'files', rel)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content)
  }
  if (opts.handoff !== undefined) writeFileSync(join(dir, 'handoff.md'), opts.handoff)
  if (opts.hardlinks) writeFileSync(join(dir, 'hardlinks.json'), JSON.stringify(opts.hardlinks))
  return dir
}
const okHandoff = readFileSync(join(FAKE, 'readme-ok', 'handoff.md'), 'utf8')
const run = (id: string, dir: string) =>
  runTask({ root }, id, { adapter: 'fake', fixtureDir: dir, home })
/** 메인 대비 작업 브랜치에서 바뀐 파일 */
const branchFiles = (id: string) =>
  sh(['git', 'diff', '--name-only', 'main', `gotechy/${id}`], root)
    .trim()
    .split('\n')
const activeKey = () => {
  const id = readFileSync(join(home, 'keys', 'active'), 'utf8').trim()
  return readFileSync(join(home, 'keys', `${id}.key`), 'utf8').trim()
}

describe.skipIf(process.platform !== 'darwin')(
  '높음 A: verify 샌드박스는 프로젝트 밖 쓰기, 네트워크, 환경 변수를 막는다',
  () => {
    test('verify가 프로젝트 밖 파일을 쓰지 못한다', async () => {
      const outside = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-outside-')))
      const script = `echo planted > ${join(outside, 'gitconfig')} 2>/dev/null; exit 0`
      const id = newTask(root, { ownership: ['v.sh'], verify: 'sh v.sh' })
      await run(id, fixture({ 'v.sh': script }, { handoff: okHandoff }))
      expect(existsSync(join(outside, 'gitconfig'))).toBe(false)
    })

    test('verify는 네트워크에 연결하지 못한다', async () => {
      let hits = 0
      const server = Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        fetch: () => {
          hits++
          return new Response('ok')
        },
      })
      try {
        const script = `/usr/bin/curl -s -m 3 http://127.0.0.1:${server.port}/ >/dev/null 2>&1; exit 0`
        const id = newTask(root, { ownership: ['v.sh'], verify: 'sh v.sh' })
        await run(id, fixture({ 'v.sh': script }, { handoff: okHandoff }))
        expect(hits).toBe(0)
      } finally {
        server.stop(true)
      }
    })

    test('verify에는 오너의 환경 변수(토큰 같은)가 넘어가지 않는다', async () => {
      process.env.GOTECHY_TEST_SECRET = 'leak-me'
      try {
        const id = newTask(root, { ownership: ['v.sh'], verify: 'sh v.sh' })
        const out = await run(
          id,
          fixture({ 'v.sh': '[ -z "$GOTECHY_TEST_SECRET" ]' }, { handoff: okHandoff }),
        )
        expect(out.status).toBe('done')
      } finally {
        delete process.env.GOTECHY_TEST_SECRET
      }
    })

    test('verify는 worktree의 .git 파일을 바꾸지 못한다', async () => {
      const id = newTask(root, { ownership: ['v.sh'], verify: 'sh v.sh' })
      await run(
        id,
        fixture(
          { 'v.sh': 'echo "gitdir: /tmp/evil" > .git 2>/dev/null; exit 0' },
          { handoff: okHandoff },
        ),
      )
      const wt = join(root, '.gotechy', 'worktrees', id)
      expect(readFileSync(join(wt, '.git'), 'utf8')).not.toContain('/tmp/evil')
    })
  },
)

describe('높음 B: verify가 만든 파일은 작업 브랜치에 들어가지 않는다', () => {
  test('verify가 쓴 보호 경로 파일과 부산물은 커밋되지 않는다', async () => {
    const script =
      'mkdir -p .claude; echo x > .claude/settings.json; echo y > AGENTS.md; echo z > junk.txt; exit 0'
    const id = newTask(root, { ownership: ['v.sh'], verify: 'sh v.sh' })
    expect((await run(id, fixture({ 'v.sh': script }, { handoff: okHandoff }))).status).toBe('done')
    const files = branchFiles(id)
    expect(files).toContain('v.sh')
    expect(files).not.toContain('AGENTS.md')
    expect(files).not.toContain('junk.txt')
    expect(files).not.toContain('.claude/settings.json')
    // 다시 실행하면 남은 부산물이 워커 변경으로 잡힌다. worktree에도 남지 않아야 한다
    const wt = join(root, '.gotechy', 'worktrees', id)
    expect(existsSync(join(wt, 'junk.txt'))).toBe(false)
    expect(readFileSync(join(wt, 'AGENTS.md'), 'utf8')).not.toBe('y\n')
  })

  test('accept는 작업 브랜치의 변경 범위를 다시 검사한다', async () => {
    const id = newTask(root, { ownership: ['a.txt'], verify: 'test -f a.txt' })
    expect((await run(id, join(FAKE, 'write-a'))).status).toBe('done')
    const wt = join(root, '.gotechy', 'worktrees', id)
    writeFileSync(join(wt, 'AGENTS.md'), '# 바뀐 지도\n')
    sh(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'sneak'], wt)
    const out = await acceptTask({ root }, home, id)
    expect(out.status).toBe('rejected')
    expect(out.messages.join('\n')).toContain('AGENTS.md')
  })
})

describe('중간 D: 하드 링크와 키 유출', () => {
  test('워커가 만든 하드 링크는 되돌리고 실패로 처리한다', async () => {
    const victim = join(root, 'orchestration', 'project.yaml')
    const id = newTask(root, { ownership: ['p.txt'], verify: 'true' })
    const out = await run(
      id,
      fixture({}, { handoff: okHandoff, hardlinks: [{ path: 'p.txt', target: victim }] }),
    )
    expect(out.status).toBe('failed')
    expect(String(fm(handoffFile(root, id)).lead_note)).toContain('하드 링크')
    expect(branchFiles(id)).not.toContain('p.txt')
  })

  test('워커가 서명 키 내용을 파일에 넣으면 되돌리고 실패로 처리한다', async () => {
    const id = newTask(root, { ownership: ['k.txt'], verify: 'true' })
    const out = await run(
      id,
      fixture({ 'k.txt': `leaked ${activeKey()}\n` }, { handoff: okHandoff }),
    )
    expect(out.status).toBe('failed')
    expect(String(fm(handoffFile(root, id)).lead_note)).toContain('서명 키')
    expect(branchFiles(id)).not.toContain('k.txt')
  })
})

describe('낮음 E: 되돌리기 어려움은 실제로 바뀐 파일도 본다', () => {
  test('ownership이 src/여도 src/auth/를 바꿨으면 이해 게이트 대상이다', async () => {
    const id = newTask(root, { ownership: ['src/'], verify: 'test -f src/auth/login.ts' })
    await run(id, join(FAKE, 'auth-decision'))
    expect(listGates({ root })[0]?.irreversible).toBe(true)
  })
})
