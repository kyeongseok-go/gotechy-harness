// contract.md 10.5절 bin/gotechy 부트스트랩. 실제 다운로드 없이 dry-run과 이미 설치된 mise로 넘기는 경로만 본다.
import { expect, test } from 'bun:test'
import {
  chmodSync,
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

test('mise가 이미 있으면 내려받지 않고 라이브러리의 CLI로 넘긴다', () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-boot-')))
  const ghome = join(home, '.gotechy')
  mkdirSync(join(ghome, 'bin'), { recursive: true })
  const fake = join(ghome, 'bin', 'mise')
  writeFileSync(fake, '#!/bin/sh\necho "mise $*"\n')
  chmodSync(fake, 0o755)
  const r = run(['inbox'], { HOME: home, GOTECHY_HOME: ghome })
  expect(r.code).toBe(0)
  expect(r.out.trim()).toBe(`mise exec -C ${LIB} -- bun ${LIB}/src/cli.ts inbox`)
})
