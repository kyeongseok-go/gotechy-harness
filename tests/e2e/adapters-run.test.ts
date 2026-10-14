// 어댑터의 실행 경로(핵심 모듈 기준 95%, contract.md 10.6절). 가짜 codex와 녹화 폴더 없는 fake 어댑터, 샌드박스가 없는 OS의 verify.
import { afterEach, expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { codexAdapter } from '../../src/runtime/adapters/codex'
import { fakeAdapter } from '../../src/runtime/adapters/fake'
import { runSandboxedShell } from '../../src/runtime/sandbox'

const PATH_BEFORE = process.env.PATH
afterEach(() => {
  process.env.PATH = PATH_BEFORE
})
const tmp = (p: string) => realpathSync(mkdtempSync(join(tmpdir(), p)))
const req = { taskId: 'T-001', prompt: 'P', budgetUsd: 0.1, timeoutMs: 10_000 }

test('codex 워커의 JSONL 출력에서 사용량을 읽고, 지정한 모델을 결과에 남긴다', async () => {
  const bin = tmp('gotechy-fakecodex-')
  const line = JSON.stringify({
    type: 'turn.completed',
    usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 7 },
  })
  writeFileSync(join(bin, 'codex'), `#!/bin/sh\necho '${line}'\n`)
  chmodSync(join(bin, 'codex'), 0o755)
  process.env.PATH = `${bin}:${PATH_BEFORE}`
  const r = await codexAdapter.run({ ...req, cwd: bin, model: 'gpt-6.1-sol' })
  expect(r.exitCode).toBe(0)
  expect(r.model).toBe('gpt-6.1-sol')
  expect(r.usage).toMatchObject({ input_tokens: 60, cache_read_tokens: 40, output_tokens: 7 })
})

test('codex 출력에 사용량이 없으면 usage와 model을 비워 둔다', async () => {
  const bin = tmp('gotechy-fakecodex-')
  writeFileSync(join(bin, 'codex'), '#!/bin/sh\necho "not json"\nexit 3\n')
  chmodSync(join(bin, 'codex'), 0o755)
  process.env.PATH = `${bin}:${PATH_BEFORE}`
  const r = await codexAdapter.run({ ...req, cwd: bin })
  expect(r.exitCode).toBe(3)
  expect(r.usage).toBeUndefined()
  expect(r.model).toBeUndefined()
})

test('fake 어댑터는 녹화 폴더가 없으면 exit 2와 이유를 돌려준다', async () => {
  const cwd = tmp('gotechy-fake-')
  const r = await fakeAdapter.run({ ...req, cwd, fixtureDir: join(cwd, '없는 폴더') })
  expect(r.exitCode).toBe(2)
  expect(r.stderr).toContain('--fixture')
  expect((await fakeAdapter.run({ ...req, cwd })).stderr).toContain('없음')
})

test('샌드박스가 없는 환경에서는 verify를 그냥 실행하고 sandboxed: false를 돌려준다', async () => {
  const wt = tmp('gotechy-nosbx-')
  const t = join(wt, 'tmp')
  mkdirSync(t)
  const r = await runSandboxedShell(
    'echo "$HOME"',
    wt,
    { writable: wt, tmp: t, secret: [] },
    10_000,
    false,
  )
  expect(r.sandboxed).toBe(false)
  expect(r.exitCode).toBe(0)
  // 샌드박스가 없어도 오너의 HOME 대신 임시 폴더를 준다
  expect(r.stdout.trim()).toBe(t)
})
