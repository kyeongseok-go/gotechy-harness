// 실제 Secure Enclave 서명 도구(native/ownerkey.swift). macOS에 swiftc가 있을 때만 돈다.
// 테스트용 빌드(-D GOTECHY_TEST_NO_PRESENCE)는 사람 확인 없는 키를 만든다. 화면이 잠겨 있으면 키를 만들 수 없어 그 테스트는 건너뛴다.
import { describe, expect, test } from 'bun:test'
import { createHash, createPrivateKey } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifySignature } from '../../src/core/gate'
import { ensureOwnerTool, ownerToolPath } from '../../src/runtime/keys'
import { runSandboxedShell, sandboxAvailable } from '../../src/runtime/sandbox'
import { LIB } from './helpers'

const tmp = (p: string) => realpathSync(mkdtempSync(join(tmpdir(), p)))
const swiftc = process.platform === 'darwin' ? Bun.which('swiftc') : null
const dir = tmp('gotechy-se-')
const tool = join(dir, 'ownerkey-test')
const prodHome = tmp('gotechy-se-home-')
let locked = true
if (swiftc) {
  // 테스트용 빌드와 배포용 빌드(ensureOwnerTool)를 함께 돌려 시간을 줄인다
  const build = Bun.spawn({
    cmd: [
      swiftc,
      '-O',
      '-D',
      'GOTECHY_TEST_NO_PRESENCE',
      '-o',
      tool,
      join(LIB, 'native', 'ownerkey.swift'),
    ],
    stdout: 'ignore',
    stderr: 'pipe',
    env: process.env,
  })
  ensureOwnerTool(prodHome, LIB)
  if ((await build.exited) !== 0) throw new Error(await new Response(build.stderr).text())
  const probe = Bun.spawnSync({
    cmd: [tool, 'create', join(dir, 'probe.blob')],
    stderr: 'pipe',
    env: process.env,
  })
  locked = probe.exitCode !== 0
}
/** 서로 맞는 [결정 서명 대상, 장부 줄] 한 쌍 */
const pair = (): [string, string] => {
  const p0 = JSON.stringify({
    choice: '5분',
    gate_id: 'G-001',
    key_id: 'o-0000000000000001',
    nonce: 'n1',
    task_id: 'T-001',
  })
  const line = JSON.stringify({
    gate: 'G-001',
    nonce: 'n1',
    key_id: 'o-0000000000000001',
    decided_at: '2026-10-14T00:00:00.000Z',
    payload_sha256: createHash('sha256').update(p0).digest('hex'),
  })
  return [p0, line]
}
const run = (args: string[], stdin?: string) => {
  const r = Bun.spawnSync({
    cmd: [tool, ...args],
    stdin: stdin === undefined ? 'ignore' : Buffer.from(stdin),
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  return { code: r.exitCode, out: r.stdout.toString().trim(), err: r.stderr.toString() }
}

describe.skipIf(!swiftc)('Secure Enclave 서명 도구', () => {
  test('배포용 빌드는 GOTECHY_HOME/bin에 생기고 사용법이 틀리면 exit 2', () => {
    expect(existsSync(ownerToolPath(prodHome))).toBe(true)
    expect(Bun.spawnSync({ cmd: [ownerToolPath(prodHome)], env: process.env }).exitCode).toBe(2)
  })

  test.skipIf(!sandboxAvailable())(
    'Validation 2: verify 샌드박스 안에서는 도구가 Secure Enclave를 쓰지 못한다',
    async () => {
      const wt = tmp('gotechy-se-wt-')
      mkdirSync(join(wt, 'tmp'))
      const r = await runSandboxedShell(`'${tool}' create '${wt}/x.blob'`, wt, {
        writable: wt,
        tmp: join(wt, 'tmp'),
        secret: [],
      })
      expect(r.sandboxed).toBe(true)
      // 3: Secure Enclave를 쓸 수 없음. 샌드박스 밖에서는 0(성공)이나 1(화면 잠김)이다
      expect(r.exitCode).toBe(3)
    },
  )

  test('중간 1: 메시지가 두 개가 아니거나 장부 줄이 결정과 맞지 않으면 서명하지 않는다', () => {
    const three = run(['sign', join(dir, 'none.blob')], JSON.stringify(['a', 'b', 'c']))
    expect(three.code).toBe(2)
    expect(three.out).toBe('')
    const [p0, line] = pair()
    const bad = run(
      ['sign', join(dir, 'none.blob')],
      JSON.stringify([p0, line.replace(/"payload_sha256":"[0-9a-f]+"/, '"payload_sha256":"00"')]),
    )
    expect(bad.code).toBe(2)
  })

  test('중간 1: 확인 창 문구는 서명 대상의 게이트와 선택으로 도구가 직접 만든다', () => {
    // 테스트 빌드는 창 대신 stderr에 문구를 남긴다. blob이 없어 서명은 실패하지만 문구는 그 전에 정해진다
    const r = run(['sign', join(dir, 'none.blob'), '--reason', '다른 문구'], JSON.stringify(pair()))
    expect(r.err).toContain('확인 문구: gotechy G-001 T-001: 5분 (확인 N1)')
    expect(r.err).not.toContain('다른 문구')
  })

  test('낮음 3: keys init은 이미 있는 도구도 다시 빌드한다', () => {
    const h = tmp('gotechy-se-rebuild-')
    mkdirSync(join(h, 'bin'), { recursive: true })
    writeFileSync(ownerToolPath(h), '#!/bin/sh\nexit 0\n')
    ensureOwnerTool(h, LIB, true)
    expect(Bun.spawnSync({ cmd: [ownerToolPath(h)], env: process.env }).exitCode).toBe(2)
  })

  test.skipIf(locked)('낮음 3: 테스트 빌드의 키는 probe가 사람 확인 없는 키로 알아챈다', () => {
    const blob = join(dir, 'np.blob')
    expect(run(['create', blob]).code).toBe(0)
    expect(run(['probe', blob]).code).toBe(5)
  })

  test.skipIf(locked || !sandboxAvailable())(
    '낮음 5: 키를 작업 폴더로 복사해도 verify 샌드박스 안에서는 서명하지 못한다',
    async () => {
      const wt = tmp('gotechy-se-wt2-')
      mkdirSync(join(wt, 'tmp'))
      const blob = join(wt, 'k.blob')
      expect(run(['create', blob]).code).toBe(0)
      writeFileSync(join(wt, 'in.json'), JSON.stringify(pair()))
      const r = await runSandboxedShell(`'${tool}' sign '${blob}' < in.json`, wt, {
        writable: wt,
        tmp: join(wt, 'tmp'),
        secret: [],
      })
      expect(r.exitCode).not.toBe(0)
      expect(r.stdout.trim()).toBe('')
    },
  )

  test.skipIf(locked)('만든 키로 서명하면 Bun이 검증하고, blob은 개인 키 원문이 아니다', () => {
    const blob = join(dir, 'k.blob')
    const created = run(['create', blob])
    expect(created.code).toBe(0)
    const pub = created.out
    expect(run(['pub', blob]).out).toBe(pub)
    const [p0, line] = pair()
    const signed = run(['sign', blob], JSON.stringify([p0, line]))
    expect(signed.code).toBe(0)
    const [s1, s2] = JSON.parse(signed.out) as string[]
    expect(verifySignature(pub, p0, s1 as string)).toBe(true)
    expect(verifySignature(pub, line, s2 as string)).toBe(true)
    expect(verifySignature(pub, `${p0} `, s1 as string)).toBe(false)
    expect(statSync(blob).mode & 0o777).toBe(0o600)
    expect(() => createPrivateKey(readFileSync(blob))).toThrow()
    // 이미 있는 blob은 덮어쓰지 않는다
    expect(run(['create', blob]).code).toBe(1)
  })
})
