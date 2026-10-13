// 보호 경로와 ownership 규칙 (contract.md 5절). 워커 격리의 마지막 방어선이라 도구별 권한 설정과 무관하게 적용한다.

export const PROTECTED_PREFIXES = [
  'orchestration/gates/',
  'orchestration/tasks/',
  'orchestration/private/',
  'orchestration/.seq',
  'orchestration/.gate-seq',
  'orchestration/project.yaml',
  '.githooks/',
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
  '.gitleaks.toml',
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

export function isProtected(path: string): boolean {
  const p = normalizeRel(path)
  if ((PROTECTED_FILES as readonly string[]).includes(p)) return true
  return PROTECTED_PREFIXES.some((pre) => p === pre.replace(/\/$/, '') || p.startsWith(pre))
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
  for (const pre of PROTECTED_PREFIXES) {
    if (e.endsWith('/') && pre.startsWith(e)) return `보호 경로 ${pre}를 포함하는 폴더입니다`
  }
  if (
    e.endsWith('/') &&
    (PROTECTED_FILES as readonly string[]).some((f) => f.startsWith(e) || e === '')
  ) {
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
