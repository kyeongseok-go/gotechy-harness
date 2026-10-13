// 워커 격리 플래그가 빠지면 보안 경계가 무너진다 — 명령 조립을 고정한다.
import { describe, expect, test } from 'bun:test'
import { formatIssue } from '../../src/core/issues'
import { claudeArgs } from '../../src/runtime/adapters/claude'
import { codexArgs } from '../../src/runtime/adapters/codex'

const req = { taskId: 'T-001', cwd: '/wt', prompt: 'P', budgetUsd: 0.5, timeoutMs: 1000 }

describe('claudeArgs', () => {
  test('restricted·편집만 자동 승인·MCP 차단·예산 상한을 항상 건다', () => {
    const a = claudeArgs(req)
    expect(a.slice(0, 3)).toEqual(['claude', '-p', 'P'])
    for (const f of ['--restricted', '--strict-mcp-config']) expect(a).toContain(f)
    expect(a[a.indexOf('--permission-mode') + 1]).toBe('acceptEdits')
    expect(a[a.indexOf('--max-budget-usd') + 1]).toBe('0.5')
    expect(a).not.toContain('--dangerously-skip-permissions')
    expect(a).not.toContain('bypassPermissions')
  })

  test('결정·작업 명세 폴더를 deny한다', () => {
    const a = claudeArgs(req)
    const settings = JSON.parse(a[a.indexOf('--settings') + 1] ?? '{}')
    expect(settings.permissions.deny).toContain('Edit(./orchestration/gates/**)')
    expect(settings.permissions.deny).toContain('Read(./orchestration/gates/**)')
    expect(settings.permissions.deny).toContain('Write(./orchestration/tasks/**)')
  })

  test('모델·effort는 지정했을 때만 붙인다', () => {
    expect(claudeArgs(req)).not.toContain('--model')
    const a = claudeArgs({ ...req, model: 'claude-opus-5-5', effort: 'low' })
    expect(a[a.indexOf('--model') + 1]).toBe('claude-opus-5-5')
    expect(a[a.indexOf('--effort') + 1]).toBe('low')
  })
})

describe('codexArgs', () => {
  test('workspace-write 샌드박스를 worktree에 묶고 기록을 남기지 않는다', () => {
    const a = codexArgs(req)
    expect(a.slice(0, 3)).toEqual(['codex', 'exec', '--json'])
    expect(a[a.indexOf('-s') + 1]).toBe('workspace-write')
    expect(a[a.indexOf('-C') + 1]).toBe('/wt')
    expect(a).toContain('--ephemeral')
    expect(a).not.toContain('--dangerously-bypass-approvals-and-sandbox')
    expect(a.at(-1)).toBe('P')
  })

  test('effort는 TOML 문자열로 넘긴다', () => {
    const a = codexArgs({ ...req, model: 'gpt-6.1-sol', effort: 'medium' })
    expect(a[a.indexOf('-m') + 1]).toBe('gpt-6.1-sol')
    expect(a[a.indexOf('-c') + 1]).toBe('model_reasoning_effort="medium"')
  })
})

describe('formatIssue', () => {
  test('위치·규칙·교정·예시를 한 덩어리로 보여 준다', () => {
    const s = formatIssue({
      file: 'a.md',
      line: 3,
      col: 2,
      rule: 'r',
      message: 'm',
      fix: 'f',
      example: 'e',
    })
    expect(s).toBe('a.md:3:2 [r] m\n  고치는 법: f\n  예: e')
    expect(formatIssue({ file: 'a.md', rule: 'r', message: 'm', fix: 'f' })).toBe(
      'a.md [r] m\n  고치는 법: f',
    )
  })
})
