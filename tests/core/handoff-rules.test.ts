// contract.md 4.1절(HANDOFF 규칙)의 수용 테스트. 구현보다 먼저 쓴다(.claude/rules/testing.md).
import { describe, expect, test } from 'bun:test'
import { serializeFrontmatter } from '../../src/core/frontmatter'
import { lintHandoff } from '../../src/core/lint-handoff'

const sections = {
  decision: '없음',
  summary: 'README에 설치 줄을 추가했어요.',
  done: '- README.md에 설치 줄을 추가했어요. [확인]',
  evidence: '- `grep -q 설치 README.md`: exit 0',
  risk: '없음',
  terms: '없음',
  ask: '- 설치 줄은 왜 README에 두었나요?',
  next: '- 설치 스크립트 작성',
}
type S = typeof sections

function handoff(over: Partial<S> = {}, fm: Record<string, unknown> = {}) {
  const s = { ...sections, ...over }
  const body = [
    `## 결정 필요\n${s.decision}\n`,
    `## 한 줄 요약\n${s.summary}\n`,
    `## 한 일\n${s.done}\n`,
    `## 증거\n${s.evidence}\n`,
    `## 건너뛴 것, 확인 못 한 것, 리스크\n${s.risk}\n`,
    `## 새 용어\n${s.terms}\n`,
    `## 말해 보기\n${s.ask}\n`,
    `## 다음 단계\n${s.next}\n`,
  ].join('\n')
  return serializeFrontmatter({ task: 'T-001', status: 'done', ...fm }, body)
}
const NOW = new Date('2026-10-14T00:00:00Z')
const errors = (text: string) =>
  lintHandoff(text, 'h.md', { now: NOW, knownTerms: new Set(['readme']) })
    .issues.filter((i) => (i.severity ?? 'error') === 'error')
    .map((i) => i.rule)

const decision = (marker: string, opts = '- 선택지: 5분, 1분\n  - 추천: 5분\n  - 이유: 충분해요') =>
  `- [${marker}] 캐시 만료를 얼마로 할까요?\n  ${opts}`

describe('HANDOFF 규칙 (오류)', () => {
  test('규칙을 모두 지킨 HANDOFF는 오류가 없다', () => {
    expect(errors(handoff())).toEqual([])
  })

  test('한 줄 요약이 60자를 넘으면 실패한다', () => {
    expect(errors(handoff({ summary: '가'.repeat(61) }))).toContain('handoff-summary')
  })

  test('한 줄 요약이 두 줄이면 실패한다', () => {
    expect(errors(handoff({ summary: '첫 줄이에요.\n둘째 줄이에요.' }))).toContain(
      'handoff-summary',
    )
  })

  test('표지 없는 결정은 실패한다', () => {
    expect(errors(handoff({ decision: '- 캐시 만료를 정해 주세요' }))).toContain(
      'handoff-decision-format',
    )
  })

  test('막는 결정에 선택지가 하나뿐이면 실패한다', () => {
    const d = decision('막는', '- 선택지: 5분\n  - 추천: 5분\n  - 이유: 충분해요')
    expect(errors(handoff({ decision: d }, { status: 'needs-decision' }))).toContain(
      'handoff-decision-format',
    )
  })

  test('추천이 선택지에 없으면 실패한다', () => {
    const d = decision('막는', '- 선택지: 5분, 1분\n  - 추천: 10분\n  - 이유: 충분해요')
    expect(errors(handoff({ decision: d }, { status: 'needs-decision' }))).toContain(
      'handoff-decision-format',
    )
  })

  test('추천 줄이 없으면 실패한다', () => {
    const d = decision('기본값', '- 선택지: 5분, 1분\n  - 이유: 충분해요')
    expect(errors(handoff({ decision: d }))).toContain('handoff-decision-format')
  })

  test('형식을 지킨 막는 결정은 통과한다', () => {
    expect(errors(handoff({ decision: decision('막는') }, { status: 'needs-decision' }))).toEqual(
      [],
    )
  })

  test('알림은 선택지가 없어도 된다', () => {
    expect(errors(handoff({ decision: '- [알림] 테스트 데이터는 공개 자료만 썼어요' }))).toEqual([])
  })

  test('막는 결정이 4개면 쪼개라는 교정과 함께 실패한다', () => {
    const d = [1, 2, 3, 4].map(() => decision('막는')).join('\n')
    const r = lintHandoff(handoff({ decision: d }, { status: 'needs-decision' }), 'h.md', {
      now: NOW,
    })
    const issue = r.issues.find((i) => i.rule === 'handoff-blocking-limit')
    expect(issue?.fix).toContain('쪼개')
  })

  test('막는 결정이 있는데 status가 done이면 실패한다', () => {
    expect(errors(handoff({ decision: decision('막는') }))).toContain('handoff-blocking-status')
  })

  test('리스크가 4개면 실패한다', () => {
    const risk = [1, 2, 3, 4].map((n) => `- 리스크 ${n} [추정]`).join('\n')
    expect(errors(handoff({ risk }))).toContain('handoff-risk-limit')
  })

  test('증거가 `명령`: 결과 형식이 아니면 실패한다', () => {
    expect(errors(handoff({ evidence: '- 테스트를 돌렸고 통과했어요' }))).toContain(
      'handoff-evidence-format',
    )
  })

  test('한 일 항목에 사실 표시가 없으면 실패한다', () => {
    expect(errors(handoff({ done: '- README.md를 고쳤어요.' }))).toContain('handoff-fact-tag')
  })

  test('리스크 항목에도 사실 표시가 필요하다', () => {
    expect(errors(handoff({ risk: '- 실제 설치는 확인하지 못했어요' }))).toContain(
      'handoff-fact-tag',
    )
  })

  test('굵게는 결정과 리스크 절에서만 쓴다', () => {
    expect(errors(handoff({ summary: '**중요**한 변경이에요.' }))).toContain('handoff-emphasis')
  })

  test('HANDOFF에 문체 예외 표지가 있으면 실패한다', () => {
    const done =
      '<!-- style-ignore-start -->\n- README.md를 고쳤어요. [확인]\n<!-- style-ignore-end -->'
    expect(errors(handoff({ done }))).toContain('handoff-style-ignore')
  })

  test('HANDOFF에서는 예외 표지 안의 문장도 문체 검사를 받는다', () => {
    const done =
      '<!-- style-ignore-start -->\n- 설치 → 확인을 했어요. [확인]\n<!-- style-ignore-end -->'
    const rules = lintHandoff(handoff({ done }), 'h.md', { now: NOW }).issues.map((i) => i.rule)
    expect(rules).toContain('style-symbol')
  })

  test('모든 오류는 고치는 법을 함께 알려 준다', () => {
    const broken = handoff(
      {
        decision: '- 캐시 만료를 정해 주세요',
        summary: '가'.repeat(61),
        done: '- README.md를 고쳤어요.',
        evidence: '- 테스트를 돌렸어요',
        risk: [1, 2, 3, 4].map((n) => `- 리스크 ${n}`).join('\n'),
        ask: '**중요** 질문',
      },
      { status: 'done' },
    )
    const issues = lintHandoff(broken, 'h.md', { now: NOW }).issues.filter(
      (i) => (i.severity ?? 'error') === 'error',
    )
    expect(issues.length).toBeGreaterThanOrEqual(6)
    for (const i of issues) expect(i.fix?.trim(), i.rule).toBeTruthy()
  })
})

describe('새 용어 풀이 요구의 오탐 줄이기 (경고 기간 조정, 2026-10-14)', () => {
  const unexplained = (text: string) =>
    lintHandoff(text, 'h.md', { now: NOW, knownTerms: new Set(['readme']) })
      .issues.filter((i) => i.rule === 'style-term-unexplained')
      .map((i) => i.message)
      .join(' ')

  test('마일스톤과 결정 번호(M1, M2b, D13, TD-005)는 용어로 보지 않는다', () => {
    const done = '- M1, M2b, D13, TD-005 기록을 고쳤어요. [확인]'
    expect(unexplained(handoff({ done }))).toBe('')
  })

  test('증거 절의 명령 결과(pass, fail)는 용어로 보지 않는다', () => {
    const evidence = '- `bun test`: 115 pass, 0 fail, success'
    expect(unexplained(handoff({ evidence }))).toBe('')
  })

  test('여러 단어 용어(Secure Enclave)를 풀이하면 그 낱말들도 풀이된 것으로 본다', () => {
    const done = '- Secure Enclave로 키를 옮길 계획이에요. [확인]'
    const terms = '- Secure Enclave: 맥의 보안 칩이에요.'
    expect(unexplained(handoff({ done, terms }))).toBe('')
  })

  test('본문의 진짜 새 용어는 여전히 풀이를 요구한다', () => {
    const done = '- worktree를 정리했어요. [확인]'
    expect(unexplained(handoff({ done }))).toContain('worktree')
  })
})
