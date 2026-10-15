// 병합할 커밋의 비밀 값 검사(contract.md 9.4절, TD-012). gitleaks를 라이브러리의 설정으로만 돌린다.
// 검사 대상 저장소의 .gitleaks.toml, .gitleaksignore, gitleaks:allow 주석은 따르지 않는다. 워커가 그것을 심어
// 검사를 끌 수 있어서다(2026-10-16 실험: 대상 폴더의 .gitleaks.toml 허용 목록이 있으면 기본 실행이 exit 0이 됐다).
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { libraryRoot } from './library'
import { runProc } from './proc'

export type SecretHit = { file: string; line: number; rule: string; commit: string }
export type SecretScan = { ok: true; hits: SecretHit[] } | { ok: false; error: string }

/** 찾았을 때의 종료 코드. gitleaks는 오류에도 1로 끝나서, 찾은 경우를 다른 값으로 구별한다 */
const LEAK_EXIT = 99
const TIMEOUT_MS = 120_000

export function gitleaksPath(): string | undefined {
  return (
    process.env.GOTECHY_GITLEAKS ??
    Bun.which('gitleaks', { PATH: process.env.PATH ?? '' }) ??
    undefined
  )
}

/** repo에서 git log 범위(예: `<메인>..<작업 브랜치>`)의 커밋을 검사한다 */
export async function scanCommits(repo: string, range: string): Promise<SecretScan> {
  const bin = gitleaksPath()
  if (!bin)
    return {
      ok: false,
      error:
        'gitleaks가 없어 비밀 값 검사를 못 했어요. bin/gotechy로 실행하면 train의 gitleaks가 PATH에 있어요',
    }
  const lib = libraryRoot()
  // 무시 목록 자리로 빈 폴더를 준다. 기본값(".")이면 실행 위치의 .gitleaksignore를 읽는다
  const scratch = mkdtempSync(join(tmpdir(), 'gotechy-gitleaks-'))
  const report = join(scratch, 'report.json')
  try {
    let r: Awaited<ReturnType<typeof runProc>>
    try {
      r = await runProc(
        [
          bin,
          'git',
          '--no-banner',
          '--no-color',
          '--redact',
          '--config',
          join(lib, 'templates', 'project', 'gitleaks.toml'),
          '--gitleaks-ignore-path',
          scratch,
          '--ignore-gitleaks-allow',
          '--exit-code',
          String(LEAK_EXIT),
          '--report-format',
          'json',
          '--report-path',
          report,
          '--log-opts',
          range,
          repo,
        ],
        // 실행 위치를 라이브러리로 둔다. mise shim은 실행 위치의 mise.toml로 버전을 고른다
        { cwd: lib, env: scanEnv(), replaceEnv: true, timeoutMs: TIMEOUT_MS },
      )
    } catch (e) {
      return { ok: false, error: `gitleaks를 실행하지 못했어요(${bin}): ${(e as Error).message}` }
    }
    if (r.exitCode === 0) return { ok: true, hits: [] }
    if (r.exitCode !== LEAK_EXIT || !existsSync(report))
      return {
        ok: false,
        error: `gitleaks가 실패했어요 (exit ${r.exitCode}${r.timedOut ? ', 시간 초과' : ''}): ${r.stderr.trim().split('\n').slice(-3).join(' ')}`,
      }
    return { ok: true, hits: parseReport(readFileSync(report, 'utf8')) }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

/** gitleaks JSON 보고서에서 위치와 규칙만 꺼낸다. 값(Secret, Match)은 버린다 */
export function parseReport(text: string): SecretHit[] {
  let rows: unknown
  try {
    rows = JSON.parse(text)
  } catch {
    return [{ file: '(보고서를 읽지 못함)', line: 0, rule: 'unknown', commit: '' }]
  }
  if (!Array.isArray(rows)) return []
  return rows.map((row) => {
    const o = (row ?? {}) as Record<string, unknown>
    return {
      file: typeof o.File === 'string' ? o.File : '?',
      line: typeof o.StartLine === 'number' ? o.StartLine : 0,
      rule: typeof o.RuleID === 'string' ? o.RuleID : '?',
      commit: typeof o.Commit === 'string' ? o.Commit.slice(0, 7) : '',
    }
  })
}

/** 오너 셸의 GIT_* 변수는 넘기지 않고, 전역과 시스템 git 설정을 끈다(git.ts와 같은 규칙) */
function scanEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && !k.startsWith('GIT_') && !k.startsWith('GITLEAKS_')) env[k] = v
  return {
    ...env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
  }
}
