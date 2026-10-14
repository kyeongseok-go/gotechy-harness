// gotechy test의 커버리지 판정(contract.md 10.6절). bun test의 lcov 결과를 읽어 전체와 핵심 모듈 기준을 본다.

export type FileCoverage = { file: string; found: number; hit: number }
export type CoverageJudgement = {
  ok: boolean
  totalPct: number
  failures: string[]
  core: { file: string; pct: number | null }[]
}

/** 핵심 모듈: lint, 결정(서명과 decide), 검증(verify 격리), 반영, 어댑터. 파일마다 95% 이상이어야 한다 */
export const CORE_MODULES = [
  'src/core/frontmatter.ts',
  'src/core/lint-handoff.ts',
  'src/core/lint-task.ts',
  'src/core/rules-handoff.ts',
  'src/core/paths.ts',
  'src/core/schema.ts',
  'src/core/schema-issues.ts',
  'src/core/sections.ts',
  'src/core/style.ts',
  'src/core/gate.ts',
  'src/core/decisions.ts',
  'src/runtime/gates.ts',
  'src/runtime/keys.ts',
  'src/runtime/sandbox.ts',
  'src/runtime/accept.ts',
  'src/runtime/adapters/claude.ts',
  'src/runtime/adapters/codex.ts',
  'src/runtime/adapters/env.ts',
  'src/runtime/adapters/fake.ts',
  'src/runtime/adapters/index.ts',
]
export const TOTAL_MIN = 80
export const CORE_MIN = 95

export function parseLcov(text: string, root?: string): FileCoverage[] {
  const out: FileCoverage[] = []
  let cur: FileCoverage | undefined
  for (const line of text.split('\n')) {
    if (line.startsWith('SF:')) {
      let file = line.slice(3).trim()
      if (root && file.startsWith(`${root}/`)) file = file.slice(root.length + 1)
      cur = { file, found: 0, hit: 0 }
    } else if (cur && line.startsWith('LF:')) cur.found = Number(line.slice(3))
    else if (cur && line.startsWith('LH:')) cur.hit = Number(line.slice(3))
    else if (cur && line.trim() === 'end_of_record') {
      out.push(cur)
      cur = undefined
    }
  }
  return out
}

const pct = (hit: number, found: number) => (found === 0 ? 100 : (hit / found) * 100)
const fmt = (n: number) => n.toFixed(2)

export function judgeCoverage(files: FileCoverage[]): CoverageJudgement {
  const found = files.reduce((a, f) => a + f.found, 0)
  const hit = files.reduce((a, f) => a + f.hit, 0)
  const totalPct = pct(hit, found)
  const failures: string[] = []
  if (totalPct < TOTAL_MIN) failures.push(`전체 줄 커버리지 ${fmt(totalPct)}% (기준 ${TOTAL_MIN}%)`)
  const core = CORE_MODULES.map((file) => {
    const f = files.find((x) => x.file === file)
    if (!f) {
      // 테스트가 불러오지 않은 핵심 모듈은 0%와 같다. 측정에서 빠져 기준을 피하지 못하게 한다
      failures.push(`${file}: 측정되지 않았어요 (테스트가 이 파일을 불러오지 않아요)`)
      return { file, pct: null }
    }
    const p = pct(f.hit, f.found)
    if (p < CORE_MIN) failures.push(`${file}: ${fmt(p)}% (핵심 모듈 기준 ${CORE_MIN}%)`)
    return { file, pct: p }
  })
  return { ok: failures.length === 0, totalPct, failures, core }
}
