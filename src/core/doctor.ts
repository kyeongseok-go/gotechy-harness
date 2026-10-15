// doctor의 순수 판정(contract.md 10.2절): 버전 읽기, 셸 스크립트, 스킬 frontmatter.
import { parseFrontmatter } from './frontmatter'

/** 명령 출력에서 첫 번째 a.b.c 버전. */
export function parseVersion(output: string): string | undefined {
  return /\d+\.\d+\.\d+/.exec(output)?.[0]
}

type Rule = { re: RegExp; label: string }
// POSIX sh에 없는 문법 (#!/bin/sh 스크립트에만)
const NOT_POSIX: Rule[] = [
  { re: /\[\[/, label: '[[' },
  { re: /\bdeclare\b/, label: 'declare' },
  { re: /<<</, label: '<<<' },
  { re: /^\s*function\s+\w+\s*\{/, label: 'function f {' },
]
// macOS 기본 bash 3.2에 없는 문법 (bash와 sh 둘 다)
const NOT_BASH32: Rule[] = [
  { re: /\bdeclare\s+-A\b/, label: 'declare -A' },
  { re: /\bmapfile\b/, label: 'mapfile' },
  { re: /\breadarray\b/, label: 'readarray' },
  { re: /\$\{\w+(,,|\^\^)\}/, label: '대소문자 바꾸는 확장(x,, 또는 x^^)' },
  { re: /&>>/, label: '&>>' },
  { re: /\|&/, label: '|&' },
  { re: /\bcoproc\b/, label: 'coproc' },
  { re: /\blocal\s+-n\b/, label: 'local -n' },
]
// GNU 전용 명령
const GNU_ONLY: Rule[] = [
  { re: /\bsha256sum\b/, label: 'sha256sum (macOS는 shasum -a 256)' },
  { re: /\bdate\s+-d\b/, label: 'date -d' },
]

/** 셸 스크립트 문제. 주석 줄과 줄 끝 주석은 보지 않는다. */
export function scriptProblems(text: string): string[] {
  const lines = text.split('\n')
  const posix = /^#!\s*\/bin\/sh\b/.test(lines[0] ?? '')
  const rules = [...(posix ? NOT_POSIX : []), ...NOT_BASH32, ...GNU_ONLY]
  const out: string[] = []
  lines.forEach((raw, i) => {
    if (i === 0 && raw.startsWith('#!')) return
    const line = raw.replace(/(^|\s)#.*$/, '')
    for (const r of rules) if (r.re.test(line)) out.push(`${i + 1}행: ${r.label}`)
  })
  return [...new Set(out)]
}

/** 스킬 SKILL.md 문제: name, description 필수, description 400자 이하, 본문 150줄 이하. */
export function skillProblems(text: string): string[] {
  const parsed = parseFrontmatter(text, 'SKILL.md')
  if (!parsed.ok) return ['frontmatter를 읽을 수 없어요']
  const { data, body } = parsed.value
  const out: string[] = []
  if (typeof data.name !== 'string' || !data.name) out.push('name이 없어요')
  if (typeof data.description !== 'string' || !data.description) out.push('description이 없어요')
  else if ([...data.description].length > 400)
    out.push(`description이 ${[...data.description].length}자예요 (400자 이하)`)
  const bodyLines = body.trimEnd().split('\n').length
  if (bodyLines > 150) out.push(`본문이 ${bodyLines}줄이에요 (150줄 이하)`)
  return out
}

/**
 * 프로젝트 .claude/settings*.json의 env가 하네스의 판단을 바꾸는 변수를 넣는가(보안 감사 15차 중간 2).
 * 남의 저장소가 커밋한 설정은 리드 세션의 모든 명령에 env를 넣는다. PATH로 검사기를 바꾸거나 NODE_ENV=test로
 * 테스트용 주입을 켤 수 있다. 문제가 되는 키 이름을 돌려준다
 */
export function settingsEnvProblems(jsonText: string): string[] {
  let o: unknown
  try {
    o = JSON.parse(jsonText)
  } catch {
    return []
  }
  const env = (o as { env?: unknown } | null)?.env
  if (!env || typeof env !== 'object') return []
  return Object.keys(env).filter(
    (k) =>
      k === 'PATH' || k === 'NODE_ENV' || k.startsWith('GOTECHY_') || k.startsWith('GITLEAKS_'),
  )
}
