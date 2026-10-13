// 용어 은행: 라이브러리 knowledge/terms.jsonl(공개 기술 용어) + 프로젝트 orchestration/terms.jsonl(누적).
// 한 번 풀이한 용어는 다시 요구하지 않는다(contract.md 7절).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { libraryRoot } from './library'

export type TermEntry = {
  term: string
  aliases?: string[]
  easy: string
  formal?: string
  src?: string
}

export function readTermBank(file: string): TermEntry[] {
  if (!existsSync(file)) return []
  const out: TermEntry[] = []
  for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line) as TermEntry
      if (typeof e.term === 'string' && typeof e.easy === 'string') out.push(e)
    } catch {
      throw new Error(`${file}:${i + 1}: 용어 은행 줄이 JSON이 아닙니다`)
    }
  }
  return out
}

export function loadKnownTerms(projectRoot?: string): Set<string> {
  const files = [join(libraryRoot(), 'knowledge', 'terms.jsonl')]
  if (projectRoot) files.push(join(projectRoot, 'orchestration', 'terms.jsonl'))
  const known = new Set<string>()
  for (const f of files) {
    for (const e of readTermBank(f)) {
      known.add(e.term.toLowerCase())
      for (const a of e.aliases ?? []) known.add(a.toLowerCase())
    }
  }
  return known
}
