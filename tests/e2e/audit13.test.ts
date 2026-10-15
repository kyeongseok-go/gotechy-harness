// 보안 감사 13차(2026-10-15 오후 변경 재검토) 지적의 수용 테스트.
import { describe, expect, test } from 'bun:test'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isProtected } from '../../src/core/paths'
import { acceptTask } from '../../src/runtime/accept'
import { codexAdapter } from '../../src/runtime/adapters/codex'
import { initProject } from '../../src/runtime/init'
import { runTask } from '../../src/runtime/run'
import { FAKE, LIB, makeHome, makeProject, newTask, sh } from './helpers'

const tmp = (p: string) => realpathSync(mkdtempSync(join(tmpdir(), p)))
const cli = (args: string[], cwd: string, env: Record<string, string | undefined>) => {
  const r = Bun.spawnSync({
    cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), ...args],
    cwd,
    env: env as Record<string, string>,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() }
}

describe('높음 1: 남의 저장소가 심은 링크와 추적 파일', () => {
  test('verify 기록 자리에 링크가 있어도 따라가지 않고 링크를 바꿔 쓴다', async () => {
    const root = makeProject()
    const home = makeHome()
    const id = newTask(root, { verify: 'echo VERIFY-OUT && grep -q 설치 README.md' })
    const target = join(tmp('gotechy-victim-'), 'victim.txt')
    writeFileSync(target, 'ORIGINAL\n')
    mkdirSync(join(root, '.gotechy', 'runs'), { recursive: true })
    symlinkSync(target, join(root, '.gotechy', 'runs', `${id}-verify.log`))
    await runTask({ root }, id, { adapter: 'fake', fixtureDir: join(FAKE, 'readme-ok'), home })
    expect(readFileSync(target, 'utf8')).toBe('ORIGINAL\n')
    const log = join(root, '.gotechy', 'runs', `${id}-verify.log`)
    expect(lstatSync(log).isSymbolicLink()).toBe(false)
    expect(readFileSync(log, 'utf8')).toContain('VERIFY-OUT')
  })

  test('git이 추적하는 .gotechy/나 orchestration/private/가 있으면 명령을 멈춘다', () => {
    const root = makeProject()
    mkdirSync(join(root, '.gotechy', 'runs'), { recursive: true })
    writeFileSync(join(root, '.gotechy', 'runs', 'planted.log'), 'x\n')
    sh(['git', 'add', '-f', '.gotechy/runs/planted.log'], root)
    sh(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'plant'], root)
    const r = cli(['inbox'], root, { ...process.env, GOTECHY_HOME: tmp('gotechy-gh13-') })
    expect(r.code).toBe(2)
    expect(r.err).toContain('.gotechy')
  })

  test('기준 커밋 기록이 커밋 번호가 아니면 run을 거부한다', async () => {
    const root = makeProject()
    const home = makeHome()
    const id = newTask(root)
    mkdirSync(join(root, '.gotechy', 'worktrees'), { recursive: true })
    writeFileSync(join(root, '.gotechy', 'worktrees', `${id}.base`), '--output=/tmp/x\n')
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: join(FAKE, 'readme-ok'),
      home,
    })
    expect(out.status).toBe('refused')
    expect(out.messages.join('\n')).toContain('기준 커밋')
  })

  test('worktree 자리에 등록되지 않은 폴더가 있으면 run을 거부한다', async () => {
    const root = makeProject()
    const home = makeHome()
    const id = newTask(root)
    mkdirSync(join(root, '.gotechy', 'worktrees', id), { recursive: true })
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: join(FAKE, 'readme-ok'),
      home,
    })
    expect(out.status).toBe('refused')
    expect(out.messages.join('\n')).toContain('worktree')
  })
})

describe('중간 1: GOTECHY_HOME이 비었거나 상대 경로', () => {
  test('빈 값이나 상대 경로면 멈춘다', () => {
    const root = makeProject()
    for (const v of ['', 'owner-home'])
      expect({
        v,
        code: cli(['gate', 'verify'], root, { ...process.env, GOTECHY_HOME: v }).code,
      }).toEqual({
        v,
        code: 2,
      })
  })
})

describe('중간 2: 하위 폴더의 에이전트 설정 폴더', () => {
  test('어느 깊이의 .claude/, .agents/, .codex/와 루트 .mcp.json도 보호한다', () => {
    for (const p of [
      'packages/x/.claude/skills/a/SKILL.md',
      'a/.agents/x.md',
      'b/.codex/hooks.json',
      'c/.CLAUDE/settings.json',
      '.mcp.json',
    ])
      expect({ p, protected: isProtected(p) }).toEqual({ p, protected: true })
    expect(isProtected('docs/.claude-notes.md')).toBe(false)
    expect(isProtected('src/claude/x.ts')).toBe(false)
  })
})

describe('중간 3: 한글 파일 이름', () => {
  test('워커가 커밋한 한글 파일 이름도 따옴표 없이 비교해 허용 범위 안이면 통과한다', async () => {
    const root = makeProject()
    const home = makeHome()
    const id = newTask(root, { ownership: ['문서.md'], verify: 'grep -q 공문 문서.md' })
    const dir = tmp('gotechy-fx13-')
    mkdirSync(join(dir, 'files'))
    writeFileSync(join(dir, 'files', '문서.md'), '공문\n')
    // 워커가 직접 커밋하면 이름이 git diff --name-only에서 온다(셸이 있는 codex 흉내)
    writeFileSync(join(dir, 'commit'), '')
    writeFileSync(
      join(dir, 'handoff.md'),
      readFileSync(join(FAKE, 'readme-ok', 'handoff.md'), 'utf8').replaceAll(
        'README.md',
        '문서.md',
      ),
    )
    const out = await runTask({ root }, id, { adapter: 'fake', fixtureDir: dir, home })
    expect(out.messages.join('\n')).not.toContain('허용 밖')
    expect(out.status).toBe('done')
  })
})

describe('중간 3: 한글 파일 이름의 병합', () => {
  test('한글 파일 이름을 바꾼 작업도 허용 범위 안이면 accept가 병합한다', async () => {
    const root = makeProject()
    const home = makeHome()
    const id = newTask(root, { ownership: ['문서.md'], verify: 'grep -q 공문 문서.md' })
    const dir = tmp('gotechy-fx13b-')
    mkdirSync(join(dir, 'files'))
    writeFileSync(join(dir, 'files', '문서.md'), '공문\n')
    writeFileSync(
      join(dir, 'handoff.md'),
      readFileSync(join(FAKE, 'readme-ok', 'handoff.md'), 'utf8').replaceAll(
        'README.md',
        '문서.md',
      ),
    )
    const run = await runTask({ root }, id, { adapter: 'fake', fixtureDir: dir, home })
    expect(run.status).toBe('done')
    const out = await acceptTask({ root }, home, id)
    expect(out.messages.join('\n')).not.toContain('허용 밖')
    expect(out.status).toBe('accepted')
  })
})

describe('중간 1: 프로젝트 밖에서 도는 명령도 GOTECHY_HOME을 검사한다', () => {
  test('setup도 빈 GOTECHY_HOME이면 멈춘다', () => {
    const r = cli(['setup', '--dry-run'], tmp('gotechy-out13-'), {
      ...process.env,
      GOTECHY_HOME: '',
    })
    expect(r.code).toBe(2)
    expect(r.err).toContain('GOTECHY_HOME')
  })
})

describe('중간 4와 낮음 4, 5: init의 가드 설정', () => {
  const repo = () => {
    const root = tmp('gotechy-g13-')
    sh(['git', 'init', '-q', '-b', 'main'], root)
    return root
  }

  test('git이 추적하는 hooks 파일에는 쓰지 않고 알린다(경로가 커밋되지 않게)', () => {
    const root = repo()
    mkdirSync(join(root, '.codex'), { recursive: true })
    writeFileSync(join(root, '.codex', 'hooks.json'), '{"hooks":{}}\n')
    sh(['git', 'add', '.codex/hooks.json'], root)
    sh(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x'], root)
    const report = initProject(root, { hooks: false })
    expect(readFileSync(join(root, '.codex', 'hooks.json'), 'utf8')).toBe('{"hooks":{}}\n')
    expect(report.warnings.join('\n')).toContain('git이 추적')
  })

  test('표시가 붙은 옛 가드 항목은 모두 지우고 가드를 맨 앞에 하나만 두며, 다른 hook을 알린다', () => {
    const root = repo()
    mkdirSync(join(root, '.codex'), { recursive: true })
    const stale = { matcher: 'x', hooks: [{ type: 'command', command: 'old gotechy 가드' }] }
    const other = { matcher: '^Bash$', hooks: [{ type: 'command', command: 'echo theirs' }] }
    writeFileSync(
      join(root, '.codex', 'hooks.json'),
      JSON.stringify({ hooks: { PreToolUse: [other, stale, stale] } }),
    )
    const report = initProject(root, { hooks: false })
    const pre = JSON.parse(readFileSync(join(root, '.codex', 'hooks.json'), 'utf8')).hooks
      .PreToolUse as Record<string, unknown>[]
    expect(pre).toHaveLength(2)
    expect(JSON.stringify(pre[0])).toContain(join(LIB, 'bin', 'gotechy'))
    expect(pre[1]).toEqual(other)
    expect(report.warnings.join('\n')).toContain('다른 hook')
  })

  test('hooks 값이 객체가 아니면 바꾸지 않고 알린다', () => {
    const root = repo()
    mkdirSync(join(root, '.codex'), { recursive: true })
    writeFileSync(join(root, '.codex', 'hooks.json'), '{"hooks":"oops"}')
    const report = initProject(root, { hooks: false })
    expect(readFileSync(join(root, '.codex', 'hooks.json'), 'utf8')).toBe('{"hooks":"oops"}')
    expect(report.warnings.join('\n')).toContain('.codex/hooks.json')
  })

  test('리드가 가드 설정 파일을 편집 도구로 고치지 못하게 deny에 넣는다', () => {
    const root = repo()
    initProject(root, { hooks: false })
    const deny = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'))
      .permissions.deny as string[]
    expect(deny).toEqual(
      expect.arrayContaining([
        'Edit(.claude/**)',
        'Write(.claude/**)',
        'Edit(.codex/**)',
        'Write(.codex/**)',
      ]),
    )
  })
})

describe('낮음 1: 무시되는 글자', () => {
  test('폭 없는 글자를 끼운 보호 경로도 보호한다', () => {
    const zw = String.fromCodePoint(0x200b)
    expect(isProtected(`.cla${zw}ude/settings.json`)).toBe(true)
  })
})

describe('낮음 10: 테스트 안에서 실제 에이전트 CLI를 부르지 못하게 하는 두 번째 울타리', () => {
  test('임시 폴더 밖의 codex로 풀리면 실행하지 않는다', async () => {
    const bin = join(LIB, 'tests', 'fixtures', 'bin-outside-tmp')
    expect(existsSync(join(bin, 'codex'))).toBe(true)
    const before = process.env.PATH
    process.env.PATH = `${bin}:${before}`
    try {
      const r = await codexAdapter.run({
        taskId: 'T-001',
        cwd: tmp('gotechy-w13-'),
        prompt: 'x',
        budgetUsd: 0.1,
        timeoutMs: 5000,
      })
      expect(r.exitCode).not.toBe(0)
      expect(r.stderr).toContain('테스트')
    } finally {
      process.env.PATH = before
    }
  })
})
