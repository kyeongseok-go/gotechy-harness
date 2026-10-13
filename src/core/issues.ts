// 에이전트가 읽고 바로 고칠 수 있는 형태의 검사 결과. 모든 lint·검증이 이 형식으로 보고한다.
export type Issue = {
  file: string
  line?: number
  col?: number
  rule: string
  message: string
  fix: string
  example?: string
}

export function formatIssue(i: Issue): string {
  const loc = i.line ? `${i.file}:${i.line}${i.col ? `:${i.col}` : ''}` : i.file
  const lines = [`${loc} [${i.rule}] ${i.message}`, `  → 고치는 법: ${i.fix}`]
  if (i.example) lines.push(`  예: ${i.example}`)
  return lines.join('\n')
}
