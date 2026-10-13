// 용어 은행 항목(contract.md 7절). 프로젝트 은행은 워커 출력에서 쌓이므로 신뢰하지 않는 입력으로 검증한다.
import { z } from 'zod'

export const TermEntry = z.object({
  term: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  easy: z.string().min(1),
  formal: z.string().optional(),
  src: z.string().optional(),
})
export type TermEntry = z.infer<typeof TermEntry>

/** 글에 나온 단어(소문자) 중 은행에 있는 항목. 은행 순서를 지키고 중복은 뺀다. */
export function termsUsed(bank: TermEntry[], words: Set<string>): TermEntry[] {
  const seen = new Set<string>()
  return bank.filter((e) => {
    const names = [e.term, ...(e.aliases ?? [])].map((n) => n.toLowerCase())
    const key = e.term.toLowerCase()
    if (seen.has(key) || !names.some((n) => words.has(n))) return false
    seen.add(key)
    return true
  })
}
