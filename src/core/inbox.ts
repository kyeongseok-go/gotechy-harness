// 인박스 카드(contract.md 8.1절). 파일 읽기는 runtime이 하고, 여기서는 HANDOFF 글로 카드를 만들고 정렬해 글로 찍는다.
import { parseDecisions } from './decisions'
import { parseFrontmatter } from './frontmatter'
import { hasErrors, lintHandoff } from './lint-handoff'
import { HandoffFrontmatter } from './schema'
import { schemaIssues } from './schema-issues'
import { extractSections, isNone, type Section, topItems } from './sections'

export type CardGroup = 'decision' | 'failed' | 'done'
export type Card = {
  id: string
  /** 화면에 보여 줄 HANDOFF 경로 */
  file: string
  title: string | undefined
  group: CardGroup
  /** 읽기 실패 사유. 있으면 handoff는 없다 */
  problem?: string
  handoff?: HandoffFrontmatter
  sections: Map<string, Section>
  summary: string
  blocking: { question: string; pick?: string }[]
  defaults: number
  /** 리스크 절이 없으면 undefined. 없는 절을 "리스크 없음"으로 읽으면 오너를 잘못 안심시킨다 */
  risks: number | undefined
  /** 계약(4절, 4.1절) 위반 수. 문체 규칙은 날짜에 따라 강도가 바뀌어 세지 않는다 */
  formatErrors: number
}

export const GROUP_LABEL: Record<CardGroup, string> = {
  decision: '결정 필요',
  failed: '실패',
  done: '완료',
}
const GROUP_ORDER: CardGroup[] = ['decision', 'failed', 'done']
const RISK = '건너뛴 것, 확인 못 한 것, 리스크'

// 터미널 제어 문자(줄바꿈, 탭 제외)와 양방향 제어 문자. 화면을 덮어쓰거나 글자 순서를 속이는 데 쓰인다.
// 유니코드 속성으로 쓴다: \u escape는 편집 도구를 거치며 실제 문자로 바뀌어 소스에 보이지 않는 문자가 들어간 적이 있다.
const UNSAFE = /(?![\n\t])[\p{Cc}\p{Bidi_Control}]/gu
export function displayText(s: string): string {
  return s.replace(UNSAFE, '')
}

export function buildCard(input: { id: string; file: string; text: string; title?: string }): Card {
  const base = {
    id: input.id,
    file: input.file,
    title: input.title,
    sections: new Map<string, Section>(),
    summary: '',
    blocking: [],
    defaults: 0,
    risks: undefined,
    formatErrors: 0,
  }
  const parsed = parseFrontmatter(input.text, input.file)
  if (!parsed.ok)
    return { ...base, group: 'failed', problem: parsed.issues[0]?.message ?? '읽을 수 없어요' }
  const res = HandoffFrontmatter.safeParse(parsed.value.data)
  if (!res.success) {
    const first = schemaIssues(res.error, parsed.value, input.file, 'handoff')[0]
    return { ...base, group: 'failed', problem: first?.message ?? '스키마 오류' }
  }
  const h = res.data
  const sections = new Map(
    extractSections(parsed.value.body, parsed.value.bodyLine).map((s) => [s.title, s]),
  )
  const decisions = parseDecisions(sections.get('결정 필요')).items
  const risk = sections.get(RISK)
  const summaryLine = sections
    .get('한 줄 요약')
    ?.content.split('\n')
    .find((l) => l.trim() !== '')
  return {
    ...base,
    group: h.status === 'needs-decision' ? 'decision' : h.status === 'failed' ? 'failed' : 'done',
    handoff: h,
    sections,
    summary: summaryLine?.trim() ?? '(요약 없음)',
    blocking: decisions
      .filter((d) => d.marker === '막는')
      .map((d) => (d.pick ? { question: d.question, pick: d.pick } : { question: d.question })),
    defaults: decisions.filter((d) => d.marker === '기본값').length,
    risks: !risk ? undefined : isNone(risk.content) ? 0 : topItems(risk).length,
    formatErrors: lintHandoff(input.text, input.file).issues.filter(
      (i) => !i.rule.startsWith('style-') && hasErrors([i]),
    ).length,
  }
}

function waitedSince(c: Card): number {
  const t = Date.parse(c.handoff?.verified?.at ?? '')
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

/** 묶음(결정 필요, 실패, 완료) 순, 같은 묶음은 오래 기다린 것부터, 그다음 작업 번호 순. */
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
      waitedSince(a) - waitedSince(b) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

export function countLine(cards: Card[]): string {
  if (cards.length === 0) return '대기 중인 일 없음'
  return GROUP_ORDER.map((g) => [g, cards.filter((c) => c.group === g).length] as const)
    .filter(([, n]) => n > 0)
    .map(([g, n]) => `${GROUP_LABEL[g]} ${n}건`)
    .join(', ')
}

export function cardLabel(c: Card): string {
  return c.problem ? '읽기 실패' : GROUP_LABEL[c.group]
}

export function signalLine(c: Card): string {
  const h = c.handoff
  if (!h) return ''
  const parts: string[] = []
  if (c.blocking.length > 0) parts.push(`막는 결정 ${c.blocking.length}`)
  if (c.defaults > 0) parts.push(`기본값 ${c.defaults}`)
  if (c.formatErrors > 0) parts.push(`형식 오류 ${c.formatErrors}건`)
  const v = h.verified
  parts.push(
    !v ? '검증 기록 없음' : v.exit_code === 0 ? '검증 통과' : `검증 실패 exit ${v.exit_code}`,
  )
  parts.push(
    c.risks === undefined ? '리스크 기록 없음' : c.risks > 0 ? `리스크 ${c.risks}` : '리스크 없음',
  )
  const cost = h.usage?.cost_usd
  parts.push(typeof cost === 'number' ? `$${cost.toFixed(2)}` : '비용 모름')
  const files = h.changed_files?.filter((f) => !f.startsWith('orchestration/handoffs/'))
  parts.push(files ? `파일 ${files.length}개` : '파일 기록 없음')
  return parts.join(', ')
}

export const MAX_DECISION_LINES = 3

export function truncate(s: string, max: number): string {
  const chars = [...s]
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : s
}

function formatCard(c: Card): string {
  const head = `[${cardLabel(c)}] ${c.id} ${c.title ?? '(작업 명세 없음)'}`
  if (c.problem) return [head, `  ${c.problem}`, `  gotechy handoff lint ${c.file}`].join('\n')
  const lines = [head, `  ${signalLine(c)}`, `  ${c.summary}`]
  for (const d of c.blocking.slice(0, MAX_DECISION_LINES))
    lines.push(`  결정: ${d.question}${d.pick ? ` (추천 ${d.pick})` : ''}`)
  if (c.blocking.length > MAX_DECISION_LINES)
    lines.push(`  결정 외 ${c.blocking.length - MAX_DECISION_LINES}건`)
  if (c.group === 'failed' && c.handoff?.lead_note)
    lines.push(`  리드: ${truncate(c.handoff.lead_note.replace(/\s*\n\s*/g, ' '), 80)}`)
  return lines.join('\n')
}

export function formatInbox(cards: Card[]): string {
  if (cards.length === 0) return `${countLine(cards)}\n`
  const text = [countLine(cards), ...sortCards(cards).map(formatCard)].join('\n\n')
  return `${displayText(text)}\n`
}
