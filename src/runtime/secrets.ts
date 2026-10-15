// 병합할 커밋의 비밀 값 검사(contract.md 9.4절, TD-012, 보안 감사 15차). gitleaks를 라이브러리의 설정으로만 돌린다.
// 저장소가 정한 것은 따르지 않는다. 실험(2026-10-16)에서 모두 검사를 끌 수 있었다:
// 대상 폴더의 .gitleaks.toml 허용 목록, 대상 작업 트리의 .gitleaksignore(무시 목록 자리를 따로 줘도 읽음),
// 작업 트리 .gitattributes의 -diff, gitleaks:allow 주석. 그래서 작업 트리 없는 임시 폴더를 대상으로 쓰고 --text로 본다.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { displayText } from '../core/inbox'
import { parseTrain } from '../core/train'
import { libraryRoot } from './library'
import { runProc } from './proc'

export type SecretHit = { file: string; line: number; rule: string; commit: string }
export type SecretScan =
  | { ok: true; hits: SecretHit[]; version: string }
  | { ok: false; error: string }

/** 찾았을 때의 종료 코드. gitleaks는 오류에도 1로 끝나서, 찾은 경우를 다른 값으로 구별한다 */
const LEAK_EXIT = 99
const TIMEOUT_MS = 120_000

/**
 * gitleaks 경로. `GOTECHY_GITLEAKS`는 테스트에서만 받는다. 남의 저장소가 커밋한 `.claude/settings.json`의 env로
 * 리드 세션에 넣은 값이 검사기를 바꾸지 못하게 한다(보안 감사 15차 중간 2)
 */
export function gitleaksPath(): string | undefined {
  const injected = process.env.NODE_ENV === 'test' ? process.env.GOTECHY_GITLEAKS : undefined
  return injected ?? Bun.which('gitleaks', { PATH: process.env.PATH ?? '' }) ?? undefined
}

/**
 * gitDir(저장소의 git 폴더)에서 git log 옵션(범위 포함)에 걸리는 커밋을 검사한다.
 * 판은 train의 gitleaks와 같아야 한다.
 */
export async function scanCommits(gitDir: string, logOpts: string): Promise<SecretScan> {
  const bin = gitleaksPath()
  if (!bin)
    return {
      ok: false,
      error:
        'gitleaks가 없어 비밀 값 검사를 못 했어요. bin/gotechy로 실행하면 train의 gitleaks가 PATH에 있어요',
    }
  const lib = libraryRoot()
  const want = trainVersion(lib)
  const scratch = mkdtempSync(join(tmpdir(), 'gotechy-gitleaks-'))
  try {
    const ver = await run(bin, ['version'], lib)
    if (!ver.ok) return { ok: false, error: `gitleaks version이 실패했어요: ${ver.error}` }
    const version = one(ver.stdout).replace(/^v/, '')
    if (want && version !== want)
      return {
        ok: false,
        error: `gitleaks 판(${version || '읽지 못함'})이 train(${want})과 달라요(${bin}). bin/gotechy로 실행하세요`,
      }
    // 작업 트리 없는 대상 폴더: .git 파일만 두고 저장소의 git 폴더를 가리킨다
    const source = join(scratch, 'source')
    const ignore = join(scratch, 'ignore')
    mkdirSync(source)
    mkdirSync(ignore)
    writeFileSync(join(source, '.git'), `gitdir: ${gitDir}\n`)
    const report = join(scratch, 'report.json')
    const r = await run(
      bin,
      [
        'git',
        '--no-banner',
        '--no-color',
        '--redact',
        '--config',
        join(lib, 'templates', 'project', 'gitleaks.toml'),
        '--gitleaks-ignore-path',
        ignore,
        '--ignore-gitleaks-allow',
        '--exit-code',
        String(LEAK_EXIT),
        '--report-format',
        'json',
        '--report-path',
        report,
        '--log-opts',
        logOpts,
        source,
      ],
      lib,
    )
    if (!r.ok) return { ok: false, error: r.error }
    if (r.exitCode === 0) return { ok: true, hits: [], version }
    if (r.exitCode !== LEAK_EXIT || !existsSync(report))
      return {
        ok: false,
        error: `gitleaks가 실패했어요 (exit ${r.exitCode}${r.timedOut ? ', 시간 초과' : ''}): ${one(r.stderr.split('\n').slice(-3).join(' '))}`,
      }
    const hits = parseReport(readFileSync(report, 'utf8'))
    // 찾았다고 했는데 보고서가 비었으면 믿지 않는다(보안 감사 15차 낮음 2)
    if (hits.length === 0)
      return { ok: false, error: 'gitleaks가 찾았다고 했는데 보고서가 비었어요' }
    return { ok: true, hits, version }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

type Run =
  | { ok: true; exitCode: number; stdout: string; stderr: string; timedOut: boolean }
  | { ok: false; error: string }

async function run(bin: string, args: string[], cwd: string): Promise<Run> {
  try {
    // 실행 위치를 라이브러리로 둔다. mise shim은 실행 위치의 mise.toml로 버전을 고른다
    const r = await runProc([bin, ...args], {
      cwd,
      env: scanEnv(),
      replaceEnv: true,
      timeoutMs: TIMEOUT_MS,
    })
    if (args[0] === 'version' && r.exitCode !== 0)
      return { ok: false, error: `exit ${r.exitCode}: ${one(r.stderr)}` }
    return { ok: true, ...r }
  } catch (e) {
    return { ok: false, error: `gitleaks를 실행하지 못했어요(${bin}): ${(e as Error).message}` }
  }
}

function trainVersion(lib: string): string | undefined {
  try {
    return parseTrain(readFileSync(join(lib, 'train.yaml'), 'utf8')).tools.gitleaks?.version
  } catch {
    return undefined
  }
}

/** 한 줄로 펴고 제어 문자를 지운다(터미널과 기록에 남길 글, 보안 감사 15차 낮음 1) */
const one = (s: string) => displayText(s).replace(/\s+/g, ' ').trim()

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
      file: typeof o.File === 'string' ? one(o.File).slice(0, 200) : '?',
      line: typeof o.StartLine === 'number' ? o.StartLine : 0,
      rule: typeof o.RuleID === 'string' ? one(o.RuleID).slice(0, 80) : '?',
      commit: typeof o.Commit === 'string' ? o.Commit.slice(0, 7) : '',
    }
  })
}

/** 오너 셸의 GIT_*, GITLEAKS_* 변수는 넘기지 않고, 전역과 시스템 git 설정을 끈다(git.ts와 같은 규칙) */
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
