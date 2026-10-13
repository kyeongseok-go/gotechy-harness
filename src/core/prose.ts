// 문체 검사용으로 본문에서 코드·URL·파일명을 같은 길이의 공백으로 가린다. 오프셋과 줄 번호가 원문과 일치해야 한다.
// 규칙을 설명하느라 금지 패턴을 인용하는 구간: <!-- style-ignore-start --> ... <!-- style-ignore-end -->
const IGNORE = /<!--\s*style-ignore-start\s*-->[\s\S]*?<!--\s*style-ignore-end\s*-->/g
// 보이지 않게 화면을 조작하는 문자: 터미널 제어 문자(줄바꿈, 탭, CR 제외)와 양방향 제어 문자
export const CONTROL_CHAR = /(?![\n\t\r])[\p{Cc}\p{Bidi_Control}]/u
export const IGNORE_MARKER = /<!--\s*style-ignore-(?:start|end)\s*-->/
const FENCE = /^\s*(```|~~~)[\s\S]*?^\s*\1\s*$/gm
const INLINE_CODE = /`[^`\n]*`/g
const URL = /\bhttps?:\/\/[^\s)>\]]+/g
const FILE = /\b[\w./-]+\.(md|ts|tsx|js|json|ya?ml|toml|txt|py|sh|lock|html|css)\b/g

function blank(match: string): string {
  return match.replace(/[^\n]/g, ' ')
}

export type MaskOptions = {
  /** false면 예외 구간도 검사한다. HANDOFF는 규칙 설명 문서가 아니라서 예외 구간을 인정하지 않는다. */
  honorIgnore?: boolean
}

export function maskNonProse(text: string, opts: MaskOptions = {}): string {
  return (opts.honorIgnore === false ? text : text.replace(IGNORE, blank))
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
