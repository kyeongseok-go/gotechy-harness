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
  if (opts.group) trackGroup(proc.pid)
  const out = drain(proc.stdout)
  const err = drain(proc.stderr)
  const exitCode = await proc.exited
  if (opts.group) {
    killGroup(proc.pid)
    untrackGroup(proc.pid)
    // setsid로 그룹을 벗어난 자손이 출력을 쥐고 있으면 스트림이 닫히지 않는다. 잠깐만 기다리고 끊는다(보안 감사 15차 낮음 8)
    await Promise.race([Promise.all([out.done, err.done]), Bun.sleep(DRAIN_GRACE_MS)])
    out.cancel()
    err.cancel()
  } else await Promise.all([out.done, err.done])
  if (timer) clearTimeout(timer)
  if (killTimer) clearTimeout(killTimer)
  return { exitCode, stdout: out.text(), stderr: err.text(), timedOut }
}

const DRAIN_GRACE_MS = 2_000

/** 스트림을 끝까지(또는 끊을 때까지) 모은다 */
function drain(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  const done = (async () => {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      chunks.push(value)
    }
  })().catch(() => {
    // 끊은 스트림의 읽기 오류는 무시한다(이미 모은 것을 돌려준다)
  })
  return {
    done,
    cancel: () => {
      reader.cancel().catch(() => {})
    },
    text: () => Buffer.concat(chunks).toString('utf8'),
  }
}

// 리드가 신호로 끝나도 살아 있는 워커 그룹을 남기지 않는다(보안 감사 15차 중간 1). 새 그룹은 터미널의 Ctrl-C를 받지 못한다.
// 그룹이 있을 때만 처리기를 달아, 다른 명령의 신호 처리(decide의 잠금 풀기 등)를 바꾸지 않는다
const liveGroups = new Set<number>()
const SIGNALS = [
  ['SIGINT', 130],
  ['SIGTERM', 143],
  ['SIGHUP', 129],
] as const
const onSignal = {
  SIGINT: () => exitAfterKill(130),
  SIGTERM: () => exitAfterKill(143),
  SIGHUP: () => exitAfterKill(129),
}
function killAllGroups(): void {
  for (const g of liveGroups) killGroup(g)
  liveGroups.clear()
}
function exitAfterKill(code: number): void {
  killAllGroups()
  process.exit(code)
}
function trackGroup(pgid: number): void {
  if (liveGroups.size === 0) {
    process.on('exit', killAllGroups)
    for (const [sig] of SIGNALS) process.on(sig, onSignal[sig])
  }
  liveGroups.add(pgid)
}
function untrackGroup(pgid: number): void {
  liveGroups.delete(pgid)
  if (liveGroups.size === 0) {
    process.off('exit', killAllGroups)
    for (const [sig] of SIGNALS) process.off(sig, onSignal[sig])
  }
}

/** 프로세스 그룹 전체를 끝낸다. 이미 없으면 조용히 넘어간다 */
function killGroup(pgid: number): void {
  try {
    process.kill(-pgid, 'SIGKILL')
  } catch {
    // ESRCH: 그룹에 남은 프로세스가 없다
  }
}
