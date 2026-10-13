// gotechy init: 프로젝트에 계약 골격·라우터·팩을 깐다. 이미 있는 파일은 덮어쓰지 않는다.
// M1은 팩을 복사로 설치하고, M3에서 apm(버전 고정·해시 감사)으로 교체한다.
import {
  appendFileSync,
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { libraryRoot } from './library'
import { projectId } from './project'

const PACKS: Record<string, string[]> = { owner: ['owner-protocol'] }

export type InitReport = { created: string[]; skipped: string[]; warnings: string[] }

export type InitOptions = {
  /** 커밋 전 gitleaks hook을 설정한다(contract.md 10.4절). 기본 켜짐 */
  hooks?: boolean
}

export function initProject(root: string, packs: string[], opts: InitOptions = {}): InitReport {
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
  const current = existsSync(gi) ? readFileSync(gi, 'utf8') : ''
  if (!current.includes('.gotechy/')) {
    appendFileSync(gi, `${current && !current.endsWith('\n') ? '\n' : ''}${fragment}`)
    note('.gitignore (gotechy 항목)', true)
  } else note('.gitignore', false)

  if (opts.hooks !== false) installHooks(root, lib, report, note)

  for (const pack of packs) {
    const skills = PACKS[pack]
    if (!skills) {
      report.warnings.push(`알 수 없는 팩: ${pack} (사용 가능: ${Object.keys(PACKS).join(', ')})`)
      continue
    }
    for (const skill of skills) {
      for (const dest of ['.claude/skills', '.agents/skills']) {
        const target = join(root, dest, skill)
        const made = !existsSync(target)
        if (made) cpSync(join(lib, 'skills', skill), target, { recursive: true })
        note(`${dest}/${skill}/`, made)
      }
    }
  }
  return report
}

function installHooks(
  root: string,
  lib: string,
  report: InitReport,
  note: (path: string, made: boolean) => void,
): void {
  const hook = join(root, '.githooks', 'pre-commit')
  const madeHook = !existsSync(hook)
  if (madeHook) {
    mkdirSync(join(root, '.githooks'), { recursive: true })
    cpSync(join(lib, 'templates', 'project', 'githooks', 'pre-commit'), hook)
    chmodSync(hook, 0o755)
  }
  note('.githooks/pre-commit', madeHook)
  const config = join(root, '.gitleaks.toml')
  const madeConfig = !existsSync(config)
  if (madeConfig) cpSync(join(lib, 'templates', 'project', 'gitleaks.toml'), config)
  note('.gitleaks.toml', madeConfig)
  const inRepo = Bun.spawnSync({ cmd: ['git', 'rev-parse', '--git-dir'], cwd: root }).exitCode === 0
  if (!inRepo) {
    report.warnings.push(
      'git 저장소가 아니라 hook을 연결하지 못했어요. git init 뒤에 gotechy init을 다시 실행하세요.',
    )
    return
  }
  Bun.spawnSync({ cmd: ['git', 'config', 'core.hooksPath', '.githooks'], cwd: root })
}
