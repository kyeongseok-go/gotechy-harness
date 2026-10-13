// contract.md 6.2, 6.3절의 순수 로직: 정렬 JSON, 작업 명세 요약값, 서명.
import { describe, expect, test } from 'bun:test'
import { canonicalJson, signPayload, taskSpecDigest, verifyPayload } from '../../src/core/gate'
import { buildWorkerPrompt } from '../../src/core/prompt'
import type { TaskFrontmatter } from '../../src/core/schema'

describe('정렬 JSON', () => {
  test('모든 깊이에서 키를 정렬하고 배열 순서는 지킨다', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,1]},"b":1}',
    )
  })
})

describe('작업 명세 요약값', () => {
  const spec = (status: string, verify = 'true', body = '## Target\n없음\n') =>
    `---\nid: T-001\nstatus: ${status}\nverify: ${verify}\n---\n${body}`

  test('status만 바뀌면 같다', () => {
    expect(taskSpecDigest(spec('ready'))).toBe(taskSpecDigest(spec('done')))
  })

  test('다른 키나 본문이 바뀌면 달라진다', () => {
    expect(taskSpecDigest(spec('ready'))).not.toBe(taskSpecDigest(spec('ready', 'false')))
    expect(taskSpecDigest(spec('ready'))).not.toBe(
      taskSpecDigest(spec('ready', 'true', '## Target\n있음\n')),
    )
  })
})

describe('서명', () => {
  const key = Buffer.alloc(32, 7)
  test('같은 키와 내용이면 검증을 통과한다', () => {
    const sig = signPayload(key, '{"a":1}')
    expect(verifyPayload(key, '{"a":1}', sig)).toBe(true)
  })

  test('내용이나 키가 다르면 실패한다', () => {
    const sig = signPayload(key, '{"a":1}')
    expect(verifyPayload(key, '{"a":2}', sig)).toBe(false)
    expect(verifyPayload(Buffer.alloc(32, 8), '{"a":1}', sig)).toBe(false)
    expect(verifyPayload(key, '{"a":1}', 'zz')).toBe(false)
  })
})

describe('워커 지시문', () => {
  const task = {
    id: 'T-001',
    ownership: ['README.md'],
    verify: 'true',
    packs: ['owner'],
  } as unknown as TaskFrontmatter

  test('오너 결정이 있으면 지시문에 질문, 선택, 다음 지시를 넣는다', () => {
    const p = buildWorkerPrompt(task, '## Target\n없음', [
      { gate: 'G-001', question: '캐시 만료를 얼마로 할까요?', choice: '5분', instruction: null },
      { gate: 'G-002', question: '키에 번호를 넣을까요?', choice: '넣기', instruction: '해시로' },
    ])
    expect(p).toContain('## 오너 결정')
    expect(p).toContain('- G-001 캐시 만료를 얼마로 할까요? 결정: 5분')
    expect(p).toContain('- G-002 키에 번호를 넣을까요? 결정: 넣기. 다음 지시: 해시로')
  })

  test('결정이 없으면 오너 결정 절을 넣지 않는다', () => {
    expect(buildWorkerPrompt(task, '## Target\n없음')).not.toContain('## 오너 결정')
  })
})
