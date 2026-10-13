// contract.md 6절 게이트와 결정 서명의 수용 테스트(Validation 8, 9, 11). 임시 저장소와 임시 GOTECHY_HOME에서 돈다.
import { beforeEach, describe, expect, test } from 'bun:test'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseFrontmatter } from '../../src/core/frontmatter'
import { acceptTask } from '../../src/runtime/accept'
import { decideGate, listGates, verifyGates } from '../../src/runtime/gates'
import { initProject } from '../../src/runtime/init'
import { initKey, rotateKey } from '../../src/runtime/keys'
import { runTask } from '../../src/runtime/run'
import { createTask, type NewTaskInput } from '../../src/runtime/task-new'

const FIX = join(import.meta.dir, '..', 'fixtures', 'fake')
const CLI = join(import.meta.dir, '..', '..', 'src', 'cli.ts')
const sh = (cmd: string[], cwd: string) => {
  const r = Bun.spawnSync({ cmd, cwd, stdout: 'pipe', stderr: 'pipe' })
  if (r.exitCode !== 0) throw new Error(`${cmd.join(' ')}: ${r.stderr.toString()}`)
  return r.stdout.toString()
}
const fm = (file: string) => {
  const r = parseFrontmatter(readFileSync(file, 'utf8'), file)
  if (!r.ok) throw new Error(`frontmatter 읽기 실패: ${file}`)
  return r.value.data
}
const yes = async () => true

function makeProject(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-gate-')))
  sh(['git', 'init', '-q', '-b', 'main'], root)
  writeFileSync(join(root, 'README.md'), '# Sandbox\n')
  initProject(root, ['owner'], { hooks: false })
  sh(['git', 'add', '-A'], root)
  sh(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init'], root)
  return root
}

let root: string
let home: string
beforeEach(() => {
  root = makeProject()
  home = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-home-')))
  initKey(home)
})

const task = (over: Partial<NewTaskInput> = {}, r = root) =>
  createTask(
    { root: r },
    { title: '캐시 설정', verify: 'grep -q 설치 README.md', ownership: ['README.md'], ...over },
  ).id
const run = (id: string, fixture: string, r = root) =>
  runTask({ root: r }, id, { adapter: 'fake', fixtureDir: join(FIX, fixture), home })
const gateFile = (id: string, r = root) => join(r, 'orchestration', 'gates', `${id}.md`)
const verdict = (id: string, r = root) =>
  verifyGates({ root: r }, home).find((v) => v.id === id) ?? { status: 'missing', reasons: [] }

async function decidedTask(r = root) {
  const id = task({}, r)
  expect((await run(id, 'needs-decision', r)).status).toBe('needs-decision')
  await decideGate({ root: r }, home, 'G-001', { choice: '5분', confirm: yes })
  return id
}

describe('게이트 열기', () => {
  test('막는 결정이 있는 HANDOFF는 막는 결정마다 게이트를 연다', async () => {
    const id = task()
    await run(id, 'needs-decision')
    const gates = listGates({ root })
    expect(gates.map((g) => [g.id, g.class, g.status, g.handoff_rev])).toEqual([
      ['G-001', 'decision', 'pending', 1],
      ['G-002', 'decision', 'pending', 1],
    ])
    expect(gates[0]?.options).toEqual(['5분', '1분'])
    expect(gates[0]?.recommended).toBe('5분')
    expect(gates[0]?.task).toBe(id)
  })

  test('gate: before 작업은 결정 전에 시작하지 않고 진행, 중단 게이트를 연다', async () => {
    const id = task({ gate: 'before' })
    const out = await run(id, 'readme-ok')
    expect(out.status).toBe('blocked')
    expect(out.messages.join('\n')).toContain('gotechy decide G-001')
    const [g] = listGates({ root })
    expect([g?.class, g?.options]).toEqual(['approval-before', ['진행', '중단']])
    expect((await run(id, 'readme-ok')).status).toBe('blocked')
    expect(listGates({ root })).toHaveLength(1)
  })

  test('진행을 고르면 시작하고, 중단을 고르면 시작하지 않는다', async () => {
    const a = task({ gate: 'before' })
    await run(a, 'readme-ok')
    await decideGate({ root }, home, 'G-001', { choice: '진행', confirm: yes })
    expect((await run(a, 'readme-ok')).status).toBe('done')

    const b = task({ gate: 'before' })
    await run(b, 'readme-ok')
    await decideGate({ root }, home, 'G-002', { choice: '중단', confirm: yes })
    expect((await run(b, 'readme-ok')).status).toBe('blocked')
  })

  test('gate: after 작업이 done이면 승인, 다시 게이트를 연다', async () => {
    const id = task({ gate: 'after' })
    expect((await run(id, 'readme-ok')).status).toBe('done')
    const [g] = listGates({ root })
    expect([g?.class, g?.options, g?.handoff_rev]).toEqual(['approval-after', ['승인', '다시'], 1])
  })
})

describe('decide', () => {
  test('결정한 게이트는 verify를 통과하고, 막는 결정이 모두 닫히면 작업은 ready가 된다', async () => {
    const id = await decidedTask()
    expect(verdict('G-001').status).toBe('ok')
    expect(fm(join(root, 'orchestration', 'tasks', `${id}.md`)).status).toBe('needs-decision')
    await decideGate({ root }, home, 'G-002', {
      choice: '넣기',
      instruction: '키는 해시로',
      confirm: yes,
    })
    expect(fm(join(root, 'orchestration', 'tasks', `${id}.md`)).status).toBe('ready')
    const g = fm(gateFile('G-002'))
    expect([g.status, g.resolution, g.instruction]).toEqual(['resolved', '넣기', '키는 해시로'])
    expect(typeof g.sig).toBe('string')
  })

  test('게이트 번호 형식이 아니면 경로로 쓰기 전에 거부한다', async () => {
    const id = task()
    await expect(
      decideGate({ root }, home, `../tasks/${id}`, { choice: '5분', confirm: yes }),
    ).rejects.toThrow('게이트 번호')
    expect(existsSync(join(root, 'orchestration', 'tasks', `${id}.md.lock`))).toBe(false)
  })

  test('선택지에 없는 선택은 거부한다', async () => {
    const id = task()
    await run(id, 'needs-decision')
    await expect(
      decideGate({ root }, home, 'G-001', { choice: '10분', confirm: yes }),
    ).rejects.toThrow('5분, 1분')
    expect(fm(gateFile('G-001')).status).toBe('pending')
  })

  test('확인 질문에 y가 아니면 기록하지 않는다', async () => {
    await run(task(), 'needs-decision')
    await expect(
      decideGate({ root }, home, 'G-001', { choice: '5분', confirm: async () => false }),
    ).rejects.toThrow('취소')
    expect(fm(gateFile('G-001')).status).toBe('pending')
  })

  test('같은 게이트에 동시에 decide하면 하나만 기록된다', async () => {
    await run(task(), 'needs-decision')
    let release: (v: boolean) => void = () => {}
    const slow = () => new Promise<boolean>((r) => (release = r))
    const first = decideGate({ root }, home, 'G-001', { choice: '5분', confirm: slow })
    const second = decideGate({ root }, home, 'G-001', { choice: '1분', confirm: yes })
    await expect(second).rejects.toThrow('잠금')
    release(true)
    await first
    expect(fm(gateFile('G-001')).resolution).toBe('5분')
  })

  test('검증을 통과한 게이트는 다시 결정할 수 없다', async () => {
    await decidedTask()
    await expect(
      decideGate({ root }, home, 'G-001', { choice: '1분', confirm: yes }),
    ).rejects.toThrow('이미')
  })

  test('키 파일 권한이 넓으면 서명을 거부한다', async () => {
    await run(task(), 'needs-decision')
    const active = readFileSync(join(home, 'keys', 'active'), 'utf8').trim()
    chmodSync(join(home, 'keys', `${active}.key`), 0o644)
    await expect(
      decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes }),
    ).rejects.toThrow('권한')
  })
})

describe('gate verify가 거부하는 것 (Validation 8, 11)', () => {
  test('결정 파일을 손으로 고치면 실패한다', async () => {
    await decidedTask()
    const f = gateFile('G-001')
    writeFileSync(f, readFileSync(f, 'utf8').replace('resolution: 5분', 'resolution: 1분'))
    const v = verdict('G-001')
    expect(v.status).toBe('fail')
    expect(v.reasons.join(' ')).toContain('서명')
  })

  test('결정 뒤에 질문을 고치면 실패한다', async () => {
    await decidedTask()
    const f = gateFile('G-001')
    writeFileSync(f, readFileSync(f, 'utf8').replace('얼마로 할까요?', '10분으로 할까요?'))
    expect(verdict('G-001').status).toBe('fail')
  })

  test('같은 판본의 HANDOFF 내용을 바꾸면 실패한다', async () => {
    const id = await decidedTask()
    const h = join(root, 'orchestration', 'handoffs', `${id}.md`)
    writeFileSync(h, readFileSync(h, 'utf8').replace('넣고 캐시', '넣고 몰래 캐시'))
    const v = verdict('G-001')
    expect(v.status).toBe('fail')
    expect(v.reasons.join(' ')).toContain('HANDOFF')
  })

  test('작업 명세를 바꾸면 실패하고, 상태만 바뀐 것은 괜찮다', async () => {
    const id = await decidedTask()
    const t = join(root, 'orchestration', 'tasks', `${id}.md`)
    writeFileSync(t, readFileSync(t, 'utf8').replace('status: needs-decision', 'status: ready'))
    expect(verdict('G-001').status).toBe('ok')
    writeFileSync(t, readFileSync(t, 'utf8').replace('grep -q 설치', 'grep -q 제거'))
    const v = verdict('G-001')
    expect(v.status).toBe('fail')
    expect(v.reasons.join(' ')).toContain('작업 명세')
  })

  test('다른 프로젝트의 결정 파일을 가져오면 실패한다', async () => {
    await decidedTask()
    const other = makeProject()
    await decidedTask(other)
    copyFileSync(gateFile('G-001', other), gateFile('G-001'))
    const v = verdict('G-001')
    expect(v.status).toBe('fail')
    expect(v.reasons.join(' ')).toContain('프로젝트')
  })

  test('다른 게이트의 nonce를 다시 쓰면 실패한다', async () => {
    await decidedTask()
    const used = String(fm(gateFile('G-001')).nonce)
    await decideGate({ root }, home, 'G-002', { choice: '넣기', confirm: yes, nonce: used })
    const v = verdict('G-002')
    expect(v.status).toBe('fail')
    expect(v.reasons.join(' ')).toContain('nonce')
  })

  test('같은 키로 서명한 옛 결정을 되살리면 서명이 맞아도 실패한다', async () => {
    const id = await decidedTask()
    const old = readFileSync(gateFile('G-001'), 'utf8')
    const t = join(root, 'orchestration', 'tasks', `${id}.md`)
    const spec = readFileSync(t, 'utf8')
    writeFileSync(t, spec.replace('grep -q 설치', 'grep -q 제거'))
    await decideGate({ root }, home, 'G-001', { choice: '1분', confirm: yes })
    writeFileSync(t, spec)
    writeFileSync(gateFile('G-001'), old)
    const v = verdict('G-001')
    expect(v.status).toBe('fail')
    expect(v.reasons).toHaveLength(1)
    expect(v.reasons[0]).toContain('nonce')
  })

  test('keys rotate 뒤 이전 키로 서명한 결정은 실패하고, 다시 결정하면 통과한다', async () => {
    await decidedTask()
    const old = readFileSync(gateFile('G-001'), 'utf8')
    rotateKey(home)
    const v = verdict('G-001')
    expect(v.status).toBe('fail')
    expect(v.reasons.join(' ')).toContain('키')
    await decideGate({ root }, home, 'G-001', { choice: '1분', confirm: yes })
    expect(verdict('G-001').status).toBe('ok')
    writeFileSync(gateFile('G-001'), old)
    expect(verdict('G-001').status).toBe('fail')
  })

  test('HANDOFF 판본이 올라가면 지난 판본의 게이트는 superseded다', async () => {
    const id = await decidedTask()
    await decideGate({ root }, home, 'G-002', { choice: '넣기', confirm: yes })
    expect((await run(id, 'readme-ok')).status).toBe('done')
    expect(verdict('G-001').status).toBe('superseded')
  })
})

describe('run의 강제 (Validation 9)', () => {
  test('검증에 실패하는 게이트가 걸린 작업은 다시 실행하지 않는다', async () => {
    const id = await decidedTask()
    await decideGate({ root }, home, 'G-002', { choice: '넣기', confirm: yes })
    const f = gateFile('G-002')
    writeFileSync(f, readFileSync(f, 'utf8').replace('resolution: 넣기', 'resolution: 빼기'))
    const out = await run(id, 'readme-ok')
    expect(out.status).toBe('blocked')
    expect(out.messages.join('\n')).toContain('G-002')
  })

  test('선행 작업에 열린 게이트가 있으면 시작하지 않는다', async () => {
    const a = task({ gate: 'after' })
    expect((await run(a, 'readme-ok')).status).toBe('done')
    const b = task({ deps: [a] })
    const out = await run(b, 'readme-ok')
    expect(out.status).toBe('blocked')
    expect(out.messages.join('\n')).toContain('G-001')
    await decideGate({ root }, home, 'G-001', { choice: '승인', confirm: yes })
    expect((await acceptTask({ root }, home, a)).status).toBe('accepted')
    expect((await run(b, 'readme-ok')).status).toBe('done')
  })
})

describe('CLI', () => {
  const cli = (args: string[]) => {
    const r = Bun.spawnSync({
      cmd: [process.execPath, CLI, ...args],
      cwd: root,
      env: { ...process.env, GOTECHY_HOME: home },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() }
  }

  test('decide는 대화형 터미널이 아니면 거부한다', async () => {
    await run(task(), 'needs-decision')
    const r = cli(['decide', 'G-001', '5분'])
    expect(r.code).toBe(2)
    expect(r.err).toContain('대화형 터미널')
    expect(fm(gateFile('G-001')).status).toBe('pending')
  })

  test('gate verify는 실패한 게이트가 있으면 exit 1이고 사유를 알려 준다', async () => {
    await decidedTask()
    expect(cli(['gate', 'verify']).code).toBe(0)
    const f = gateFile('G-001')
    writeFileSync(f, readFileSync(f, 'utf8').replace('resolution: 5분', 'resolution: 1분'))
    const r = cli(['gate', 'verify'])
    expect(r.code).toBe(1)
    expect(r.out).toContain('G-001 fail')
  })

  test('run이 게이트 때문에 멈추면 exit 1이다', async () => {
    const id = task({ gate: 'before' })
    const r = cli(['run', id, '--adapter', 'fake', '--fixture', join(FIX, 'readme-ok')])
    expect(r.code).toBe(1)
    expect(r.out).toContain('gotechy decide G-001')
  })
})
