// Claude Code 워커. --restricted: 명령 실행 도구 제거, 파일 도구를 작업 폴더로 제한, 사용자·프로젝트 설정 무시,
// 권한 우회 거부(M0 확인). --strict-mcp-config로 MCP 서버도 띄우지 않는다.
import { parseClaudeUsage } from '../../core/usage'
import { gotechyHome } from '../keys'
import { runProc } from '../proc'
import { workerEnv } from './env'
import type { WorkerAdapter, WorkerRequest, WorkerResult } from './types'

const DENY = [
  'Read(./orchestration/gates/**)',
  'Edit(./orchestration/gates/**)',
  'Write(./orchestration/gates/**)',
  'Edit(./orchestration/tasks/**)',
  'Write(./orchestration/tasks/**)',
  'Read(./orchestration/private/**)',
  'Edit(./orchestration/project.yaml)',
  'Write(./orchestration/project.yaml)',
  // 결정 서명 키. restricted 모드가 이미 작업 폴더 밖을 막지만 한 겹 더 둔다
  'Read(~/.gotechy/**)',
]

export function claudeArgs(req: WorkerRequest): string[] {
  const args = [
    'claude',
    '-p',
    req.prompt,
    '--restricted',
    '--permission-mode',
    'acceptEdits',
    '--output-format',
    'json',
    '--strict-mcp-config',
    '--max-budget-usd',
    String(req.budgetUsd),
    '--settings',
    // GOTECHY_HOME을 바꾼 경우에도 실제 키 폴더를 막는다
    JSON.stringify({ permissions: { deny: [...DENY, `Read(${gotechyHome()}/**)`] } }),
  ]
  if (req.model) args.push('--model', req.model)
  if (req.effort) args.push('--effort', req.effort)
  return args
}

export const claudeAdapter: WorkerAdapter = {
  name: 'claude',
  async run(req): Promise<WorkerResult> {
    const r = await runProc(claudeArgs(req), {
      cwd: req.cwd,
      timeoutMs: req.timeoutMs,
      // 허용 목록만 넘긴다(contract.md 6.3절). 워커는 train 버전 그대로 돈다(10.1절)
      env: workerEnv(['ANTHROPIC_API_KEY', 'CLAUDE_CONFIG_DIR'], { DISABLE_AUTOUPDATER: '1' }),
      replaceEnv: true,
    })
    const usage = parseClaudeUsage(r.stdout)
    let model: string | undefined
    try {
      const out = JSON.parse(r.stdout) as { modelUsage?: Record<string, unknown> }
      model = Object.keys(out.modelUsage ?? {})[0]
    } catch {
      // 출력이 JSON이 아니면 모델을 알 수 없다 — 아래 결과에 원문을 남긴다
    }
    const result: WorkerResult = {
      exitCode: r.exitCode,
      timedOut: r.timedOut,
      rawOutput: r.stdout,
      stderr: r.stderr,
    }
    if (usage) result.usage = usage
    if (model) result.model = model
    return result
  },
}
