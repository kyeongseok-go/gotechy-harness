// 팩 구조 계약(contract.md 10.8절): 스킬마다 bar, 렌즈, 최신화 출처, 평가 케이스가 있고, 설치된 프로젝트에서 스스로 완결된다.
import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { skillProblems } from '../../src/core/doctor'
import { parseFrontmatter } from '../../src/core/frontmatter'
import {
  ALL_SKILLS,
  expandPacks,
  PACKS,
  ROUTER_END,
  ROUTER_START,
  replaceRouter,
  routerTable,
  SKILL_WHEN,
} from '../../src/core/packs'
import { lintStyle } from '../../src/core/style'

const ROOT = join(import.meta.dir, '..', '..')
const SKILLS = join(ROOT, 'skills')
/** `gotechy text lint`와 같다: frontmatter가 있으면 본문만 본다 */
function lintText(text: string, rel: string) {
  const parsed = text.startsWith('---') ? parseFrontmatter(text, rel) : undefined
  if (parsed?.ok) return lintStyle(parsed.value.body, rel, parsed.value.bodyLine)
  return lintStyle(text, rel, 1)
}
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  })

describe('팩 목록', () => {
  test('skills/의 스킬은 모두 정확히 한 팩에 들어 있고, 팩의 스킬은 모두 skills/에 있다', () => {
    const dirs = readdirSync(SKILLS).filter((d) => statSync(join(SKILLS, d)).isDirectory())
    expect([...dirs].sort()).toEqual([...ALL_SKILLS].sort())
    expect(new Set(ALL_SKILLS).size).toBe(ALL_SKILLS.length)
  })

  test('스킬마다 색인 표의 "일" 칸이 있다', () => {
    for (const s of ALL_SKILLS) expect(SKILL_WHEN[s]).toBeTruthy()
  })

  test('모든 팩을 깔아도 세션당 스킬 상한(15개, doctor)을 넘지 않는다', () => {
    expect(expandPacks(['all']).skills).toHaveLength(ALL_SKILLS.length)
    expect(ALL_SKILLS.length).toBeLessThanOrEqual(15)
  })

  test('팩 이름을 스킬로 펴고 중복은 한 번만, 모르는 팩은 따로 알린다', () => {
    expect(expandPacks(['define', 'owner', 'define'])).toEqual({
      skills: ['owner-protocol', 'gotechy-spec', 'gotechy-plan'],
      unknown: [],
    })
    expect(expandPacks(['nope']).unknown).toEqual(['nope'])
    expect(Object.keys(PACKS)).toContain('owner')
  })
})

describe('AGENTS.md 팩 색인', () => {
  const doc = `# 지도\n\n앞 글\n${ROUTER_START}\n옛 표\n${ROUTER_END}\n\n뒤 글\n`
  test('표시 사이만 바꾸고, 깔린 스킬만 라이브러리 순서로 넣는다', () => {
    const out = replaceRouter(doc, routerTable(['gotechy-plan', 'owner-protocol', 'x-unknown']))
    expect(out).toContain('앞 글')
    expect(out).toContain('뒤 글')
    expect(out).not.toContain('옛 표')
    expect(out).not.toContain('x-unknown')
    expect(out?.indexOf('owner-protocol')).toBeLessThan(out?.indexOf('gotechy-plan') ?? 0)
  })
  test('다시 해도 같은 결과다', () => {
    const t = routerTable(['owner-protocol'])
    const once = replaceRouter(doc, t) ?? ''
    expect(replaceRouter(once, t)).toBe(once)
  })
  test('표시가 없거나 둘 이상이면 건드리지 않는다', () => {
    expect(replaceRouter('# 오너가 쓴 지도\n', 'x')).toBeUndefined()
    expect(replaceRouter(`${doc}${ROUTER_START}${ROUTER_END}`, 'x')).toBeUndefined()
    expect(replaceRouter(`${ROUTER_END}\n${ROUTER_START}`, 'x')).toBeUndefined()
  })
  test('프로젝트 템플릿의 AGENTS.md에 표시가 있다', () => {
    const t = readFileSync(join(ROOT, 'templates', 'project', 'AGENTS.md'), 'utf8')
    expect(replaceRouter(t, routerTable(['owner-protocol']))).toBeDefined()
  })
})

// 설치된 프로젝트에는 하네스의 docs/가 없다. 스킬이 프로젝트에 만드는 파일 경로만 가리킬 수 있다(contract.md 10.8절)
const PROJECT_DOCS = [
  'docs/discovery/',
  'docs/product-specs/',
  'docs/quality/',
  'docs/exec-plans/',
  'docs/decisions/',
  'docs/security/',
  'docs/compliance/',
  'docs/evals/',
  'docs/operations/',
  'docs/launch/',
  'docs/retros/',
  'docs/content/',
]
// https://code.claude.com/docs/en/plugin-evals.md 채점기 표(2026-10-16 확인). 모든 채점기는 weight, arm을 더 받는다
const GRADER_KEYS: Record<string, string[]> = {
  regex: ['pattern', 'flags', 'match', 'target'],
  tool_used: ['tool', 'input_match', 'min', 'max'],
  tool_order: ['before', 'after'],
  file_exists: ['path', 'exists'],
  llm: ['criteria', 'focus'],
  baseline: ['baseline_file', 'criteria'],
}
const GRADER_TYPES = new Set(Object.keys(GRADER_KEYS))

describe.each(ALL_SKILLS)('%s', (skill) => {
  const dir = join(SKILLS, skill)
  const all = files(dir)

  test('SKILL.md: name은 폴더 이름, description 400자 이하, 본문 150줄 이하', () => {
    const text = readFileSync(join(dir, 'SKILL.md'), 'utf8')
    expect(skillProblems(text)).toEqual([])
    const fm = parseFrontmatter(text, 'SKILL.md')
    expect(fm.ok && fm.value.data.name).toBe(skill)
    // description도 사람이 읽는 글이라 기호 규칙을 지킨다
    expect(fm.ok && String(fm.value.data.description)).not.toMatch(/[→←⇒—·]/)
  })

  test('bar와 렌즈가 있다(렌즈 40줄 이하, bar에 원천 URL과 판정 표지)', () => {
    const bar = readFileSync(join(dir, 'references', 'bar.md'), 'utf8')
    expect(bar).toMatch(/https:\/\//)
    expect(bar).toMatch(/\[기계\]/)
    expect(bar).toMatch(/\[사람\]/)
    for (const grade of ['A', 'B', 'C', 'D'])
      expect(bar).toMatch(new RegExp(`(^|[^A-Za-z])${grade}[(\\s:]`, 'm'))
    const lens = readFileSync(join(dir, 'references', 'lens.md'), 'utf8')
    expect(lens.trimEnd().split('\n').length).toBeLessThanOrEqual(40)
  })

  test('SKILL.md가 가리키는 references 파일이 모두 있다', () => {
    const text = readFileSync(join(dir, 'SKILL.md'), 'utf8')
    for (const m of text.matchAll(/(?<![\w/.-])references\/[\w./-]+\.md/g))
      expect(existsSync(join(dir, m[0])), m[0]).toBe(true)
  })

  test('하네스 저장소 문서를 가리키지 않는다(프로젝트에 만드는 경로만)', () => {
    for (const f of all) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(/(?<![\w/.-])docs\/[\w./-]*/g))
        expect(
          PROJECT_DOCS.some((p) => `${m[0].replace(/\/$/, '')}/`.startsWith(p)),
          `${f.slice(ROOT.length + 1)}: ${m[0]}`,
        ).toBe(true)
      // 하네스의 서브에이전트 정의는 프로젝트에 깔리지 않는다
      expect(text, f).not.toMatch(/(?<![\w/.-])\.claude\/agents\//)
    }
  })

  test('문체 규칙(contract.md 7절) 경고가 없다', () => {
    const evalDir = join(ROOT, 'evals', skill)
    const targets = [...all, ...(existsSync(evalDir) ? files(evalDir) : [])].filter((f) =>
      f.endsWith('.md'),
    )
    for (const f of targets) {
      const issues = lintText(readFileSync(f, 'utf8'), f)
      expect(issues.map((i) => `${f.slice(ROOT.length + 1)}:${i.line} ${i.rule}`)).toEqual([])
    }
  })

  test('최신화 출처(radar/sources)가 형식대로 있다', () => {
    const y = parse(readFileSync(join(ROOT, 'radar', 'sources', `${skill}.yaml`), 'utf8')) as {
      skill: string
      checked: string
      sources: Record<string, unknown>[]
    }
    expect(y.skill).toBe(skill)
    expect(String(y.checked)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(y.sources.length).toBeGreaterThanOrEqual(3)
    const ids = new Set<string>()
    for (const s of y.sources) {
      expect(String(s.id)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(ids.has(String(s.id))).toBe(false)
      ids.add(String(s.id))
      expect(String(s.url)).toMatch(/^https:\/\//)
      expect(['official', 'standard', 'regulator', 'paper', 'community']).toContain(String(s.trust))
      expect(['github-releases', 'rss', 'page']).toContain(String(s.watch))
      if (s.watch === 'github-releases') expect(String(s.feed)).toMatch(/^[\w.-]+\/[\w.-]+$/)
      if (s.watch === 'rss') expect(String(s.feed)).toMatch(/^https:\/\//)
      expect(['weekly', 'monthly', 'quarterly']).toContain(String(s.cadence))
      for (const c of (s.covers as string[]) ?? []) expect(existsSync(join(dir, c)), c).toBe(true)
    }
  })

  test('평가 케이스가 plugin eval 형식으로 3개 이상(능력 2, 회귀 1 이상) 있다', () => {
    const evalDir = join(ROOT, 'evals', skill)
    const cases = readdirSync(evalDir).filter((d) => statSync(join(evalDir, d)).isDirectory())
    expect(cases.length).toBeGreaterThanOrEqual(3)
    const tags: string[] = []
    for (const c of cases) {
      const prompt = parseFrontmatter(
        readFileSync(join(evalDir, c, 'prompt.md'), 'utf8'),
        'prompt.md',
      )
      expect(prompt.ok, c).toBe(true)
      if (!prompt.ok) continue
      expect(prompt.value.body.trim().length, c).toBeGreaterThan(0)
      tags.push(...((prompt.value.data.tags as string[]) ?? []))
      const graders = readdirSync(join(evalDir, c, 'graders')).filter((g) => g.endsWith('.md'))
      expect(graders.length, c).toBeGreaterThan(0)
      for (const g of graders) {
        const gf = parseFrontmatter(readFileSync(join(evalDir, c, 'graders', g), 'utf8'), g)
        expect(gf.ok && GRADER_TYPES.has(String(gf.value.data.type)), `${c}/${g}`).toBe(true)
        if (!gf.ok) continue
        const type = String(gf.value.data.type)
        const allowed = new Set(['type', 'weight', 'arm', ...(GRADER_KEYS[type] ?? [])])
        for (const k of Object.keys(gf.value.data))
          expect(allowed.has(k), `${c}/${g}: 모르는 키 ${k}`).toBe(true)
        const match = gf.value.data.match
        if (match !== undefined)
          expect(String(match), `${c}/${g}`).toMatch(/^(not_contains|count:\d+)$/)
        if (type === 'regex') expect(() => new RegExp(String(gf.value.data.pattern))).not.toThrow()
      }
    }
    expect(tags.filter((t) => t === 'capability').length).toBeGreaterThanOrEqual(2)
    expect(tags.filter((t) => t === 'regression').length).toBeGreaterThanOrEqual(1)
  })
})

// 이음매(스킬 사이 약속, 2026-10-16 교차 리뷰): 스킬마다 따로 쓰면 같은 약속이 벌어진다. 공유하는 틀은 표시 사이 글이 같아야 한다
const between = (skill: string, marker: string): string[] => {
  const out: string[] = []
  for (const f of files(join(SKILLS, skill))) {
    const text = readFileSync(f, 'utf8')
    const re = new RegExp(
      `<!-- gotechy:${marker}:start -->([\\s\\S]*?)<!-- gotechy:${marker}:end -->`,
      'g',
    )
    for (const m of text.matchAll(re)) out.push((m[1] ?? '').trim())
  }
  return out
}

describe('스킬 사이 이음매', () => {
  test.each([
    ['size-table', ['gotechy-spec', 'gotechy-plan', 'gotechy-build', 'gotechy-ship']],
    ['debt-table', ['gotechy-ship', 'gotechy-plan', 'gotechy-retro']],
    ['adr-template', ['gotechy-plan', 'gotechy-retro']],
    ['adr-when', ['gotechy-plan', 'gotechy-retro', 'gotechy-build']],
  ])('%s는 스킬마다 한 번씩 있고 글이 같다', (marker, skills) => {
    const blocks = (skills as string[]).map((s) => between(s, marker as string))
    for (const [i, b] of blocks.entries()) expect(b.length, (skills as string[])[i]).toBe(1)
    const first = blocks[0]?.[0]
    for (const b of blocks) expect(b[0]).toBe(first)
  })

  test('다른 스킬은 있는 이름으로만 가리킨다', () => {
    for (const s of ALL_SKILLS)
      for (const f of files(join(SKILLS, s))) {
        const text = readFileSync(f, 'utf8')
        for (const m of text.matchAll(/(?<![\w/.-])(?:gotechy|gotekie)-[a-z0-9]+(?:-[a-z0-9]+)*/g))
          expect(
            ALL_SKILLS.includes(m[0]) || m[0] === 'gotechy-harness',
            `${f.slice(ROOT.length + 1)}: ${m[0]}`,
          ).toBe(true)
      }
  })

  test('[기계] 항목은 같은 줄에 판정 도구를 적는다', () => {
    for (const s of ALL_SKILLS) {
      const bar = readFileSync(join(SKILLS, s, 'references', 'bar.md'), 'utf8')
      bar.split('\n').forEach((line, i) => {
        if (
          line.includes('[기계]') &&
          !/^#|\[기계\]\s*(와|과|은|는|이|가|로|으로)?\s*\[사람\]|`\[기계\]`/.test(line)
        )
          expect(line.includes('도구'), `${s} bar.md:${i + 1}`).toBe(true)
      })
    }
  })

  test('표준에 없는 수치의 표지는 "(하네스 기본값)" 하나다', () => {
    for (const s of ALL_SKILLS)
      for (const f of files(join(SKILLS, s))) {
        const text = readFileSync(f, 'utf8')
        for (const bad of [
          '(이 bar가 정한 값)',
          '(이 bar의 값)',
          '(이 팩의 기본값)',
          '(이 스킬의 기준)',
        ])
          expect(text.includes(bad), `${f.slice(ROOT.length + 1)}: ${bad}`).toBe(false)
      }
  })
})

describe('이 저장소 자신도 팩을 쓴다(도그푸딩)', () => {
  test('.claude/skills의 스킬은 skills/의 원본 파일을 모두 같은 내용으로 가진다', () => {
    const local = join(ROOT, '.claude', 'skills')
    for (const s of ALL_SKILLS) {
      const src = files(join(SKILLS, s)).map((f) => f.slice(join(SKILLS, s).length))
      const dst = existsSync(join(local, s))
        ? files(join(local, s)).map((f) => f.slice(join(local, s).length))
        : []
      // 원본에 없는 파일은 "옮긴 파일" 안내만 허용한다(지우기는 저장소 hook이 오너 확인을 요구한다)
      for (const rel of dst.filter((r) => !src.includes(r)))
        expect(
          readFileSync(join(local, s, rel), 'utf8').startsWith('# 옮긴 파일'),
          `${s}${rel}`,
        ).toBe(true)
      expect(
        src.filter((r) => !dst.includes(r)),
        s,
      ).toEqual([])
      for (const rel of src)
        expect(readFileSync(join(local, s, rel), 'utf8'), `${s}${rel}`).toBe(
          readFileSync(join(SKILLS, s, rel), 'utf8'),
        )
    }
  })
})
