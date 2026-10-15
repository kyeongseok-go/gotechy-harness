// 워커 출력에서 토큰·비용을 정규화한다. 형식은 M0에서 실제 출력으로 확인했다 (ExecPlan Surprises).
import type { Usage } from './schema'

const ZERO: Usage = {
  input_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  output_tokens: 0,
  cost_usd: null,
}

type Num = number | undefined
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** `claude -p --output-format json`: type=result 객체 하나가 실행 전체 합계. modelUsage가 있으면 모델별 합을 쓴다. */
export function parseClaudeUsage(stdout: string): Usage | undefined {
  let obj: Record<string, unknown> | undefined
  try {
    const parsed: unknown = JSON.parse(stdout.trim())
    if (parsed && typeof parsed === 'object') obj = parsed as Record<string, unknown>
  } catch {
    // stream-json(줄 단위)일 수 있다 — 마지막 result 줄을 찾는다
    for (const line of stdout.trim().split('\n').reverse()) {
      try {
        const o = JSON.parse(line) as Record<string, unknown>
        if (o.type === 'result') {
          obj = o
          break
        }
      } catch {
        // 계속 찾는다
      }
    }
  }
  if (obj?.type !== 'result') return undefined
  const cost = typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : null
  const models = obj.modelUsage as Record<string, Record<string, Num>> | undefined
  if (models && Object.keys(models).length > 0) {
    const sum = (k: string) => Object.values(models).reduce((a, m) => a + n(m[k]), 0)
    return {
      input_tokens: sum('inputTokens'),
      cache_read_tokens: sum('cacheReadInputTokens'),
      cache_write_tokens: sum('cacheCreationInputTokens'),
      output_tokens: sum('outputTokens'),
      cost_usd: cost,
    }
  }
  const u = (obj.usage ?? {}) as Record<string, Num>
  return {
    input_tokens: n(u.input_tokens),
    cache_read_tokens: n(u.cache_read_input_tokens),
    cache_write_tokens: n(u.cache_creation_input_tokens),
    output_tokens: n(u.output_tokens),
    cost_usd: cost,
  }
}

/** `codex exec --json`: turn.completed 이벤트의 usage 합. cached_input_tokens는 input_tokens의 부분집합(OpenAI 관례). */
export function parseCodexUsage(stdout: string): Usage | undefined {
  let found = false
  const total = { ...ZERO }
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue
    let e: Record<string, unknown>
    try {
      e = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (e.type !== 'turn.completed') continue
    found = true
    const u = (e.usage ?? {}) as Record<string, Num>
    const input = n(u.input_tokens)
    const cached = Math.min(n(u.cached_input_tokens), input)
    total.input_tokens += input - cached
    total.cache_read_tokens += cached
    total.cache_write_tokens += n(u.cache_write_input_tokens)
    total.output_tokens += n(u.output_tokens) + n(u.reasoning_output_tokens)
  }
  return found ? total : undefined
}

export function emptyUsage(): Usage {
  return { ...ZERO }
}

/** 두 실행의 사용량 합. 한쪽이라도 비용을 모르면 합의 비용도 모른다(다시 쓰기, TD-016) */
export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    cache_read_tokens: a.cache_read_tokens + b.cache_read_tokens,
    cache_write_tokens: a.cache_write_tokens + b.cache_write_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cost_usd: a.cost_usd === null || b.cost_usd === null ? null : a.cost_usd + b.cost_usd,
  }
}
