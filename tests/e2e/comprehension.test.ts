// contract.md 9.1, 9.2절 이해 게이트와 측정의 수용 테스트(Validation 10).
import { beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatInbox } from '../../src/core/inbox'
import { decideGate, listGates } from '../../src/runtime/gates'
import { loadCards, renderViews } from '../../src/runtime/inbox'
import { gateFile, makeHome, makeProject, newTask, runFake, yes } from './helpers'

let root: string
let home: string
beforeEach(() => {
  root = makeProject()
  home = makeHome()
})

async function authTask() {
  // 명세의 irreversible은 false지만 경로(src/auth/)가 규칙에 걸린다
  const id = newTask(root, { ownership: ['src/auth/'], verify: 'test -f src/auth/login.ts' })
  expect((await runFake(root, home, id, 'auth-decision')).status).toBe('needs-decision')
  return id
}
const ANSWERS = ['비밀번호를 그대로 두면 유출 때 바로 쓰여요. 해시와 SALT를 써요', '']

describe('이해 게이트', () => {
  test('경로 규칙에 걸린 작업의 게이트는 되돌리기 어려운 결정이 된다', async () => {
    await authTask()
    expect(listGates({ root })[0]?.irreversible).toBe(true)
  })

  test('이해 문항에 답하지 않으면 결정이 기록되지 않는다', async () => {
    await authTask()
    await expect(
      decideGate({ root }, home, 'G-001', { choice: 'argon2', confirm: yes }),
    ).rejects.toThrow('이해 문항')
    expect(listGates({ root })[0]?.status).toBe('pending')
  })

  test('답마다 핵심어 적중을 세고, 빈 답은 0으로 기록한다', async () => {
    await authTask()
    const asked: string[] = []
    await decideGate({ root }, home, 'G-001', {
      choice: 'argon2',
      confirm: yes,
      answer: async (q) => {
        asked.push(q)
        return ANSWERS[asked.length - 1] ?? ''
      },
    })
    expect(asked).toEqual([
      '비밀번호를 그대로 저장하면 왜 위험한가요?',
      '로그인 상태는 어디에 두나요?',
    ])
    const rows = readFileSync(join(root, 'orchestration', 'private', 'comprehension.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
    expect(rows.map((r) => r.hits)).toEqual([2, 0])
    expect(listGates({ root })[0]?.comprehension).toEqual({ questions: 2, hits: 2, keys: 3 })
  })

  test('답과 핵심어는 private 밖(게이트, 이벤트 로그, 인박스, 화면)에 나타나지 않는다', async () => {
    const id = await authTask()
    await decideGate({ root }, home, 'G-001', {
      choice: 'argon2',
      confirm: yes,
      answer: async () => ANSWERS[0] as string,
    })
    const outside = [
      readFileSync(gateFile(root, 'G-001'), 'utf8'),
      readFileSync(join(root, 'orchestration', 'private', 'events.jsonl'), 'utf8'),
      formatInbox(loadCards({ root }, root)),
      readFileSync(renderViews({ root }, root).pages.get(id) as string, 'utf8'),
    ]
    for (const text of outside) {
      expect(text).not.toContain('유출 때')
      expect(text).not.toContain('salt')
      expect(text).not.toContain('SALT')
    }
  })

  test('되돌리기 쉬운 결정은 이해 문항을 묻지 않는다', async () => {
    const id = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'needs-decision')
    let asked = 0
    await decideGate({ root }, home, 'G-001', {
      choice: '5분',
      confirm: yes,
      answer: async () => {
        asked++
        return ''
      },
    })
    expect(asked).toBe(0)
  })
})

describe('측정 (9.2절)', () => {
  test('인박스가 처음 보여 준 시각이 opened_at이 되고, 다시 보여 줘도 바뀌지 않는다', async () => {
    const id = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'needs-decision')
    loadCards({ root }, root, { recordShown: true })
    const first = readFileSync(join(root, 'orchestration', 'private', 'events.jsonl'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('"gate.shown"'))
    expect(first).toHaveLength(2)
    loadCards({ root }, root, { recordShown: true })
    const again = readFileSync(join(root, 'orchestration', 'private', 'events.jsonl'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('"gate.shown"'))
    expect(again).toHaveLength(2)
    const shownAt = JSON.parse(first[0] as string).at
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    expect(listGates({ root })[0]?.opened_at).toBe(shownAt)
  })
})
