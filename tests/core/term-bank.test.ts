// 용어 은행 읽기(contract.md 7절, 9.5절).
import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadKnownTerms } from '../../src/runtime/terms'

test('여러 단어 용어와 별칭은 낱말로도 안다 (본문에서는 낱말 단위로 뽑히므로)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gotechy-terms-'))
  mkdirSync(join(root, 'orchestration'), { recursive: true })
  writeFileSync(
    join(root, 'orchestration', 'terms.jsonl'),
    `${JSON.stringify({ term: 'Secure Enclave', aliases: ['Apple T2'], easy: '보안 칩' })}\n`,
  )
  const known = loadKnownTerms(root)
  for (const w of ['secure enclave', 'secure', 'enclave', 'apple', 't2'])
    expect(known.has(w)).toBe(true)
})
