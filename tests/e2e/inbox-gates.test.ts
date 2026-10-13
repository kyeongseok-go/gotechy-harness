// contract.md 9.3절 인박스의 게이트 표시.
import { beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { parseFrontmatter } from '../../src/core/frontmatter'
import { formatInbox } from '../../src/core/inbox'
import type { TaskFrontmatter } from '../../src/core/schema'
import { acceptTask } from '../../src/runtime/accept'
import { decideGate, gateCheck } from '../../src/runtime/gates'
import { loadCards } from '../../src/runtime/inbox'
import { makeHome, makeProject, newTask, runFake, taskFile, yes } from './helpers'

let root: string
let home: string
beforeEach(() => {
  root = makeProject()
  home = makeHome()
})
const inbox = () => formatInbox(loadCards({ root }, root))
const taskOf = (id: string) => {
  const r = parseFrontmatter(readFileSync(taskFile(root, id), 'utf8'), id)
  if (!r.ok) throw new Error('task')
  return r.value.data as unknown as TaskFrontmatter
}

describe('인박스의 게이트 표시', () => {
  test('막는 결정 줄에 게이트 번호와 결정 명령을 붙인다', async () => {
    const id = newTask(root, { title: '캐시 설정', verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'needs-decision')
    const out = inbox()
    expect(out).toContain('  결정 G-001: 캐시 만료를 얼마로 할까요? (추천 5분)\n')
    expect(out).toContain('  결정 G-002: 캐시 키에 사용자 번호를 넣을까요? (추천 넣기)\n')
    expect(out).toContain('  결정하려면: gotechy decide <게이트 번호> <선택>\n')
  })

  test('HANDOFF가 없는 작업의 시작 승인 게이트도 카드로 보여 준다', async () => {
    const id = newTask(root, { title: '배포 스크립트', gate: 'before' })
    gateCheck({ root }, home, taskOf(id))
    expect(inbox()).toBe(
      `결정 필요 1건\n\n[결정 필요] ${id} 배포 스크립트\n  시작 승인 대기 G-001: gotechy decide G-001 진행|중단\n`,
    )
  })

  test('승인 게이트가 열린 done 작업은 결정 필요 묶음으로 올린다', async () => {
    const id = newTask(root, { title: '설치 줄', gate: 'after', verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'readme-ok')
    const out = inbox()
    expect(out).toStartWith('결정 필요 1건\n\n[결정 필요]')
    expect(out).toContain('  승인 대기 G-001: gotechy decide G-001 승인|다시\n')
  })

  test('accepted 작업은 인박스에서 빠진다', async () => {
    const id = newTask(root, { gate: 'after', verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'readme-ok')
    await decideGate({ root }, home, 'G-001', { choice: '승인', confirm: yes })
    expect((await acceptTask({ root }, home, id)).status).toBe('accepted')
    expect(inbox()).toBe('대기 중인 일 없음\n')
  })

  test('은행에 없는 새 용어를 카드에 보여 준다', async () => {
    const id = newTask(root, { verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'new-term')
    expect(inbox()).toContain('  새 용어: frobnicate\n')
  })
})
