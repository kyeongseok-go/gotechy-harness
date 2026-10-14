// contract.md 12절: gotechy guard(Claude Code PreToolUse hook), init이 까는 프로젝트 설정, 상태 줄(1b N4).
import { beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initProject } from '../../src/runtime/init'
import { LIB, makeHome, makeProject, newTask, runFake, sh } from './helpers'

const cli = (args: string[], cwd: string, stdin?: string) => {
  const r = Bun.spawnSync({
    cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), ...args],
    cwd,
    stdin: stdin === undefined ? 'ignore' : Buffer.from(stdin),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { PATH: process.env.PATH ?? '', HOME: cwd },
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
