// 외부 명령 실행. 표준 입력은 항상 닫는다 — codex exec는 stdin이 열려 있으면 무한 대기한다(M0 확인).
export type ProcResult = { exitCode: number; stdout: string; stderr: string; timedOut: boolean }

export async function runProc(
  cmd: string[],
  opts: {
    cwd: string
    timeoutMs?: number
    env?: Record<string, string | undefined>
    /** true면 opts.env만 넘긴다(오너 환경 변수를 물려주지 않음) */
    replaceEnv?: boolean
    /**
     * true면 새 프로세스 그룹으로 띄우고, 끝나면 그룹 전체를 끝낸다(TD-029). 워커와 verify가 남긴 백그라운드
     * 프로세스가 리드의 검사 뒤에 worktree나 git 설정을 바꾸지 못하게, 출력을 쥔 자식 때문에 기다리지 않게.
     * setsid로 그룹을 벗어난 프로세스는 막지 못한다.
     */
    group?: boolean
  },
): Promise<ProcResult> {
  const proc = Bun.spawn({
    cmd,
    cwd: opts.cwd,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    detached: opts.group === true,
    env: opts.replaceEnv
      ? (opts.env ?? {})
      : opts.env
        ? { ...process.env, ...opts.env }
        : process.env,
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
  const out = new Response(proc.stdout).text()
  const err = new Response(proc.stderr).text()
  const exitCode = await proc.exited
  if (opts.group) killGroup(proc.pid)
  const [stdout, stderr] = await Promise.all([out, err])
  if (timer) clearTimeout(timer)
  if (killTimer) clearTimeout(killTimer)
  return { exitCode, stdout, stderr, timedOut }
}

/** 프로세스 그룹 전체를 끝낸다. 이미 없으면 조용히 넘어간다 */
function killGroup(pgid: number): void {
  try {
    process.kill(-pgid, 'SIGKILL')
  } catch {
    // ESRCH: 그룹에 남은 프로세스가 없다
  }
}
