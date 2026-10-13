// Markdown 본문에서 `## ` 제목을 줄 번호와 함께 뽑는다. 코드 블록 안의 `##`는 제목이 아니다.
export type Section = { title: string; line: number; content: string }

export function extractSections(body: string, bodyLine: number): Section[] {
  const lines = body.split('\n')
  const sections: Section[] = []
  let inFence = false
  let current: Section | undefined
  lines.forEach((raw, i) => {
    if (/^\s*(```|~~~)/.test(raw)) inFence = !inFence
    const m = !inFence ? /^##\s+(.+?)\s*$/.exec(raw) : null
    if (m?.[1] && !raw.startsWith('###')) {
      current = { title: m[1], line: bodyLine + i, content: '' }
      sections.push(current)
      return
    }
    if (current) current.content += `${raw}\n`
  })
  return sections
}

/** 절 내용을 줄 단위로, 파일 기준 줄 번호와 함께. */
export function sectionLines(sec: Section): { text: string; line: number }[] {
  return sec.content.split('\n').map((text, i) => ({ text, line: sec.line + 1 + i }))
}

/** 들여쓰지 않은 목록 항목만. */
export function topItems(sec: Section): { text: string; line: number }[] {
  return sectionLines(sec).filter((l) => /^[-*]\s+/.test(l.text))
}

export const isNone = (s: string) => s.trim() === '' || s.trim() === '없음'
