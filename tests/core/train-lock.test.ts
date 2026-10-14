// contract.md 10.1절: train의 A등급 도구는 라이브러리의 mise.toml과 mise.lock에 같은 버전으로 고정돼 있어야 한다.
// 둘이 어긋나면 새 설치(부트스트랩)가 train과 다른 버전을 깔거나, 락에 없는 도구에서 설치가 멈춘다.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTrain } from '../../src/core/train'

const LIB = join(import.meta.dir, '..', '..')
const train = parseTrain(readFileSync(join(LIB, 'train.yaml'), 'utf8'))
const miseToml = Bun.TOML.parse(readFileSync(join(LIB, 'mise.toml'), 'utf8')) as {
  tools: Record<string, string>
}
type LockEntry = { version: string } & Record<string, unknown>
const miseLock = Bun.TOML.parse(readFileSync(join(LIB, 'mise.lock'), 'utf8')) as {
  tools: Record<string, LockEntry[]>
}
const PLATFORMS = ['macos-arm64', 'macos-x64', 'linux-x64', 'linux-arm64']
// mise 자신은 부트스트랩이 train의 체크섬으로 설치한다
const pinnedA = Object.entries(train.tools).filter(([name, t]) => t.pin === 'A' && name !== 'mise')

describe('train과 mise 락', () => {
  test('A등급 도구는 mise 이름이 있다', () => {
    for (const [name, t] of pinnedA)
      expect({ name, mise: t.mise }).toEqual({ name, mise: expect.any(String) })
  })

  test('mise 이름 없는 A등급 도구가 있는 train은 읽지 않는다', () => {
    const text = readFileSync(join(LIB, 'train.yaml'), 'utf8').replace(', mise: uv }', ' }')
    expect(() => parseTrain(text)).toThrow('mise 이름')
  })

  test('claude와 codex도 A등급이다 (새 설치에서 train 버전을 만들 수 있게)', () => {
    expect(train.tools.claude?.pin).toBe('A')
    expect(train.tools.codex?.pin).toBe('A')
  })

  test('A등급 도구는 mise.toml에 train과 같은 버전으로 있다', () => {
    for (const [, t] of pinnedA)
      expect({ tool: t.mise, version: miseToml.tools[t.mise as string] }).toEqual({
        tool: t.mise,
        version: t.version,
      })
  })

  test('A등급 도구는 mise.lock에 4개 플랫폼 체크섬이 있다', () => {
    for (const [, t] of pinnedA) {
      const entry = miseLock.tools[t.mise as string]?.find((e) => e.version === t.version)
      expect({ tool: t.mise, locked: entry !== undefined }).toEqual({ tool: t.mise, locked: true })
      for (const p of PLATFORMS) {
        const plat = entry?.[`platforms.${p}`] as { checksum?: string } | undefined
        expect({
          tool: t.mise,
          p,
          checksum: /^sha256:[0-9a-f]{64}$/.test(plat?.checksum ?? ''),
        }).toEqual({
          tool: t.mise,
          p,
          checksum: true,
        })
      }
    }
  })

  test('mise.toml에는 train에 없는 도구가 없다', () => {
    const known = new Set(pinnedA.map(([, t]) => t.mise))
    for (const k of Object.keys(miseToml.tools))
      expect({ k, known: known.has(k) }).toEqual({ k, known: true })
  })
})
