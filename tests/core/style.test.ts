// contract.md 7절(문체 규칙, AI 티 제거)의 수용 테스트. 구현보다 먼저 쓴다.
import { describe, expect, test } from 'bun:test'
import { extractEnglishTerms, lintStyle } from '../../src/core/style'

const BEFORE = new Date('2026-10-14T00:00:00Z')
const AFTER = new Date('2026-10-21T00:00:00Z')
const rules = (body: string, now = BEFORE) => lintStyle(body, 'a.md', 1, now).map((i) => i.rule)

describe('lintStyle', () => {
  test('평범한 해요체 문장은 통과한다', () => {
    expect(rules('README에 설치 줄을 추가했어요. 테스트도 통과했어요.\n')).toEqual([])
  })

  test.each([
    ['화살표', '입력 → 출력으로 바뀌어요.'],
    ['em-dash', '이 기능은 — 핵심이에요.'],
    ['가운데점', '기획·디자인·개발을 나눠요.'],
  ])('%s 기호를 잡는다', (_n, text) => {
    expect(rules(text)).toContain('style-symbol')
  })

  test('코드 블록과 인라인 코드 안의 기호는 검사하지 않는다', () => {
    expect(rules('명령은 `a → b`예요.\n```\nx → y\n```\n')).toEqual([])
  })

  test('이모지를 잡는다', () => {
    expect(rules('완료했어요 🎉')).toContain('style-emoji')
  })

  test.each([
    ['에 대해', '계약에 대해 설명해요.'],
    ['를 통해', 'lint를 통해 검사해요.'],
    ['에 있어서', '보안에 있어서 중요해요.'],
    ['되어지', '판단되어진 결과예요.'],
    ['에서의', '실무에서의 사용법이에요.'],
  ])('번역투 "%s"를 잡는다', (_n, text) => {
    expect(rules(text)).toContain('style-translationese')
  })

  test('상투어와 "~인 것이다" 결말을 잡는다', () => {
    expect(rules('이 결과는 주목할 만하다.')).toContain('style-cliche')
    expect(rules('이것이 핵심인 것이다.')).toContain('style-cliche')
  })

  test('결산 피벗은 4회부터 잡는다', () => {
    const three = '결론적으로 좋아요. 따라서 써요. 요약하면 빨라요.'
    expect(rules(three)).not.toContain('style-pivot')
    expect(rules(`${three} 정리하면 끝이에요.`)).toContain('style-pivot')
  })

  test('과장 어휘는 3회부터 잡는다', () => {
    expect(rules('획기적이고 압도적이에요.')).not.toContain('style-hype')
    expect(rules('획기적이고 압도적이고 혁신적이에요.')).toContain('style-hype')
  })

  test('문두 접속사는 5회부터 잡는다', () => {
    const s = (n: number) => Array.from({ length: n }, () => '또한 좋아요.').join(' ')
    expect(rules(s(4))).not.toContain('style-connective')
    expect(rules(s(5))).toContain('style-connective')
  })

  test('영어 문장 인용(영어 단어 6개 이상 연속)을 잡는다', () => {
    expect(rules('이건 "the quick brown fox jumps over" 예시예요.')).toContain(
      'style-english-quote',
    )
    expect(rules('Claude Code와 Codex로 일해요.')).not.toContain('style-english-quote')
  })

  test('style-ignore 구간은 검사하지 않고, 구간 밖은 그대로 검사한다', () => {
    const body =
      '<!-- style-ignore-start -->\n금지 예: 결론적으로 → 획기적\n<!-- style-ignore-end -->\n바깥 → 여기\n'
    const found = lintStyle(body, 'a.md', 1, BEFORE)
    expect(found.map((i) => i.rule)).toEqual(['style-symbol'])
    expect(found[0]?.line).toBe(4)
  })

  test('2026-10-20까지는 경고, 21일부터는 오류다', () => {
    const before = lintStyle('a → b', 'a.md', 1, BEFORE)[0]
    const after = lintStyle('a → b', 'a.md', 1, AFTER)[0]
    expect(before?.severity).toBe('warning')
    expect(after?.severity).toBe('error')
  })

  test('줄 번호는 본문 시작 줄 기준이다', () => {
    const i = lintStyle('첫 줄이에요.\n둘째 → 줄', 'a.md', 10, BEFORE)[0]
    expect(i?.line).toBe(11)
  })
})

describe('extractEnglishTerms', () => {
  test('본문의 영어 용어를 중복 없이 소문자로 뽑고, 코드·URL·작업 번호는 뺀다', () => {
    const body =
      'worktree에서 Worktree와 MCP를 써요. `bun test`는 코드예요. https://example.com T-001'
    expect(extractEnglishTerms(body).sort()).toEqual(['mcp', 'worktree'])
  })
})
