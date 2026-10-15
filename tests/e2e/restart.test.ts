// TD-006: accept가 충돌이나 verify 실패로 멈춘 작업을 새 메인 위에서 처음부터 다시 하게 한다(contract.md 3절, 9.6절).
import { beforeEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { acceptTask } from '../../src/runtime/accept'
import { restartTask } from '../../src/runtime/restart'
import { fm, handoffFile, makeHome, makeProject, newTask, runFake, sh, taskFile } from './helpers'

// accept가 병합 전에 gitleaks를 부른다(TD-012). CI 리눅스에서 기본 5초를 넘을 수 있어 늘린다
setDefaultTimeout(30_000)

let root: string
let home: string
beforeEach(() => {
  root = makeProject()
  home = makeHome()
})
const accept = (id: string) => acceptTask({ root }, home, id)
const branches = () =>
  sh(['git', 'branch', '--format=%(refname:short)'], root).trim().split('\n').filter(Boolean)

async function conflicted(): Promise<{ a: string; b: string; oldTip: string }> {
  const a = newTask(root, { verify: 'grep -q 설치 README.md' })
  const b = newTask(root, { verify: 'grep -q 설치 README.md' })
  await runFake(root, home, a, 'readme-ok')
  await runFake(root, home, b, 'readme-conflict')
  expect((await accept(a)).status).toBe('accepted')
  expect((await accept(b)).status).toBe('conflict')
  return { a, b, oldTip: sh(['git', 'rev-parse', `gotechy/${b}`], root).trim() }
}

describe('gotechy task restart (TD-006)', () => {
  test('충돌로 멈춘 작업을 새 메인 위에서 다시 돌려 병합할 수 있다', async () => {
    const { b, oldTip } = await conflicted()
    const r = await restartTask({ root }, b)
    expect(r.status).toBe('restarted')
    expect(fm(taskFile(root, b)).status).toBe('ready')
    expect(existsSync(join(root, '.gotechy', 'worktrees', b))).toBe(false)
    expect(existsSync(join(root, '.gotechy', 'worktrees', `${b}.base`))).toBe(false)
    // 옛 작업은 지우지 않고 다른 이름의 브랜치로 남긴다
    expect(branches()).toContain(`gotechy/${b}-try1`)
    expect(sh(['git', 'rev-parse', `gotechy/${b}-try1`], root).trim()).toBe(oldTip)
    expect(branches()).not.toContain(`gotechy/${b}`)
    const again = await runFake(root, home, b, 'readme-conflict')
    expect(again.status).toBe('done')
    expect((await accept(b)).status).toBe('accepted')
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toContain('다른 방법')
  })

  test('두 번째 다시 하기는 try2로 남긴다', async () => {
    const { b } = await conflicted()
    expect((await restartTask({ root }, b)).status).toBe('restarted')
    await runFake(root, home, b, 'readme-ok')
    expect((await restartTask({ root }, b)).status).toBe('restarted')
    expect(branches()).toEqual(expect.arrayContaining([`gotechy/${b}-try1`, `gotechy/${b}-try2`]))
  })

  test('메인의 HANDOFF와 결정 기록은 그대로 두어 다음 실행이 이어 받는다', async () => {
    const { b } = await conflicted()
    const before = readFileSync(handoffFile(root, b), 'utf8')
    await restartTask({ root }, b)
    expect(readFileSync(handoffFile(root, b), 'utf8')).toBe(before)
  })

  test('병합한 작업, 없는 작업, 도는 중인 작업은 다시 하지 않는다', async () => {
    const { a, b } = await conflicted()
    expect((await restartTask({ root }, a)).status).toBe('refused')
    expect((await restartTask({ root }, 'T-099')).status).toBe('refused')
    // 살아 있는 프로세스(이 테스트)가 잠금을 잡고 있다
    const lock = join(root, 'orchestration', 'private', `run-${b}.lock`)
    mkdirSync(lock, { recursive: true })
    writeFileSync(join(lock, 'pid'), String(process.pid))
    const busy = await restartTask({ root }, b)
    expect(busy.status).toBe('refused')
    expect(busy.messages.join('\n')).toContain('실행하고 있어요')
    expect(fm(taskFile(root, b)).status).toBe('needs-decision')
  })

  test('worktree 자리에 등록되지 않은 폴더가 있으면 지우지 않고 멈춘다', async () => {
    const { b } = await conflicted()
    const wt = join(root, '.gotechy', 'worktrees', b)
    sh(['git', 'worktree', 'remove', '--force', wt], root)
    sh(['mkdir', '-p', wt], root)
    writeFileSync(join(wt, 'keep.txt'), 'x')
    const r = await restartTask({ root }, b)
    expect(r.status).toBe('refused')
    expect(readFileSync(join(wt, 'keep.txt'), 'utf8')).toBe('x')
  })

  test('worktree 자리가 링크면 따라가지 않는다(보안 감사 15차 낮음 6)', async () => {
    const { a, b } = await conflicted()
    const wt = join(root, '.gotechy', 'worktrees', b)
    sh(['git', 'worktree', 'remove', '--force', wt], root)
    // 다른 작업의 worktree를 하나 살려 두고 그쪽을 가리키는 링크를 심는다
    const other = join(root, '.gotechy', 'worktrees', 'victim')
    sh(['git', 'worktree', 'add', '-q', '--detach', other], root)
    symlinkSync(other, wt)
    const r = await restartTask({ root }, b)
    expect(r.status).toBe('refused')
    expect(existsSync(join(other, 'README.md'))).toBe(true)
    expect(a).toBeTruthy()
  })

  test('폴더가 없어진 worktree도 등록 항목만 치우고 다시 하게 한다', async () => {
    const { b } = await conflicted()
    const wt = join(root, '.gotechy', 'worktrees', b)
    renameSync(wt, `${wt}-moved`)
    expect((await restartTask({ root }, b)).status).toBe('restarted')
    expect(branches()).toContain(`gotechy/${b}-try1`)
  })

  test('비밀 값으로 멈춘 작업을 다시 하면 남긴 브랜치를 공개하지 말라고 알린다(낮음 7)', async () => {
    const { b } = await conflicted()
    appendFileSync(
      join(root, 'orchestration', 'private', 'events.jsonl'),
      `${JSON.stringify({ type: 'task.accept-held', task: b, reason: 'secret-found' })}\n`,
    )
    const r = await restartTask({ root }, b)
    expect(r.messages.join('\n')).toContain('push하지 말고')
  })
})
