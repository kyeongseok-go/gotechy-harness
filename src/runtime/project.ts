// 프로젝트의 orchestration/ 파일 접근. 번호 발급은 mkdir 잠금으로 원자적으로 한다(동시 실행 대비).
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { parseFrontmatter, serializeFrontmatter } from '../core/frontmatter'

export type Project = { root: string }

export const paths = {
  orch: (p: Project) => join(p.root, 'orchestration'),
  task: (p: Project, id: string) => join(p.root, 'orchestration', 'tasks', `${id}.md`),
  handoff: (p: Project, id: string) => join(p.root, 'orchestration', 'handoffs', `${id}.md`),
  privateDir: (p: Project) => join(p.root, 'orchestration', 'private'),
  events: (p: Project) => join(p.root, 'orchestration', 'private', 'events.jsonl'),
  seq: (p: Project) => join(p.root, 'orchestration', '.seq'),
  worktree: (p: Project, id: string) => join(p.root, '.gotechy', 'worktrees', id),
}

export function findProject(start: string): Project | undefined {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'orchestration', 'tasks'))) return { root: dir }
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

export function allocateTaskId(p: Project): string {
  const lock = `${paths.seq(p)}.lock`
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      mkdirSync(lock)
    } catch {
      Bun.sleepSync(25)
      continue
    }
    try {
      const current = existsSync(paths.seq(p))
        ? Number(readFileSync(paths.seq(p), 'utf8').trim())
        : 0
      const next = (Number.isFinite(current) ? current : 0) + 1
      writeFileSync(paths.seq(p), `${next}\n`)
      return `T-${String(next).padStart(3, '0')}`
    } finally {
      rmdirSync(lock)
    }
  }
  throw new Error(
    `번호 잠금(${lock})을 5초 안에 얻지 못했습니다. 다른 gotechy 프로세스가 멈췄다면 이 폴더를 지우세요.`,
  )
}

/** frontmatter의 일부 키만 바꾸고 본문은 그대로 둔다. */
export function updateFrontmatter(file: string, patch: Record<string, unknown>): void {
  const text = readFileSync(file, 'utf8')
  const parsed = parseFrontmatter(text, file)
  if (!parsed.ok) throw new Error(`${file}: frontmatter를 읽을 수 없어 갱신하지 못했습니다`)
  writeFileSync(file, serializeFrontmatter({ ...parsed.value.data, ...patch }, parsed.value.body))
}

export function appendEvent(p: Project, event: Record<string, unknown>): void {
  mkdirSync(paths.privateDir(p), { recursive: true })
  appendFileSync(paths.events(p), `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`)
}
