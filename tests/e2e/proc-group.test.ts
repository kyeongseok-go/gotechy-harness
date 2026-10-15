// TD-029: 워커와 verify가 남긴 백그라운드 프로세스는 실행이 끝날 때 함께 끝낸다(contract.md 6.6절).
// 2026-10-16 실험: Bun.spawn의 detached는 새 프로세스 그룹을 만들고, 그룹에 보낸 SIGKILL은 남은 자식까지 끝낸다.
import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_OUTPUT_BYTES, runProc } from '../../src/runtime/proc'
import { runTask } from '../../src/runtime/run'
import { FAKE, makeHome, makeProject, newTask } from './helpers'

const later = (file: string) => `(sleep 1; touch '${file}') >/dev/null 2>&1 &`

const PROC = join(import.meta.dir, '..', '..', 'src', 'runtime', 'proc.ts')
const alive = (pgid: number) => {
  try {
    process.kill(-pgid, 0)
    return true
  } catch {
    return false
  }
}

describe('프로세스 그룹 정리 (TD-029)', () => {
  test('리드가 Ctrl-C(SIGINT)로 끝나도 워커 그룹을 함께 끝낸다(보안 감사 15차 중간 1)', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-pg-int-')))
    const pidFile = join(dir, 'pgid')
    writeFileSync(
      join(dir, 'lead.ts'),
      `import { runProc } from '${PROC}'\nawait runProc(['sh', '-c', 'echo $$ > ${pidFile}; sleep 30 & sleep 30'], { cwd: '${dir}', group: true })\n`,
    )
    const lead = Bun.spawn({
      cmd: [process.execPath, join(dir, 'lead.ts')],
      stdout: 'ignore',
      stderr: 'ignore',
    })
    for (let i = 0; i < 50 && !existsSync(pidFile); i++) await Bun.sleep(100)
    const pgid = Number(readFileSync(pidFile, 'utf8').trim())
    expect(alive(pgid)).toBe(true)
    lead.kill('SIGINT')
    await lead.exited
    await Bun.sleep(300)
    expect(alive(pgid)).toBe(false)
  })

  test('그룹을 벗어나 출력을 쥔 자손이 있어도 2초 남짓 뒤에는 돌아온다(보안 감사 15차 낮음 8)', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-pg-')))
    const started = Date.now()
    const r = await runProc(
      [
        'sh',
        '-c',
        `perl -MPOSIX -e 'fork and exit; POSIX::setsid(); sleep 15' & sleep 0.5; echo done`,
      ],
      { cwd: dir, group: true },
    )
    expect(r.stdout).toContain('done')
    expect(Date.now() - started).toBeLessThan(6_000)
  })

  test('group이면 끝난 뒤 남은 백그라운드 자식도 끝낸다', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-pg-')))
    const r = await runProc(['sh', '-c', `${later(join(dir, 'left'))} echo done`], {
      cwd: dir,
      group: true,
    })
    expect(r.stdout.trim()).toBe('done')
    await Bun.sleep(1_500)
    expect(existsSync(join(dir, 'left'))).toBe(false)
  })

  test('출력을 쥔 채 남은 자식이 있어도 기다리지 않고 돌아온다', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-pg-')))
    const started = Date.now()
    const r = await runProc(['sh', '-c', 'sleep 20 & echo done'], { cwd: dir, group: true })
    expect(r.stdout).toContain('done')
    expect(Date.now() - started).toBeLessThan(5_000)
  })

  test('리드 verify가 남긴 백그라운드 프로세스는 run이 끝날 때 끝난다', async () => {
    const root = makeProject()
    const home = makeHome()
    const id = newTask(root, { verify: `${later('LEFT')} grep -q 설치 README.md` })
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: join(FAKE, 'readme-ok'),
      home,
    })
    expect(out.status).toBe('done')
    await Bun.sleep(1_500)
    expect(existsSync(join(root, '.gotechy', 'worktrees', id, 'LEFT'))).toBe(false)
  })
})

describe('출력 상한 (TD-028 일부)', () => {
  test('출력이 상한을 넘으면 끝 부분만 남기고 잘렸다고 표시한다', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-cap-')))
    const r = await runProc(['sh', '-c', 'yes 0123456789 | head -c 30000000; echo TAIL-MARK'], {
      cwd: dir,
      group: true,
    })
    expect(Buffer.byteLength(r.stdout)).toBeLessThanOrEqual(MAX_OUTPUT_BYTES + 200)
    expect(r.stdout).toContain('TAIL-MARK')
    expect(r.stdout).toContain('잘렸어요')
  })
})
