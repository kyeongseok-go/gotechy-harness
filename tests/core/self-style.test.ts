// 하네스가 자기 문체 규칙을 지키는지 본다(2026-11-05, U3). 10-21에 문체 규칙이 오류로 바뀌었는데 지도(AGENTS.md)에
// 오류 52건이 남아 있었고, 이 파일들을 검사하는 테스트가 없어 아무도 몰랐다. 에이전트가 세션마다 읽는 지도와 규칙,
// 프로젝트로 나가는 스킬과 템플릿을 검사한다. 날짜로 켜지는 규칙이 더 생겨도 미리 걸리게 먼 미래 시각으로도 본다.
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseFrontmatter } from '../../src/core/frontmatter'
import { lintStyle } from '../../src/core/style'

const ROOT = join(import.meta.dir, '..', '..')
const FILES = ['AGENTS.md', 'CLAUDE.md', 'ARCHITECTURE.md', 'README.md']
const DIRS = ['.claude/rules', '.claude/agents', 'skills', 'templates']
const FAR_FUTURE = new Date('2030-01-01T00:00:00Z')

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (name.endsWith('.md')) yield p
  }
}

function targets(): string[] {
  return [...FILES.map((f) => join(ROOT, f)), ...DIRS.flatMap((d) => [...walk(join(ROOT, d))])]
}

function errorsAt(now: Date): string[] {
  const out: string[] = []
  for (const file of targets()) {
    const rel = relative(ROOT, file)
    const text = readFileSync(file, 'utf8')
    const parsed = text.startsWith('---') ? parseFrontmatter(text, rel) : undefined
    const issues = parsed?.ok
      ? lintStyle(parsed.value.body, rel, parsed.value.bodyLine, now)
      : lintStyle(text, rel, 1, now)
    for (const i of issues)
      if (i.severity === 'error') out.push(`${i.file}:${i.line} [${i.rule}] ${i.message}`)
  }
  return out
}

describe('하네스 자신의 문체 (U3)', () => {
  test('검사 대상이 비어 있지 않다(경로가 바뀌어 아무것도 안 보는 일을 막는다)', () => {
    expect(targets().length).toBeGreaterThan(100)
  })

  test('지도, 규칙, 서브에이전트, 스킬, 템플릿에 문체 오류가 없다', () => {
    expect(errorsAt(new Date())).toEqual([])
  })

  test('먼 미래 시각으로 봐도 오류가 없다(날짜로 켜지는 규칙의 시한폭탄 방지)', () => {
    expect(errorsAt(FAR_FUTURE)).toEqual([])
  })
})
