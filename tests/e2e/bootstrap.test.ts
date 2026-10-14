// contract.md 10.5절 bin/gotechy 부트스트랩. 실제 다운로드 없이 dry-run과 이미 설치된 mise로 넘기는 경로만 본다.
import { expect, test } from 'bun:test'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseTrain } from '../../src/core/train'

const LIB = realpathSync(join(import.meta.dir, '..', '..'))
const train = parseTrain(readFileSync(join(LIB, 'train.yaml'), 'utf8'))
const platform = `${process.platform === 'darwin' ? 'macos' : 'linux'}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`
const run = (args: string[], env: Record<string, string>) => {
  const r = Bun.spawnSync({
    cmd: ['/bin/sh', join(LIB, 'bin', 'gotechy'), ...args],
    env: { PATH: '/usr/bin:/bin', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() }
}

test('--bootstrap-dry-run은 받을 mise와 체크섬을 보여 주고 아무것도 만들지 않는다', () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-boot-')))
  const ghome = join(home, '.gotechy')
  const r = run(['--bootstrap-dry-run'], { HOME: home, GOTECHY_HOME: ghome })
  expect(r.code).toBe(0)
  expect(r.out).toContain(`mise-v${train.mise.version}-${platform}`)
  expect(r.out).toContain(train.mise.sha256[platform] as string)
  expect(existsSync(ghome)).toBe(false)
})

/** 받은 인자와 환경을 출력하는 가짜 mise를 둔다 */
function fakeMise(ghome: string): void {
  mkdirSync(join(ghome, 'bin'), { recursive: true })
  const fake = join(ghome, 'bin', 'mise')
  writeFileSync(
    fake,
    '#!/bin/sh\necho "mise $*"\necho "PATH=$PATH"\necho "MISE_LOCKED=${MISE_LOCKED:-}"\n',
  )
  chmodSync(fake, 0o755)
}

test('mise가 이미 있으면 내려받지 않고 라이브러리의 CLI로 넘긴다', () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-boot-')))
  const ghome = join(home, '.gotechy')
  fakeMise(ghome)
  const r = run(['inbox'], { HOME: home, GOTECHY_HOME: ghome })
  expect(r.code).toBe(0)
  expect(r.out.split('\n')[0]).toBe(`mise exec -C ${LIB} -- bun ${LIB}/src/cli.ts inbox`)
})

test('CLI에 mise를 PATH 맨 앞에 두고, 락 파일에 있는 것만 설치하게 넘긴다', () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-boot-')))
  const ghome = join(home, '.gotechy')
  fakeMise(ghome)
  const r = run(['doctor'], { HOME: home, GOTECHY_HOME: ghome })
  expect(r.code).toBe(0)
  // doctor가 `mise --version`을 찾을 수 있어야 한다
  expect(r.out).toContain(`PATH=${join(ghome, 'bin')}:/usr/bin:/bin`)
  // 설치하면서 라이브러리의 mise.lock을 고치지 않게 한다(2026-10-14 fresh install 실험)
  expect(r.out).toContain('MISE_LOCKED=1')
})

test('라이브러리에 node_modules가 없으면 bun.lock 그대로 먼저 설치한다', () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-boot-')))
  const ghome = join(home, '.gotechy')
  fakeMise(ghome)
  // node_modules가 없는 라이브러리 사본(부트스트랩은 자기 위치로 라이브러리를 찾는다)
  const lib = join(home, 'lib')
  mkdirSync(join(lib, 'bin'), { recursive: true })
  copyFileSync(join(LIB, 'bin', 'gotechy'), join(lib, 'bin', 'gotechy'))
  copyFileSync(join(LIB, 'train.yaml'), join(lib, 'train.yaml'))
  const r = Bun.spawnSync({
    cmd: ['/bin/sh', join(lib, 'bin', 'gotechy'), 'inbox'],
    env: { PATH: '/usr/bin:/bin', HOME: home, GOTECHY_HOME: ghome },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  expect(r.exitCode).toBe(0)
  // 설치 출력은 stderr로 보내 CLI의 stdout을 섞지 않는다
  expect(r.stderr.toString()).toContain(`mise exec -C ${lib} -- bun install --frozen-lockfile`)
  expect(r.stdout.toString().split('\n')[0]).toBe(
    `mise exec -C ${lib} -- bun ${lib}/src/cli.ts inbox`,
  )
})
