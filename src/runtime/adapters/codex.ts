// Codex 워커. workspace-write 샌드박스는 작업 폴더(-C) 밖 쓰기를 막지만 안쪽 파일은 다 쓸 수 있다(M0에서 결정 파일 수정 확인).
// 그래서 작업 폴더를 worktree로 두고, 허용 밖 변경은 리드가 changed-files 검사로 실패 처리한다.
import { parseCodexUsage } from '../../core/usage'
import { runProc } from '../proc'
import { realAgentInTest, workerEnv } from './env'
import type { WorkerAdapter, WorkerRequest, WorkerResult } from './types'

/** codex에 넘기는 환경 변수 허용 목록. 감사관도 같은 목록을 쓴다 */
export const CODEX_ENV = ['OPENAI_API_KEY', 'CODEX_HOME']

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
    // 오너의 ~/.codex/config.toml(모델, 메모리, 권한 프로필)이 워커에 섞이지 않게. 로그인은 CODEX_HOME 그대로(0.166 확인)
    '--ignore-user-config',
  ]
  if (req.model) args.push('-m', req.model)
  if (req.effort) args.push('-c', `model_reasoning_effort="${req.effort}"`)
  // 워커는 train 버전 그대로 돈다(contract.md 10.1절)
  args.push('-c', 'check_for_update_on_startup=false')
  // 지시문은 표준 입력으로 넘긴다(`-`). 명령줄은 리눅스에서 인자 하나 128KB 한도가 있고 ps로 보인다(TD-028, U9)
  args.push('-')
  return args
}

export const codexAdapter: WorkerAdapter = {
  name: 'codex',
  async run(req): Promise<WorkerResult> {
    // 허용 목록만 넘긴다(contract.md 6.3절). codex는 셸이 있어 받은 환경 변수를 파일에 쓸 수 있다(보안 감사 5차 중간 1)
    const env = workerEnv(CODEX_ENV)
    const blocked = realAgentInTest('codex', env.PATH)
    if (blocked) return { exitCode: 97, timedOut: false, rawOutput: '', stderr: blocked }
    const r = await runProc(codexArgs(req), {
      cwd: req.cwd,
      timeoutMs: req.timeoutMs,
      env,
      replaceEnv: true,
      group: true,
      input: req.prompt,
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
