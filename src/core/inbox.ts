// 인박스 카드(contract.md 8.1절). 파일 읽기는 runtime이 하고, 여기서는 HANDOFF 글로 카드를 만들고 정렬해 글로 찍는다.
import { parseDecisions } from './decisions'
import { parseFrontmatter } from './frontmatter'
import type { Gate } from './gate'
import { hasErrors, lintHandoff } from './lint-handoff'
import { HandoffFrontmatter } from './schema'
import { schemaIssues } from './schema-issues'
import { extractSections, isNone, type Section, topItems } from './sections'

/** resume: 막는 결정을 모두 결정해 다시 실행을 기다린다(TD-022) */
export type CardGroup = 'decision' | 'failed' | 'resume' | 'done'
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
  /** gate: 열린 게이트 번호, decided: 이미 고른 선택 (contract.md 9.3절). options, reason은 HANDOFF에 적힌 것 */
  blocking: {
    question: string
    pick?: string
    gate?: string
    decided?: string
    options?: string[]
    reason?: string
  }[]
  defaults: number
  /** 기본값 결정 목록(화면의 "기본값으로 진행한 것") */
  defaultItems: { question: string; pick?: string; reason?: string }[]
  /** 알림 표지 항목 */
  alerts: string[]
  /** 리스크 절이 없으면 undefined. 없는 절을 "리스크 없음"으로 읽으면 오너를 잘못 안심시킨다 */
  risks: number | undefined
  /** 계약(4절, 4.1절) 위반 수. 문체 규칙은 날짜에 따라 강도가 바뀌어 세지 않는다 */
  formatErrors: number
  /** 열린 approval-after 게이트 */
  approval?: { id: string; options: string[] }
  /** HANDOFF 없이 시작 승인만 기다리는 카드의 approval-before 게이트 */
  startGate?: { id: string; options: string[] }
  /** 용어 은행에 없는 새 용어 */
  newTerms: string[]
  /** 감사 기록(contract.md 13절). current: 지금 HANDOFF 판본을 감사했는가. items: 기록의 지적(화면용) */
  audit?: {
    current: boolean
    confirmed: number
    /** 기록의 지적 수(근거 확인 여부와 무관) */
    findings: number
    truncated: boolean
    items: AuditItem[]
  }
}

/** 감사 지적 하나(contract.md 13절). confirmed: 리드가 작업 브랜치에서 file:line을 확인했는가 */
export type AuditItem = {
  severity: 'high' | 'medium' | 'low'
  file: string
  line: number
  confirmed: boolean
  claim: string
  actual: string
}

export const GROUP_LABEL: Record<CardGroup, string> = {
  decision: '결정 필요',
  failed: '실패',
  resume: '다시 실행 대기',
  done: '완료',
}
const GROUP_ORDER: CardGroup[] = ['decision', 'failed', 'resume', 'done']
const RISK = '건너뛴 것, 확인 못 한 것, 리스크'

// 터미널 제어 문자(줄바꿈, 탭 제외)와 양방향 제어 문자. 화면을 덮어쓰거나 글자 순서를 속이는 데 쓰인다.
// 유니코드 속성으로 쓴다: \u escape는 편집 도구를 거치며 실제 문자로 바뀌어 소스에 보이지 않는 문자가 들어간 적이 있다.
// 형식 문자(Cf: 폭 없는 공백, U+061C 등)도 지운다. 선택지가 화면에서 같아 보이게 만들 수 있다(감사 8차 중간 5)
const UNSAFE = /(?![\n\t])[\p{Cc}\p{Cf}\p{Bidi_Control}]/gu
export function displayText(s: string): string {
  return s.replace(UNSAFE, '')
}

export function buildCard(input: {
  id: string
  file: string
  text: string
  title?: string
  /** 용어 은행(소문자). 주면 은행에 없는 새 용어를 카드에 올린다 */
  knownTerms?: Set<string>
}): Card {
  const base = {
    id: input.id,
    file: input.file,
    title: input.title,
    sections: new Map<string, Section>(),
    summary: '',
    blocking: [],
    defaults: 0,
    defaultItems: [],
    alerts: [],
    risks: undefined,
    formatErrors: 0,
    newTerms: [],
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
      .map((d) => ({
        question: d.question,
        ...(d.pick ? { pick: d.pick } : {}),
        ...(d.options ? { options: d.options } : {}),
        ...(d.reason ? { reason: d.reason } : {}),
      })),
    defaults: decisions.filter((d) => d.marker === '기본값').length,
    defaultItems: decisions
      .filter((d) => d.marker === '기본값')
      .map((d) => ({
        question: d.question,
        ...(d.pick ? { pick: d.pick } : {}),
        ...(d.reason ? { reason: d.reason } : {}),
      })),
    alerts: decisions.filter((d) => d.marker === '알림').map((d) => d.question),
    risks: !risk ? undefined : isNone(risk.content) ? 0 : topItems(risk).length,
    formatErrors: lintHandoff(input.text, input.file).issues.filter(
      (i) => !i.rule.startsWith('style-') && hasErrors([i]),
    ).length,
    newTerms: input.knownTerms
      ? unknownTerms(h.new_terms, sections.get('새 용어'), input.knownTerms)
      : [],
  }
}

function unknownTerms(listed: string[], sec: Section | undefined, known: Set<string>): string[] {
  const named =
    sec && !isNone(sec.content)
      ? topItems(sec)
          .map((l) => /^[-*]\s+([^:：]+?)\s*[:：]/.exec(l.text)?.[1]?.trim())
          .filter((t): t is string => Boolean(t))
      : []
  const out: string[] = []
  for (const t of [...listed, ...named])
    if (!known.has(t.toLowerCase()) && !out.some((o) => o.toLowerCase() === t.toLowerCase()))
      out.push(t)
  return out
}

/** 이 카드 작업의 게이트를 붙인다. 지난 판본 게이트는 무시한다. */
export function attachGates(c: Card, gates: Gate[]): Card {
  const rev = c.handoff?.rev ?? null
  const mine = gates.filter((g) => g.task === c.id && g.handoff_rev === rev)
  const blocking = c.blocking.map((b) => {
    const g = mine.find((g) => g.class === 'decision' && g.question === b.question)
    if (!g) return b
    return g.status === 'resolved' && g.resolution
      ? { ...b, gate: g.id, decided: g.resolution }
      : { ...b, gate: g.id }
  })
  const after = mine.find((g) => g.class === 'approval-after' && g.status === 'pending')
  if (after)
    return { ...c, blocking, group: 'decision', approval: { id: after.id, options: after.options } }
  // 오너가 할 결정이 남지 않았는데 "결정 필요"로 보이면 결정 버튼 없는 화면에서 헤맨다(TD-022)
  const allDecided = blocking.length > 0 && blocking.every((b) => b.gate && b.decided)
  return c.group === 'decision' && allDecided
    ? { ...c, blocking, group: 'resume' }
    : { ...c, blocking }
}

/** 감사 기록 줄(contract.md 13절). 지난 판본을 감사했으면 수를 보여 주지 않는다 */
export function auditLine(c: Card): string | undefined {
  if (!c.audit) return undefined
  if (!c.audit.current) return '감사: 지난 판본 기준'
  return `감사: 근거 있는 지적 ${c.audit.confirmed}건${c.audit.truncated ? ' (diff 일부만 감사)' : ''}`
}

/** 다시 실행 대기 카드의 다음 명령 */
export function resumeCommand(c: Card): string {
  return `gotechy run ${c.id}`
}

/** HANDOFF가 아직 없는 작업의 시작 승인 카드 */
export function startGateCard(taskId: string, title: string | undefined, gate: Gate): Card {
  return {
    id: taskId,
    file: '',
    title,
    group: 'decision',
    sections: new Map(),
    summary: '',
    blocking: [],
    defaults: 0,
    defaultItems: [],
    alerts: [],
    risks: undefined,
    formatErrors: 0,
    startGate: { id: gate.id, options: gate.options },
    newTerms: [],
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

export function decisionLine(d: Card['blocking'][number]): string {
  const label = d.gate ? `결정 ${d.gate}` : '결정'
  const tail = d.decided ? ` (결정함 ${d.decided})` : d.pick ? ` (추천 ${d.pick})` : ''
  return `${label}: ${d.question}${tail}`
}

export function gateCommand(g: { id: string; options: string[] }): string {
  return `gotechy decide ${g.id} ${g.options.join('|')}`
}

function formatCard(c: Card): string {
  const head = `[${cardLabel(c)}] ${c.id} ${c.title ?? '(작업 명세 없음)'}`
  if (c.startGate)
    return [head, `  시작 승인 대기 ${c.startGate.id}: ${gateCommand(c.startGate)}`].join('\n')
  if (c.problem) return [head, `  ${c.problem}`, `  gotechy handoff lint ${c.file}`].join('\n')
  const lines = [head, `  ${signalLine(c)}`, `  ${c.summary}`]
  for (const d of c.blocking.slice(0, MAX_DECISION_LINES)) lines.push(`  ${decisionLine(d)}`)
  if (c.blocking.length > MAX_DECISION_LINES)
    lines.push(`  결정 외 ${c.blocking.length - MAX_DECISION_LINES}건`)
  if (c.blocking.some((d) => d.gate && !d.decided))
    lines.push('  결정하려면: gotechy decide <게이트 번호> <선택>')
  if (c.approval) lines.push(`  승인 대기 ${c.approval.id}: ${gateCommand(c.approval)}`)
  if (c.group === 'resume') lines.push(`  다음: ${resumeCommand(c)}`)
  const audit = auditLine(c)
  if (audit) lines.push(`  ${audit}`)
  if (c.newTerms.length > 0) lines.push(`  새 용어: ${c.newTerms.join(', ')}`)
  // 리드 메모는 실패와 결정 필요 카드에 보인다. accept가 충돌로 멈춘 사유도 여기 남는다(contract.md 9.4절)
  if (c.group !== 'done' && c.handoff?.lead_note)
    lines.push(`  리드: ${truncate(c.handoff.lead_note.replace(/\s*\n\s*/g, ' '), 80)}`)
  return lines.join('\n')
}

export function formatInbox(cards: Card[]): string {
  if (cards.length === 0) return `${countLine(cards)}\n`
  const text = [countLine(cards), ...sortCards(cards).map(formatCard)].join('\n\n')
  return `${displayText(text)}\n`
}
