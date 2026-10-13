// gotechy accept(contract.md 9.4, 9.5절): 오너가 승인한 작업 브랜치를 메인에 병합한다.
// 메인을 바로 건드리지 않고 임시 worktree에서 병합과 verify를 끝낸 뒤 fast-forward만 한다. 실패하면 메인은 그대로다.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from '../core/frontmatter'
import { disallowedChanges } from '../core/paths'
import { HandoffFrontmatter, TaskFrontmatter, TaskId } from '../core/schema'
import { extractSections, isNone, topItems } from '../core/sections'
import { acceptBlockers } from './gates'
import { GIT_IDENTITY, gitProc as git, headCommit } from './git'
import { appendEvent, type Project, paths, updateFrontmatter } from './project'
import { runSandboxedShell } from './sandbox'
import { loadKnownTerms } from './terms'

export type AcceptStatus = 'accepted' | 'rejected' | 'conflict' | 'verify-failed' | 'ff-refused'
export type AcceptOutcome = { status: AcceptStatus; messages: string[] }

export async function acceptTask(p: Project, home: string, id: string): Promise<AcceptOutcome> {
  const reject = (...messages: string[]): AcceptOutcome => ({ status: 'rejected', messages })
  if (!TaskId.safeParse(id).success) return reject(`작업 번호 형식이 아니에요: ${id} (예: T-001)`)
  const taskFile = paths.task(p, id)
  const handoffFile = paths.handoff(p, id)
  if (!existsSync(taskFile) || !existsSync(handoffFile))
    return reject(`${id}의 작업 명세나 HANDOFF가 없어요`)
  const tp = parseFrontmatter(readFileSync(taskFile, 'utf8'), taskFile)
  const task = tp.ok ? TaskFrontmatter.safeParse(tp.value.data) : undefined
  if (!task?.success) return reject(`${id} 작업 명세를 읽을 수 없어요 (gotechy task lint로 확인)`)
  if (task.data.status !== 'done')
    return reject(`상태가 ${task.data.status}인 작업은 병합하지 않아요. done인 작업만 병합해요`)
  const handoffText = readFileSync(handoffFile, 'utf8')
  const hp = parseFrontmatter(handoffText, handoffFile)
  const handoff = hp.ok ? HandoffFrontmatter.safeParse(hp.value.data) : undefined
  if (!handoff?.success) return reject(`${id} HANDOFF를 읽을 수 없어요`)
  if (handoff.data.verified?.exit_code !== 0)
    return reject(`${id}는 리드 verify를 통과하지 않았어요. 통과한 작업만 병합해요`)

  const blockers = acceptBlockers(p, home, task.data)
  if (blockers.length > 0) return reject('병합하기 전에 결정이 필요해요:', ...blockers)

  const branch = `gotechy/${id}`
  if ((await git(['rev-parse', '--verify', '-q', branch], p.root)).exitCode !== 0)
    return reject(`작업 브랜치 ${branch}가 없어요`)
  const head = await headCommit(p.root)
  if (!head) return reject('메인 체크아웃에 커밋이 없어요')
  // run 이후 브랜치가 바뀌었을 수 있다. 병합하기 전에 브랜치 전체 변경을 다시 검사한다(보안 감사 2차 높음 B).
  const scope = await branchScopeProblems(head, branch, task.data.ownership, id, p.root)
  if (scope.length > 0)
    return reject('작업 브랜치에 허용 밖 변경이 있어 병합하지 않아요:', ...scope)

  const tmp = join(p.root, '.gotechy', 'accept', `${id}-${process.pid}`)
  mkdirSync(join(p.root, '.gotechy', 'accept'), { recursive: true })
  const add = await git(['worktree', 'add', '-q', '--detach', tmp, head], p.root)
  if (add.exitCode !== 0) return reject(`임시 worktree를 만들지 못했어요: ${add.stderr.trim()}`)
  try {
    const merge = await git([...GIT_IDENTITY, 'merge', '--no-ff', '--no-commit', '-q', branch], tmp)
    if (merge.exitCode !== 0) {
      const conflicted = (await git(['diff', '--name-only', '--diff-filter=U'], tmp)).stdout
        .trim()
        .split('\n')
        .filter(Boolean)
      await git(['merge', '--abort'], tmp)
      return holdForDecision(
        p,
        id,
        'conflict',
        `메인과 병합이 충돌했어요 (${conflicted.join(', ') || merge.stderr.trim()}). 작업을 새 메인 위에서 다시 하거나 직접 고쳐야 해요`,
      )
    }
    // 작업 명세, HANDOFF, 게이트는 리드의 기록이라 메인 체크아웃에만 둔다. 병합하는 것은 워커가 바꾼 파일뿐이다.
    await git(['reset', '-q', 'HEAD', '--', 'orchestration'], tmp)
    await git(['checkout', 'HEAD', '--', 'orchestration'], tmp)
    await git(['clean', '-fdq', '--', 'orchestration'], tmp)
    const commit = await git(
      [
        ...GIT_IDENTITY,
        'commit',
        '-q',
        '--allow-empty',
        '-m',
        `${id}: ${task.data.title} (gotechy accept)`,
      ],
      tmp,
    )
    if (commit.exitCode !== 0) return reject(`병합 커밋을 만들지 못했어요: ${commit.stderr.trim()}`)
    const merged = await headCommit(tmp)
    const vtmp = join(p.root, '.gotechy', 'tmp', `accept-${id}-${process.pid}-${Date.now()}`)
    mkdirSync(vtmp, { recursive: true })
    const verify = await runSandboxedShell(task.data.verify, tmp, {
      writable: tmp,
      tmp: vtmp,
      secret: [home, paths.privateDir(p)],
    }).finally(() => rmSync(vtmp, { recursive: true, force: true }))
    if (verify.exitCode !== 0)
      return holdForDecision(
        p,
        id,
        'verify-failed',
        `병합한 결과에서 verify가 실패했어요 (\`${task.data.verify}\`: exit ${verify.exitCode}). 다른 작업과 합쳐지며 깨진 것이라 메인에 반영하지 않았어요`,
      )
    const ff = await git(['merge', '--ff-only', '-q', merged ?? 'HEAD'], p.root)
    if (ff.exitCode !== 0)
      return {
        status: 'ff-refused',
        messages: [
          `메인 체크아웃의 커밋하지 않은 변경과 겹쳐 반영하지 못했어요: ${ff.stderr.trim()}`,
          '그 변경을 커밋하거나 치운 뒤 다시 gotechy accept를 실행하세요. 메인은 바뀌지 않았어요.',
        ],
      }
    updateFrontmatter(taskFile, { status: 'accepted' })
    const added = addProjectTerms(p, id, hp.ok ? hp.value.body : '', hp.ok ? hp.value.bodyLine : 1)
    await removeTaskWorktree(p, id)
    appendEvent(p, { type: 'task.accepted', task: id, commit: merged, terms: added })
    return {
      status: 'accepted',
      messages: [
        `${id}를 메인에 병합했어요 (${merged?.slice(0, 7)}).`,
        ...(added.length > 0 ? [`프로젝트 용어 은행에 더했어요: ${added.join(', ')}`] : []),
      ],
    }
  } finally {
    await git(['worktree', 'remove', '--force', tmp], p.root)
    await git(['worktree', 'prune'], p.root)
  }
}

function holdForDecision(
  p: Project,
  id: string,
  status: AcceptStatus,
  note: string,
): AcceptOutcome {
  updateFrontmatter(paths.task(p, id), { status: 'needs-decision' })
  updateFrontmatter(paths.handoff(p, id), { lead_note: note })
  appendEvent(p, { type: 'task.accept-held', task: id, reason: status })
  return { status, messages: [note, '메인은 바뀌지 않았어요. 작업은 needs-decision으로 바꿨어요.'] }
}

async function removeTaskWorktree(p: Project, id: string): Promise<void> {
  const wt = paths.worktree(p, id)
  if (existsSync(wt)) await git(['worktree', 'remove', '--force', wt], p.root)
  rmSync(`${wt}.base`, { force: true })
}

/** HANDOFF "새 용어"의 `- 용어: 풀이` 중 은행에 없는 것을 프로젝트 은행에 더한다(contract.md 9.5절). */
function addProjectTerms(p: Project, id: string, body: string, bodyLine: number): string[] {
  const sec = extractSections(body, bodyLine).find((s) => s.title === '새 용어')
  if (!sec || isNone(sec.content)) return []
  const known = loadKnownTerms(p.root)
  const added: string[] = []
  const file = join(paths.orch(p), 'terms.jsonl')
  for (const item of topItems(sec)) {
    const m = /^[-*]\s+([^:：]+?)\s*[:：]\s*(\S.*)$/.exec(item.text)
    const term = m?.[1]?.trim()
    const easy = m?.[2]?.trim()
    if (!term || !easy || known.has(term.toLowerCase())) continue
    appendFileSync(file, `${JSON.stringify({ term, easy, src: id })}\n`)
    known.add(term.toLowerCase())
    added.push(term)
  }
  return added
}

async function branchScopeProblems(
  head: string,
  branch: string,
  ownership: string[],
  id: string,
  root: string,
): Promise<string[]> {
  const mb = (await git(['merge-base', head, branch], root)).stdout.trim()
  const files = (await git(['diff', '--name-only', mb, branch], root)).stdout
    .trim()
    .split('\n')
    .filter(Boolean)
  if (files.length === 0) return []
  const problems = disallowedChanges(files, ownership, id).map((f) => `허용 밖 파일: ${f}`)
  const tree = (await git(['ls-tree', '-r', branch, '--', ...files], root)).stdout
  for (const line of tree.split('\n')) {
    const [meta, path] = line.split('\t')
    if (path && meta?.startsWith('120000')) problems.push(`심볼릭 링크: ${path}`)
    if (path && meta?.startsWith('160000')) problems.push(`하위 저장소(gitlink): ${path}`)
  }
  return problems
}
