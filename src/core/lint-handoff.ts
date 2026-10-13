// HANDOFF 검사: 구조(스키마, 절 순서) + 내용 규칙(contract.md 4.1) + 문체(7절) + 용어 풀이.
import { parseFrontmatter } from './frontmatter'
import type { Issue } from './issues'
import { explainedTerms, handoffRuleIssues } from './rules-handoff'
import { HANDOFF_SECTIONS, HandoffFrontmatter } from './schema'
import { schemaIssues } from './schema-issues'
import { extractSections } from './sections'
import { extractEnglishTerms, lintStyle, styleSeverity } from './style'

export type HandoffLintResult = { issues: Issue[]; handoff?: HandoffFrontmatter }
export type HandoffLintOptions = {
  now?: Date
  /** 용어 은행(라이브러리 + 프로젝트)에 이미 있는 용어, 소문자 */
  knownTerms?: Set<string>
}

export function lintHandoff(
  text: string,
  file: string,
  opts: HandoffLintOptions = {},
): HandoffLintResult {
  const now = opts.now ?? new Date()
  const parsed = parseFrontmatter(text, file)
  if (!parsed.ok) return { issues: parsed.issues }
  const { value } = parsed
  const res = HandoffFrontmatter.safeParse(value.data)
  if (!res.success) return { issues: schemaIssues(res.error, value, file, 'handoff') }
  const issues: Issue[] = []

  const sections = extractSections(value.body, value.bodyLine)
  const titles = sections.map((s) => s.title)
  const expected = [...HANDOFF_SECTIONS]
  for (const t of expected.filter((t) => !titles.includes(t))) {
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
      fix: `순서: ${expected.join(', ')}`,
    })
  }
  for (const s of sections.filter((s) => !(expected as string[]).includes(s.title))) {
    issues.push({
      file,
      line: s.line,
      rule: 'handoff-section-unknown',
      message: `계약에 없는 절 \`## ${s.title}\`입니다.`,
      fix: '내용을 계약의 8개 절 중 맞는 곳으로 옮기고, 하위 제목이 필요하면 `###`를 쓰세요.',
    })
  }

  const byTitle = new Map(sections.map((s) => [s.title, s]))
  issues.push(...handoffRuleIssues({ file, status: res.data.status, byTitle }))
  issues.push(...lintStyle(value.body, file, value.bodyLine, now))

  const known = new Set([
    ...(opts.knownTerms ?? []),
    ...res.data.new_terms.map((t) => t.toLowerCase()),
  ])
  for (const t of explainedTerms(byTitle.get('새 용어'))) known.add(t)
  const termsSection = byTitle.get('새 용어')
  const bodyWithoutTerms = termsSection ? value.body.replace(termsSection.content, '') : value.body
  const unexplained = extractEnglishTerms(bodyWithoutTerms).filter((t) => !known.has(t))
  if (unexplained.length > 0) {
    issues.push({
      file,
      line: termsSection?.line ?? value.bodyLine,
      rule: 'style-term-unexplained',
      severity: styleSeverity(now),
      message: `풀이가 없는 영어 용어: ${unexplained.join(', ')}`,
      fix: '"새 용어" 절에 `- 용어: 쉬운 설명 한 줄`로 풀이를 남기세요. 현업 용어는 그대로 쓰되 오너가 익힐 수 있게 합니다.',
      example: '- worktree: 한 저장소를 여러 폴더에 동시에 펼쳐 두는 git 기능이에요.',
    })
  }
  return { issues, handoff: res.data }
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => (i.severity ?? 'error') === 'error')
}
