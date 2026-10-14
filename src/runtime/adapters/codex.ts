// Codex 워커. workspace-write 샌드박스는 작업 폴더(-C) 밖 쓰기를 막지만 안쪽 파일은 다 쓸 수 있다(M0에서 결정 파일 수정 확인).
// 그래서 작업 폴더를 worktree로 두고, 허용 밖 변경은 리드가 changed-files 검사로 실패 처리한다.
import { parseCodexUsage } from '../../core/usage'
import { runProc } from '../proc'
import { workerEnv } from './env'
import type { WorkerAdapter, WorkerRequest, WorkerResult } from './types'

export function codexArgs(req: WorkerRequest): string[] {
  const args = [
    'codex',
    'exec',
    '--json',
    '-s',
    'workspace-write',
    '-C',
    req.cwd,
    '--skip-git-repo-check',
    '--ephemeral',
  ]
  if (req.model) args.push('-m', req.model)
  if (req.effort) args.push('-c', `model_reasoning_effort="${req.effort}"`)
  // 워커는 train 버전 그대로 돈다(contract.md 10.1절)
  args.push('-c', 'check_for_update_on_startup=false')
  args.push(req.prompt)
  return args
}

export const codexAdapter: WorkerAdapter = {
  name: 'codex',
  async run(req): Promise<WorkerResult> {
    const r = await runProc(codexArgs(req), {
      cwd: req.cwd,
      timeoutMs: req.timeoutMs,
      // 허용 목록만 넘긴다(contract.md 6.3절). codex는 셸이 있어 받은 환경 변수를 파일에 쓸 수 있다(보안 감사 5차 중간 1)
      env: workerEnv(['OPENAI_API_KEY', 'CODEX_HOME']),
      replaceEnv: true,
    })
    const result: WorkerResult = {
      exitCode: r.exitCode,
      timedOut: r.timedOut,
      rawOutput: r.stdout,
      stderr: r.stderr,
    }
    const usage = parseCodexUsage(r.stdout)
    if (usage) result.usage = usage
    if (req.model) result.model = req.model
    return result
  },
}
