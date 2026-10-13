import { describe, expect, test } from 'bun:test'
import { parseFrontmatter, serializeFrontmatter } from '../../src/core/frontmatter'

describe('parseFrontmatter', () => {
  test('frontmatter와 본문을 나누고 본문 시작 줄을 계산한다', () => {
    const r = parseFrontmatter('---\nid: T-001\ntitle: x\n---\n## Target\nhi\n', 'a.md')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.data).toEqual({ id: 'T-001', title: 'x' })
    expect(r.value.body).toBe('## Target\nhi\n')
    expect(r.value.bodyLine).toBe(5)
  })

  test('키 경로를 파일 기준 줄 번호로 찾는다 (첫 줄 --- 포함)', () => {
    const r = parseFrontmatter('---\nid: T-001\nownership:\n  - a.md\n  - b.md\n---\nbody', 'a.md')
    if (!r.ok) throw new Error('parse failed')
    expect(r.value.locate(['id'])?.line).toBe(2)
    expect(r.value.locate(['ownership', 1])?.line).toBe(5)
    expect(r.value.locate(['없는키'])?.line).toBe(2) // 없는 키는 부모(문서) 위치
  })

  test('frontmatter가 없으면 교정 방법과 함께 실패한다', () => {
    const r = parseFrontmatter('# 제목만\n', 'a.md')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues[0]?.rule).toBe('frontmatter-missing')
    expect(r.issues[0]?.fix).toContain('---')
  })

  test('닫는 --- 가 없으면 실패한다', () => {
    const r = parseFrontmatter('---\nid: T-001\n', 'a.md')
    expect(r.ok ? 'ok' : r.issues[0]?.rule).toBe('frontmatter-unclosed')
  })

  test('중복 키를 거부한다', () => {
    const r = parseFrontmatter('---\nid: T-001\nid: T-002\n---\n', 'a.md')
    expect(r.ok ? 'ok' : r.issues[0]?.rule).toBe('frontmatter-duplicate-key')
  })

  test('YAML 문법 오류를 줄 번호와 함께 보고한다', () => {
    const r = parseFrontmatter('---\nid: T-001\nbad: [1, 2\n---\n', 'a.md')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues[0]?.rule).toBe('frontmatter-yaml')
    expect(r.issues[0]?.line).toBeGreaterThanOrEqual(2)
  })

  test('매핑이 아니면 실패한다', () => {
    const r = parseFrontmatter('---\n- a\n- b\n---\n', 'a.md')
    expect(r.ok ? 'ok' : r.issues[0]?.rule).toBe('frontmatter-not-map')
  })

  test('직렬화 후 다시 읽으면 같은 값이다', () => {
    const text = serializeFrontmatter({ id: 'T-001', ownership: ['a.md'] }, '## Target\nx\n')
    const r = parseFrontmatter(text, 'a.md')
    if (!r.ok) throw new Error('roundtrip failed')
    expect(r.value.data).toEqual({ id: 'T-001', ownership: ['a.md'] })
    expect(r.value.body).toBe('## Target\nx\n')
  })

  test('JavaScript frontmatter(---js)를 실행하지 않는다', () => {
    const r = parseFrontmatter('---js\n({ x: process.exit(9) })\n---\n', 'a.md')
    expect(r.ok).toBe(false)
  })
})
