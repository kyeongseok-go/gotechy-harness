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
