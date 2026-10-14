// gotechy test의 커버리지 판정(contract.md 10.6절, Validation 17): 전체 줄 80% 이상, 핵심 모듈은 파일마다 95% 이상.
import { describe, expect, test } from 'bun:test'
import { CORE_MODULES, judgeCoverage, parseLcov } from '../../src/core/coverage'

const lcov = (rows: [string, number, number][]) =>
  rows
    .map(([f, lf, lh]) => `TN:\nSF:${f}\nFNF:1\nFNH:1\nLF:${lf}\nLH:${lh}\nend_of_record`)
    .join('\n')

const allCore = (pct: number): [string, number, number][] =>
  CORE_MODULES.map((f) => [f, 100, pct] as [string, number, number])

describe('parseLcov', () => {
  test('파일마다 전체 줄 수와 실행된 줄 수를 읽고, 라이브러리 기준 상대 경로로 바꾼다', () => {
    const files = parseLcov(
      lcov([
        ['/lib/src/a.ts', 10, 7],
        ['src/b.ts', 4, 4],
      ]),
      '/lib',
    )
    expect(files).toEqual([
      { file: 'src/a.ts', found: 10, hit: 7 },
      { file: 'src/b.ts', found: 4, hit: 4 },
    ])
  })
})

describe('judgeCoverage', () => {
  test('전체 80% 이상이고 핵심 모듈이 모두 95% 이상이면 통과', () => {
    const r = judgeCoverage(parseLcov(lcov([...allCore(96), ['src/x.ts', 100, 50]])))
    expect(r.failures).toEqual([])
    expect(r.ok).toBe(true)
  })

  test('전체 줄 커버리지가 80% 미만이면 실패', () => {
    const r = judgeCoverage(parseLcov(lcov([...allCore(100), ['src/x.ts', 10_000, 100]])))
    expect(r.ok).toBe(false)
    expect(r.failures.join('\n')).toContain('전체')
  })

  test('핵심 모듈 하나가 95% 미만이면 그 파일 이름과 함께 실패', () => {
    const rows = allCore(100)
    rows[0] = [rows[0]?.[0] as string, 100, 94]
    const r = judgeCoverage(parseLcov(lcov(rows)))
    expect(r.ok).toBe(false)
    expect(r.failures.join('\n')).toContain(CORE_MODULES[0] as string)
  })

  test('핵심 모듈이 측정에 없으면(테스트가 불러오지 않음) 실패', () => {
    const r = judgeCoverage(parseLcov(lcov(allCore(100).slice(1))))
    expect(r.ok).toBe(false)
    expect(r.failures.join('\n')).toContain(`${CORE_MODULES[0]}: 측정되지 않았어요`)
  })

  test('핵심 모듈 목록에는 lint, 결정, 검증, 어댑터가 들어 있다', () => {
    for (const f of [
      'src/core/lint-handoff.ts',
      'src/core/gate.ts',
      'src/runtime/gates.ts',
      'src/runtime/sandbox.ts',
      'src/runtime/adapters/codex.ts',
    ])
      expect(CORE_MODULES).toContain(f)
  })
})
