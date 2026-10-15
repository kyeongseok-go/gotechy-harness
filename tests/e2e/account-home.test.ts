// TD-019: 환경 변수 HOME을 바꿔도 verify 샌드박스는 계정의 진짜 홈에 있는 비밀 폴더를 막고,
// 끝 기록 위치가 기본과 다르면 gate verify가 알린다. Bun의 os.homedir와 userInfo().homedir는 HOME을 따른다(실험).
import { expect, test } from 'bun:test'
import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { accountHome, homeMismatch } from '../../src/runtime/account'
import { LIB, makeProject } from './helpers'

/** 운영체제 도구로 읽은 계정 홈(비교 기준) */
function osAccountHome(): string {
  const name = Bun.spawnSync({ cmd: ['id', '-un'] })
    .stdout.toString()
    .trim()
  if (process.platform === 'darwin') {
    const out = Bun.spawnSync({
      cmd: ['dscl', '.', '-read', `/Users/${name}`, 'NFSHomeDirectory'],
    }).stdout.toString()
    return out.replace(/^NFSHomeDirectory:\s*/, '').trim()
  }
  return (
    Bun.spawnSync({ cmd: ['getent', 'passwd', name] })
      .stdout.toString()
      .trim()
      .split(':')[5] ?? ''
  )
}

/** HOME을 바꾼 새 프로세스에서 홈 값과 샌드박스 규칙을 본다(Bun의 homedir는 시작할 때의 HOME을 따른다) */
function probeWithHome(home: string): { homedir: string; account: string; profile: string } {
  const code = [
    `const { homedir } = require('node:os')`,
    `const { accountHome } = require(${JSON.stringify(join(LIB, 'src', 'runtime', 'account.ts'))})`,
    `const { sandboxProfile } = require(${JSON.stringify(join(LIB, 'src', 'runtime', 'sandbox.ts'))})`,
    `console.log(JSON.stringify({ homedir: homedir(), account: accountHome(), profile: sandboxProfile({ writable: '/tmp/w', tmp: '/tmp/t', secret: [] }) }))`,
  ].join('\n')
  const r = Bun.spawnSync({
    cmd: [process.execPath, '-e', code],
    env: { ...process.env, HOME: home },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return JSON.parse(r.stdout.toString())
}

test('계정 홈은 환경 변수 HOME이 아니라 계정 정보에서 읽는다', () => {
  const r = probeWithHome('/tmp/gotechy-fake-home')
  expect(r.homedir).toBe('/tmp/gotechy-fake-home')
  expect(r.account).toBe(osAccountHome())
})

test('HOME을 바꿔도 verify 샌드박스는 계정 홈의 비밀 폴더를 막는다', () => {
  const r = probeWithHome('/tmp/gotechy-fake-home')
  const deny = (p: string) => r.profile.includes(`(deny file-read* file-write* (subpath "${p}"))`)
  const realSsh = join(osAccountHome(), '.ssh')
  expect(deny(realSsh) || deny(realpathSafe(realSsh))).toBe(true)
  expect(deny('/tmp/gotechy-fake-home/.ssh')).toBe(true)
})

test('키와 끝 기록 위치가 계정 홈의 기본 위치와 다르면 알린다', () => {
  expect(homeMismatch({ HOME: accountHome() })).toBeUndefined()
  expect(homeMismatch({ HOME: '/tmp/gotechy-fake-home' })).toContain('계정 홈')
  // GOTECHY_HOME을 둔 경우도 실제 위치를 비교한다(보안 감사 13차 중간 1)
  expect(homeMismatch({ HOME: accountHome(), GOTECHY_HOME: '/tmp/g' })).toContain('계정 홈')
  expect(
    homeMismatch({ HOME: '/tmp/x', GOTECHY_HOME: `${accountHome() as string}/.gotechy` }),
  ).toBeUndefined()
})

test('gate verify는 HOME이 계정 홈과 다르면 끝 기록 위치가 기본과 다르다고 알린다', () => {
  const root = makeProject()
  const fake = realpathSync(
    Bun.spawnSync({ cmd: ['mktemp', '-d'] })
      .stdout.toString()
      .trim(),
  )
  const env: Record<string, string> = { ...(process.env as Record<string, string>), HOME: fake }
  delete env.GOTECHY_HOME
  const r = Bun.spawnSync({
    cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), 'gate', 'verify'],
    cwd: root,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  expect(r.stderr.toString()).toContain('계정 홈')
})

function realpathSafe(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}
