import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serializeFrontmatter } from '../../src/core/frontmatter'
import { lintHandoff } from '../../src/core/lint-handoff'
import { lintTask } from '../../src/core/lint-task'
import { HANDOFF_SECTIONS, TASK_SECTIONS } from '../../src/core/schema'

const taskFm = (over: Record<string, unknown> = {}) => ({
  id: 'T-001',
  title: 'README 한 줄',
  status: 'ready',
  packs: ['owner'],
  tier: 'T0',
  deps: [],
  ownership: ['README.md'],
  data_class: 'public',
  autonomy: 'L0',
  verify: 'grep -q 설치 README.md',
  irreversible: false,
  gate: 'none',
  ...over,
})
const taskBody = TASK_SECTIONS.map((s) => `## ${s}\nx\n`).join('\n')
const task = (over = {}, body = taskBody) => serializeFrontmatter(taskFm(over), body)
const rules = (r: { issues: { rule: string }[] }) => r.issues.map((i) => i.rule)

describe('lintTask', () => {
  test('계약을 지킨 작업은 통과한다', () => {
    const r = lintTask(task(), 'orchestration/tasks/T-001.md')
    expect(r.issues).toEqual([])
    expect(r.task?.id).toBe('T-001')
  })

  test('알 수 없는 키를 줄 번호와 함께 거부한다', () => {
    const r = lintTask(task({ owner_approved: true }), 'orchestration/tasks/T-001.md')
    expect(rules(r)).toContain('task-schema')
    expect(r.issues[0]?.message).toContain('owner_approved')
  })

  test('잘못된 값의 위치를 가리킨다', () => {
    const r = lintTask(task({ tier: 'T9' }), 'orchestration/tasks/T-001.md')
    expect(r.issues[0]?.message).toContain('tier')
    expect(r.issues[0]?.line).toBeGreaterThan(1)
  })

  test('id와 파일명이 다르면 실패한다', () => {
    expect(rules(lintTask(task(), 'orchestration/tasks/T-002.md'))).toContain('task-id-filename')
  })

  test.each([
    ['orchestration/gates/'],
    ['orchestration/gates/G-001.md'],
    ['../outside.md'],
    ['/etc/passwd'],
    ['src/*.ts'],
    ['AGENTS.md'],
    ['.claude/skills/x/'],
    ['orchestration/'],
  ])('ownership %s 는 거부된다', (entry) => {
    const r = lintTask(task({ ownership: [entry] }), 'orchestration/tasks/T-001.md')
    expect(rules(r)).toContain('task-ownership')
  })

  test('본문 5요소가 빠지거나 순서가 다르면 실패한다', () => {
    expect(rules(lintTask(task({}, '## Target\nx\n'), 'orchestration/tasks/T-001.md'))).toContain(
      'task-section-missing',
    )
    const swapped =
      '## Change\nx\n## Target\nx\n## Constraints\n## Ownership\n## Observable acceptance\n'
    expect(rules(lintTask(task({}, swapped), 'orchestration/tasks/T-001.md'))).toContain(
      'task-section-order',
    )
  })

  test('되돌리기 어려운 경로는 명세 값과 무관하게 irreversible이 된다', () => {
    const r = lintTask(task({ ownership: ['db/schema.sql'] }), 'orchestration/tasks/T-001.md')
    expect(r.irreversible).toBe(true)
  })
})

const handoffFixture = readFileSync(
  join(import.meta.dir, '..', 'fixtures', 'fake', 'readme-ok', 'handoff.md'),
  'utf8',
).replaceAll('{{TASK}}', 'T-001')

describe('lintHandoff (M1 구조)', () => {
  test('계약 형식의 HANDOFF는 통과한다', () => {
    expect(lintHandoff(handoffFixture, 'h.md').issues).toEqual([])
  })

  test('빠진 절을 알려 준다', () => {
    const r = lintHandoff(handoffFixture.replace('## 새 용어\n없음\n', ''), 'h.md')
    expect(rules(r)).toContain('handoff-section-missing')
  })

  test('절 순서가 다르면 실패한다', () => {
    const body = [...HANDOFF_SECTIONS]
      .reverse()
      .map((s) => `## ${s}\n없음\n`)
      .join('\n')
    const text = serializeFrontmatter({ task: 'T-001', status: 'done' }, body)
    expect(rules(lintHandoff(text, 'h.md'))).toContain('handoff-section-order')
  })

  test('계약에 없는 절을 거부한다', () => {
    const r = lintHandoff(`${handoffFixture}\n## 잡담\n하하\n`, 'h.md')
    expect(rules(r)).toContain('handoff-section-unknown')
  })

  test('코드 블록 안의 ## 는 절로 보지 않는다', () => {
    const text = handoffFixture.replace('## 다음 단계', '```\n## 가짜 절\n```\n## 다음 단계')
    expect(lintHandoff(text, 'h.md').issues).toEqual([])
  })

  test('워커가 알 수 없는 frontmatter 키를 쓰면 거부한다', () => {
    const text = handoffFixture.replace('status: done', 'status: done\napproved_by_owner: true')
    expect(rules(lintHandoff(text, 'h.md'))).toContain('handoff-schema')
  })
})
