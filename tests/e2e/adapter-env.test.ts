// 워커는 train 버전 그대로 돌아야 한다. claude 워커에 자동 업데이트를 끄는 환경 변수를 넘기는지 가짜 claude로 본다.
import { afterEach, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { claudeAdapter } from '../../src/runtime/adapters/claude'

const PATH_BEFORE = process.env.PATH
const AU_BEFORE = process.env.DISABLE_AUTOUPDATER
afterEach(() => {
  process.env.PATH = PATH_BEFORE
  if (AU_BEFORE === undefined) delete process.env.DISABLE_AUTOUPDATER
  else process.env.DISABLE_AUTOUPDATER = AU_BEFORE
})

test('claude 워커는 DISABLE_AUTOUPDATER=1 환경으로 돈다', async () => {
  const bin = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fakeclaude-')))
  const fake = join(bin, 'claude')
  writeFileSync(fake, '#!/bin/sh\nprintf \'{"au":"%s"}\' "$DISABLE_AUTOUPDATER"\n')
  chmodSync(fake, 0o755)
  process.env.PATH = `${bin}:${PATH_BEFORE}`
  // 오너 환경에 다른 값이 있어도 워커에는 1이 가야 한다
  process.env.DISABLE_AUTOUPDATER = '0'
  const r = await claudeAdapter.run({
    taskId: 'T-001',
    cwd: bin,
    prompt: 'P',
    budgetUsd: 0.1,
    timeoutMs: 10_000,
  })
  expect(r.exitCode).toBe(0)
  expect(JSON.parse(r.rawOutput)).toEqual({ au: '1' })
})
