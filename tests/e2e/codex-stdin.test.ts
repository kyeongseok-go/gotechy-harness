// U9, TD-028: codex 워커의 지시문은 명령줄이 아니라 표준 입력으로 간다. 가짜 codex로 받은 것을 본다.
import { afterEach, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { codexAdapter } from '../../src/runtime/adapters/codex'

const PATH_BEFORE = process.env.PATH
afterEach(() => {
  process.env.PATH = PATH_BEFORE
})

test('codex 워커는 지시문을 표준 입력으로 받고, 표준 입력은 그 뒤 닫힌다(긴 지시문도)', async () => {
  const bin = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fakecodex-')))
  // 마지막 인자와 표준 입력의 길이와 끝을 그대로 돌려준다. 표준 입력이 닫히지 않으면 cat이 끝나지 않는다
  writeFileSync(
    join(bin, 'codex'),
    '#!/bin/sh\nfor a; do last="$a"; done\nin=$(cat)\nprintf \'{"last":"%s","tail":"%s"}\' "$last" "$(printf %s "$in" | tail -c 3)"\n',
  )
  chmodSync(join(bin, 'codex'), 0o755)
  process.env.PATH = `${bin}:${PATH_BEFORE}`
  const prompt = `${'가'.repeat(70_000)}끝`
  const r = await codexAdapter.run({
    taskId: 'T-001',
    cwd: bin,
    prompt,
    budgetUsd: 0.1,
    timeoutMs: 10_000,
  })
  expect(r.exitCode).toBe(0)
  const o = JSON.parse(r.rawOutput)
  expect(o.last).toBe('-')
  // tail -c는 바이트를 센다. 한글 한 글자가 3바이트라 마지막 글자만 나온다
  expect(o.tail).toBe('끝')
})
