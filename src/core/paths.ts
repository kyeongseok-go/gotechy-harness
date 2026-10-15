// 보호 경로와 ownership 규칙 (contract.md 5절). 워커 격리의 마지막 방어선이라 도구별 권한 설정과 무관하게 적용한다.

export const PROTECTED_PREFIXES = [
  'orchestration/gates/',
  'orchestration/tasks/',
  'orchestration/private/',
  'orchestration/.seq',
  'orchestration/.gate-seq',
  'orchestration/project.yaml',
  'orchestration/owner.pub',
  'orchestration/audits/',
  '.gotechy/',
  '.git/',
  '.claude/',
  '.agents/',
  'policy/',
] as const

export const PROTECTED_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'apm.yml',
  'apm.lock.yaml',
  'mise.toml',
  'mise.lock',
] as const

const IRREVERSIBLE_HINTS = [
  /schema/i,
  /migration/i,
  /auth/i,
  /security/i,
  /deploy/i,
  /^\.github\/workflows\//,
]

export function normalizeRel(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '')
}

/**
 * 보호 경로 비교용 접기. macOS(APFS)는 대소문자와 유니코드 접기(ſ, Kelvin 기호)를 무시하고 같은 파일로 읽는다.
 * 아직 없는 보호 폴더를 `.CLAUDE/`로 만들면 git은 다른 경로로 보여 줘서, 그대로 비교하면 보호를 피한다(TD-020 실험).
 * 대문자로 갔다가 소문자로 오면 ſ는 s, Kelvin 기호는 k가 된다. 전각 글자는 APFS도 접지 않아 그대로 둔다
 */
export function foldPath(p: string): string {
  return normalizeRel(p).normalize('NFC').toUpperCase().toLowerCase()
}

const FOLDED_FILES = PROTECTED_FILES.map(foldPath)
const FOLDED_PREFIXES = PROTECTED_PREFIXES.map(foldPath)

export function isProtected(path: string): boolean {
  const p = foldPath(path)
  if (FOLDED_FILES.includes(p)) return true
  return FOLDED_PREFIXES.some((pre) => p === pre.replace(/\/$/, '') || p.startsWith(pre))
}

/** ownership 항목 하나의 문제를 설명한다. 문제가 없으면 undefined. */
export function ownershipProblem(entry: string): string | undefined {
  const e = normalizeRel(entry)
  if (e.startsWith('/') || /^[A-Za-z]:/.test(e)) return '절대 경로는 쓸 수 없습니다'
  if (e.split('/').includes('..')) return '`..`로 상위 폴더를 가리킬 수 없습니다'
  if (/[*?[\]{}]/.test(e))
    return '글롭(*, ?, [], {})은 쓸 수 없습니다 — 파일이나 `/`로 끝나는 폴더를 적으세요'
  if (e === '' || e === '.' || e === '/') return '저장소 전체를 넘길 수 없습니다'
  if (isProtected(e)) return '보호 경로입니다 (contract.md 5절)'
  const folded = foldPath(e)
  for (const [i, pre] of FOLDED_PREFIXES.entries()) {
    if (e.endsWith('/') && pre.startsWith(folded))
      return `보호 경로 ${PROTECTED_PREFIXES[i]}를 포함하는 폴더입니다`
  }
  if (e.endsWith('/') && FOLDED_FILES.some((f) => f.startsWith(folded) || e === '')) {
    return '보호 파일을 포함하는 폴더입니다'
  }
  return undefined
}

export function handoffPathFor(taskId: string): string {
  return `orchestration/handoffs/${taskId}.md`
}

/** 워커가 바꾼 파일이 허용 범위 안인지. 허용 = ownership + 자기 HANDOFF, 단 보호 경로는 언제나 금지. */
export function disallowedChanges(
  changed: string[],
  ownership: string[],
  taskId: string,
): string[] {
  const own = ownership.map(normalizeRel)
  const handoff = handoffPathFor(taskId)
  return changed.map(normalizeRel).filter((f) => {
    if (isProtected(f)) return true
    if (f === handoff) return false
    return !own.some((o) => (o.endsWith('/') ? f.startsWith(o) : f === o))
  })
}

export function impliesIrreversible(paths: string[]): boolean {
  return paths.map(normalizeRel).some((p) => IRREVERSIBLE_HINTS.some((re) => re.test(p)))
}
