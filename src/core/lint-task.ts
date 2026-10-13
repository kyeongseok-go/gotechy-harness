// 작업 명세 검사: 스키마, 파일명-id 일치, ownership 규칙, 본문 5요소 순서.
import { parseFrontmatter } from './frontmatter'
import type { Issue } from './issues'
import { impliesIrreversible, ownershipProblem } from './paths'
import { TASK_SECTIONS, TaskFrontmatter } from './schema'
import { schemaIssues } from './schema-issues'
import { extractSections } from './sections'

export type TaskLintResult = { issues: Issue[]; task?: TaskFrontmatter; irreversible: boolean }

export function lintTask(text: string, file: string): TaskLintResult {
  const parsed = parseFrontmatter(text, file)
  if (!parsed.ok) return { issues: parsed.issues, irreversible: false }
  const { value } = parsed
  const res = TaskFrontmatter.safeParse(value.data)
  if (!res.success)
    return { issues: schemaIssues(res.error, value, file, 'task'), irreversible: false }
  const task = res.data
  const issues: Issue[] = []

  const base = file.split('/').pop()?.replace(/\.md$/, '')
  if (base && base !== task.id) {
    issues.push({
      file,
      ...value.locate(['id']),
      rule: 'task-id-filename',
      message: `id(${task.id})와 파일명(${base}.md)이 다릅니다.`,
      fix: `파일명을 ${task.id}.md로 바꾸거나 id를 ${base}로 고치세요.`,
    })
  }
  task.ownership.forEach((entry, i) => {
    const problem = ownershipProblem(entry)
    if (problem) {
      issues.push({
        file,
        ...value.locate(['ownership', i]),
        rule: 'task-ownership',
        message: `ownership \`${entry}\`: ${problem}.`,
        fix: '워커가 바꿀 파일 경로나 `/`로 끝나는 폴더만 적으세요. 보호 경로는 리드만 다룹니다.',
        example: 'ownership: [README.md, src/parser/]',
      })
    }
  })

  const sections = extractSections(value.body, value.bodyLine)
  const titles = sections.map((s) => s.title)
  let cursor = -1
  for (const want of TASK_SECTIONS) {
    const at = titles.indexOf(want)
    if (at === -1) {
      issues.push({
        file,
        line: value.bodyLine,
        rule: 'task-section-missing',
        message: `본문에 \`## ${want}\` 절이 없습니다.`,
        fix: `본문에 5요소 절을 이 순서로 두세요: ${TASK_SECTIONS.map((t) => `## ${t}`).join(' → ')}`,
      })
    } else if (at < cursor) {
      issues.push({
        file,
        line: sections[at]?.line,
        rule: 'task-section-order',
        message: `\`## ${want}\` 절의 순서가 계약과 다릅니다.`,
        fix: `절 순서: ${TASK_SECTIONS.join(' → ')}`,
      })
    } else {
      cursor = at
    }
  }
  const irreversible = task.irreversible || impliesIrreversible(task.ownership)
  return { issues, task, irreversible }
}
