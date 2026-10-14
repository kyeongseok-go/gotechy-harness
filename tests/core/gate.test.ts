// contract.md 6.2, 6.3절의 순수 로직: 정렬 JSON, 작업 명세 요약값, 오너 서명 검증, 장부 서명.
import { describe, expect, test } from 'bun:test'
import { generateKeyPairSync, sign } from 'node:crypto'
import {
  canonicalJson,
  type LedgerEntry,
  ledgerLinePayload,
  ledgerSigned,
  ownerKeyId,
  taskSpecDigest,
  verifySignature,
} from '../../src/core/gate'
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

const keyPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pub = publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
  const signText = (text: string) =>
    sign('sha256', Buffer.from(text), { key: privateKey, dsaEncoding: 'der' }).toString('base64')
  return { pub, signText }
}

describe('오너 서명 검증 (ECDSA P-256)', () => {
  const k = keyPair()
  test('같은 키와 내용이면 검증을 통과한다', () => {
    expect(verifySignature(k.pub, '{"a":1}', k.signText('{"a":1}'))).toBe(true)
  })

  test('내용이나 키가 다르거나 서명 형식이 아니면 실패한다', () => {
    const sig = k.signText('{"a":1}')
    expect(verifySignature(k.pub, '{"a":2}', sig)).toBe(false)
    expect(verifySignature(keyPair().pub, '{"a":1}', sig)).toBe(false)
    expect(verifySignature(k.pub, '{"a":1}', 'zz')).toBe(false)
    expect(verifySignature('공개 키가 아님', '{"a":1}', sig)).toBe(false)
  })

  test('키 id는 공개 키의 지문이라 공개 키가 바뀌면 달라진다', () => {
    expect(ownerKeyId(k.pub)).toMatch(/^o-[0-9a-f]{16}$/)
    expect(ownerKeyId(k.pub)).toBe(ownerKeyId(k.pub))
    expect(ownerKeyId(keyPair().pub)).not.toBe(ownerKeyId(k.pub))
  })
})

describe('결정 장부 서명', () => {
  const k = keyPair()
  const id = ownerKeyId(k.pub)
  const line = (gate: string): LedgerEntry => {
    const e: LedgerEntry = {
      gate,
      nonce: `n-${gate}`,
      key_id: id,
      decided_at: '2026-10-14T00:00:00Z',
      payload_sha256: 'ab',
    }
    return { ...e, sig: k.signText(ledgerLinePayload(e)) }
  }
  const pubFor = (kid: string) => (kid === id ? k.pub : undefined)

  test('모든 줄이 그 줄의 키로 서명돼 있으면 통과한다', () => {
    expect(ledgerSigned([line('G-001'), line('G-002')], pubFor)).toBe(true)
  })

  test('줄의 값을 바꾸거나, 서명 없는 줄을 더하거나, 모르는 키의 줄이 있으면 실패한다', () => {
    const changed = { ...line('G-001'), decided_at: '2026-10-15T00:00:00Z' }
    expect(ledgerSigned([changed], pubFor)).toBe(false)
    const { sig: _sig, ...unsigned } = line('G-002')
    expect(ledgerSigned([line('G-001'), unsigned], pubFor)).toBe(false)
    expect(ledgerSigned([{ ...line('G-003'), key_id: 'o-0000000000000000' }], pubFor)).toBe(false)
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
