// 워커가 쓴 코드를 리드 권한으로 실행할 때(verify) 쓰는 샌드박스(contract.md 6.3절).
// verify는 워커가 쓴 테스트를 실행하므로, 막지 않으면 그 코드가 서명 키를 읽고 결정 파일을 위조하거나,
// 홈의 설정 파일을 고쳐 리드가 나중에 실행하는 명령을 오염시킬 수 있다(보안 감사 1차, 2차).
// macOS sandbox-exec 실험으로 확인한 것: 뒤의 규칙이 앞의 규칙을 이긴다, 링크를 거친 읽기도 막힌다,
// 쓰기를 기본 거부해도 bun test는 돈다, 키 파일에 대한 하드 링크와 복제(cp -c)도 막힌다.
import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { accountHome } from './account'
import { type ProcResult, runProc } from './proc'

const SANDBOX_EXEC = '/usr/bin/sandbox-exec'

export type SandboxPaths = {
  /** 쓰기를 허용하는 작업 폴더 (worktree). 그 안의 .git 파일은 쓸 수 없다 */
  writable: string
  /** verify 전용 임시 폴더. HOME과 TMPDIR로 쓴다 */
  tmp: string
  /** 읽기와 쓰기를 모두 막는 폴더 (서명 키, private 기록) */
  secret: string[]
}

/** 오너 홈의 비밀이 흔히 있는 곳. 네트워크가 막혀 있어도 읽은 내용이 작업 폴더에 남지 않게 읽기도 막는다. */
const HOME_SECRETS = [
  '.ssh',
  '.aws',
  '.gnupg',
  '.netrc',
  '.config/gh',
  '.claude',
  '.claude.json',
  '.codex',
  // 보안 감사 5차 낮음 1
  '.git-credentials',
  '.npmrc',
  '.pypirc',
  '.config/gcloud',
  '.kube',
  '.docker',
]

const real = (p: string) => (existsSync(p) ? realpathSync(p) : p)
const quote = (p: string) => `"${real(p).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

export function sandboxProfile(s: SandboxPaths): string {
  // 환경 변수 HOME과 계정의 진짜 홈을 모두 막는다. HOME만 보면 HOME을 바꿔 부른 run에서 진짜 홈이 열린다(TD-019)
  const homes = [...new Set([homedir(), accountHome()].filter((h): h is string => Boolean(h)))]
  const secrets = [...s.secret, ...homes.flatMap((h) => HOME_SECRETS.map((d) => join(h, d)))]
  return [
    '(version 1)',
    '(allow default)',
    '(deny file-write*)',
    `(allow file-write* (subpath ${quote(s.writable)}) (subpath ${quote(s.tmp)}) (literal "/dev/null") (literal "/dev/tty") (regex #"^/dev/fd/"))`,
    `(deny file-write* (literal ${quote(join(s.writable, '.git'))}))`,
    ...secrets.map((d) => `(deny file-read* file-write* (subpath ${quote(d)}))`),
    '(deny network*)',
    // 샌드박스 밖 프로세스에 일을 시키는 경로를 막는다(감사 3차). 실험: bun test는 그대로 돈다
    '(deny process-exec (literal "/usr/bin/osascript") (literal "/bin/launchctl") (literal "/usr/bin/open") (literal "/usr/bin/automator") (literal "/usr/bin/shortcuts"))',
    '(deny mach-lookup (global-name "com.apple.coreservices.appleevents") (global-name "com.apple.coreservices.launchservicesd"))',
    // 워커 코드가 오너 키로 서명하거나 인증 창을 띄우지 못하게 Secure Enclave와 인증 서비스를 막는다(1b N0 실험)
    '(deny mach-lookup (global-name "com.apple.ctkd.token-client") (global-name "com.apple.CoreAuthentication.daemon") (global-name "com.apple.coreauthd"))',
  ].join('\n')
}

/** 오너의 환경 변수는 허용 목록만 넘긴다. API 토큰 같은 값이 verify 코드에 닿지 않게 한다. */
function verifyEnv(tmp: string): Record<string, string> {
  const env: Record<string, string> = { HOME: tmp, TMPDIR: tmp, NO_COLOR: '1' }
  for (const k of ['PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'USER', 'LOGNAME', 'SHELL']) {
    const v = process.env[k]
    if (v !== undefined) env[k] = v
  }
  return env
}

export function sandboxAvailable(): boolean {
  return process.platform === 'darwin' && existsSync(SANDBOX_EXEC)
}

/** 샌드박스를 쓸 수 없는 환경이면 그냥 실행하고 sandboxed: false를 돌려준다. 호출한 쪽이 기록에 남긴다. */
export async function runSandboxedShell(
  command: string,
  cwd: string,
  paths: SandboxPaths,
  timeoutMs = 300_000,
  /** 테스트에서 샌드박스가 없는 OS(리눅스 CI)의 경로를 보려고 넣는다 */
  available = sandboxAvailable(),
): Promise<ProcResult & { sandboxed: boolean }> {
  const env = verifyEnv(paths.tmp)
  if (!available)
    return {
      ...(await runProc(['sh', '-c', command], { cwd, timeoutMs, env, replaceEnv: true })),
      sandboxed: false,
    }
  const r = await runProc([SANDBOX_EXEC, '-p', sandboxProfile(paths), 'sh', '-c', command], {
    cwd,
    timeoutMs,
    env,
    replaceEnv: true,
  })
  return { ...r, sandboxed: true }
}
