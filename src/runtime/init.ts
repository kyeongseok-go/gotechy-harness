// gotechy init: 프로젝트에 계약 골격·라우터·팩을 깐다. 이미 있는 파일은 덮어쓰지 않는다.
// M1은 팩을 복사로 설치하고, M3에서 apm(버전 고정·해시 감사)으로 교체한다.
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { libraryRoot } from './library'

const PACKS: Record<string, string[]> = { owner: ['owner-protocol'] }

export type InitReport = { created: string[]; skipped: string[]; warnings: string[] }

export function initProject(root: string, packs: string[]): InitReport {
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
