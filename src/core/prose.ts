// 문체 검사용으로 본문에서 코드·URL·파일명을 같은 길이의 공백으로 가린다. 오프셋과 줄 번호가 원문과 일치해야 한다.
// 규칙을 설명하느라 금지 패턴을 인용하는 구간: <!-- style-ignore-start --> ... <!-- style-ignore-end -->
const IGNORE = /<!--\s*style-ignore-start\s*-->[\s\S]*?<!--\s*style-ignore-end\s*-->/g
const FENCE = /^\s*(```|~~~)[\s\S]*?^\s*\1\s*$/gm
const INLINE_CODE = /`[^`\n]*`/g
const URL = /\bhttps?:\/\/[^\s)>\]]+/g
const FILE = /\b[\w./-]+\.(md|ts|tsx|js|json|ya?ml|toml|txt|py|sh|lock|html|css)\b/g

function blank(match: string): string {
  return match.replace(/[^\n]/g, ' ')
}

export function maskNonProse(text: string): string {
  return text
    .replace(IGNORE, blank)
    .replace(FENCE, blank)
    .replace(INLINE_CODE, blank)
    .replace(URL, blank)
    .replace(FILE, blank)
}

export function lineAt(text: string, index: number, baseLine: number): number {
  let line = baseLine
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++
  return line
}
