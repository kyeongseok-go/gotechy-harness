// contract.md 12절: gotechy guard(Claude Code PreToolUse hook), init이 까는 프로젝트 설정, 상태 줄(1b N4).
import { beforeEach, describe, expect, test } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { guardHookCommand, initProject } from '../../src/runtime/init'
import { LIB, makeHome, makeProject, newTask, runFake, sh } from './helpers'

// HOME을 저장소로 두면 bun이 그 안에 변환 캐시(Library/Caches)를 쓴다(2026-10-15 실수). 늘 임시 HOME을 쓴다
const HOME = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-gh-')))
const cli = (args: string[], cwd: string, stdin?: string) => {
  const r = Bun.spawnSync({
    cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), ...args],
    cwd,
    stdin: stdin === undefined ? 'ignore' : Buffer.from(stdin),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { PATH: process.env.PATH ?? '', HOME },
  })
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() }
}
const hookInput = (command: string, tool = 'Bash') =>
  JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command } })
// 이 저장소의 Bash hook이 force push 문자열을 막으므로 테스트 문자열은 조각으로 만든다
const FORCE_PUSH = ['git', 'push', '--force', 'origin', 'main'].join(' ')

describe('gotechy guard (Validation 9)', () => {
  test('gotechy decide와 force push는 deny로 답한다', () => {
    for (const cmd of ['gotechy decide G-001 5분', FORCE_PUSH]) {
      const r = cli(['guard'], LIB, hookInput(cmd))
      expect(r.code).toBe(0)
      const o = JSON.parse(r.out)
      expect(o.hookSpecificOutput.hookEventName).toBe('PreToolUse')
      expect(o.hookSpecificOutput.permissionDecision).toBe('deny')
      expect(o.hookSpecificOutput.permissionDecisionReason.length).toBeGreaterThan(0)
    }
  })

  test('일상 명령과 Bash가 아닌 도구는 아무것도 출력하지 않고 통과시킨다', () => {
    for (const input of [hookInput('git status'), hookInput('gotechy decide', 'Read')]) {
      const r = cli(['guard'], LIB, input)
      expect({ code: r.code, out: r.out }).toEqual({ code: 0, out: '' })
    }
  })

  test('입력을 읽을 수 없으면 막는다(fail-closed)', () => {
    for (const input of ['not json', '', JSON.stringify({ tool_name: 'Bash' })]) {
      const r = cli(['guard'], LIB, input)
      expect({ input, decision: JSON.parse(r.out).hookSpecificOutput.permissionDecision }).toEqual({
        input,
        decision: 'deny',
      })
    }
  })
})

describe('init이 까는 프로젝트 설정', () => {
  let root: string
  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-g-')))
    sh(['git', 'init', '-q', '-b', 'main'], root)
  })

  test('settings.json에 deny 규칙, settings.local.json에 가드 hook(라이브러리 절대 경로), gitignore에 local', () => {
    initProject(root, { hooks: false })
    const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'))
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining([
        'Bash(gotechy decide:*)',
        'Bash(gotechy serve:*)',
        'Bash(gotechy keys:*)',
      ]),
    )
    expect(JSON.stringify(settings)).not.toContain(LIB)
    const local = JSON.parse(readFileSync(join(root, '.claude', 'settings.local.json'), 'utf8'))
    const hook = local.hooks.PreToolUse[0]
    expect(hook.matcher).toBe('Bash')
    expect(hook.hooks[0].command).toContain(join(LIB, 'bin', 'gotechy'))
    expect(hook.hooks[0].command).toContain('guard')
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('.claude/settings.local.json')
  })

  test('가드 hook은 gotechy가 없으면 exit 2로 막는다', () => {
    initProject(root, { hooks: false })
    const local = JSON.parse(readFileSync(join(root, '.claude', 'settings.local.json'), 'utf8'))
    const command = (local.hooks.PreToolUse[0].hooks[0].command as string).replaceAll(
      join(LIB, 'bin', 'gotechy'),
      join(root, 'no-such-gotechy'),
    )
    const r = Bun.spawnSync({
      cmd: ['sh', '-c', command],
      stdin: Buffer.from(hookInput('ls')),
      stderr: 'pipe',
      env: { PATH: '/usr/bin:/bin' },
    })
    expect(r.exitCode).toBe(2)
    expect(r.stderr.toString()).toContain('가드')
  })

  test('이미 있는 settings.json은 바꾸지 않고 알린다', () => {
    const own = '{"permissions":{"allow":["Bash(ls:*)"]}}\n'
    sh(['mkdir', '-p', '.claude'], root)
    writeFileSync(join(root, '.claude', 'settings.json'), own)
    const r = initProject(root, { hooks: false })
    expect(readFileSync(join(root, '.claude', 'settings.json'), 'utf8')).toBe(own)
    expect(r.warnings.join('\n')).toContain('settings.json')
    expect(existsSync(join(root, '.claude', 'settings.local.json'))).toBe(true)
  })
})

describe('gotechy status --line (상태 줄)', () => {
  test('열린 결정 수를 한 줄로 보여 준다', async () => {
    const root = makeProject()
    const home = makeHome()
    expect(cli(['status', '--line'], root).out).toBe('gotechy 대기 없음\n')
    const id = newTask(root, { title: '캐시', verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'needs-decision')
    expect(cli(['status', '--line'], root).out).toBe('gotechy 결정 대기 2\n')
  })

  test('프로젝트 밖에서는 아무것도 출력하지 않는다', () => {
    const out = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-s-')))
    expect(cli(['status', '--line'], out)).toEqual({ code: 0, out: '', err: '' })
  })
})

describe('보안 감사 10차', () => {
  test('중간 4: 가드가 0이 아닌 코드로 끝나면 hook은 exit 2로 막고, 0이면 통과시킨다', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-g4-')))
    for (const [code, expected] of [
      [0, 0],
      [1, 2],
      [7, 2],
    ] as const) {
      const bin = join(root, `fake-gotechy-${code}`)
      writeFileSync(bin, `#!/bin/sh\nexit ${code}\n`)
      chmodSync(bin, 0o755)
      const r = Bun.spawnSync({
        cmd: ['sh', '-c', guardHookCommand(bin)],
        stdin: Buffer.from(hookInput('ls')),
        stderr: 'pipe',
        env: { PATH: '/usr/bin:/bin' },
      })
      expect({ code, exit: r.exitCode }).toEqual({ code, exit: expected })
    }
  })

  test('중간 4, 낮음 14: 경로에 따옴표, 달러, 공백이 있어도 셸이 해석하지 않는다', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-g14-')))
    const odd = join(root, `it's "q" $(touch ${join(root, 'pwned')}) x`)
    const r = Bun.spawnSync({
      cmd: ['sh', '-c', guardHookCommand(join(odd, 'gotechy'))],
      stdin: Buffer.from(hookInput('ls')),
      stderr: 'pipe',
      env: { PATH: '/usr/bin:/bin' },
    })
    expect(r.exitCode).toBe(2)
    expect(existsSync(join(root, 'pwned'))).toBe(false)
  })

  test('낮음 8: 객체가 아니거나 tool_name이 없으면 막는다', () => {
    for (const input of [
      '{}',
      'null',
      '[]',
      JSON.stringify({ toolName: 'Bash', tool_input: { command: 'ls' } }),
    ]) {
      const r = cli(['guard'], LIB, input)
      expect({ input, decision: JSON.parse(r.out).hookSpecificOutput.permissionDecision }).toEqual({
        input,
        decision: 'deny',
      })
    }
  })

  test('낮음 9: 표준 입력이 닫히지 않으면 기한 안에 막는다', async () => {
    const proc = Bun.spawn({
      cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), 'guard'],
      cwd: LIB,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { PATH: process.env.PATH ?? '', HOME, GOTECHY_GUARD_STDIN_MS: '300' },
    })
    const out = await new Response(proc.stdout).text()
    expect(JSON.parse(out).hookSpecificOutput.permissionDecision).toBe('deny')
    proc.stdin.end()
  })

  test('중간 5: settings.local.json이 이미 있으면 다른 키는 지키고 가드 hook만 더한다. 라이브러리를 옮기면 경로를 갱신한다', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-g5-')))
    sh(['git', 'init', '-q', '-b', 'main'], root)
    sh(['mkdir', '-p', '.claude'], root)
    const local = join(root, '.claude', 'settings.local.json')
    const old = guardHookCommand('/old/place/bin/gotechy')
    writeFileSync(
      local,
      JSON.stringify({
        permissions: { allow: ['Bash(ls:*)'] },
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: old }] }] },
      }),
    )
    initProject(root, { hooks: false })
    const data = JSON.parse(readFileSync(local, 'utf8'))
    expect(data.permissions.allow).toEqual(['Bash(ls:*)'])
    expect(data.hooks.PreToolUse).toHaveLength(1)
    expect(data.hooks.PreToolUse[0].hooks[0].command).toContain(join(LIB, 'bin', 'gotechy'))

    const fresh = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-g5b-')))
    sh(['git', 'init', '-q', '-b', 'main'], fresh)
    sh(['mkdir', '-p', '.claude'], fresh)
    writeFileSync(
      join(fresh, '.claude', 'settings.local.json'),
      '{"permissions":{"allow":["Bash(ls:*)"]}}',
    )
    initProject(fresh, { hooks: false })
    const d2 = JSON.parse(readFileSync(join(fresh, '.claude', 'settings.local.json'), 'utf8'))
    expect(d2.permissions.allow).toEqual(['Bash(ls:*)'])
    expect(d2.hooks.PreToolUse[0].hooks[0].command).toContain('guard')
  })

  test('중간 6: keys init과 rotate는 대화형 터미널이 아니면 exit 2', () => {
    for (const sub of ['init', 'rotate']) {
      const r = cli(['keys', sub], LIB)
      expect({ sub, code: r.code }).toEqual({ sub, code: 2 })
    }
  })

  test('낮음 13: 게이트 폴더에 링크가 있으면 상태 줄은 아무것도 보여 주지 않는다', () => {
    const root = makeProject()
    symlinkSync('/dev/zero', join(root, 'orchestration', 'gates', 'G-001.md'))
    const t0 = Date.now()
    expect(cli(['status', '--line'], root).out).toBe('')
    expect(Date.now() - t0).toBeLessThan(5000)
  })
})
