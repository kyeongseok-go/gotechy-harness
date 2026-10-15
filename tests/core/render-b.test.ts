// HANDOFF 화면 B+C(contract.md 8.2절, 2026-10-16 오너 결정 T-007): 결정 카드를 먼저, 한 일 항목 옆에 감사 지적.
import { describe, expect, test } from 'bun:test'
import { attachAudit, parseAuditItems } from '../../src/core/audit'
import type { Gate } from '../../src/core/gate'
import { attachGates, buildCard } from '../../src/core/inbox'
import { pairFindings, renderGatePage, renderHandoffPage } from '../../src/core/view/pages'

const HANDOFF = `---
task: T-003
status: needs-decision
packs: [owner]
skills_loaded: [owner-protocol]
new_terms: []
rev: 1
agent: claude
model: claude-sonnet-5-5
usage:
  input_tokens: 41200
  cache_read_tokens: 0
  cache_write_tokens: 0
  output_tokens: 3900
  cost_usd: 0.21
verified:
  command: bun test tests/deadline.test.ts
  exit_code: 0
  at: 2026-10-15T05:40:00.000Z
changed_files:
  - src/deadline.ts
  - tests/deadline.test.ts
  - orchestration/handoffs/T-003.md
---
## 결정 필요
- [막는] 날짜가 연도 없이 오면 어느 해로 볼까요?
  - 선택지: 공문 시행일의 해, 올해, <b>사람</b>에게 묻기
  - 추천: 공문 시행일의 해
  - 이유: 공문은 시행일 기준으로 쓰여요
- [막는] 마감 시각이 없으면 몇 시로 둘까요?
  - 선택지: 18시, 24시
  - 추천: 18시
  - 이유: 회신은 보통 근무 시간 안에 받아요
- [기본값] 붙임 파일 이름의 날짜를 마감으로 볼까요?
  - 선택지: 보지 않기, 보기
  - 추천: 보지 않기
  - 이유: 붙임 이름의 날짜는 작성일인 경우가 많아요
- [알림] 표 안의 날짜는 다음 작업으로 나눠요.

## 한 줄 요약
마감일과 근거 문장을 뽑는 함수를 만들었어요.

## 한 일
- 본문에서 마감 표현을 찾는 함수를 만들었어요. [확인]
- 찾은 마감마다 근거 문장과 줄 번호를 함께 돌려줘요. [확인]
- 연도 없는 날짜는 공문 시행일의 해로 두었어요. [추론]

## 증거
- \`bun test tests/deadline.test.ts\`: 12개 통과

## 건너뛴 것, 확인 못 한 것, 리스크
- 표 안의 날짜는 아직 읽지 않아요. [확인]

## 새 용어
없음

## 말해 보기
- 연도 없는 날짜를 시행일의 해로 보면 어떤 공문에서 틀리나요?

## 다음 단계
- 결정대로 연도 규칙을 고쳐요.
`

const base = buildCard({
  id: 'T-003',
  file: 'orchestration/handoffs/T-003.md',
  text: HANDOFF,
  title: '공문 마감일 추출',
})
const gate = (id: string, question: string, options: string[], resolution?: string): Gate =>
  ({
    id,
    task: 'T-003',
    class: 'decision',
    question,
    options,
    recommended: options[0],
    handoff_rev: 1,
    status: resolution ? 'resolved' : 'pending',
    resolution,
  }) as unknown as Gate
const gated = attachGates(base, [
  gate('G-004', '날짜가 연도 없이 오면 어느 해로 볼까요?', [
    '공문 시행일의 해',
    '올해',
    '<b>사람</b>에게 묻기',
  ]),
  gate('G-005', '마감 시각이 없으면 몇 시로 둘까요?', ['18시', '24시'], '18시'),
])
const finding = {
  severity: 'high' as const,
  file: 'src/deadline.ts',
  line: 41,
  confirmed: true,
  claim: '연도 없는 날짜는 공문 시행일의 해로 두었다',
  actual: '코드는 실행한 날의 해(올해)로 둔다',
}
const stray = {
  severity: 'low' as const,
  file: 'README.md',
  line: 3,
  confirmed: false,
  claim: 'README에 사용법을 적었다',
  actual: 'README는 바뀌지 않았다',
}
const audited = attachAudit(gated, {
  handoff_rev: 1,
  confirmed: 1,
  items: [finding, stray],
})

const serve = renderHandoffPage({ card: audited, terms: [], mode: 'serve' })
const file = renderHandoffPage({ card: audited, terms: [], mode: 'file' })

describe('결정 카드 먼저 (시안 B)', () => {
  test('결정 카드가 한 일보다 먼저 나오고, 질문, 선택지, 추천, 이유를 모두 담는다', () => {
    const cards = serve.indexOf('class="dcard')
    expect(cards).toBeGreaterThan(0)
    expect(cards).toBeLessThan(serve.indexOf('>한 일</h2>'))
    for (const s of [
      '날짜가 연도 없이 오면 어느 해로 볼까요?',
      '공문 시행일의 해',
      '올해',
      '이유: 공문은 시행일 기준으로 쓰여요',
      'G-004',
    ])
      expect(serve).toContain(s)
    expect(serve).toContain('(추천)')
  })

  test('같은 질문을 두 번 보여 주지 않는다', () => {
    expect(serve.split('날짜가 연도 없이 오면 어느 해로 볼까요?').length - 1).toBe(1)
    expect(file.split('날짜가 연도 없이 오면 어느 해로 볼까요?').length - 1).toBe(1)
  })

  test('serve 화면의 열린 게이트 선택지는 그 선택을 미리 고른 결정 화면으로 이어진다', () => {
    expect(serve).toContain(`href="/G-004?choice=${encodeURIComponent('올해')}"`)
    expect(serve).toContain(`href="/G-004?choice=${encodeURIComponent('<b>사람</b>에게 묻기')}"`)
    expect(serve).not.toContain('<b>사람</b>')
  })

  test('파일 화면은 링크 대신 decide 명령을 보여 준다', () => {
    expect(file).not.toContain('href="/G-004')
    expect(file).toContain('gotechy decide G-004')
  })

  test('이미 결정한 게이트는 고른 것을 보여 주고 링크를 만들지 않는다', () => {
    expect(serve).toContain('결정함: 18시')
    expect(serve).not.toContain('href="/G-005?')
    expect(serve).not.toContain('href="/G-005"')
    expect(serve).toContain('href="/G-004"')
  })

  test('기본값 결정은 접어서, 알림은 따로 보여 준다', () => {
    expect(serve).toContain('기본값으로 진행한 것 1건</summary>')
    expect(serve).toContain('붙임 파일 이름의 날짜를 마감으로 볼까요?')
    expect(serve).toContain('표 안의 날짜는 다음 작업으로 나눠요.')
  })

  test('상태 칩에 검증, 감사, 리스크, 비용과 파일 수가 있다', () => {
    for (const s of ['검증 통과', '감사 지적 1건(근거 확인됨)', '리스크 1', '$0.21, 파일 2개'])
      expect(serve).toContain(s)
  })
})

describe('한 일 옆에 감사 지적 (시안 C)', () => {
  test('사실 표시는 칩으로 바꾼다', () => {
    expect(serve).toContain('<span class="tag ok">확인</span>')
    expect(serve).toContain('<span class="tag inf">추론</span>')
  })

  test('주장이 닮은 한 일 항목 아래에 감사 지적이 붙는다', () => {
    const item = serve.indexOf('연도 없는 날짜는 공문 시행일의 해로 두었어요.')
    const f = serve.indexOf('코드는 실행한 날의 해(올해)로 둔다')
    expect(item).toBeGreaterThan(0)
    expect(f).toBeGreaterThan(item)
    expect(f).toBeLessThan(serve.indexOf('>건너뛴 것, 확인 못 한 것, 리스크</h2>'))
    expect(serve).toContain('src/deadline.ts:41')
  })

  test('짝을 못 찾은 지적은 감사관 절에 남는다', () => {
    const sec = serve.indexOf('>감사관이 본 것</h2>')
    expect(sec).toBeGreaterThan(0)
    expect(serve.indexOf('README는 바뀌지 않았다')).toBeGreaterThan(sec)
    expect(serve).toContain('근거 확인 안 됨')
  })

  test('지난 판본을 감사한 기록은 지적을 붙이지 않는다', () => {
    const old = attachAudit(gated, { handoff_rev: 0, confirmed: 1, items: [finding] })
    const html = renderHandoffPage({ card: old, terms: [], mode: 'serve' })
    expect(html).not.toContain('코드는 실행한 날의 해(올해)로 둔다')
    expect(html).toContain('지난 판본 기준')
  })

  test('짝짓기는 가장 닮은 항목 하나에만, 닮지 않으면 짝을 짓지 않는다', () => {
    const items = ['함수를 만들었어요.', '연도 없는 날짜는 공문 시행일의 해로 두었어요.']
    const pairs = pairFindings(items, [finding, stray])
    expect(pairs.byItem.get(1)?.map((f) => f.line)).toEqual([41])
    expect(pairs.byItem.get(0)).toBeUndefined()
    expect(pairs.unpaired.map((f) => f.line)).toEqual([3])
    // 조각 몇 개만 겹치는 주장(Dice 0.33)은 짝짓지 않는다
    const weak = { ...stray, line: 9, claim: '함수를 고쳤다' }
    expect(pairFindings(['함수를 만들었어요.'], [weak]).unpaired.map((f) => f.line)).toEqual([9])
  })
})

describe('깨진 감사 기록 (보안 감사 15차 낮음 4)', () => {
  test('한 항목이 깨져도 나머지 지적은 남는다', () => {
    const items = parseAuditItems([finding, { ...stray, claim: '' }, 'x'])
    expect(items.map((i) => i.line)).toEqual([41])
  })
  test('붙일 지적이 없어도 기록의 지적 수로 칩을 보여 준다(초록 "없음"으로 속지 않게)', () => {
    const c = attachAudit(gated, { handoff_rev: 1, confirmed: 0, findings: 2, items: [] })
    const html = renderHandoffPage({ card: c, terms: [], mode: 'file' })
    expect(html).toContain('감사 지적 2건(근거 확인 안 됨)')
    expect(html).not.toContain('감사 지적 없음')
  })
})

describe('결정 화면의 미리 고르기', () => {
  const form = {
    id: 'G-004',
    task: 'T-003',
    title: '공문 마감일 추출',
    question: '어느 해로 볼까요?',
    options: ['공문 시행일의 해', '올해'],
    recommended: '공문 시행일의 해',
    summary: '',
    questions: [],
    csrf: 'c',
    view: 'v',
    code: 'AB12',
    handoffRev: 1,
    handoffSha: null,
    autonomy: 'L0',
    budgetUsd: undefined,
    failing: [],
  }
  test('선택지 중 하나면 그 선택만 미리 고른다', () => {
    const html = renderGatePage({ ...form, preselect: '올해' })
    expect(html.match(/checked/g)).toHaveLength(1)
    expect(html).toMatch(/value="올해"[^>]*checked/)
  })
  test('선택지에 없는 값이면 아무것도 고르지 않는다', () => {
    const html = renderGatePage({ ...form, preselect: '없는 선택' })
    expect(html).not.toContain('checked')
  })
})
