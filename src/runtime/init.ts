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
  const linked = linkedPaths(root, [...PROJECT_DIRS, 'AGENTS.md', 'CLAUDE.md'])
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
    if (!current.includes('.gotechy/')) {
      appendFileSync(gi, `${current && !current.endsWith('\n') ? '\n' : ''}${fragment}`)
      note('.gitignore (gotechy 항목)', true)
    } else note('.gitignore', false)
  }

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
