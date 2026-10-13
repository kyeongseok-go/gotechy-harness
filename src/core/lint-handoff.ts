// HANDOFF 검사. M1은 구조(스키마·절 순서)만, M2에서 길이·결정 표지·사실 표시·강조 규칙을 더한다.
import { parseFrontmatter } from './frontmatter'
import type { Issue } from './issues'
import { HANDOFF_SECTIONS, HandoffFrontmatter } from './schema'
import { schemaIssues } from './schema-issues'
import { extractSections } from './sections'

export type HandoffLintResult = { issues: Issue[]; handoff?: HandoffFrontmatter }

export function lintHandoff(text: string, file: string): HandoffLintResult {
  const parsed = parseFrontmatter(text, file)
  if (!parsed.ok) return { issues: parsed.issues }
  const { value } = parsed
  const res = HandoffFrontmatter.safeParse(value.data)
  if (!res.success) return { issues: schemaIssues(res.error, value, file, 'handoff') }
  const issues: Issue[] = []

  const sections = extractSections(value.body, value.bodyLine)
  const titles = sections.map((s) => s.title)
  const expected = [...HANDOFF_SECTIONS]
  const missing = expected.filter((t) => !titles.includes(t))
  for (const t of missing) {
    issues.push({
      file,
      line: value.bodyLine,
      rule: 'handoff-section-missing',
      message: `\`## ${t}\` 절이 없습니다.`,
      fix: '내용이 없어도 절은 두고 "없음"이라고 쓰세요. 순서는 계약 4절과 같아야 합니다.',
      example: `## ${t}\n없음`,
    })
  }
  const present = titles.filter((t) => (expected as string[]).includes(t))
  const ordered = expected.filter((t) => present.includes(t))
  const firstWrong = present.findIndex((t, i) => t !== ordered[i])
  if (firstWrong !== -1) {
    issues.push({
      file,
      line: sections.find((s) => s.title === present[firstWrong])?.line,
      rule: 'handoff-section-order',
      message: `절 순서가 계약과 다릅니다 (\`## ${present[firstWrong]}\`부터 어긋남).`,
      fix: `순서: ${expected.join(' → ')}`,
    })
  }
  const unknown = sections.filter((s) => !(expected as string[]).includes(s.title))
  for (const s of unknown) {
    issues.push({
      file,
      line: s.line,
      rule: 'handoff-section-unknown',
      message: `계약에 없는 절 \`## ${s.title}\`입니다.`,
      fix: '내용을 계약의 8개 절 중 맞는 곳으로 옮기고, 하위 제목이 필요하면 `###`를 쓰세요.',
    })
  }
  return { issues, handoff: res.data }
}
