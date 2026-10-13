// 용어 은행: 라이브러리 knowledge/terms.jsonl(공개 기술 용어) + 프로젝트 orchestration/terms.jsonl(누적).
// 한 번 풀이한 용어는 다시 요구하지 않는다(contract.md 7절).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TermEntry } from '../core/terms'
import { libraryRoot } from './library'

export type { TermEntry }

export function readTermBank(file: string): TermEntry[] {
  if (!existsSync(file)) return []
  const out: TermEntry[] = []
  for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
    if (!line.trim()) continue
    let raw: unknown
    try {
      raw = JSON.parse(line)
    } catch {
      throw new Error(`${file}:${i + 1}: 용어 은행 줄이 JSON이 아닙니다`)
    }
    // 형식이 틀린 항목은 건너뛴다. 프로젝트 은행은 워커 출력에서 쌓이므로 모양을 믿지 않는다.
    const e = TermEntry.safeParse(raw)
    if (e.success) out.push(e.data)
  }
  return out
}

/** 라이브러리 은행 다음에 프로젝트 은행. 같은 용어는 라이브러리 풀이가 먼저 나온다. */
export function loadTermBank(projectRoot?: string): TermEntry[] {
  const files = [join(libraryRoot(), 'knowledge', 'terms.jsonl')]
  if (projectRoot) files.push(join(projectRoot, 'orchestration', 'terms.jsonl'))
  return files.flatMap(readTermBank)
}

export function loadKnownTerms(projectRoot?: string): Set<string> {
  const known = new Set<string>()
  for (const e of loadTermBank(projectRoot)) {
    known.add(e.term.toLowerCase())
    for (const a of e.aliases ?? []) known.add(a.toLowerCase())
  }
  return known
}
