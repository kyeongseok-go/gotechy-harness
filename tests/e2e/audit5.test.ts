// 보안 감사 5차(2026-10-14 저녁) 지적의 재현 테스트. 워커 환경 변수, verify 샌드박스의 비밀 폴더와 Secure Enclave, 리드 git의 GIT_* 변수.
import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { claudeAdapter } from '../../src/runtime/adapters/claude'
import { codexAdapter } from '../../src/runtime/adapters/codex'
import { repoRoot } from '../../src/runtime/git'
import { sandboxProfile } from '../../src/runtime/sandbox'

const SAVED = { ...process.env }
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in SAVED)) delete process.env[k]
  Object.assign(process.env, SAVED)
})
const tmp = (p: string) => realpathSync(mkdtempSync(join(tmpdir(), p)))
const req = { taskId: 'T-001', prompt: 'P', budgetUsd: 0.1, timeoutMs: 10_000 }

/** 받은 환경 변수를 그대로 출력하는 가짜 워커 */
function fakeWorker(name: string): string {
  const bin = tmp('gotechy-envworker-')
  writeFileSync(join(bin, name), '#!/bin/sh\n/usr/bin/env\n')
  chmodSync(join(bin, name), 0o755)
  process.env.PATH = `${bin}:${SAVED.PATH}`
  return bin
}

describe('중간 1: 워커는 오너 환경 변수 중 허용 목록만 받는다', () => {
  for (const [name, adapter] of [
    ['claude', claudeAdapter],
    ['codex', codexAdapter],
  ] as const) {
    test(`${name} 워커에는 오너 셸의 토큰이 넘어가지 않는다`, async () => {
      const cwd = fakeWorker(name)
      process.env.GITHUB_TOKEN = 'ghp_sentinel_github'
      process.env.AWS_SECRET_ACCESS_KEY = 'aws_sentinel_secret'
      process.env.GOTECHY_HOME = '/tmp/gotechy-sentinel-home'
      const r = await adapter.run({ ...req, cwd })
      expect(r.exitCode).toBe(0)
      expect(r.rawOutput).not.toContain('sentinel')
      // 워커가 로그인과 도구를 찾는 데 필요한 값은 넘긴다
      expect(r.rawOutput).toContain(`HOME=${SAVED.HOME}`)
      expect(r.rawOutput).toContain('PATH=')
    })
  }

  test('claude 워커의 자동 업데이트 끄기는 그대로 넘긴다', async () => {
    const cwd = fakeWorker('claude')
    const r = await claudeAdapter.run({ ...req, cwd })
    expect(r.rawOutput).toContain('DISABLE_AUTOUPDATER=1')
  })
})

describe('낮음: verify 샌드박스', () => {
  test('홈의 자격 증명 파일과 폴더를 더 막는다', () => {
    const p = sandboxProfile({ writable: '/wt', tmp: '/wt/tmp', secret: [] })
    for (const d of ['.git-credentials', '.npmrc', '.pypirc', '.config/gcloud', '.kube', '.docker'])
      expect(p).toContain(`(deny file-read* file-write* (subpath "${join(homedir(), d)}"))`)
  })

  test('Secure Enclave와 인증 서비스 이름을 막는다', () => {
    const p = sandboxProfile({ writable: '/wt', tmp: '/wt/tmp', secret: [] })
    for (const n of [
      'com.apple.ctkd.token-client',
      'com.apple.CoreAuthentication.daemon',
      'com.apple.coreauthd',
    ])
      expect(p).toContain(`(global-name "${n}")`)
  })
})

describe('낮음: 리드의 git은 오너 셸의 GIT_* 변수를 따르지 않는다', () => {
  test('GIT_DIR이 엉뚱한 곳을 가리켜도 저장소를 바르게 찾는다', async () => {
    const repo = tmp('gotechy-gitenv-')
    Bun.spawnSync({ cmd: ['git', 'init', '-q', repo], env: process.env })
    process.env.GIT_DIR = '/nonexistent-gotechy-git-dir'
    process.env.GIT_CONFIG_COUNT = '1'
    process.env.GIT_CONFIG_KEY_0 = 'core.fsmonitor'
    process.env.GIT_CONFIG_VALUE_0 = '/tmp/gotechy-evil-fsmonitor'
    expect(await repoRoot(repo)).toBe(repo)
  })
})
