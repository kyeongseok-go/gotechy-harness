// contract.md 12절 Codex hook(1b N4): init이 .codex/hooks.json에 부작용 가드를 깔고, gotechy guard가 Codex의 입력 형식을 읽는다.
// Codex 형식은 공식 문서(learn.chatgpt.com/docs/hooks, 2026-10-15 확인): tool_name "Bash", tool_input.command,
// 막을 때 hookSpecificOutput.permissionDecision "deny". 실패와 시간 초과는 막지 않으므로(fail-open) 감싸개가 exit 2로 바꾼다.
import { beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initProject } from '../../src/runtime/init'
import { LIB, sh } from './helpers'

const HOME = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-gx-')))
const guard = (stdin: string) => {
  const r = Bun.spawnSync({
    cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), 'guard'],
    stdin: Buffer.from(stdin),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { PATH: process.env.PATH ?? '', HOME },
  })
  return { code: r.exitCode, out: r.stdout.toString() }
}
// Codex가 PreToolUse hook에 넘기는 모양(공통 칸과 PreToolUse 칸)
const codexInput = (command: string) =>
  JSON.stringify({
    session_id: 's',
    transcript_path: '/tmp/t.jsonl',
    cwd: '/tmp',
    hook_event_name: 'PreToolUse',
    model: 'gpt-6.1-sol',
    turn_id: 't1',
    tool_name: 'Bash',
    tool_use_id: 'u1',
    tool_input: { command },
    permission_mode: 'default',
  })
const hooksFile = (root: string) => join(root, '.codex', 'hooks.json')

describe('Codex 가드 hook (1b N4)', () => {
  let root: string
  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-gc-')))
    sh(['git', 'init', '-q', '-b', 'main'], root)
  })

  test('gotechy guard는 Codex 입력 형식에서도 오너 전용 명령을 막고 일상 명령은 통과시킨다', () => {
    const deny = guard(codexInput('gotechy decide G-001 5분'))
    expect(deny.code).toBe(0)
    expect(JSON.parse(deny.out).hookSpecificOutput.permissionDecision).toBe('deny')
    const ok = guard(codexInput('ls -la'))
    expect(ok).toEqual({ code: 0, out: '' })
  })

  test('init은 .codex/hooks.json에 Bash 앞 가드 hook을 깔고 gitignore에 넣는다', () => {
    initProject(root, { hooks: false })
    const data = JSON.parse(readFileSync(hooksFile(root), 'utf8'))
    const group = data.hooks.PreToolUse[0]
    expect(group.matcher).toBe('^Bash$')
    expect(group.hooks[0].type).toBe('command')
    expect(group.hooks[0].command).toContain(join(LIB, 'bin', 'gotechy'))
    expect(group.hooks[0].command).toContain('guard')
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('.codex/hooks.json')
  })

  test('처음 깔 때 Codex에서 신뢰하고 /hooks에서 승인해야 한다고 알리고, 바뀐 것이 없으면 다시 알리지 않는다', () => {
    expect(initProject(root, { hooks: false }).warnings.join('\n')).toContain('/hooks')
    expect(initProject(root, { hooks: false }).warnings.join('\n')).not.toContain('/hooks')
  })

  test('Codex 가드 hook도 gotechy가 없으면 exit 2로 막는다(Codex는 hook 실패를 막지 않음)', () => {
    initProject(root, { hooks: false })
    const data = JSON.parse(readFileSync(hooksFile(root), 'utf8'))
    const command = (data.hooks.PreToolUse[0].hooks[0].command as string).replaceAll(
      join(LIB, 'bin', 'gotechy'),
      join(root, 'no-such-gotechy'),
    )
    const r = Bun.spawnSync({
      cmd: ['sh', '-c', command],
      stdin: Buffer.from(codexInput('ls')),
      stderr: 'pipe',
      env: { PATH: '/usr/bin:/bin' },
    })
    expect(r.exitCode).toBe(2)
  })

  test('이미 있는 hooks.json의 다른 hook은 지키고 가드만 더하며, 다시 init해도 하나만 둔다', () => {
    mkdirSync(join(root, '.codex'), { recursive: true })
    const other = { matcher: '^apply_patch$', hooks: [{ type: 'command', command: 'echo mine' }] }
    writeFileSync(
      hooksFile(root),
      JSON.stringify({ hooks: { PreToolUse: [other], Stop: [{ hooks: [] }] } }),
    )
    initProject(root, { hooks: false })
    initProject(root, { hooks: false })
    const data = JSON.parse(readFileSync(hooksFile(root), 'utf8'))
    expect(data.hooks.Stop).toEqual([{ hooks: [] }])
    expect(data.hooks.PreToolUse).toHaveLength(2)
    // 가드는 맨 앞, 다른 hook은 그대로 뒤에(보안 감사 13차 중간 4)
    expect(JSON.stringify(data.hooks.PreToolUse[0])).toContain('guard')
    expect(data.hooks.PreToolUse[1]).toEqual(other)
  })

  test('읽을 수 없는 hooks.json은 바꾸지 않고 알린다', () => {
    mkdirSync(join(root, '.codex'), { recursive: true })
    writeFileSync(hooksFile(root), '{ 깨진 json')
    const report = initProject(root, { hooks: false })
    expect(readFileSync(hooksFile(root), 'utf8')).toBe('{ 깨진 json')
    expect(report.warnings.join('\n')).toContain('.codex/hooks.json')
  })
})
