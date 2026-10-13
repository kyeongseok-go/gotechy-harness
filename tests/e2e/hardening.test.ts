// 보안 감사(2026-10-14 밤) 지적의 재현 테스트. 공격을 실제로 시도하고 막혔는지 본다.
import { beforeEach, describe, expect, test } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseFrontmatter } from '../../src/core/frontmatter'
import { lintHandoff } from '../../src/core/lint-handoff'
import type { TaskFrontmatter } from '../../src/core/schema'
import { acceptTask } from '../../src/runtime/accept'
import { decideGate, gateCheck, listGates, verifyGates } from '../../src/runtime/gates'
import { runTask } from '../../src/runtime/run'
import {
  FAKE,
  fm,
  gateFile,
  handoffFile,
  makeHome,
  makeProject,
  newTask,
  runFake,
  taskFile,
  yes,
} from './helpers'

let root: string
let home: string
beforeEach(() => {
  root = makeProject()
  home = makeHome()
})

/** 테스트마다 절대 경로가 다른 공격 fixture를 만든다. */
function fixture(
  files: Record<string, string>,
  opts: { handoff?: string; symlinks?: unknown[] } = {},
) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fx-')))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, 'files', rel)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content)
  }
  if (opts.handoff !== undefined) writeFileSync(join(dir, 'handoff.md'), opts.handoff)
  if (opts.symlinks) writeFileSync(join(dir, 'symlinks.json'), JSON.stringify(opts.symlinks))
  return dir
}
const okHandoff = readFileSync(join(FAKE, 'readme-ok', 'handoff.md'), 'utf8')
const run = (id: string, fixtureDir: string) =>
  runTask({ root }, id, { adapter: 'fake', fixtureDir, home })
const taskOf = (id: string) => {
  const r = parseFrontmatter(readFileSync(taskFile(root, id), 'utf8'), id)
  if (!r.ok) throw new Error('task')
  return r.value.data as unknown as TaskFrontmatter
}

describe('높음 1: verify는 샌드박스 안에서 워커 코드를 실행한다', () => {
  test.skipIf(process.platform !== 'darwin')(
    'verify가 실행한 워커 스크립트는 키를 읽거나 메인의 게이트를 쓰지 못한다',
    async () => {
      const keyDir = join(home, 'keys')
      // 키를 읽으면 9로, 끝까지 막히면 3으로 끝난다. verify의 부산물은 리드가 지우므로 종료 코드로 판정한다
      const evil = [
        '#!/bin/sh',
        `cat ${keyDir}/*.key >/dev/null 2>&1 && exit 9`,
        `echo forged > ${join(root, 'orchestration', 'gates', 'G-999.md')} 2>/dev/null`,
        `echo poisoned >> ${join(root, 'orchestration', 'private', 'decisions.jsonl')} 2>/dev/null`,
        'exit 3',
      ].join('\n')
      const id = newTask(root, { ownership: ['evil.sh'], verify: 'sh evil.sh' })
      await run(id, fixture({ 'evil.sh': evil }, { handoff: okHandoff }))
      expect((fm(handoffFile(root, id)).verified as { exit_code: number }).exit_code).toBe(3)
      expect(existsSync(join(root, 'orchestration', 'gates', 'G-999.md'))).toBe(false)
      const ledger = join(root, 'orchestration', 'private', 'decisions.jsonl')
      expect(existsSync(ledger) ? readFileSync(ledger, 'utf8') : '').not.toContain('poisoned')
    },
  )
})

describe('높음 2: 심볼릭 링크로 리드의 쓰기를 다른 파일로 돌리지 못한다', () => {
  test('HANDOFF 자리에 링크를 두면 따라가지 않고 failed로 처리한다', async () => {
    const victim = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, victim, 'needs-decision')
    const before = readFileSync(gateFile(root, 'G-001'), 'utf8')
    const id = newTask(root, { verify: 'true' })
    const out = await run(
      id,
      fixture(
        {},
        {
          symlinks: [
            { path: 'orchestration/handoffs/{{TASK}}.md', target: gateFile(root, 'G-001') },
          ],
        },
      ),
    )
    expect(out.status).toBe('failed')
    expect(readFileSync(gateFile(root, 'G-001'), 'utf8')).toBe(before)
    expect(String(fm(handoffFile(root, id)).lead_note)).toContain('심볼릭 링크')
  })

  test('ownership 안의 파일이라도 심볼릭 링크로 바꾸면 되돌리고 failed로 처리한다', async () => {
    const id = newTask(root, { ownership: ['README.md'], verify: 'true' })
    const out = await run(
      id,
      fixture({}, { handoff: okHandoff, symlinks: [{ path: 'README.md', target: '/etc/hosts' }] }),
    )
    expect(out.status).toBe('failed')
    expect(String(fm(handoffFile(root, id)).lead_note)).toContain('README.md')
  })
})

describe('높음 3: 필요한 게이트는 원천(HANDOFF, 작업 명세)에서 정한다', () => {
  test('막는 결정의 게이트 파일을 지우면 다시 열고 멈춘다', async () => {
    const id = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'needs-decision')
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    await decideGate({ root }, home, 'G-002', { choice: '넣기', confirm: yes })
    rmSync(gateFile(root, 'G-002'))
    const check = gateCheck({ root }, home, taskOf(id))
    expect(check.blockers.join('\n')).toContain('캐시 키에 사용자 번호를 넣을까요?')
    expect(
      listGates({ root }).some((g) => g.question.startsWith('캐시 키') && g.status === 'pending'),
    ).toBe(true)
  })

  test('게이트의 handoff_rev를 낮춰 지난 판본인 척해도 통과하지 못한다', async () => {
    const id = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'needs-decision')
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    const f = gateFile(root, 'G-002')
    writeFileSync(f, readFileSync(f, 'utf8').replace('handoff_rev: 1', 'handoff_rev: 0'))
    expect(gateCheck({ root }, home, taskOf(id)).blockers.length).toBeGreaterThan(0)
  })

  test('결정한 게이트의 handoff_rev나 irreversible을 고치면 서명이 깨진다', async () => {
    const id = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'needs-decision')
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    const f = gateFile(root, 'G-001')
    const original = readFileSync(f, 'utf8')
    writeFileSync(f, original.replace('irreversible: false', 'irreversible: true'))
    expect(verifyGates({ root }, home, ['G-001'])[0]?.status).toBe('fail')
  })

  test('읽을 수 없는 게이트 파일이 있으면 run과 accept를 막는다', async () => {
    const a = newTask(root, { ownership: ['a.txt'], verify: 'test -f a.txt' })
    await runFake(root, home, a, 'write-a')
    writeFileSync(join(root, 'orchestration', 'gates', 'G-050.md'), '---\nid: [깨짐\n---\n')
    const acc = await acceptTask({ root }, home, a)
    expect(acc.status).toBe('rejected')
    expect(acc.messages.join('\n')).toContain('G-050')
    const b = newTask(root, { ownership: ['b.txt'], verify: 'test -f b.txt' })
    expect((await runFake(root, home, b, 'write-b')).status).toBe('blocked')
  })

  test('gate: after 작업의 승인 게이트 파일을 지워도 accept는 거부한다', async () => {
    const id = newTask(root, { gate: 'after', verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'readme-ok')
    rmSync(gateFile(root, 'G-001'))
    const out = await acceptTask({ root }, home, id)
    expect(out.status).toBe('rejected')
  })

  test('되돌리기 어려운 작업은 게이트의 irreversible을 끄더라도 이해 문항을 묻는다', async () => {
    const id = newTask(root, { ownership: ['src/auth/'], verify: 'test -f src/auth/login.ts' })
    await runFake(root, home, id, 'auth-decision')
    const f = gateFile(root, 'G-001')
    writeFileSync(f, readFileSync(f, 'utf8').replace('irreversible: true', 'irreversible: false'))
    await expect(
      decideGate({ root }, home, 'G-001', { choice: 'argon2', confirm: yes }),
    ).rejects.toThrow('이해 문항')
  })
})

describe('중간 4: 번호 파일이 옛 값으로 돌아가도 기존 게이트를 덮어쓰지 않는다', () => {
  test('.gate-seq가 되감겨도 다음 번호는 실제 파일보다 크다', async () => {
    const a = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, a, 'needs-decision')
    const g1 = readFileSync(gateFile(root, 'G-001'), 'utf8')
    writeFileSync(join(root, 'orchestration', '.gate-seq'), '0\n')
    const b = newTask(root, { gate: 'before' })
    gateCheck({ root }, home, taskOf(b))
    expect(readFileSync(gateFile(root, 'G-001'), 'utf8')).toBe(g1)
    expect(existsSync(gateFile(root, 'G-003'))).toBe(true)
  })
})

describe('중간 6: 제어 문자', () => {
  test('HANDOFF에 터미널 제어 문자가 있으면 lint 오류다', () => {
    const esc = String.fromCodePoint(0x1b)
    const text = okHandoff
      .replace('{{TASK}}', 'T-001')
      .replace('README에 설치 방법 한 줄을 추가했어요.', `요약${esc}[2K이에요.`)
    const rules = lintHandoff(text, 'h.md').issues.map((i) => i.rule)
    expect(rules).toContain('handoff-control-char')
  })
})

describe('낮음', () => {
  test('결정 장부의 한 줄이 깨져도 예외로 멈추지 않고 실패로 판정한다', async () => {
    const id = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'needs-decision')
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    writeFileSync(join(root, 'orchestration', 'private', 'decisions.jsonl'), '{깨진 줄\n', {
      flag: 'a',
    })
    const v = verifyGates({ root }, home, ['G-001'])[0]
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('장부')
  })

  test('keys/active에 형식 밖의 값이 있으면 키를 쓰지 않는다', async () => {
    writeFileSync(join(home, 'keys', 'active'), '../../etc/passwd\n')
    chmodSync(join(home, 'keys', 'active'), 0o600)
    const id = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'needs-decision')
    await expect(
      decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes }),
    ).rejects.toThrow('키 id')
  })
})
