// 오너 서명 도구(native/ownerkey.swift)의 위치와 빌드. 빌드는 macOS와 swiftc가 있어야 해서 keys.ts에서 떼어 냈다.
// 리눅스 CI에서 이 부분은 돌 수 없으므로, keys.ts의 나머지(검증, 고정 키, 장부)는 리눅스에서도 커버리지 기준을 본다(U8)
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'

export const ownerToolPath = (home: string) => join(home, 'bin', 'gotechy-ownerkey')

/**
 * native/ownerkey.swift를 swiftc로 빌드한다. rebuild면 이미 있어도 다시 빌드한다(keys init과 rotate.
 * 남아 있던 테스트 빌드나 낡은 도구로 키를 만들지 않게, 보안 감사 6차 낮음 3). 테스트는 rebuild 없이 가짜 도구를 쓴다.
 */
export function ensureOwnerTool(home: string, libRoot: string, rebuild = false): string {
  const tool = ownerToolPath(home)
  if (existsSync(tool) && !rebuild) return tool
  if (process.platform !== 'darwin')
    throw new Error('오너 키는 macOS(Secure Enclave)에서만 만들 수 있어요')
  const swiftc = Bun.which('swiftc', { PATH: process.env.PATH ?? '' })
  if (!swiftc)
    throw new Error(
      'swiftc가 없어요. Xcode Command Line Tools를 설치하세요: xcode-select --install',
    )
  mkdirSync(join(home, 'bin'), { recursive: true, mode: 0o700 })
  const tmp = `${tool}.build-${randomBytes(4).toString('hex')}`
  const r = Bun.spawnSync({
    cmd: [swiftc, '-O', '-o', tmp, join(libRoot, 'native', 'ownerkey.swift')],
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  if (r.exitCode !== 0)
    throw new Error(`서명 도구를 빌드하지 못했어요: ${r.stderr.toString().trim()}`)
  renameSync(tmp, tool)
  return tool
}
