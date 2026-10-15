// 감사관 실행(contract.md 13절). 워커 어댑터와 달리 읽기만 한다: codex는 read-only 샌드박스, claude는 계획 모드와 쓰기 거부.
// fake는 녹화 폴더의 output.txt를 마지막 답으로 돌려준다(LLM 호출 없음).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AuditorName } from '../core/audit'
import { parseClaudeUsage, parseCodexUsage } from '../core/usage'
import { CLAUDE_ENV } from './adapters/claude'
import { CODEX_ENV } from './adapters/codex'
import { workerEnv } from './adapters/env'
import { gotechyHome } from './keys'
import { runProc } from './proc'

export type AuditorRequest = {
  /** 작업 worktree. 감사관이 줄 번호를 확인하려고 읽는다 */
  cwd: string
  prompt: string
  model?: string | null
  budgetUsd: number
  timeoutMs: number
  /** fake 전용: 재생할 녹화 폴더 */
  fixtureDir?: string
}

export type AuditorResult = {
  exitCode: number
  timedOut: boolean
  /** 감사관의 마지막 답 */
  text: string
  raw: string
  stderr: string
  model?: string
  costUsd?: number
}

export function codexAuditorArgs(req: AuditorRequest): string[] {
  const args = [
    'codex',
    'exec',
    '--json',
    '-s',
    'read-only',
    '-C',
    req.cwd,
    '--skip-git-repo-check',
    '--ephemeral',
    '-c',
    'check_for_update_on_startup=false',
  ]
  if (req.model) args.push('-m', req.model)
  args.push(req.prompt)
  return args
}

export function claudeAuditorArgs(req: AuditorRequest): string[] {
  const deny = [
    'Edit(**)',
    'Write(**)',
    'Read(./orchestration/private/**)',
    'Read(~/.gotechy/**)',
    `Read(${gotechyHome()}/**)`,
  ]
  const args = [
    'claude',
    '-p',
    req.prompt,
    '--restricted',
    '--permission-mode',
    'plan',
    '--output-format',
    'json',
    '--strict-mcp-config',
    '--max-budget-usd',
    String(req.budgetUsd),
    '--settings',
    JSON.stringify({ permissions: { deny } }),
  ]
  if (req.model) args.push('--model', req.model)
  return args
}

/** `codex exec --json` 이벤트에서 마지막 agent_message 글. 읽을 수 없는 줄은 건너뛴다. */
export function lastCodexMessage(jsonl: string): string {
  let last = ''
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line) as { type?: string; item?: { type?: string; text?: unknown } }
      if (
        e.type === 'item.completed' &&
        e.item?.type === 'agent_message' &&
        typeof e.item.text === 'string'
      )
        last = e.item.text
    } catch {
      // 이벤트가 아닌 줄(경고 등)은 건너뛴다
    }
  }
  return last
}

/** `claude -p --output-format json`의 result 글 */
export function claudeResultText(json: string): string {
  try {
    const o = JSON.parse(json) as { result?: unknown }
    return typeof o.result === 'string' ? o.result : ''
  } catch {
    return ''
  }
}

async function runCodex(req: AuditorRequest): Promise<AuditorResult> {
  const r = await runProc(codexAuditorArgs(req), {
    cwd: req.cwd,
    timeoutMs: req.timeoutMs,
    env: workerEnv(CODEX_ENV),
    replaceEnv: true,
  })
  const out: AuditorResult = {
    exitCode: r.exitCode,
    timedOut: r.timedOut,
    text: lastCodexMessage(r.stdout),
    raw: r.stdout,
    stderr: r.stderr,
  }
  const cost = parseCodexUsage(r.stdout)?.cost_usd
  if (typeof cost === 'number') out.costUsd = cost
  if (req.model) out.model = req.model
  return out
}

async function runClaude(req: AuditorRequest): Promise<AuditorResult> {
  const r = await runProc(claudeAuditorArgs(req), {
    cwd: req.cwd,
    timeoutMs: req.timeoutMs,
    env: workerEnv(CLAUDE_ENV, { DISABLE_AUTOUPDATER: '1' }),
    replaceEnv: true,
  })
  const out: AuditorResult = {
    exitCode: r.exitCode,
    timedOut: r.timedOut,
    text: claudeResultText(r.stdout),
    raw: r.stdout,
    stderr: r.stderr,
  }
  const cost = parseClaudeUsage(r.stdout)?.cost_usd
  if (typeof cost === 'number') out.costUsd = cost
  if (req.model) out.model = req.model
  return out
}

async function runFake(req: AuditorRequest): Promise<AuditorResult> {
  const file = req.fixtureDir ? join(req.fixtureDir, 'output.txt') : ''
  if (!file || !existsSync(file))
    return {
      exitCode: 2,
      timedOut: false,
      text: '',
      raw: '',
      stderr: `fake 감사관에는 --fixture <폴더>(output.txt)가 필요해요 (받은 값: ${req.fixtureDir ?? '없음'})`,
    }
  const text = readFileSync(file, 'utf8')
  return { exitCode: 0, timedOut: false, text, raw: text, stderr: '', model: 'fake', costUsd: 0 }
}

export const auditors: Record<AuditorName, (req: AuditorRequest) => Promise<AuditorResult>> = {
  codex: runCodex,
  claude: runClaude,
  fake: runFake,
}
