// YAML frontmatter + Markdown 본문 분리·파싱. gray-matter는 `---js` eval 경로가 있어 쓰지 않는다(ADR 0001).
import { type Document, isMap, LineCounter, parseDocument, stringify } from 'yaml'
import type { Issue } from './issues'

export type Parsed = {
  data: Record<string, unknown>
  body: string
  /** 본문이 시작하는 줄 번호(1부터) */
  bodyLine: number
  /** frontmatter 안의 키 경로 → 파일 기준 줄·칸 */
  locate: (path: (string | number)[]) => { line: number; col: number } | undefined
}

const OPEN = /^---\r?\n/

export function parseFrontmatter(
  text: string,
  file: string,
): { ok: true; value: Parsed } | { ok: false; issues: Issue[] } {
  if (!OPEN.test(text)) {
    return fail(
      file,
      1,
      'frontmatter-missing',
      '파일이 `---`로 시작하는 YAML frontmatter로 시작하지 않습니다.',
      '첫 줄에 `---`, 그 아래 YAML, 다시 `---` 줄을 두세요.',
      '---\\nid: T-001\\n---',
    )
  }
  const firstBreak = text.indexOf('\n') + 1
  const closeMatch = /\r?\n---[ \t]*(\r?\n|$)/.exec(text.slice(firstBreak - 1))
  if (!closeMatch) {
    return fail(
      file,
      1,
      'frontmatter-unclosed',
      'frontmatter를 닫는 `---` 줄이 없습니다.',
      'YAML이 끝나는 곳에 `---` 한 줄을 넣으세요.',
    )
  }
  const yamlStart = firstBreak
  const yamlEnd = firstBreak - 1 + closeMatch.index
  const yamlText = text.slice(yamlStart, yamlEnd + 1)
  const bodyStart = firstBreak - 1 + closeMatch.index + closeMatch[0].length
  const body = text.slice(bodyStart)
  const bodyLine = text.slice(0, bodyStart).split('\n').length

  const lc = new LineCounter()
  const doc = parseDocument(yamlText, { lineCounter: lc, uniqueKeys: true, prettyErrors: false })
  if (doc.errors.length > 0) {
    return {
      ok: false,
      issues: doc.errors.map((e) => {
        const pos = e.linePos?.[0]
        return {
          file,
          line: pos ? pos.line + 1 : 2,
          col: pos?.col,
          rule: e.code === 'DUPLICATE_KEY' ? 'frontmatter-duplicate-key' : 'frontmatter-yaml',
          message: `YAML 오류: ${e.message.split('\n')[0]}`,
          fix:
            e.code === 'DUPLICATE_KEY'
              ? '같은 키가 두 번 있습니다. 하나만 남기세요.'
              : 'YAML 문법을 고치세요 (들여쓰기, 콜론 뒤 공백, 따옴표 짝).',
        }
      }),
    }
  }
  if (!isMap(doc.contents)) {
    return fail(
      file,
      2,
      'frontmatter-not-map',
      'frontmatter가 `키: 값` 형태의 매핑이 아닙니다.',
      '각 줄을 `키: 값` 형식으로 쓰세요.',
    )
  }
  const data = doc.toJS() as Record<string, unknown>
  return {
    ok: true,
    value: { data, body, bodyLine, locate: (path) => locate(doc, lc, path) },
  }
}

function locate(doc: Document, lc: LineCounter, path: (string | number)[]) {
  // 존재하는 가장 깊은 노드의 위치를 돌려준다 (없는 키면 부모 위치).
  for (let n = path.length; n >= 0; n--) {
    const node = n === 0 ? doc.contents : doc.getIn(path.slice(0, n), true)
    const range = (node as { range?: [number, number, number] } | undefined)?.range
    if (range) {
      const pos = lc.linePos(range[0])
      return { line: pos.line + 1, col: pos.col } // +1: 첫 줄 `---`
    }
  }
  return undefined
}

export function serializeFrontmatter(data: Record<string, unknown>, body: string): string {
  // 본문은 손대지 않는다 — 저장·재파싱을 반복해도 같은 텍스트여야 한다(왕복 안정성).
  const yamlText = stringify(data, { lineWidth: 0 })
  return `---\n${yamlText}---\n${body}`
}

function fail(
  file: string,
  line: number,
  rule: string,
  message: string,
  fix: string,
  example?: string,
) {
  const issue: Issue = { file, line, rule, message, fix }
  if (example) issue.example = example
  return { ok: false as const, issues: [issue] }
}
