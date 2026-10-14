// contract.md 11절: gotechy loop. 무인 루프(1b N3, Validation 7, 8). 워커는 녹화 재생(fake)만 쓴다.
import { beforeEach, describe, expect, test } from 'bun:test'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hasErrors, lintHandoff } from '../../src/core/lint-handoff'
import { runLoop } from '../../src/runtime/loop'
import { updateFrontmatter } from '../../src/runtime/project'
import { runTask } from '../../src/runtime/run'
import { FAKE, fm, LIB, makeHome, makeProject, newTask, taskFile } from './helpers'

let root: string
let home: string
beforeEach(() => {
  root = makeProject()
  home = makeHome()
})

/** 작업마다 녹화 폴더를 정해 fake 워커로 돌린다. 몇 번 불렸는지 센다 */
function fakeRunner(fixtures: Record<string, string>) {
  const calls: string[] = []
  const run = (id: string) => {
    calls.push(id)
    return runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: join(FAKE, fixtures[id] as string),
      home,
    })
  }
  return { run, calls }
}
const status = (id: string) => fm(taskFile(root, id)).status

describe('Validation 7: 같은 실패 2회에서 그 작업만 멈추고, 예산을 넘으면 새 작업을 시작하지 않는다', () => {
  test('같은 실패가 두 번 이어진 작업만 멈추고 다른 작업은 끝까지 돈다', async () => {
    const bad = newTask(root, { title: '늘 실패', autonomy: 'L2', verify: 'false' })
    const good = newTask(root, {
      title: '설치 줄',
      autonomy: 'L2',
      verify: 'grep -q 설치 README.md',
    })
    const r = fakeRunner({ [bad]: 'readme-ok', [good]: 'readme-ok' })
    const report = await runLoop({ root }, { home, run: r.run })
    expect(r.calls.filter((c) => c === bad)).toHaveLength(2)
    expect(status(good)).toBe('done')
    const b = report.results.find((x) => x.task === bad)
    expect(b?.outcome).toBe('stopped')
    expect(b?.reason).toContain('같은 실패')
  })

  test('시도 상한에 닿으면 멈춘다', async () => {
    const bad = newTask(root, { title: '늘 실패', autonomy: 'L2', verify: 'false' })
    const r = fakeRunner({ [bad]: 'readme-ok' })
    const report = await runLoop({ root }, { home, run: r.run, maxAttempts: 1 })
    expect(r.calls).toEqual([bad])
    expect(report.results[0]?.outcome).toBe('stopped')
  })

  test('시작한 작업의 예산 합이 상한을 넘게 되면 다음 작업은 시작하지 않는다', async () => {
    const a = newTask(root, { title: '첫째', autonomy: 'L2', verify: 'grep -q 설치 README.md' })
    const b = newTask(root, { title: '둘째', autonomy: 'L2', verify: 'grep -q 설치 README.md' })
    const r = fakeRunner({ [a]: 'readme-ok', [b]: 'readme-ok' })
    const report = await runLoop({ root }, { home, run: r.run, budgetUsd: 1.5 })
    expect(r.calls).toEqual([a])
    expect(report.results.find((x) => x.task === b)?.outcome).toBe('budget')
    expect(status(b)).toBe('ready')
  })

  test('결정이 필요한 작업은 기다리고 다른 작업은 계속한다', async () => {
    const wait = newTask(root, { title: '캐시', autonomy: 'L2', verify: 'grep -q 설치 README.md' })
    const go = newTask(root, { title: '설치 줄', autonomy: 'L2', verify: 'grep -q 설치 README.md' })
    const r = fakeRunner({ [wait]: 'needs-decision', [go]: 'readme-ok' })
    const report = await runLoop({ root }, { home, run: r.run })
    expect(report.results.find((x) => x.task === wait)?.outcome).toBe('needs-decision')
    expect(status(go)).toBe('done')
  })

  test('시작 승인이 필요한 작업은 실행하지 않고 기다린다(게이트는 연다)', async () => {
    const gated = newTask(root, { title: '배포', autonomy: 'L2', gate: 'before' })
    const r = fakeRunner({ [gated]: 'readme-ok' })
    const report = await runLoop({ root }, { home, run: r.run })
    expect(r.calls).toEqual([])
    expect(report.results[0]?.outcome).toBe('waiting')
    expect(existsSync(join(root, 'orchestration', 'gates', 'G-001.md'))).toBe(true)
  })

  test('autonomy가 L2보다 낮은 작업은 돌리지 않는다', async () => {
    const l1 = newTask(root, { title: 'L1', autonomy: 'L1', verify: 'true' })
    const l0 = newTask(root, { title: 'L0', verify: 'true' })
    const r = fakeRunner({ [l1]: 'readme-ok', [l0]: 'readme-ok' })
    await runLoop({ root }, { home, run: r.run })
    expect(r.calls).toEqual([])
  })

  test('루프는 결정과 병합을 하지 않는다: 끝난 작업은 done으로 남고 게이트는 결정 전이다', async () => {
    const id = newTask(root, {
      title: '설치 줄',
      autonomy: 'L2',
      gate: 'after',
      verify: 'grep -q 설치 README.md',
    })
    const r = fakeRunner({ [id]: 'readme-ok' })
    await runLoop({ root }, { home, run: r.run })
    expect(status(id)).toBe('done')
    expect(fm(join(root, 'orchestration', 'gates', 'G-001.md')).status).toBe('pending')
  })
})

describe('Validation 8: 아침 보고서와 이어 가기', () => {
  test('끝나면 보고서가 생기고, 보고서가 가리키는 HANDOFF는 모두 lint를 통과한다', async () => {
    const wait = newTask(root, { title: '캐시', autonomy: 'L2', verify: 'grep -q 설치 README.md' })
    const go = newTask(root, { title: '설치 줄', autonomy: 'L2', verify: 'grep -q 설치 README.md' })
    const bad = newTask(root, { title: '늘 실패', autonomy: 'L2', verify: 'false' })
    const r = fakeRunner({ [wait]: 'needs-decision', [go]: 'readme-ok', [bad]: 'readme-ok' })
    const report = await runLoop({ root }, { home, run: r.run })
    expect(report.digest).toStartWith(join(root, '.gotechy', 'digest'))
    const md = readFileSync(report.digest, 'utf8')
    for (const id of [wait, go, bad]) expect(md).toContain(id)
    expect(md).toContain('G-001')
    expect(md).toContain('gotechy serve')
    const linked = [...md.matchAll(/orchestration\/handoffs\/(T-\d{3})\.md/g)].map((m) => m[1])
    expect(linked.length).toBeGreaterThan(0)
    for (const id of linked) {
      const rel = `orchestration/handoffs/${id}.md`
      const issues = lintHandoff(readFileSync(join(root, rel), 'utf8'), rel).issues
      expect({ id, errors: hasErrors(issues) }).toEqual({ id, errors: false })
    }
  })

  test('오너가 멈춘 작업을 ready로 돌리면 시도 수를 비우고 새로 시작한다', async () => {
    const bad = newTask(root, { title: '늘 실패', autonomy: 'L2', verify: 'false' })
    const r = fakeRunner({ [bad]: 'readme-ok' })
    await runLoop({ root }, { home, run: r.run })
    expect(r.calls).toHaveLength(2)
    updateFrontmatter(taskFile(root, bad), { status: 'ready' })
    await runLoop({ root }, { home, run: r.run })
    expect(r.calls).toHaveLength(4)
  })

  test('다시 실행하면 이어 간다: 멈춘 작업은 다시 시도하지 않고, --reset이면 비운다', async () => {
    const bad = newTask(root, { title: '늘 실패', autonomy: 'L2', verify: 'false' })
    const r = fakeRunner({ [bad]: 'readme-ok' })
    await runLoop({ root }, { home, run: r.run })
    expect(r.calls).toHaveLength(2)
    await runLoop({ root }, { home, run: r.run })
    expect(r.calls).toHaveLength(2)
    await runLoop({ root }, { home, run: r.run, reset: true })
    expect(r.calls).toHaveLength(4)
  })
})

describe('보안 감사 9차', () => {
  test('중간 1: .gotechy/loop가 링크면 루프를 돌리지 않고 바깥 파일은 그대로다', async () => {
    const out = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-lo-')))
    writeFileSync(join(out, 'state.json'), 'keep')
    mkdirSync(join(root, '.gotechy'), { recursive: true })
    symlinkSync(out, join(root, '.gotechy', 'loop'))
    const r = fakeRunner({})
    await expect(runLoop({ root }, { home, run: r.run })).rejects.toThrow('.gotechy/loop')
    expect(readFileSync(join(out, 'state.json'), 'utf8')).toBe('keep')
  })

  test('중간 2: 계약 폴더 안의 파일이 링크면 프로젝트 명령이 exit 2로 멈춘다', () => {
    const out = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-lf-')))
    writeFileSync(join(out, 'victim.md'), 'keep')
    symlinkSync(join(out, 'victim.md'), join(root, 'orchestration', 'handoffs', 'T-001.md'))
    const r = Bun.spawnSync({
      cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), 'inbox'],
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { PATH: process.env.PATH ?? '', HOME: home, GOTECHY_HOME: home },
    })
    expect(r.exitCode).toBe(2)
    expect(r.stderr.toString()).toContain('orchestration/handoffs/T-001.md')
    expect(readFileSync(join(out, 'victim.md'), 'utf8')).toBe('keep')
  })

  test('중간 3: 명세의 id가 파일 이름과 다르면 돌리지 않고 멈춘다', async () => {
    const real = newTask(root, { title: '진짜', verify: 'true' })
    const decoy = newTask(root, { title: '미끼', autonomy: 'L2', verify: 'true' })
    const f = taskFile(root, decoy)
    writeFileSync(f, readFileSync(f, 'utf8').replace(`id: ${decoy}`, `id: ${real}`))
    const r = fakeRunner({ [real]: 'readme-ok', [decoy]: 'readme-ok' })
    const report = await runLoop({ root }, { home, run: r.run })
    expect(r.calls).toEqual([])
    expect(report.results.find((x) => x.task === decoy)?.reason).toContain('파일 이름')
  })

  test('중간 4: Codex 작업은 비용 상한이 없어 돌리지 않는다', async () => {
    const id = newTask(root, { title: 'codex', autonomy: 'L2', agent: 'codex', verify: 'true' })
    const r = fakeRunner({ [id]: 'readme-ok' })
    const report = await runLoop({ root }, { home, run: r.run })
    expect(r.calls).toEqual([])
    expect(report.results[0]?.reason).toContain('TD-015')
  })

  test('낮음 6: 아주 작은 budget_usd도 시도마다 최소 예약을 센다', async () => {
    const ids = [1, 2, 3].map(() =>
      newTask(root, { title: '작은 예산', autonomy: 'L2', verify: 'grep -q 설치 README.md' }),
    )
    for (const id of ids) {
      const f = taskFile(root, id)
      writeFileSync(
        f,
        readFileSync(f, 'utf8').replace('autonomy: L2', 'autonomy: L2\nbudget_usd: 0.000001'),
      )
    }
    const r = fakeRunner(Object.fromEntries(ids.map((id) => [id, 'readme-ok'])))
    await runLoop({ root }, { home, run: r.run, budgetUsd: 0.25 })
    expect(r.calls).toHaveLength(2)
  })

  test('낮음 7: 다른 루프가 돌고 있으면 시작하지 않는다', async () => {
    mkdirSync(join(root, '.gotechy', 'loop', 'lock'), { recursive: true })
    await expect(runLoop({ root }, { home, run: fakeRunner({}).run })).rejects.toThrow('다른 루프')
  })

  test('낮음 8: run이 예외를 던져도 그 작업만 멈추고 보고서는 생긴다', async () => {
    const boom = newTask(root, { title: '예외', autonomy: 'L2', verify: 'true' })
    const go = newTask(root, { title: '설치 줄', autonomy: 'L2', verify: 'grep -q 설치 README.md' })
    const r = fakeRunner({ [go]: 'readme-ok' })
    const report = await runLoop(
      { root },
      {
        home,
        run: (id) => (id === boom ? Promise.reject(new Error('터짐')) : r.run(id)),
      },
    )
    expect(report.results.find((x) => x.task === boom)?.outcome).toBe('stopped')
    expect(status(go)).toBe('done')
    expect(existsSync(report.digest)).toBe(true)
  })

  test('낮음 9: 깨지거나 이상한 상태 파일은 무시한다', async () => {
    const bad = newTask(root, { title: '늘 실패', autonomy: 'L2', verify: 'false' })
    mkdirSync(join(root, '.gotechy', 'loop'), { recursive: true })
    writeFileSync(
      join(root, '.gotechy', 'loop', 'state.json'),
      JSON.stringify({
        tasks: { [bad]: { attempts: 'many' }, '../x': { attempts: 0, stopped: 'x' } },
      }),
    )
    const r = fakeRunner({ [bad]: 'readme-ok' })
    await runLoop({ root }, { home, run: r.run, reset: true })
    expect(r.calls).toHaveLength(2)
  })

  test('낮음 10: 보고서에 들어가는 워커 글의 마크다운 문법은 무력화한다', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fxd-')))
    const h = readFileSync(join(FAKE, 'readme-ok', 'handoff.md'), 'utf8')
    const summary = h.split('## 한 줄 요약\n')[1]?.split('\n')[0] ?? ''
    writeFileSync(
      join(dir, 'handoff.md'),
      h.replace(summary, '설치 줄 ![x](http://e.x/a.png) 추가'),
    )
    cpSync(join(FAKE, 'readme-ok', 'files'), join(dir, 'files'), { recursive: true })
    const id = newTask(root, { title: '설치 줄', autonomy: 'L2', verify: 'grep -q 설치 README.md' })
    const report = await runLoop(
      { root },
      { home, run: (x) => runTask({ root }, x, { adapter: 'fake', fixtureDir: dir, home }) },
    )
    // 인박스 절은 코드 울타리 안이라 마크다운으로 그려지지 않는다. 그 앞의 표와 목록만 본다
    const md = readFileSync(report.digest, 'utf8').split('## 인박스')[0] ?? ''
    expect(md).not.toContain('![x](http')
    expect(md).toContain('\\!\\[x\\]')
    expect(report.results[0]?.task).toBe(id)
  })
})
