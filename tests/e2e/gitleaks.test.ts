// contract.md 10.4절 gitleaks hook과 doctor --history의 수용 테스트(Validation 16).
// gitleaks가 없는 환경(CI)에서는 건너뛴다. 가짜 토큰과 주민번호는 실행할 때 만들어 저장소에 남기지 않는다.
import { beforeEach, describe, expect, test } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runDoctor } from '../../src/runtime/doctor'
import { initProject } from '../../src/runtime/init'

const GITLEAKS = process.env.GOTECHY_GITLEAKS ?? Bun.which('gitleaks') ?? undefined
const LIB = join(import.meta.dir, '..', '..')
const env = { ...process.env, ...(GITLEAKS ? { GOTECHY_GITLEAKS: GITLEAKS } : {}) }
const git = (args: string[], cwd: string) => {
  const r = Bun.spawnSync({
    cmd: ['git', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
    cwd,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return { code: r.exitCode, err: r.stderr.toString() }
}
const fakeToken = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return `ghp_${[...randomBytes(36)].map((b) => abc[b % abc.length]).join('')}`
}
const fakeRrn = () => ['900101', '1234567'].join('-')

let root: string
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-leak-')))
  git(['init', '-q', '-b', 'main'], root)
  writeFileSync(join(root, 'README.md'), '# 깨끗한 저장소\n')
  // hook은 임시 GOTECHY_HOME에 깐다. 실제 ~/.gotechy를 건드리지 않는다
  initProject(root, {
    gotechyHome: realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-gh-'))),
  })
  git(['add', '-A'], root)
})

describe.skipIf(!GITLEAKS)('gitleaks hook (Validation 16)', () => {
  test('init은 hook을 설정하고, 깨끗한 커밋은 통과한다', () => {
    expect(git(['commit', '-qm', 'init'], root).code).toBe(0)
  })

  test('가짜 토큰이 든 커밋을 막는다', () => {
    git(['commit', '-qm', 'init'], root)
    writeFileSync(join(root, 'config.txt'), `token=${fakeToken()}\n`)
    git(['add', 'config.txt'], root)
    const r = git(['commit', '-qm', 'leak'], root)
    expect(r.code).not.toBe(0)
    expect(r.err).toContain('커밋을 막았어요')
  })

  test('가짜 주민등록번호가 든 커밋을 막는다', () => {
    git(['commit', '-qm', 'init'], root)
    writeFileSync(join(root, 'people.txt'), `홍길동 ${fakeRrn()}\n`)
    git(['add', 'people.txt'], root)
    expect(git(['commit', '-qm', 'pii'], root).code).not.toBe(0)
  })

  test('doctor --history는 hook을 우회해 들어간 이력 속 토큰을 찾는다', async () => {
    git(['commit', '-qm', 'init'], root)
    const opts = { trainFile: join(LIB, 'train.yaml'), libRoot: LIB, home: root }
    const clean = await runDoctor({ ...opts, history: { root, gitleaks: GITLEAKS as string } })
    expect(clean.checks.find((c) => c.name === 'git 이력')?.status).toBe('ok')
    writeFileSync(join(root, 'config.txt'), `token=${fakeToken()}\n`)
    git(['add', 'config.txt'], root)
    expect(git(['commit', '-qm', 'sneak', '--no-verify'], root).code).toBe(0)
    const dirty = await runDoctor({ ...opts, history: { root, gitleaks: GITLEAKS as string } })
    expect(dirty.checks.find((c) => c.name === 'git 이력')?.status).toBe('fail')
  })
})

test('gitleaks가 없으면 hook은 커밋을 막는다 (fail-closed)', () => {
  const r = Bun.spawnSync({
    cmd: ['git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init'],
    cwd: root,
    env: { ...process.env, GOTECHY_GITLEAKS: '/nonexistent/gitleaks' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  expect(r.exitCode).not.toBe(0)
  expect(r.stderr.toString()).toContain('gitleaks가 없어')
})
