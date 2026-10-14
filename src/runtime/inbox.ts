// 인박스와 화면 파일(contract.md 8절). 메인 체크아웃의 orchestration/을 읽기만 하고, 화면은 .gotechy/view/에만 쓴다.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseFrontmatter } from '../core/frontmatter'
import { attachGates, buildCard, type Card, startGateCard } from '../core/inbox'
import { renderHandoffPage, renderInboxPage } from '../core/view/pages'
import { listGates } from './gates'
import { appendEvent, linkedPaths, type Project, paths } from './project'
import { loadKnownTerms, loadTermBank } from './terms'

export type LoadOptions = {
  /** 열린 게이트를 처음 보여 준 시각을 이벤트 로그에 남긴다(contract.md 9.2절). CLI의 inbox, render만 켠다 */
  recordShown?: boolean
}

export function loadCards(p: Project, cwd = process.cwd(), opts: LoadOptions = {}): Card[] {
  const dir = join(paths.orch(p), 'handoffs')
  const gates = listGates(p)
  const known = loadKnownTerms(p.root)
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => /^T-\d{3,}\.md$/.test(f))
        .sort()
    : []
  const withHandoff = new Set(files.map((f) => f.slice(0, -'.md'.length)))
  const cards: Card[] = []
  for (const f of files) {
    const id = f.slice(0, -'.md'.length)
    const task = taskInfo(p, id)
    // 메인에 병합된 작업은 오너가 볼 일이 끝났다(contract.md 9.3절)
    if (task.status === 'accepted') continue
    const file = join(dir, f)
    const card = buildCard({
      id,
      file: relative(cwd, file) || file,
      text: readFileSync(file, 'utf8'),
      knownTerms: known,
      ...(task.title ? { title: task.title } : {}),
    })
    cards.push(card.problem ? card : attachGates(card, gates))
  }
  for (const g of gates.filter((g) => g.class === 'approval-before' && g.status === 'pending')) {
    if (withHandoff.has(g.task)) continue
    const task = taskInfo(p, g.task)
    if (task.status === 'accepted') continue
    cards.push(startGateCard(g.task, task.title, g))
  }
  if (opts.recordShown) recordShown(p, shownGateIds(cards))
  return cards
}

function shownGateIds(cards: Card[]): string[] {
  return cards.flatMap((c) => [
    ...c.blocking.filter((d) => d.gate && !d.decided).map((d) => d.gate as string),
    ...(c.approval ? [c.approval.id] : []),
    ...(c.startGate ? [c.startGate.id] : []),
  ])
}

export function recordShown(p: Project, ids: string[]): void {
  if (ids.length === 0) return
  const log = paths.events(p)
  const seen = new Set<string>()
  if (existsSync(log))
    for (const l of readFileSync(log, 'utf8').split('\n')) {
      if (!l.includes('"gate.shown"')) continue
      try {
        seen.add((JSON.parse(l) as { gate: string }).gate)
      } catch {
        // 깨진 이벤트 줄은 측정에서만 빠진다. 화면 전체를 멈추지 않는다(감사 8차 낮음 7)
      }
    }
  for (const id of ids) if (!seen.has(id)) appendEvent(p, { type: 'gate.shown', gate: id })
}

function taskInfo(p: Project, id: string): { title?: string; status?: string } {
  const file = paths.task(p, id)
  if (!existsSync(file)) return {}
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'), file)
  if (!parsed.ok) return {}
  const { title, status } = parsed.value.data
  return {
    ...(typeof title === 'string' ? { title } : {}),
    ...(typeof status === 'string' ? { status } : {}),
  }
}

export type RenderResult = { dir: string; index: string; pages: Map<string, string> }

export function renderViews(p: Project, cwd = process.cwd(), opts: LoadOptions = {}): RenderResult {
  // 링크를 따라가면 저장소 밖의 .html을 지우고 쓴다(보안 감사 7차 중간 4)
  const linked = linkedPaths(p.root, ['.gotechy', '.gotechy/view'])
  if (linked.length > 0)
    throw new Error(`심볼릭 링크라서 화면을 만들지 않았어요: ${linked.join(', ')}`)
  const cards = loadCards(p, cwd, opts)
  const dir = join(p.root, '.gotechy', 'view')
  mkdirSync(dir, { recursive: true })
  // 지난 화면이 남아 있으면 지워진 HANDOFF가 계속 보인다. 렌더러가 만든 .html만 지운다.
  for (const f of readdirSync(dir)) if (f.endsWith('.html')) rmSync(join(dir, f))
  const index = join(dir, 'index.html')
  writeFileSync(index, renderInboxPage(cards))
  const terms = loadTermBank(p.root)
  const pages = new Map<string, string>()
  for (const card of cards.filter((c) => !c.problem && c.handoff)) {
    const file = join(dir, `${card.id}.html`)
    writeFileSync(file, renderHandoffPage({ card, terms }))
    pages.set(card.id, file)
  }
  return { dir, index, pages }
}
