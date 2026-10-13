// 인박스와 화면 파일(contract.md 8절). 메인 체크아웃의 orchestration/을 읽기만 하고, 화면은 .gotechy/view/에만 쓴다.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseFrontmatter } from '../core/frontmatter'
import { buildCard, type Card } from '../core/inbox'
import { renderHandoffPage, renderInboxPage } from '../core/view/pages'
import { type Project, paths } from './project'
import { loadTermBank } from './terms'

export function loadCards(p: Project, cwd = process.cwd()): Card[] {
  const dir = join(paths.orch(p), 'handoffs')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^T-\d{3,}\.md$/.test(f))
    .sort()
    .map((f) => {
      const id = f.slice(0, -'.md'.length)
      const file = join(dir, f)
      const title = taskTitle(p, id)
      return buildCard({
        id,
        file: relative(cwd, file) || file,
        text: readFileSync(file, 'utf8'),
        ...(title ? { title } : {}),
      })
    })
}

function taskTitle(p: Project, id: string): string | undefined {
  const file = paths.task(p, id)
  if (!existsSync(file)) return undefined
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'), file)
  const title = parsed.ok ? parsed.value.data.title : undefined
  return typeof title === 'string' ? title : undefined
}

export type RenderResult = { dir: string; index: string; pages: Map<string, string> }

export function renderViews(p: Project, cwd = process.cwd()): RenderResult {
  const cards = loadCards(p, cwd)
  const dir = join(p.root, '.gotechy', 'view')
  mkdirSync(dir, { recursive: true })
  // 지난 화면이 남아 있으면 지워진 HANDOFF가 계속 보인다. 렌더러가 만든 .html만 지운다.
  for (const f of readdirSync(dir)) if (f.endsWith('.html')) rmSync(join(dir, f))
  const index = join(dir, 'index.html')
  writeFileSync(index, renderInboxPage(cards))
  const terms = loadTermBank(p.root)
  const pages = new Map<string, string>()
  for (const card of cards.filter((c) => !c.problem)) {
    const file = join(dir, `${card.id}.html`)
    writeFileSync(file, renderHandoffPage({ card, terms }))
    pages.set(card.id, file)
  }
  return { dir, index, pages }
}
