// contract.md 10.1절: train의 A등급 도구는 라이브러리의 mise.toml과 mise.lock에 같은 버전으로 고정돼 있어야 한다.
// 둘이 어긋나면 새 설치(부트스트랩)가 train과 다른 버전을 깔거나, 락에 없는 도구에서 설치가 멈춘다.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

// contract.md 10.1절, 10.7절: 프로젝트에 까는 팩은 라이브러리 저장소의 커밋에 고정한다.
// 그 커밋의 skills/가 지금 skills/와 다르면 init이 옛 스킬을 깐다.
describe('train의 팩 고정', () => {
  const git = (args: string[]) =>
    Bun.spawnSync({
      cmd: ['git', ...args],
      cwd: LIB,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { PATH: process.env.PATH ?? '', HOME: tmpdir(), GIT_CONFIG_GLOBAL: '/dev/null' },
    })

  test('출처는 GitHub 저장소, ref는 커밋 SHA 40자리다', () => {
    expect(train.packs.source).toMatch(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/)
    expect(train.packs.ref).toMatch(/^[0-9a-f]{40}$/)
  })

  test('태그나 짧은 SHA로 고정한 train은 읽지 않는다', () => {
    const text = readFileSync(join(LIB, 'train.yaml'), 'utf8')
    expect(() => parseTrain(text.replace(train.packs.ref, 'v2.0.0'))).toThrow()
    expect(() => parseTrain(text.replace(train.packs.ref, train.packs.ref.slice(0, 12)))).toThrow()
  })

  // 이 맥의 저장소는 네트워크 공유에 있어 git 객체 읽기가 느리다(2026-10-15). git을 부르는 두 테스트는 시간을 넉넉히 준다
  const GIT_TIMEOUT = 60_000

  test(
    'ref는 HEAD의 조상이다 (HEAD를 푸시하면 ref도 원격에 있다)',
    () => {
      expect(git(['merge-base', '--is-ancestor', train.packs.ref, 'HEAD']).exitCode).toBe(0)
    },
    GIT_TIMEOUT,
  )

  test(
    'ref의 skills/는 작업 폴더의 skills/와 같다 (스킬을 바꾸면 ref도 올린다)',
    () => {
      const r = git(['diff', '--stat', train.packs.ref, '--', 'skills/'])
      expect({ exit: r.exitCode, diff: r.stdout.toString() }).toEqual({ exit: 0, diff: '' })
      const untracked = git(['ls-files', '--others', '--exclude-standard', '--', 'skills/'])
      expect(untracked.stdout.toString()).toBe('')
    },
    GIT_TIMEOUT,
  )
})
