// 워커는 train 버전 그대로 돌아야 한다. claude 워커에 자동 업데이트를 끄는 환경 변수를 넘기는지 가짜 claude로 본다.
import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { claudeAdapter } from '../../src/runtime/adapters/claude'
import { realAgentInTest } from '../../src/runtime/adapters/env'

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

describe('테스트 안에서 실제 에이전트 CLI를 막는 두 번째 울타리 (보안 감사 13차 낮음 10)', () => {
  const fakeIn = (dir: string, name: string) => {
    const f = join(dir, name)
    writeFileSync(f, '#!/bin/sh\nexit 0\n')
    chmodSync(f, 0o755)
    return dir
  }

  test('PATH에 없으면 막을 것이 없다', () => {
    expect(realAgentInTest('gotechy-no-such-agent', '/nonexistent')).toBeUndefined()
  })

  test('임시 폴더의 가짜 실행 파일은 허용한다', () => {
    const dir = fakeIn(realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fakeagent-'))), 'claude')
    expect(realAgentInTest('claude', dir)).toBeUndefined()
  })

  test('임시 폴더 밖의 실행 파일은 사유와 함께 막고, 명시적으로 허용하면 통과시킨다', () => {
    // 임시 폴더 밖에 둬야 "실제 CLI"로 보인다. 저장소 안에 잠깐 만들고 지운다
    const dir = mkdtempSync(join(import.meta.dir, '..', '.real-agent-'))
    try {
      fakeIn(dir, 'claude')
      expect(realAgentInTest('claude', dir)).toContain('실제 claude CLI')
      process.env.GOTECHY_ALLOW_REAL_AGENTS = '1'
      expect(realAgentInTest('claude', dir)).toBeUndefined()
    } finally {
      delete process.env.GOTECHY_ALLOW_REAL_AGENTS
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
