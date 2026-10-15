// contract.md 9.4, 9.5절 accept와 용어 누적의 수용 테스트(Validation 11b).
import { beforeEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { acceptTask } from '../../src/runtime/accept'
import { decideGate } from '../../src/runtime/gates'
import {
  fm,
  handoffFile,
  makeHome,
  makeProject,
  newTask,
  runFake,
  sh,
  taskFile,
  yes,
} from './helpers'

// accept가 병합 전에 gitleaks를 부른다(TD-012). CI 리눅스에서 기본 5초를 넘을 수 있어 늘린다
setDefaultTimeout(30_000)

let root: string
let home: string
beforeEach(() => {
  root = makeProject()
  home = makeHome()
})
const accept = (id: string) => acceptTask({ root }, home, id)

describe('accept', () => {
  test('서로 다른 파일을 바꾼 두 작업은 차례로 병합되고 accepted가 된다', async () => {
    const a = newTask(root, { ownership: ['a.txt'], verify: 'test -f a.txt' })
    const b = newTask(root, { ownership: ['b.txt'], verify: 'test -f b.txt' })
    expect((await runFake(root, home, a, 'write-a')).status).toBe('done')
    expect((await runFake(root, home, b, 'write-b')).status).toBe('done')
    expect((await accept(a)).status).toBe('accepted')
    expect((await accept(b)).status).toBe('accepted')
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('A\n')
    expect(readFileSync(join(root, 'b.txt'), 'utf8')).toBe('B\n')
    expect([fm(taskFile(root, a)).status, fm(taskFile(root, b)).status]).toEqual([
      'accepted',
      'accepted',
    ])
    expect(existsSync(join(root, '.gotechy', 'worktrees', a))).toBe(false)
    expect(sh(['git', 'worktree', 'list'], root).trim().split('\n')).toHaveLength(1)
  })

  test('병합 커밋에는 워커가 바꾼 파일만 들어가고 orchestration 기록은 들어가지 않는다', async () => {
    const a = newTask(root, { ownership: ['a.txt'], verify: 'test -f a.txt' })
    await runFake(root, home, a, 'write-a')
    await accept(a)
    const files = sh(['git', 'diff', '--name-only', 'HEAD^1', 'HEAD'], root).trim().split('\n')
    expect(files).toEqual(['a.txt'])
  })

  test('같은 줄을 바꾼 두 번째 작업은 충돌로 병합이 취소되고 needs-decision이 된다', async () => {
    const a = newTask(root, { verify: 'grep -q 설치 README.md' })
    const b = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, a, 'readme-ok')
    await runFake(root, home, b, 'readme-conflict')
    expect((await accept(a)).status).toBe('accepted')
    const before = sh(['git', 'rev-parse', 'HEAD'], root)
    const out = await accept(b)
    expect(out.status).toBe('conflict')
    expect(sh(['git', 'rev-parse', 'HEAD'], root)).toBe(before)
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toContain('bin/gotechy setup')
    expect(fm(taskFile(root, b)).status).toBe('needs-decision')
    expect(String(fm(handoffFile(root, b)).lead_note)).toContain('충돌')
    expect(sh(['git', 'worktree', 'list'], root).trim().split('\n')).toHaveLength(2)
  })

  test('병합한 결과에서 verify가 실패하면 메인에 반영하지 않는다', async () => {
    const b = newTask(root, { ownership: ['b.txt'], verify: 'test -f b.txt' })
    const c = newTask(root, { ownership: ['c.txt'], verify: 'test -f c.txt && test ! -f b.txt' })
    await runFake(root, home, b, 'write-b')
    expect((await runFake(root, home, c, 'write-c')).status).toBe('done')
    await accept(b)
    const out = await accept(c)
    expect(out.status).toBe('verify-failed')
    expect(existsSync(join(root, 'c.txt'))).toBe(false)
    expect(fm(taskFile(root, c)).status).toBe('needs-decision')
    expect(String(fm(handoffFile(root, c)).lead_note)).toContain('verify')
  })

  test('done이 아니거나 승인 게이트가 닫히지 않았으면 거부한다', async () => {
    const f = newTask(root, { verify: 'false' })
    expect((await runFake(root, home, f, 'readme-ok')).status).toBe('failed')
    expect((await accept(f)).status).toBe('rejected')

    const g = newTask(root, { gate: 'after', verify: 'grep -q 설치 README.md' })
    await runFake(root, home, g, 'readme-ok')
    const pending = await accept(g)
    expect(pending.status).toBe('rejected')
    expect(pending.messages.join('\n')).toContain('G-001')
    await decideGate({ root }, home, 'G-001', { choice: '승인', confirm: yes })
    expect((await accept(g)).status).toBe('accepted')
  })

  test('다시를 고른 작업은 병합하지 않는다', async () => {
    const g = newTask(root, { gate: 'after', verify: 'grep -q 설치 README.md' })
    await runFake(root, home, g, 'readme-ok')
    await decideGate({ root }, home, 'G-001', { choice: '다시', confirm: yes })
    expect((await accept(g)).status).toBe('rejected')
  })

  test('선행 작업은 accept돼야 뒤 작업이 시작한다', async () => {
    const a = newTask(root, { ownership: ['a.txt'], verify: 'test -f a.txt' })
    const b = newTask(root, {
      deps: [a],
      ownership: ['b.txt'],
      verify: 'test -f a.txt && test -f b.txt',
    })
    await runFake(root, home, a, 'write-a')
    const blocked = await runFake(root, home, b, 'write-b')
    expect(blocked.status).toBe('blocked')
    expect(blocked.messages.join('\n')).toContain(`gotechy accept ${a}`)
    await accept(a)
    expect((await runFake(root, home, b, 'write-b')).status).toBe('done')
  })
})

describe('용어 누적 (9.5절)', () => {
  test('accept한 작업의 새 용어 중 은행에 없는 것만 프로젝트 은행에 쌓인다', async () => {
    const t = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, t, 'new-term')
    await accept(t)
    const lines = readFileSync(join(root, 'orchestration', 'terms.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
    expect(lines).toEqual([{ term: 'frobnicate', easy: '테스트용 가짜 용어예요.', src: t }])
  })
})
