// 리드 에이전트의 부작용 명령 가드(contract.md 12절, 1b N4, TD-008). Claude Code PreToolUse hook이 Bash 명령마다 부른다.
// 셸 문법(따옴표, 백슬래시, 주석, here-doc, 줄 이어 쓰기, 명령 치환)을 읽어 단순 명령으로 나누고, 앞말을 벗겨 판정한다.
// 실수를 막는 장치다. 변수로 만든 이름, 별칭, 스크립트 파일 같은 일부러 숨긴 명령은 잡지 못한다(계약에 적음).

export type GuardDecision = { deny: boolean; reason: string }

const ALLOW: GuardDecision = { deny: false, reason: '' }
const deny = (reason: string): GuardDecision => ({ deny: true, reason })

/** 오너만 하는 gotechy 명령 */
const OWNER_ONLY = new Set(['decide', 'serve', 'keys', 'loop'])
/** TTY가 있는 척해서 decide와 serve의 터미널 검사를 속이는 도구 */
const TTY_FAKERS = new Set(['script', 'expect', 'unbuffer'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish'])
/** 앞에 붙어 다른 명령을 실행하는 것들과, 값을 받는 옵션. 벗기고 뒤의 명령을 본다 */
const WRAPPERS: Record<string, Set<string>> = {
  command: new Set(),
  builtin: new Set(),
  exec: new Set(['-a']),
  nohup: new Set(),
  time: new Set(),
  noglob: new Set(),
  nocorrect: new Set(),
  sudo: new Set(['-u', '-g', '-h', '-C', '-p', '-D', '-r', '-t', '-U']),
  nice: new Set(['-n']),
  caffeinate: new Set(['-t', '-w']),
  stdbuf: new Set(['-i', '-o', '-e']),
  xargs: new Set(['-I', '-n', '-L', '-P', '-d', '-E', '-s', '-a', '-i']),
  env: new Set(['-u', '-C', '-S']),
}
const RESERVED = new Set([
  'if',
  'then',
  'elif',
  'else',
  'do',
  'while',
  'until',
  '!',
  '{',
  '(',
  'time',
])
const NPX_LIKE = new Set(['npx', 'bunx', 'pnpx'])
const PKG = new Set(['npm', 'pnpm', 'yarn', 'bun'])
/** 패키지 관리자의 전역 옵션 중 값을 받는 것 */
const PKG_VALUE_OPTS = new Set([
  '-w',
  '--workspace',
  '--filter',
  '-C',
  '--prefix',
  '--dir',
  '--cwd',
  '-F',
])
const MAX_DEPTH = 8

type Simple = { words: string[]; raw: string; heredoc?: string }
type Lexed = { commands: Simple[]; subs: string[]; broken?: string }

/** 셸 명령을 단순 명령들로 나눈다. 셸과 다르게 읽을 만한 곳은 막는 쪽으로 기운다 */
function lex(src: string): Lexed {
  const commands: Simple[] = []
  const subs: string[] = []
  let words: string[] = []
  let cur = ''
  let started = false
  let raw = ''
  let pendingHeredoc: { delim: string; strip: boolean; quoted: boolean } | null = null
  const endWord = () => {
    if (started) words.push(cur)
    cur = ''
    started = false
  }
  const endCommand = (heredoc?: string) => {
    endWord()
    if (words.length > 0)
      commands.push({ words, raw: raw.trim(), ...(heredoc !== undefined ? { heredoc } : {}) })
    words = []
    raw = ''
  }
  /** $( 또는 <( 뒤에서 짝 맞는 ) 까지를 잘라 돌려준다. 없으면 undefined */
  const takeParen = (start: number): { body: string; end: number } | undefined => {
    let depth = 1
    let q: '"' | "'" | null = null
    for (let j = start; j < src.length; j++) {
      const c = src[j]
      if (q) {
        if (c === q) q = null
        else if (c === '\\' && q === '"') j++
        continue
      }
      if (c === '"' || c === "'") q = c
      else if (c === '\\') j++
      else if (c === '<' && src[j + 1] === '<' && src[j + 2] !== '<') {
        // here-doc 본문의 따옴표와 괄호는 셸이 문법으로 읽지 않는다. 구분자 줄까지 건너뛴다
        const strip = src[j + 2] === '-'
        let k = j + (strip ? 3 : 2)
        while (src[k] === ' ' || src[k] === '\t') k++
        const m = /^(['"]?)([A-Za-z0-9_.-]+)\1/.exec(src.slice(k))
        if (!m) continue
        let line = src.indexOf('\n', k)
        let closed = false
        while (line !== -1) {
          const next = src.indexOf('\n', line + 1)
          const text = src.slice(line + 1, next === -1 ? src.length : next)
          if ((strip ? text.replace(/^\t+/, '') : text) === m[2]) {
            j = next === -1 ? src.length - 1 : next - 1
            closed = true
            break
          }
          line = next
        }
        if (!closed) return undefined
      } else if (c === '(') depth++
      else if (c === ')' && --depth === 0) return { body: src.slice(start, j), end: j }
    }
    return undefined
  }

  for (let i = 0; i < src.length; i++) {
    const c = src[i] as string
    // 한 줄이 끝나면 걸려 있는 here-doc 본문을 건너뛴다
    if (c === '\n') {
      if (pendingHeredoc) {
        const lines = src.slice(i + 1).split('\n')
        const body: string[] = []
        let consumed = 0
        let closed = false
        for (const line of lines) {
          consumed += line.length + 1
          const l = pendingHeredoc.strip ? line.replace(/^\t+/, '') : line
          if (l === pendingHeredoc.delim) {
            closed = true
            break
          }
          body.push(line)
        }
        if (!closed) return { commands, subs, broken: 'here-doc이 닫히지 않았어요' }
        // 따옴표 없는 here-doc 본문의 $( )와 백틱은 셸이 펼친다
        if (!pendingHeredoc.quoted)
          for (const m of body.join('\n').matchAll(/\$\(([^()]*)\)|`([^`]*)`/g))
            subs.push((m[1] ?? m[2] ?? '').trim())
        endCommand(body.join('\n'))
        pendingHeredoc = null
        i += consumed
        continue
      }
      endCommand()
      continue
    }
    raw += c
    if (c === "'") {
      const close = src.indexOf("'", i + 1)
      if (close === -1) return { commands, subs, broken: '작은따옴표가 닫히지 않았어요' }
      cur += src.slice(i + 1, close)
      raw += src.slice(i + 1, close + 1)
      started = true
      i = close
      continue
    }
    if (c === '"') {
      let j = i + 1
      for (; j < src.length; j++) {
        const d = src[j] as string
        if (d === '"') break
        if (d === '\\' && j + 1 < src.length) {
          const e = src[j + 1] as string
          if ('"\\$`\n'.includes(e)) {
            if (e !== '\n') cur += e
            j++
            continue
          }
        }
        if (d === '$' && src[j + 1] === '(') {
          const t = takeParen(j + 2)
          if (!t) return { commands, subs, broken: '$( 가 닫히지 않았어요' }
          subs.push(t.body)
          cur += src.slice(j, t.end + 1)
          j = t.end
          continue
        }
        if (d === '`') {
          const close = src.indexOf('`', j + 1)
          if (close === -1) return { commands, subs, broken: '백틱이 닫히지 않았어요' }
          subs.push(src.slice(j + 1, close))
          cur += src.slice(j, close + 1)
          j = close
          continue
        }
        cur += d
      }
      if (j >= src.length) return { commands, subs, broken: '큰따옴표가 닫히지 않았어요' }
      raw += src.slice(i + 1, j + 1)
      started = true
      i = j
      continue
    }
    if (c === '\\') {
      const e = src[i + 1]
      if (e === undefined) break
      raw += e
      // 백슬래시와 줄바꿈은 줄 이어 쓰기라 둘 다 지운다
      if (e !== '\n') {
        cur += e
        started = true
      }
      i++
      continue
    }
    if (c === '#' && !started) {
      const nl = src.indexOf('\n', i)
      i = (nl === -1 ? src.length : nl) - 1
      raw = raw.slice(0, -1)
      continue
    }
    if ((c === '$' || c === '<' || c === '>') && src[i + 1] === '(') {
      const t = takeParen(i + 2)
      if (!t) return { commands, subs, broken: '( 가 닫히지 않았어요' }
      subs.push(t.body)
      cur += src.slice(i, t.end + 1)
      raw += src.slice(i + 1, t.end + 1)
      started = true
      i = t.end
      continue
    }
    if (c === '`') {
      const close = src.indexOf('`', i + 1)
      if (close === -1) return { commands, subs, broken: '백틱이 닫히지 않았어요' }
      subs.push(src.slice(i + 1, close))
      cur += src.slice(i, close + 1)
      raw += src.slice(i + 1, close + 1)
      started = true
      i = close
      continue
    }
    if (c === '<' && src[i + 1] === '<' && src[i + 2] !== '<') {
      const strip = src[i + 2] === '-'
      let j = i + (strip ? 3 : 2)
      while (src[j] === ' ' || src[j] === '\t') j++
      const m = /^(['"]?)([A-Za-z0-9_.-]+)\1/.exec(src.slice(j))
      if (m) {
        pendingHeredoc = { delim: m[2] as string, strip, quoted: m[1] !== '' }
        raw += src.slice(i + 1, j + m[0].length)
        i = j + m[0].length - 1
        endWord()
        continue
      }
    }
    if (c === ';' || c === '|' || c === '&') {
      endCommand()
      continue
    }
    if (c === '(' || c === ')' || ((c === '{' || c === '}') && !started)) {
      endWord()
      continue
    }
    if (c === ' ' || c === '\t') {
      endWord()
      continue
    }
    cur += c
    started = true
  }
  if (pendingHeredoc) return { commands, subs, broken: 'here-doc이 닫히지 않았어요' }
  endCommand()
  return { commands, subs }
}

const base = (w: string) =>
  w
    .slice(w.lastIndexOf('/') + 1)
    .replace(/^=/, '')
    .toLowerCase()
const isAssign = (w: string) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w)

/** 예약어, 환경 변수 대입, 감싸는 명령과 그 옵션을 벗긴다. find -exec와 mise exec도 안쪽 명령을 꺼낸다 */
function strip(ws: string[]): string[] {
  let i = 0
  for (;;) {
    const w = ws[i]
    if (w === undefined) return []
    const b = base(w)
    if (RESERVED.has(w) || isAssign(w)) {
      i++
      continue
    }
    const opts = WRAPPERS[b]
    if (opts) {
      i++
      while (ws[i]?.startsWith('-') || (b === 'env' && isAssign(ws[i] ?? ''))) {
        const o = ws[i] as string
        i += opts.has(o) ? 2 : 1
      }
      if (b === 'xargs' && ws[i] === '--') i++
      continue
    }
    if (b === 'timeout' || b === 'gtimeout') {
      i++
      while (ws[i]?.startsWith('-')) i += ws[i] === '-s' || ws[i] === '-k' ? 2 : 1
      i++ // 시간
      continue
    }
    if (b === 'mise' && (ws[i + 1] === 'exec' || ws[i + 1] === 'x')) {
      const dd = ws.indexOf('--', i)
      if (dd === -1) return []
      i = dd + 1
      continue
    }
    if (b === 'find') {
      const e = ws.findIndex((x, k) => k > i && (x === '-exec' || x === '-execdir' || x === '-ok'))
      if (e === -1) return ws.slice(i)
      const rest = ws.slice(e + 1)
      const end = rest.findIndex((x) => x === ';' || x === '+')
      return end === -1 ? rest : rest.slice(0, end)
    }
    if (NPX_LIKE.has(b) || (b === 'bun' && ws[i + 1] === 'x')) {
      i += b === 'bun' ? 2 : 1
      while (ws[i]?.startsWith('-')) i += ws[i] === '-p' || ws[i] === '--package' ? 2 : 1
      const pkg = ws[i]
      if (pkg) return [pkg.replace(/(.)@[^/]*$/, '$1'), ...ws.slice(i + 1)]
      return []
    }
    if (
      (b === 'npm' && ws[i + 1] === 'exec') ||
      ((b === 'pnpm' || b === 'yarn') && ws[i + 1] === 'dlx')
    ) {
      i += 2
      while (ws[i]?.startsWith('-')) i++
      continue
    }
    return ws.slice(i)
  }
}

/** 패키지 관리자의 첫 하위 명령과 그 뒤(전역 옵션을 건너뜀) */
function pkgSub(ws: string[]): { sub: string | undefined; rest: string[] } {
  let i = 1
  while (ws[i]?.startsWith('-')) i += PKG_VALUE_OPTS.has(ws[i] as string) ? 2 : 1
  return { sub: ws[i], rest: ws.slice(i + 1) }
}

/** gotechy 명령이면 하위 명령(라이브러리 dev 스크립트, bun src/cli.ts, npm run gotechy 포함) */
function gotechySubcommand(ws: string[]): string | undefined {
  const head = base(ws[0] ?? '')
  const after = (k: number) => (ws[k] === '--' ? ws[k + 1] : ws[k])
  if (head === 'gotechy') return after(1)
  if (head === 'bun' || head === 'node' || PKG.has(head)) {
    const cli = ws.findIndex((w) => w.endsWith('src/cli.ts') || base(w) === 'gotechy')
    if (cli > 0) return after(cli + 1)
    const run = ws.indexOf('run')
    if (run > 0 && (ws[run + 1] === 'dev' || ws[run + 1] === 'gotechy')) return after(run + 2)
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

const WIKI = /gotechy-wiki/i
/** 위키 경로가 쓰기 대상 자리에 있는가(읽기와 위키 밖으로의 복사는 막지 않는다) */
function writesWiki(ws: string[], raw: string, cwdInWiki: boolean): boolean {
  const head = base(ws[0] ?? '')
  const args = ws.slice(1).filter((a) => !a.startsWith('-'))
  if (/(^|[^0-9])>>?\s*\S*gotechy-wiki/i.test(raw)) return true
  if (['cp', 'mv', 'rsync', 'ln', 'install'].includes(head)) {
    const target = args.at(-1) ?? ''
    return WIKI.test(target) || (cwdInWiki && !target.startsWith('/') && !target.startsWith('~'))
  }
  if (['tee', 'touch', 'mkdir', 'rm', 'rmdir'].includes(head))
    return args.some((a) => WIKI.test(a)) || (cwdInWiki && args.length > 0)
  if (head === 'dd') return ws.some((a) => a.startsWith('of=') && WIKI.test(a))
  if (head === 'sed' && ws.some((a) => a.startsWith('-i')))
    return args.some((a) => WIKI.test(a)) || cwdInWiki
  return false
}

function judge(ws: string[], raw: string, depth: number, cwdInWiki: boolean): GuardDecision {
  const head = base(ws[0] ?? '')
  if (SHELLS.has(head)) {
    const c = ws.findIndex(
      (w, k) => k > 0 && (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(w) || w === '--command'),
    )
    if (c > 0 && ws[c + 1] !== undefined) return judgeAll(ws[c + 1] as string, depth + 1)
    const eq = ws.find((w) => w.startsWith('--command='))
    if (eq) return judgeAll(eq.slice('--command='.length), depth + 1)
  }
  if (head === 'eval') return judgeAll(ws.slice(1).join(' '), depth + 1)
  if (TTY_FAKERS.has(head))
    return deny(`${head}는 터미널이 있는 척해서 오너 확인을 속일 수 있어요. 리드는 쓰지 않아요`)
  const sub = gotechySubcommand(ws)
  if (sub && OWNER_ONLY.has(sub.toLowerCase()))
    return deny(
      `gotechy ${sub}는 오너만 실행해요. 결정이 필요하면 HANDOFF의 결정 필요 절로 올리세요`,
    )
  if (head === 'git') return gitPush(ws)
  if (PKG.has(head)) {
    const { sub: s, rest } = pkgSub(ws)
    const publish = s === 'publish' || (head === 'yarn' && s === 'npm' && rest[0] === 'publish')
    if (publish && !ws.includes('--dry-run')) return deny('패키지 발행은 오너가 직접 해요')
    if (s === 'run' && /^(deploy|release|publish|ship)(:|$)/.test(rest[0] ?? ''))
      return deny('배포나 발행처럼 보이는 스크립트는 오너가 직접 실행해요(이름으로 판단)')
  }
  if (head === 'gh') {
    let i = 1
    while (ws[i]?.startsWith('-')) i += ws[i] === '-R' || ws[i] === '--repo' ? 2 : 1
    const [a, b] = [ws[i], ws[i + 1]]
    if (a === 'release' && !['view', 'list', 'download'].includes(b ?? ''))
      return deny('릴리스는 오너가 직접 해요')
    if (a === 'pr' && b === 'merge') return deny('PR 병합은 오너가 직접 해요')
    if (a === 'workflow' && b === 'run')
      return deny('워크플로 실행(배포일 수 있음)은 오너가 직접 해요')
  }
  const target = ws.find((w) => w.startsWith('--target'))
  if (
    (head === 'vercel' &&
      (ws.includes('--prod') ||
        ws[1] === 'promote' ||
        (target !== undefined &&
          /production/.test(`${target} ${ws[ws.indexOf(target) + 1] ?? ''}`)))) ||
    (head === 'wrangler' &&
      (ws[1] === 'deploy' ||
        ws[1] === 'publish' ||
        ((ws[1] === 'pages' || ws[1] === 'versions') && ws[2] === 'deploy'))) ||
    ((head === 'fly' || head === 'flyctl') && ws[1] === 'deploy') ||
    (head === 'netlify' && ws[1] === 'deploy' && ws.includes('--prod'))
  )
    return deny('배포는 오너가 직접 해요')
  if (writesWiki(ws, raw, cwdInWiki)) return deny('위키 적재는 오너가 지시했을 때만 해요')
  return ALLOW
}

function judgeAll(command: string, depth: number): GuardDecision {
  if (depth > MAX_DEPTH) return deny('명령이 너무 깊게 감싸여 있어 판정하지 않고 막았어요')
  const lexed = lex(command)
  if (lexed.broken) return deny(`셸 문법을 끝까지 읽지 못해 막았어요: ${lexed.broken}`)
  let cwdInWiki = false
  for (const cmd of lexed.commands) {
    const ws = strip(cmd.words)
    if (ws.length === 0) continue
    if (base(ws[0] as string) === 'cd') cwdInWiki = WIKI.test(ws[1] ?? '')
    let d = judge(ws, cmd.raw, depth, cwdInWiki)
    // 셸에 here-doc으로 넘긴 본문은 스크립트로 판정한다
    if (
      !d.deny &&
      cmd.heredoc !== undefined &&
      (SHELLS.has(base(ws[0] as string)) || base(ws[0] as string) === 'eval')
    )
      d = judgeAll(cmd.heredoc, depth + 1)
    if (d.deny) return d
  }
  for (const s of lexed.subs) {
    const d = judgeAll(s, depth + 1)
    if (d.deny) return d
  }
  return ALLOW
}

/** Bash 명령 하나를 판정한다. 연결된 명령 중 하나라도 막히면 막는다 */
export function guardBash(command: string): GuardDecision {
  return judgeAll(command, 0)
}
