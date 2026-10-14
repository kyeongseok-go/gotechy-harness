// 실제 Secure Enclave 서명 도구(native/ownerkey.swift). macOS에 swiftc가 있을 때만 돈다.
// 테스트용 빌드(-D GOTECHY_TEST_NO_PRESENCE)는 사람 확인 없는 키를 만든다. 화면이 잠겨 있으면 키를 만들 수 없어 그 테스트는 건너뛴다.
import { describe, expect, test } from 'bun:test'
import { createPrivateKey } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync } from 'node:fs'
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

  test.skipIf(locked)('만든 키로 서명하면 Bun이 검증하고, blob은 개인 키 원문이 아니다', () => {
    const blob = join(dir, 'k.blob')
    const created = run(['create', blob])
    expect(created.code).toBe(0)
    const pub = created.out
    expect(run(['pub', blob]).out).toBe(pub)
    const signed = run(['sign', blob, '--reason', 'test'], JSON.stringify(['{"a":1}', '{"b":2}']))
    expect(signed.code).toBe(0)
    const [s1, s2] = JSON.parse(signed.out) as string[]
    expect(verifySignature(pub, '{"a":1}', s1 as string)).toBe(true)
    expect(verifySignature(pub, '{"b":2}', s2 as string)).toBe(true)
    expect(verifySignature(pub, '{"a":2}', s1 as string)).toBe(false)
    expect(statSync(blob).mode & 0o777).toBe(0o600)
    expect(() => createPrivateKey(readFileSync(blob))).toThrow()
    // 이미 있는 blob은 덮어쓰지 않는다
    expect(run(['create', blob]).code).toBe(1)
  })
})
