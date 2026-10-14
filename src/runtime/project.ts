// 프로젝트의 orchestration/ 파일 접근. 번호 발급은 mkdir 잠금으로 원자적으로 한다(동시 실행 대비).
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
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
  gateSeq: (p: Project) => join(p.root, 'orchestration', '.gate-seq'),
  gates: (p: Project) => join(p.root, 'orchestration', 'gates'),
  gate: (p: Project, id: string) => join(p.root, 'orchestration', 'gates', `${id}.md`),
  projectFile: (p: Project) => join(p.root, 'orchestration', 'project.yaml'),
  ledger: (p: Project) => join(p.root, 'orchestration', 'private', 'decisions.jsonl'),
  comprehension: (p: Project) => join(p.root, 'orchestration', 'private', 'comprehension.jsonl'),
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
  return allocateId(paths.seq(p), 'T', join(p.root, 'orchestration', 'tasks'))
}

export function allocateGateId(p: Project): string {
  return allocateId(paths.gateSeq(p), 'G', paths.gates(p))
}

/** 번호 파일과 실제 파일 중 큰 번호 다음. 번호 파일이 checkout으로 옛 값이 돼도 겹치지 않는다. */
function allocateId(seqFile: string, prefix: 'T' | 'G', dir: string): string {
  const lock = `${seqFile}.lock`
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      mkdirSync(lock)
    } catch {
      Bun.sleepSync(25)
      continue
    }
    try {
      const recorded = existsSync(seqFile) ? Number(readFileSync(seqFile, 'utf8').trim()) : 0
      const re = new RegExp(`^${prefix}-(\\d+)\\.md$`)
      const onDisk = existsSync(dir)
        ? readdirSync(dir).map((f) => Number(re.exec(f)?.[1] ?? 0))
        : []
      const next = Math.max(Number.isFinite(recorded) ? recorded : 0, ...onDisk, 0) + 1
      writeFileSync(seqFile, `${next}\n`)
      return `${prefix}-${String(next).padStart(3, '0')}`
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

/** 프로젝트 id(contract.md 6.3절). 결정을 다른 프로젝트에 옮겨 쓰지 못하게 서명에 넣는다. */
export function projectId(p: Project, create = false): string | undefined {
  const file = paths.projectFile(p)
  if (existsSync(file)) {
    const m = /^id:\s*"?([0-9a-f-]{36})"?\s*$/m.exec(readFileSync(file, 'utf8'))
    if (m?.[1]) return m[1]
  }
  if (!create) return undefined
  const id = crypto.randomUUID()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `# gotechy 프로젝트 id. 결정 서명에 들어가니 바꾸지 마세요.\nid: ${id}\n`, {
    flag: 'wx',
  })
  return id
}

/**
 * 프로젝트 안 경로 중 심볼릭 링크인 것(경로의 중간 요소 포함). 남의 저장소가 이런 링크를 커밋해 두면
 * gotechy가 링크를 따라 저장소 밖에 쓰거나 지울 수 있다(보안 감사 7차 중간 4)
 */
export function linkedPaths(root: string, rels: readonly string[]): string[] {
  const out: string[] = []
  for (const rel of rels) {
    const parts = rel.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const sub = parts.slice(0, i).join('/')
      if (lstatSync(join(root, sub), { throwIfNoEntry: false })?.isSymbolicLink()) {
        if (!out.includes(sub)) out.push(sub)
        break
      }
    }
  }
  return out
}

/** gotechy가 쓰는 프로젝트 폴더. 하나라도 링크면 프로젝트 명령은 멈춘다 */
export const PROJECT_DIRS = [
  'orchestration',
  'orchestration/tasks',
  'orchestration/handoffs',
  'orchestration/gates',
  'orchestration/private',
  '.gotechy',
  '.gotechy/view',
  '.gotechy/worktrees',
] as const
