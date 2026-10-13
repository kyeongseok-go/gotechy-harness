// zod 검증 실패를 파일:줄:칸이 붙은 Issue로 바꾼다.
import type { z } from 'zod'
import type { Parsed } from './frontmatter'
import type { Issue } from './issues'

export function schemaIssues(
  error: z.ZodError,
  parsed: Parsed,
  file: string,
  rulePrefix: string,
): Issue[] {
  return error.issues.map((iss) => {
    const path = iss.path.filter((p): p is string | number => typeof p !== 'symbol')
    const pos = parsed.locate(path)
    const key = path.join('.') || '(전체)'
    const unknown =
      iss.code === 'unrecognized_keys' ? (iss as { keys?: string[] }).keys?.join(', ') : undefined
    const issue: Issue = {
      file,
      rule: `${rulePrefix}-schema`,
      message: unknown ? `알 수 없는 키: ${unknown}` : `\`${key}\`: ${iss.message}`,
      fix: unknown
        ? '계약(docs/references/contract.md)에 없는 키입니다. 지우거나 이름을 고치세요.'
        : `\`${key}\` 값을 계약(docs/references/contract.md)의 타입에 맞게 고치세요.`,
    }
    if (pos) {
      issue.line = pos.line
      issue.col = pos.col
    }
    return issue
  })
}
