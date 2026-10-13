// "결정 필요" 절 해석. lint(rules-handoff)와 인박스 카드가 같은 해석을 쓴다(contract.md 4.1절).
import { isNone, type Section, sectionLines } from './sections'

export type DecisionMarker = '막는' | '기본값' | '알림'
export type Decision = {
  marker: DecisionMarker
  question: string
  line: number
  options?: string[]
  pick?: string
  reason?: string
}
export type ParsedDecisions = {
  items: Decision[]
  /** 표지도 하위 항목도 아닌 줄 */
  stray: { text: string; line: number }[]
}

export function parseDecisions(sec: Section | undefined): ParsedDecisions {
  const out: ParsedDecisions = { items: [], stray: [] }
  if (!sec || isNone(sec.content)) return out
  for (const l of sectionLines(sec)) {
    if (l.text.trim() === '') continue
    const top = /^[-*]\s+\[(막는|기본값|알림)\]\s*(\S.*)$/.exec(l.text)
    const sub = /^\s+[-*]\s+(선택지|추천|이유):\s*(.*)$/.exec(l.text)
    const current = out.items.at(-1)
    if (top?.[1] && top[2]) {
      out.items.push({ marker: top[1] as DecisionMarker, question: top[2].trim(), line: l.line })
    } else if (sub && current) {
      const [, key, value = ''] = sub
      if (key === '선택지')
        current.options = value
          .split(/,\s*/)
          .map((v) => v.trim())
          .filter(Boolean)
      if (key === '추천') current.pick = value.trim()
      if (key === '이유') current.reason = value.trim()
    } else {
      out.stray.push(l)
    }
  }
  return out
}
