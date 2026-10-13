// 외부 명령 실행. 표준 입력은 항상 닫는다 — codex exec는 stdin이 열려 있으면 무한 대기한다(M0 확인).
export type ProcResult = { exitCode: number; stdout: string; stderr: string; timedOut: boolean }

export async function runProc(
  cmd: string[],
  opts: { cwd: string; timeoutMs?: number; env?: Record<string, string | undefined> },
): Promise<ProcResult> {
  const proc = Bun.spawn({
    cmd,
    cwd: opts.cwd,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
  })
  let timedOut = false
  let killTimer: ReturnType<typeof setTimeout> | undefined
  const timer = opts.timeoutMs
    ? setTimeout(() => {
        timedOut = true
        // SIGINT는 claude가 턴을 정리하고 결과를 남기게 한다. 10초 안에 안 끝나면 강제 종료.
        proc.kill('SIGINT')
        killTimer = setTimeout(() => proc.kill('SIGKILL'), 10_000)
      }, opts.timeoutMs)
    : undefined
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (timer) clearTimeout(timer)
  if (killTimer) clearTimeout(killTimer)
  return { exitCode, stdout, stderr, timedOut }
}

export async function runShell(
  command: string,
  cwd: string,
  timeoutMs = 300_000,
): Promise<ProcResult> {
  return runProc(['sh', '-c', command], { cwd, timeoutMs })
}
