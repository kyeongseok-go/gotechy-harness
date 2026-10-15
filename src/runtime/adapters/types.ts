// 워커 어댑터 경계. Orca·SDK·ACP는 나중에 이 인터페이스의 구현을 하나 더 붙이는 것으로 끝나야 한다(ADR 0001).
import type { Usage } from '../../core/schema'

export type WorkerRequest = {
  taskId: string
  /** 워커 작업 폴더 = 작업 브랜치 worktree */
  cwd: string
  prompt: string
  model?: string | null
  effort?: string | null
  budgetUsd: number
  timeoutMs: number
  /** fake 어댑터 전용: 재생할 녹화 폴더 */
  fixtureDir?: string
  /** HANDOFF 다시 쓰기 번호(1부터). 없으면 첫 실행(TD-016) */
  rewrite?: number
}

export type WorkerResult = {
  exitCode: number
  timedOut: boolean
  usage?: Usage
  /** 실제로 실행된 모델 (출력에서 알 수 있을 때) */
  model?: string
  rawOutput: string
  stderr: string
}

export interface WorkerAdapter {
  readonly name: 'claude' | 'codex' | 'fake'
  run(req: WorkerRequest): Promise<WorkerResult>
}
