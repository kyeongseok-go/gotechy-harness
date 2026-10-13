// HANDOFF 검사: 구조(스키마, 절 순서) + 내용 규칙(contract.md 4.1) + 문체(7절) + 용어 풀이.
import { parseFrontmatter } from './frontmatter'
import type { Issue } from './issues'
import { CONTROL_CHAR, IGNORE_MARKER } from './prose'
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
  const ctrl = CONTROL_CHAR.exec(text)
  if (ctrl) {
    issues.push({
      file,
      line: text.slice(0, ctrl.index).split('\n').length,
      rule: 'handoff-control-char',
      message: `HANDOFF에 보이지 않는 제어 문자(U+${(ctrl[0].codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')})가 있어요.`,
      fix: '제어 문자를 지우세요. 터미널 화면을 덮어쓰거나 글자 순서를 속이는 데 쓰일 수 있어요.',
    })
  }
  const marker = IGNORE_MARKER.exec(value.body)
  if (marker) {
    issues.push({
      file,
      line: value.bodyLine + value.body.slice(0, marker.index).split('\n').length - 1,
      rule: 'handoff-style-ignore',
      message: 'HANDOFF에 문체 예외 표지가 있어요.',
      fix: '예외 구간은 규칙을 설명하는 문서에서만 써요. 표지를 지우고 걸리는 문장을 고치세요.',
    })
  }
  issues.push(...lintStyle(value.body, file, value.bodyLine, now, { honorIgnore: false }))

  const known = new Set([
    ...(opts.knownTerms ?? []),
    ...res.data.new_terms.map((t) => t.toLowerCase()),
  ])
  // 여러 단어 용어(Secure Enclave)는 본문에서 낱말 단위로 뽑히므로 낱말도 풀이된 것으로 본다
  for (const t of [
    ...explainedTerms(byTitle.get('새 용어')),
    ...res.data.new_terms.map((x) => x.toLowerCase()),
  ])
    for (const w of [t, ...t.split(/\s+/)]) known.add(w)
  const termsSection = byTitle.get('새 용어')
  // 증거 절은 명령 출력(pass, fail 같은)을 옮겨 적는 곳이라 용어 풀이를 요구하지 않는다
  let bodyWithoutTerms = value.body
  for (const sec of [termsSection, byTitle.get('증거')])
    if (sec) bodyWithoutTerms = bodyWithoutTerms.replace(sec.content, '')
  const unexplained = extractEnglishTerms(bodyWithoutTerms, { honorIgnore: false }).filter(
    (t) => !known.has(t),
  )
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
