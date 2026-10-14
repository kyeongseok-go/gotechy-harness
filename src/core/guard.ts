// 리드 에이전트의 부작용 명령 가드(contract.md 12절, 1b N4, TD-008). Claude Code PreToolUse hook이 Bash 명령마다 부른다.
// 셸 명령을 연결자로 나누고 환경 변수와 감싸는 명령을 벗겨 판정한다. 일부러 숨긴 명령($변수로 만든 이름 등)은 잡지 못한다.

export type GuardDecision = { deny: boolean; reason: string }

const ALLOW: GuardDecision = { deny: false, reason: '' }
const deny = (reason: string): GuardDecision => ({ deny: true, reason })

/** 오너만 하는 gotechy 명령 */
const OWNER_ONLY = new Set(['decide', 'serve', 'keys'])
/** TTY가 있는 척해서 decide와 serve의 터미널 검사를 속이는 도구 */
const TTY_FAKERS = new Set(['script', 'expect', 'unbuffer'])
/** 앞에 붙어 다른 명령을 실행하는 것들. 벗기고 뒤의 명령을 본다 */
const WRAPPERS = new Set(['command', 'exec', 'nohup', 'time', 'sudo', 'nice', 'caffeinate'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh'])
const RUNNERS = new Set(['bun', 'node', 'npx', 'bunx', 'npm', 'pnpm', 'yarn'])
const WRITERS = new Set(['cp', 'mv', 'rsync', 'tee', 'ln', 'install', 'dd'])

/** 따옴표를 지키며 명령 하나를 낱말로 나눈다 */
function words(segment: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  let started = false
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i] as string
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\' && quote === '"' && i + 1 < segment.length) cur += segment[++i]
      else cur += c
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      started = true
    } else if (c === '\\' && i + 1 < segment.length) {
      cur += segment[++i]
      started = true
    } else if (/\s/.test(c)) {
      if (started) out.push(cur)
      cur = ''
      started = false
    } else {
      cur += c
      started = true
    }
  }
  if (started) out.push(cur)
  return out
}

/** 셸 연결자(; && || | & 줄바꿈)로 나눈다. 따옴표 안은 나누지 않는다 */
function segments(command: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < command.length; i++) {
    const c = command[i] as string
    if (quote) {
      if (c === quote) quote = null
      cur += c
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
    } else if (c === ';' || c === '|' || c === '&' || c === '\n') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

/** $(...)와 `...` 안의 명령도 따로 본다 */
function substitutions(command: string): string[] {
  const out: string[] = []
  for (const m of command.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g))
    out.push((m[1] ?? m[2] ?? '').trim())
  return out.filter(Boolean)
}

const base = (w: string) => w.slice(w.lastIndexOf('/') + 1)

/** 환경 변수 대입과 감싸는 명령을 벗긴다 */
function strip(ws: string[]): string[] {
  let i = 0
  for (;;) {
    const w = ws[i]
    if (w === undefined) return []
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) i++
    else if (base(w) === 'env') {
      i++
      while (ws[i]?.startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(ws[i] ?? '')) i++
    } else if (WRAPPERS.has(base(w))) {
      i++
      while (ws[i]?.startsWith('-')) i++
    } else return ws.slice(i)
  }
}

/** gotechy 명령이면 하위 명령을 돌려준다(라이브러리 dev 스크립트와 bun src/cli.ts 포함) */
function gotechySubcommand(ws: string[]): string | undefined {
  const head = ws[0] ?? ''
  if (base(head) === 'gotechy') return ws[1]
  if (RUNNERS.has(base(head))) {
    const cli = ws.findIndex((w) => w.endsWith('src/cli.ts') || base(w) === 'gotechy')
    if (cli > 0) return ws[cli + 1]
    const dev = ws.indexOf('dev')
    if (ws.includes('run') && dev > 0) {
      const rest = ws.slice(dev + 1)
      return rest[0] === '--' ? rest[1] : rest[0]
    }
  }
  return undefined
}

function gitPush(ws: string[]): GuardDecision {
  // git의 전역 옵션(-C 경로, -c 키=값 등)을 건너뛰고 하위 명령을 찾는다
  let i = 1
  while (ws[i]?.startsWith('-')) i += ws[i] === '-C' || ws[i] === '-c' ? 2 : 1
  if (ws[i] !== 'push') return ALLOW
  const args = ws.slice(i + 1)
  if (
    args.some(
      (a) => a === '-f' || a.startsWith('--force') || a === '--mirror' || /^-[a-z]*f/.test(a),
    )
  )
    return deny('force push는 오너가 직접 해요(원격 이력을 덮어써요)')
  if (args.some((a) => a === '--delete' || a === '-d' || a.startsWith(':') || a.startsWith('+')))
    return deny('원격 브랜치를 지우거나 강제로 덮는 push는 오너가 직접 해요')
  return ALLOW
}

function judge(ws: string[], raw: string): GuardDecision {
  const head = base(ws[0] ?? '')
  if (SHELLS.has(head)) {
    const c = ws.indexOf('-c')
    if (c > 0 && ws[c + 1]) return guardBash(ws[c + 1] as string)
  }
  if (head === 'eval') return guardBash(ws.slice(1).join(' '))
  if (TTY_FAKERS.has(head))
    return deny(`${head}는 터미널이 있는 척해서 오너 확인을 속일 수 있어요. 리드는 쓰지 않아요`)
  const sub = gotechySubcommand(ws)
  if (sub && OWNER_ONLY.has(sub))
    return deny(
      `gotechy ${sub}는 오너만 실행해요. 결정이 필요하면 HANDOFF의 결정 필요 절로 올리세요`,
    )
  if (head === 'git') return gitPush(ws)
  if (
    (head === 'npm' || head === 'bun' || head === 'pnpm' || head === 'yarn') &&
    ws[1] === 'publish'
  )
    return deny('패키지 발행은 오너가 직접 해요')
  if (
    head === 'gh' &&
    ((ws[1] === 'release' && ws[2] !== 'view' && ws[2] !== 'list') ||
      (ws[1] === 'pr' && ws[2] === 'merge'))
  )
    return deny('릴리스와 PR 병합은 오너가 직접 해요')
  if (
    (head === 'vercel' && ws.includes('--prod')) ||
    (head === 'wrangler' && (ws[1] === 'deploy' || ws[1] === 'publish')) ||
    (head === 'fly' && ws[1] === 'deploy') ||
    (head === 'netlify' && ws[1] === 'deploy' && ws.includes('--prod'))
  )
    return deny('배포는 오너가 직접 해요')
  if (/Gotechy-Wiki/.test(raw) && (WRITERS.has(head) || />/.test(raw)))
    return deny('위키 적재는 오너가 지시했을 때만 해요')
  return ALLOW
}

/** Bash 명령 하나를 판정한다. 연결된 명령 중 하나라도 막히면 막는다 */
export function guardBash(command: string): GuardDecision {
  for (const seg of [...segments(command), ...substitutions(command)]) {
    const ws = strip(words(seg))
    if (ws.length === 0) continue
    const d = judge(ws, seg)
    if (d.deny) return d
  }
  return ALLOW
}
