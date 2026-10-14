// contract.md 8.1절 인박스 카드의 단위 테스트. 정렬과 형식 전체는 tests/e2e/inbox-cli.test.ts의 golden 비교가 맡는다.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serializeFrontmatter } from '../../src/core/frontmatter'
import { buildCard, displayText as displayTextForTest, formatInbox } from '../../src/core/inbox'
import { loadCards } from '../../src/runtime/inbox'

const body = (summary: string, decision = '없음') =>
  [
    `## 결정 필요\n${decision}\n`,
    `## 한 줄 요약\n${summary}\n`,
    '## 한 일\n- 했어요. [확인]\n',
    '## 증거\n- `true`: exit 0\n',
    '## 건너뛴 것, 확인 못 한 것, 리스크\n없음\n',
    '## 새 용어\n없음\n',
    '## 말해 보기\n- 왜?\n',
    '## 다음 단계\n- 없음\n',
  ].join('\n')
const card = (summary: string, title = '제목', decision?: string) =>
  buildCard({
    id: 'T-001',
    file: 'orchestration/handoffs/T-001.md',
    text: serializeFrontmatter(
      { task: 'T-001', status: decision ? 'needs-decision' : 'done' },
      body(summary, decision),
    ),
    title,
  })

// 보이지 않는 문자는 소스에 직접 쓰지 않고 코드 포인트로 만든다(tests/core/repo-hygiene.test.ts).
const ch = (cp: number) => String.fromCodePoint(cp)
const ESC = ch(0x1b)
const BEL = ch(0x07)
const CR = ch(0x0d)
const [RLO, LRO, LRI, RLI, LRM] = [0x202e, 0x202d, 0x2066, 0x2067, 0x200e].map(ch)
const UNSAFE = /(?![\n\t])[\p{Cc}\p{Bidi_Control}]/u

describe('인박스 카드 표시 안전', () => {
  test('터미널 제어 문자(ESC, BEL, CR)를 지우고 보여 준다', () => {
    const out = formatInbox([
      card(`요약${ESC}[2K${ESC}[1A숨김${BEL}이에요${CR}`, `제목${ESC}]0;x${BEL}`),
    ])
    expect(out).not.toMatch(UNSAFE)
    expect(out).toContain('요약[2K[1A숨김이에요')
  })

  test('양방향 제어 문자를 지우고 보여 준다', () => {
    const decision = `- [막는] 배포${LRO}할까요?\n  - 선택지: 예, 아니요\n  - 추천: 예\n  - 이유: 준비됐어요`
    const out = formatInbox([card(`승인${RLO}됨${LRI}${LRM}`, `제목${RLI}`, decision)])
    expect(out).not.toMatch(UNSAFE)
    expect(out).toContain('결정: 배포할까요? (추천 예)')
  })
})

describe('인박스 신호 줄은 없는 것을 없다고 단정하지 않는다', () => {
  test('리스크 절이 없으면 "리스크 없음"이 아니라 "리스크 기록 없음"이다', () => {
    // 계약 v1.1 이전 형식: 절 제목에 가운데점이 있어 새 계약의 리스크 절로 읽히지 않는다
    const old = body('요약이에요.').replace(
      '## 건너뛴 것, 확인 못 한 것, 리스크\n없음',
      '## 건너뛴 것 · 확인 못 한 것 · 리스크\n- 직접 확인하지 못했어요.',
    )
    const c = buildCard({
      id: 'T-001',
      file: 'h.md',
      text: serializeFrontmatter({ task: 'T-001', status: 'done' }, old),
    })
    expect(formatInbox([c])).toContain('리스크 기록 없음')
    expect(formatInbox([c])).not.toContain('리스크 없음')
  })

  test('계약을 어긴 HANDOFF는 신호 줄에 형식 오류 수를 보여 준다', () => {
    const c = card('가'.repeat(61))
    expect(formatInbox([c])).toContain('형식 오류 1건')
  })

  test('문체 경고와 오류는 형식 오류 수에 넣지 않는다', () => {
    const c = card('설치 → 확인을 했어요.')
    expect(formatInbox([c])).not.toContain('형식 오류')
  })
})

describe('인박스 정렬과 읽기 실패 (프로세스 안)', () => {
  const FIX = join(import.meta.dir, '..', 'fixtures', 'inbox')

  test('고정 fixture를 읽으면 CLI와 같은 기대 출력이 나온다', () => {
    const root = join(FIX, 'project')
    expect(formatInbox(loadCards({ root }, root))).toBe(
      readFileSync(join(FIX, 'expected.txt'), 'utf8'),
    )
  })

  test('frontmatter가 닫히지 않은 HANDOFF는 읽기 실패 카드가 되고 고치는 명령을 알려 준다', () => {
    const c = buildCard({ id: 'T-009', file: 'h.md', text: '---\ntask: T-009\n## 한 줄 요약\n' })
    const out = formatInbox([c])
    expect(out).toStartWith('실패 1건\n\n[읽기 실패] T-009 (작업 명세 없음)\n')
    expect(out).toContain('  gotechy handoff lint h.md\n')
  })

  test('리드 메모는 줄바꿈을 펴고 80자에서 자른다', () => {
    const text = serializeFrontmatter(
      { task: 'T-001', status: 'failed', lead_note: `첫 줄\n${'가'.repeat(100)}` },
      body('실패했어요.'),
    )
    const out = formatInbox([buildCard({ id: 'T-001', file: 'h.md', text })])
    expect(out).toContain(`  리드: 첫 줄 ${'가'.repeat(76)}…\n`)
  })
})

test('보안 감사 8차 중간 5: 화면 글자 정리는 형식 문자(폭 없는 공백, U+061C, BOM)도 지운다', () => {
  expect(displayTextForTest('5분\u200b \u061c유지\ufeff')).toBe('5분 유지')
})
