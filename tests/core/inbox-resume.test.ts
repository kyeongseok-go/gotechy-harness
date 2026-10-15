// contract.md 8.1절 "다시 실행 대기" 묶음(TD-022). 막는 결정을 모두 결정한 작업이 "결정 필요"로 보여
// 오너가 결정 버튼 없는 화면에서 헤맸다(2026-10-15 Touch ID 확인).
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Gate } from '../../src/core/gate'
import { attachGates, buildCard, formatInbox } from '../../src/core/inbox'
import { renderInboxPage } from '../../src/core/view/pages'

const FIXTURE = join(import.meta.dir, '..', 'fixtures', 'fake', 'needs-decision', 'handoff.md')
const text = readFileSync(FIXTURE, 'utf8').replace('"{{TASK}}"', 'T-001')
const Q1 = '캐시 만료를 얼마로 할까요?'
const Q2 = '캐시 키에 사용자 번호를 넣을까요?'

const gate = (over: Partial<Gate> & { id: string; question: string }) =>
  ({
    task: 'T-001',
    class: 'decision',
    status: 'pending',
    options: ['a', 'b'],
    recommended: null,
    handoff_rev: null,
    irreversible: false,
    resolution: null,
    ...over,
  }) as unknown as Gate

const card = (gates: Gate[], id = 'T-001') =>
  attachGates(
    buildCard({ id, file: `h-${id}.md`, text, title: '캐시 작업' }),
    gates.map((g) => ({ ...g, task: id })),
  )

const decided = [
  gate({ id: 'G-001', question: Q1, status: 'resolved', resolution: '5분' }),
  gate({ id: 'G-002', question: Q2, status: 'resolved', resolution: '넣기' }),
]

describe('다시 실행 대기 (TD-022)', () => {
  test('막는 결정의 게이트가 모두 결정되면 결정 필요가 아니라 다시 실행 대기로 보이고 다음 명령을 알려 준다', () => {
    const out = formatInbox([card(decided)])
    expect(out.split('\n')[0]).toBe('다시 실행 대기 1건')
    expect(out).toContain('[다시 실행 대기] T-001 캐시 작업')
    expect(out).toContain('결정 G-001: 캐시 만료를 얼마로 할까요? (결정함 5분)')
    expect(out).toContain('다음: gotechy run T-001')
    expect(out).not.toContain('[결정 필요]')
    expect(out).not.toContain('결정하려면')
  })

  test('하나라도 아직 결정하지 않았으면 결정 필요에 남는다', () => {
    const one = [decided[0] as Gate, gate({ id: 'G-002', question: Q2 })]
    const out = formatInbox([card(one)])
    expect(out).toContain('[결정 필요] T-001')
    expect(out).toContain('결정하려면')
    expect(out).not.toContain('다음: gotechy run')
  })

  test('게이트가 열리지 않은 막는 결정이 있으면 결정 필요에 남는다', () => {
    const out = formatInbox([card([decided[0] as Gate])])
    expect(out).toContain('[결정 필요] T-001')
  })

  test('열린 승인 게이트가 있으면 결정 필요에 남는다', () => {
    const after = gate({
      id: 'G-003',
      question: 'T-001를 승인할까요?',
      class: 'approval-after',
      options: ['승인', '다시'],
    })
    const out = formatInbox([card([...decided, after])])
    expect(out).toContain('[결정 필요] T-001')
    expect(out).toContain('승인 대기 G-003')
  })

  test('막는 결정이 없는 결정 필요 작업은 다시 실행 대기로 옮기지 않는다', () => {
    const noBlocking = text.replaceAll('[막는]', '[기본값]')
    const c = attachGates(buildCard({ id: 'T-001', file: 'h.md', text: noBlocking }), [])
    expect(formatInbox([c])).toContain('[결정 필요] T-001')
  })

  test('실패한 작업은 게이트를 모두 결정했어도 실패 묶음에 남는다', () => {
    const failedText = text.replace('status: needs-decision', 'status: failed')
    const c = attachGates(buildCard({ id: 'T-001', file: 'h.md', text: failedText }), decided)
    const out = formatInbox([c])
    expect(out).toContain('[실패] T-001')
    expect(out).not.toContain('다음: gotechy run')
  })

  test('묶음 순서는 결정 필요, 실패, 다시 실행 대기, 완료다', () => {
    const failed = buildCard({ id: 'T-003', file: 'bad.md', text: '---\nbroken' })
    const waiting = card([gate({ id: 'G-009', question: Q1 })], 'T-004')
    const out = formatInbox([card(decided, 'T-002'), failed, waiting])
    expect(out.split('\n')[0]).toBe('결정 필요 1건, 실패 1건, 다시 실행 대기 1건')
    const order = ['T-004', 'T-003', 'T-002'].map((id) => out.indexOf(`] ${id}`))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  test('HTML 인박스도 같은 묶음 이름과 다음 명령을 보여 준다', () => {
    const html = renderInboxPage([card(decided)])
    expect(html).toContain('[다시 실행 대기]')
    expect(html).toContain('gotechy run T-001')
    expect(html).toContain('class="card resume"')
    expect(html).not.toContain('[결정 필요]')
  })
})
