// TD-027: 죽은 run의 잠금을 여러 프로세스가 동시에 회수해도 잠금을 잡는 것은 하나뿐이어야 한다.
// 같은 프로세스 안에서는 경쟁이 생기지 않으므로 실제 프로세스 여러 개를 동시에 띄운다.
import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const LIB = join(import.meta.dir, '..', '..')

/** 끝난 프로세스의 pid. 바로 끝나는 프로세스를 띄워 얻는다 */
function deadPid(): number {
  const p = Bun.spawnSync({ cmd: ['true'] })
  return p.pid
}

test('TD-027: 죽은 잠금을 프로세스 8개가 동시에 회수해도 잠금을 잡은 것은 정확히 하나다', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-lock-')))
  mkdirSync(join(root, 'orchestration', 'private'), { recursive: true })
  const lock = join(root, 'orchestration', 'private', 'run-T-001.lock')
  mkdirSync(lock)
  writeFileSync(join(lock, 'pid'), String(deadPid()))
  // 각 프로세스는 잠금을 잡으면 잠깐 쥐고 있다가 놓는다. 쥐는 동안 다른 프로세스가 회수를 시도한다
  const script = `
    const { withTaskLock } = await import(${JSON.stringify(join(LIB, 'src', 'runtime', 'run.ts'))})
    const r = await withTaskLock({ root: ${JSON.stringify(root)} }, 'T-001', async () => {
      await Bun.sleep(400)
      return 'held'
    })
    console.log(r.ok ? 'GOT' : 'BUSY')
  `
  const procs = Array.from({ length: 8 }, () =>
    Bun.spawn({
      cmd: [process.execPath, '-e', script],
      stdout: 'pipe',
      stderr: 'pipe',
      // 죽은 pid를 읽은 뒤 회수하기 전에 잠깐 멈춰 경쟁 구간을 넓힌다(테스트에서만 듣는 값)
      env: { ...process.env, NODE_ENV: 'test', GOTECHY_TEST_RECLAIM_PAUSE_MS: '150' },
    }),
  )
  const outs = await Promise.all(procs.map((p) => new Response(p.stdout).text()))
  await Promise.all(procs.map((p) => p.exited))
  const got = outs.filter((o) => o.includes('GOT')).length
  const busy = outs.filter((o) => o.includes('BUSY')).length
  expect({ got, busy }).toEqual({ got: 1, busy: 7 })
}, 30_000)
