import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { disallowedChanges, isProtected } from '../../src/core/paths'
import { parseClaudeUsage, parseCodexUsage } from '../../src/core/usage'

describe('disallowedChanges', () => {
  test('ownership과 자기 HANDOFF만 허용한다', () => {
    const bad = disallowedChanges(
      [
        'README.md',
        'orchestration/handoffs/T-001.md',
        'src/a.ts',
        'orchestration/handoffs/T-002.md',
      ],
      ['README.md'],
      'T-001',
    )
    expect(bad).toEqual(['src/a.ts', 'orchestration/handoffs/T-002.md'])
  })

  test('ownership에 넣어도 보호 경로는 언제나 금지다', () => {
    expect(
      disallowedChanges(['orchestration/gates/G-001.md'], ['orchestration/'], 'T-001'),
    ).toEqual(['orchestration/gates/G-001.md'])
  })

  test('폴더 ownership은 그 아래 파일을 허용한다', () => {
    expect(disallowedChanges(['src/parser/a.ts'], ['src/parser/'], 'T-001')).toEqual([])
  })

  test('보호 판정은 ./ 와 역슬래시를 정규화한다', () => {
    expect(isProtected('./AGENTS.md')).toBe(true)
    expect(isProtected('orchestration\\gates\\G-1.md')).toBe(true)
    expect(isProtected('docs/AGENTS.md')).toBe(false)
  })
})

const fx = (f: string) => readFileSync(join(import.meta.dir, '..', 'fixtures', 'usage', f), 'utf8')

describe('usage 파서 (M0 실제 출력 형식)', () => {
  test('Claude: modelUsage 합계와 total_cost_usd', () => {
    expect(parseClaudeUsage(fx('claude-result.json'))).toEqual({
      input_tokens: 12,
      cache_read_tokens: 40000,
      cache_write_tokens: 9000,
      output_tokens: 700,
      cost_usd: 0.1777,
    })
  })

  test('Claude: JSON이 아니면 undefined', () => {
    expect(parseClaudeUsage('error: not logged in')).toBeUndefined()
  })

  test('Codex: cached는 input의 부분집합, reasoning은 출력에 합산', () => {
    expect(parseCodexUsage(fx('codex-events.jsonl'))).toEqual({
      input_tokens: 51254 - 40192,
      cache_read_tokens: 40192,
      cache_write_tokens: 0,
      output_tokens: 352 + 116,
      cost_usd: null,
    })
  })

  test('Codex: turn.completed가 없으면 undefined', () => {
    expect(parseCodexUsage('{"type":"thread.started"}\n')).toBeUndefined()
  })
})
