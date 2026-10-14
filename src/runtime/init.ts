// gotechy init: 프로젝트에 계약 골격과 라우터, gitleaks hook을 깐다. 이미 있는 파일은 덮어쓰지 않는다.
// 팩은 runtime/packs.ts가 apm으로 깐다(contract.md 10.7절).
import {
  appendFileSync,
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { gotechyHome } from './keys'
import { libraryRoot } from './library'
import { linkedPaths, PROJECT_DIRS, projectId } from './project'

export type InitReport = { created: string[]; skipped: string[]; warnings: string[] }

export type InitOptions = {
  /** 커밋 전 gitleaks hook을 설정한다(contract.md 10.4절). 기본 켜짐 */
  hooks?: boolean
  /** hook을 둘 곳. 기본은 $GOTECHY_HOME */
  gotechyHome?: string
}

export function initProject(root: string, opts: InitOptions = {}): InitReport {
  const linked = linkedPaths(root, [
    ...PROJECT_DIRS,
    'AGENTS.md',
    'CLAUDE.md',
    '.claude',
    '.claude/settings.json',
    '.claude/settings.local.json',
  ])
  if (linked.length > 0)
    throw new Error(
      `심볼릭 링크라서 아무것도 쓰지 않고 멈췄어요: ${linked.join(', ')}. 링크를 지우거나 실제 폴더와 파일로 바꾼 뒤 다시 실행하세요`,
    )
  const lib = libraryRoot()
  const report: InitReport = { created: [], skipped: [], warnings: [] }
  const note = (path: string, made: boolean) => (made ? report.created : report.skipped).push(path)

  for (const dir of ['tasks', 'handoffs', 'gates', 'private']) {
    const d = join(root, 'orchestration', dir)
    const made = !existsSync(d)
    mkdirSync(d, { recursive: true })
    if (dir !== 'private' && !existsSync(join(d, '.gitkeep')))
      writeFileSync(join(d, '.gitkeep'), '')
    note(`orchestration/${dir}/`, made)
  }

  const hadId = projectId({ root }) !== undefined
  projectId({ root }, true)
  note('orchestration/project.yaml', !hadId)

  for (const f of ['AGENTS.md', 'CLAUDE.md']) {
    const target = join(root, f)
    if (existsSync(target)) {
      note(f, false)
      if (f === 'CLAUDE.md' && !readFileSync(target, 'utf8').includes('@AGENTS.md')) {
        report.warnings.push(
          'CLAUDE.md에 `@AGENTS.md` 줄이 없습니다. Claude Code가 라우터를 못 읽으니 한 줄 추가하세요.',
        )
      }
      continue
    }
    cpSync(join(lib, 'templates', 'project', f), target)
    note(f, true)
  }

  const gi = join(root, '.gitignore')
  const fragment = readFileSync(join(lib, 'templates', 'project', 'gitignore.fragment'), 'utf8')
  // 링크면 그 너머(저장소 밖일 수 있는) 파일에 쓰게 되므로 손대지 않는다
  if (lstatSync(gi, { throwIfNoEntry: false })?.isSymbolicLink()) {
    report.warnings.push(
      '.gitignore가 심볼릭 링크라 gotechy 항목을 넣지 않았어요. 직접 넣어 주세요.',
    )
  } else {
    const current = existsSync(gi) ? readFileSync(gi, 'utf8') : ''
    const have = new Set(current.split('\n').map((l) => l.trim()))
    // 처음이면 조각 전체를, 이미 init한 프로젝트면 새로 생긴 줄만 더한다
    const missing = fragment
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#') && !have.has(l.trim()))
    if (!current.includes('.gotechy/')) {
      appendFileSync(gi, `${current && !current.endsWith('\n') ? '\n' : ''}${fragment}`)
      note('.gitignore (gotechy 항목)', true)
    } else if (missing.length > 0) {
      appendFileSync(gi, `${current.endsWith('\n') ? '' : '\n'}${missing.join('\n')}\n`)
      note(`.gitignore (${missing.join(', ')})`, true)
    } else note('.gitignore', false)
  }

  installGuard(root, lib, report, note)
  if (opts.hooks !== false) installHooks(root, lib, opts.gotechyHome ?? gotechyHome(), report, note)

  return report
}

/**
 * hook과 gitleaks 설정은 저장소 밖($GOTECHY_HOME/githooks)에 두고 절대 경로로 연결한다.
 * 저장소 안 폴더를 hooksPath로 쓰면 그 저장소가 준비한 다른 hook(post-checkout 등)이 실행되고,
 * 저장소의 .gitleaks.toml이 검사를 끌 수 있다(M3 보안 리뷰 높음 1, 중간 5).
 */
function installHooks(
  root: string,
  lib: string,
  home: string,
  report: InitReport,
  note: (path: string, made: boolean) => void,
): void {
  const git = (args: string[]) =>
    Bun.spawnSync({ cmd: ['git', ...args], cwd: root, stdout: 'pipe', env: process.env })
  if (git(['rev-parse', '--git-dir']).exitCode !== 0) {
    report.warnings.push(
      'git 저장소가 아니라 hook을 연결하지 못했어요. git init 뒤에 gotechy init을 다시 실행하세요.',
    )
    return
  }
  const dir = join(home, 'githooks')
  const existing = git(['config', '--local', '--get', 'core.hooksPath']).stdout.toString().trim()
  if (existing && existing !== dir) {
    report.warnings.push(
      `이미 core.hooksPath(${existing})가 있어 바꾸지 않았어요. 비밀 값 검사를 쓰려면 그 hook에서 ${join(dir, 'pre-commit')}를 부르세요.`,
    )
    return
  }
  const gitHooks = git(['rev-parse', '--git-path', 'hooks']).stdout.toString().trim()
  const own = existsSync(join(root, gitHooks)) || existsSync(gitHooks)
  const hooksDir = existsSync(join(root, gitHooks)) ? join(root, gitHooks) : gitHooks
  if (own && readdirSync(hooksDir).some((f) => !f.endsWith('.sample'))) {
    report.warnings.push(
      '.git/hooks에 이미 쓰는 hook이 있어 core.hooksPath를 바꾸지 않았어요. 바꾸면 그 hook이 꺼져요. 직접 연결해 주세요.',
    )
    return
  }
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(
    join(dir, 'pre-commit'),
    readFileSync(join(lib, 'templates', 'project', 'githooks', 'pre-commit')),
    { mode: 0o755 },
  )
  chmodSync(join(dir, 'pre-commit'), 0o755)
  writeFileSync(
    join(dir, 'gitleaks.toml'),
    readFileSync(join(lib, 'templates', 'project', 'gitleaks.toml')),
    { mode: 0o644 },
  )
  if (git(['config', 'core.hooksPath', dir]).exitCode !== 0) {
    report.warnings.push('core.hooksPath를 설정하지 못했어요. 커밋 전 비밀 값 검사가 꺼져 있어요.')
    return
  }
  note(`core.hooksPath ${dir}`, existing !== dir)
}

/** 리드가 오너만 하는 명령을 부르지 못하게 하는 deny 규칙(커밋됨) */
const CLAUDE_DENY = [
  'Bash(gotechy decide:*)',
  'Bash(gotechy serve:*)',
  'Bash(gotechy keys:*)',
  'Bash(gotechy loop:*)',
  'Bash(script:*)',
  'Bash(expect:*)',
]

/**
 * 부작용 가드(contract.md 12절, TD-008). deny 규칙은 경로가 없어 settings.json(커밋)에, 가드 hook은 라이브러리의
 * 절대 경로라 settings.local.json(개인, gitignore)에 둔다. gotechy가 PATH에 없어도 돌고, 실행 파일이 없으면 막는다
 */
function installGuard(
  root: string,
  lib: string,
  report: InitReport,
  note: (path: string, made: boolean) => void,
): void {
  const dir = join(root, '.claude')
  mkdirSync(dir, { recursive: true })
  const settings = join(dir, 'settings.json')
  if (existsSync(settings)) {
    note('.claude/settings.json', false)
    report.warnings.push(
      `.claude/settings.json이 이미 있어 바꾸지 않았어요. permissions.deny에 ${CLAUDE_DENY.join(', ')}를 넣어 주세요.`,
    )
  } else {
    writeFileSync(settings, `${JSON.stringify({ permissions: { deny: CLAUDE_DENY } }, null, 2)}\n`)
    note('.claude/settings.json (deny 규칙)', true)
  }
  const local = join(dir, 'settings.local.json')
  const command = guardHookCommand(join(lib, 'bin', 'gotechy'))
  const entry = { matcher: 'Bash', hooks: [{ type: 'command', command, timeout: 120 }] }
  if (!existsSync(local)) {
    writeFileSync(local, `${JSON.stringify({ hooks: { PreToolUse: [entry] } }, null, 2)}\n`)
    note('.claude/settings.local.json (부작용 가드 hook)', true)
    return
  }
  // Claude Code가 허용 규칙을 쌓아 둔 개인 파일이 대부분 이미 있다. 다른 키는 지키고 가드 hook만 더하거나 경로를 갱신한다
  // (감사 10차 중간 5: 파일이 있다고 건너뛰면 가드가 조용히 꺼진다)
  let data: Record<string, unknown>
  try {
    data = JSON.parse(readFileSync(local, 'utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('객체가 아님')
  } catch {
    report.warnings.push(
      `.claude/settings.local.json을 읽지 못해 부작용 가드 hook을 넣지 못했어요. 파일을 고친 뒤 init을 다시 실행하세요. 넣을 항목: ${JSON.stringify(entry)}`,
    )
    return
  }
  const hooks = (data.hooks ?? {}) as Record<string, unknown>
  const pre = Array.isArray(hooks.PreToolUse) ? (hooks.PreToolUse as Record<string, unknown>[]) : []
  const ours = (h: Record<string, unknown>) => JSON.stringify(h).includes(GUARD_MARK)
  const existing = pre.find(ours)
  if (existing && JSON.stringify(existing) === JSON.stringify(entry)) {
    note('.claude/settings.local.json (가드 hook 있음)', false)
    return
  }
  const next = existing ? pre.map((h) => (ours(h) ? entry : h)) : [...pre, entry]
  writeFileSync(
    local,
    `${JSON.stringify({ ...data, hooks: { ...hooks, PreToolUse: next } }, null, 2)}\n`,
  )
  note(
    `.claude/settings.local.json (${existing ? '가드 hook 경로 갱신' : '부작용 가드 hook 추가'})`,
    true,
  )
}

/** init이 깐 hook임을 알아보는 표시(hook 문구 안에 들어간다) */
const GUARD_MARK = 'gotechy 가드'

/**
 * 가드 hook 명령. 가드가 0으로 끝날 때만 통과시키고, 실행 파일이 없거나 다른 코드로 죽으면 exit 2로 막는다.
 * Claude Code는 2가 아닌 실패를 "막지 않는 오류"로 보고 명령을 실행하기 때문이다(감사 10차 중간 4)
 */
export function guardHookCommand(bin: string): string {
  const q = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`
  const fix = `라이브러리를 옮겼으면 프로젝트에서 gotechy init을 다시 실행하세요`
  const script = `[ -x ${q(bin)} ] || { printf '%s\\n' ${q(`${GUARD_MARK}를 실행할 수 없어 명령을 막았어요: ${bin}. ${fix}`)} >&2; exit 2; }; ${q(bin)} guard; rc=$?; [ "$rc" -eq 0 ] && exit 0; printf '%s\\n' ${q(`${GUARD_MARK}가 실패해 명령을 막았어요(코드 `)}"$rc)" >&2; exit 2`
  return `sh -c ${q(script)}`
}
