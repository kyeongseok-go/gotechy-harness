// usage.ts의 남은 경로를 고정하는 characterization test (TD-010). 동작은 M0 실측 형식 그대로다.
import { expect, test } from 'bun:test'
import { emptyUsage, parseClaudeUsage, parseCodexUsage } from '../../src/core/usage'

test('Claude 줄 단위 출력(stream-json)이면 마지막 result 줄을 쓴다', () => {
  const out = [
    '{"type":"system"}',
    '깨진 줄',
    JSON.stringify({
      type: 'result',
      total_cost_usd: 0.5,
      usage: { input_tokens: 3, output_tokens: 4 },
    }),
  ].join('\n')
  expect(parseClaudeUsage(out)).toEqual({
    input_tokens: 3,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    output_tokens: 4,
    cost_usd: 0.5,
  })
})

test('Claude result에 modelUsage가 없으면 usage 칸을 쓰고, 비용이 없으면 null', () => {
  const out = JSON.stringify({
    type: 'result',
    usage: {
      input_tokens: 1,
      cache_read_input_tokens: 2,
      cache_creation_input_tokens: 3,
      output_tokens: 4,
    },
  })
  expect(parseClaudeUsage(out)).toEqual({
    input_tokens: 1,
    cache_read_tokens: 2,
    cache_write_tokens: 3,
    output_tokens: 4,
    cost_usd: null,
  })
})

test('Claude 출력에 result가 없으면 undefined', () => {
  expect(parseClaudeUsage('{"type":"system"}\n{"type":"assistant"}')).toBeUndefined()
})

test('Codex 출력의 깨진 JSON 줄은 건너뛴다', () => {
  const out = [
    '{깨진',
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 5, output_tokens: 1 } }),
  ].join('\n')
  expect(parseCodexUsage(out)?.input_tokens).toBe(5)
})

test('emptyUsage는 매번 새 객체다', () => {
  const a = emptyUsage()
  a.input_tokens = 9
  expect(emptyUsage().input_tokens).toBe(0)
})
