// gotechy task restart T-###(contract.md 9.6절, TD-006): 멈춘 작업을 지금 메인 위에서 처음부터 다시 하게 한다.
// 옛 작업 브랜치는 지우지 않고 gotechy/T-###-try<N>으로 남긴다. 메인의 HANDOFF와 결정 기록은 그대로라 다음 run이 이어 받는다.
import { existsSync, lstatSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { TaskId } from '../core/schema'
import { readTask } from './gates'
import { gitProc as git, isRegisteredWorktree } from './git'
import { appendEvent, type Project, paths, updateFrontmatter } from './project'
import { withTaskLock } from './run'

export type RestartOutcome = { status: 'restarted' | 'refused'; messages: string[] }

/** 다시 하기를 받는 상태. accepted는 이미 메인에 들어갔고, draft와 ready는 다시 할 것이 없다 */
const RESTARTABLE = new Set(['needs-decision', 'failed', 'done', 'running'])

export async function restartTask(p: Project, id: string): Promise<RestartOutcome> {
  const refuse = (m: string): RestartOutcome => ({ status: 'refused', messages: [m] })
  if (!TaskId.safeParse(id).success) return refuse(`작업 번호 형식이 아니에요: ${id} (예: T-001)`)
  const task = readTask(p, id)
  if (!task) return refuse(`${id}: 작업 명세가 없거나 읽을 수 없어요`)
  if (!RESTARTABLE.has(task.status))
    return refuse(
      `${id}는 ${task.status} 상태라 다시 하지 않아요. needs-decision, failed, done(병합 전), 멈춘 running만 다시 해요`,
    )
  const locked = await withTaskLock(p, id, () => restartLocked(p, id))
  return locked.ok ? locked.value : refuse(locked.reason)
}

const branchExists = async (root: string, name: string) =>
  (await git(['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], root)).exitCode === 0

async function restartLocked(p: Project, id: string): Promise<RestartOutcome> {
  const refuse = (m: string): RestartOutcome => ({ status: 'refused', messages: [m] })
  const wt = paths.worktree(p, id)
  const branch = `gotechy/${id}`
  // 링크면 따라가지 않는다. 같은 저장소의 다른 worktree를 가리키게 해 그것을 지우게 할 수 있다(보안 감사 15차 낮음 6)
  if (lstatSync(wt, { throwIfNoEntry: false })?.isSymbolicLink())
    return refuse(`${wt}가 심볼릭 링크라 그대로 두었어요. 확인한 뒤 직접 옮기세요`)
  if (await isRegisteredWorktree(p.root, wt)) {
    // 폴더가 없어도 등록된 항목만 지운다. 저장소 전체 prune은 하지 않는다(다른 worktree의 기록을 지울 수 있어서)
    const gone = await git(['worktree', 'remove', '--force', wt], p.root)
    if (gone.exitCode !== 0) return refuse(`worktree를 치우지 못했어요: ${gone.stderr.trim()}`)
  } else if (existsSync(wt))
    // 리드가 만든 worktree만 치운다. 같은 자리에 등록되지 않은 폴더가 있으면 오너의 파일일 수 있다
    return refuse(`${wt}가 git에 등록된 worktree가 아니라 그대로 두었어요. 확인한 뒤 직접 옮기세요`)
  let kept: string | undefined
  if (await branchExists(p.root, branch)) {
    let n = 1
    while (await branchExists(p.root, `${branch}-try${n}`)) n++
    kept = `${branch}-try${n}`
    const mv = await git(['branch', '-m', branch, kept], p.root)
    if (mv.exitCode !== 0) return refuse(`작업 브랜치 이름을 바꾸지 못했어요: ${mv.stderr.trim()}`)
  }
  rmSync(`${wt}.base`, { force: true })
  const secret = lastAcceptHold(p, id) === 'secret-found'
  updateFrontmatter(paths.task(p, id), { status: 'ready' })
  appendEvent(p, { type: 'task.restart', task: id, kept: kept ?? null })
  return {
    status: 'restarted',
    messages: [
      `${id}를 지금 메인 위에서 처음부터 다시 하게 했어요(상태 ready).`,
      kept ? `옛 작업은 ${kept} 브랜치에 남겼어요.` : '남길 옛 브랜치가 없었어요.',
      // 비밀 값으로 멈춘 브랜치를 남기면 나중에 git push --all로 공개될 수 있다(보안 감사 15차 낮음 7)
      ...(secret && kept
        ? [
            `주의: ${kept}에는 비밀로 보이는 값이 남아 있어요. 원격으로 push하지 말고, 필요 없으면 git branch -D ${kept}로 지우세요. 값은 이미 노출됐다고 보고 바꾸세요.`,
          ]
        : []),
      `다음: gotechy run ${id}`,
    ],
  }
}

/** 이 작업의 마지막 accept 보류 사유(이벤트 기록) */
function lastAcceptHold(p: Project, id: string): string | undefined {
  const file = join(paths.orch(p), 'private', 'events.jsonl')
  if (!existsSync(file)) return undefined
  let reason: string | undefined
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line) as { type?: unknown; task?: unknown; reason?: unknown }
      if (e.type === 'task.accept-held' && e.task === id && typeof e.reason === 'string')
        reason = e.reason
    } catch {
      // 읽을 수 없는 줄은 건너뛴다
    }
  }
  return reason
}
