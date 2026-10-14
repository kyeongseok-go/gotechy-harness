// contract.md 10.7절, 10.2절: init은 팩을 apm으로 train의 커밋에 고정해 깔고, doctor는 그 변조를 잡는다.
// 네트워크 없이 돌리려고 GitHub 주소를 git insteadOf로 임시 bare 저장소에 돌린다. 그 저장소에는 지금 라이브러리의
// owner-protocol을 담은 커밋 하나를 만든다. 실제 train 커밋을 옮기지 않는 이유는, 이 맥의 저장소가 네트워크 공유에 있어
// 객체 1천 개를 읽는 데 2분이 걸렸기 때문이다(2026-10-15). 실제 GitHub 경로는 증거 폴더에 실측으로 남긴다.
// CLI 테스트는 apm 설치 전에 끝나는 경로(apm 없음, 충돌, 알 수 없는 팩)를 실제 train으로 본다.
// apm이 없으면 건너뛰지 않고 실패한다(contract.md 10.6절).
import { beforeAll, describe, expect, test } from 'bun:test'
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
import { parse } from 'yaml'
import { parseTrain } from '../../src/core/train'
import { runDoctor } from '../../src/runtime/doctor'
import { initProject } from '../../src/runtime/init'
import { checkPacks, installPacks } from '../../src/runtime/packs'
import { LIB } from './helpers'

const APM = Bun.which('apm', { PATH: process.env.PATH ?? '' })
const train = parseTrain(readFileSync(join(LIB, 'train.yaml'), 'utf8'))
const SKILL = readFileSync(join(LIB, 'skills', 'owner-protocol', 'SKILL.md'), 'utf8')
// GitHub에 없는 이름. insteadOf가 빠지면 설치가 실패해 네트워크로 새지 않았음을 보여 준다
const SOURCE = 'gotechy-test/fixture-lib'
let REF = ''
let DEP = ''

const base = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-apm-')))
let env: Record<string, string> = {}

function git(args: string[], cwd: string) {
  const r = Bun.spawnSync({
    cmd: ['git', '-c', 'core.hooksPath=/dev/null', ...args],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { PATH: process.env.PATH ?? '', HOME: base, GIT_CONFIG_GLOBAL: '/dev/null' },
  })
  if (r.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`)
  return r.stdout.toString()
}

function newProject(): string {
  const root = realpathSync(mkdtempSync(join(base, 'p-')))
  git(['init', '-q', '-b', 'main'], root)
  return root
}

function gotechy(args: string[], cwd: string, extra: Record<string, string> = {}) {
  const r = Bun.spawnSync({
    cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), ...args],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...env, ...extra },
  })
  return { code: r.exitCode, out: `${r.stdout.toString()}${r.stderr.toString()}` }
}

beforeAll(() => {
  const src = join(base, 'src')
  mkdirSync(join(src, 'skills', 'owner-protocol'), { recursive: true })
  writeFileSync(join(src, 'skills', 'owner-protocol', 'SKILL.md'), SKILL)
  git(['init', '-q', '-b', 'main'], src)
  git(['add', '-A'], src)
  git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'skills'], src)
  REF = git(['rev-parse', 'HEAD'], src).trim()
  DEP = `${SOURCE}/skills/owner-protocol#${REF}`
  const bare = join(base, 'lib.git')
  git(['clone', '-q', '--bare', src, bare], base)
  const cfg = join(base, 'gitconfig')
  writeFileSync(cfg, `[url "file://${bare}"]\n\tinsteadOf = https://github.com/${SOURCE}\n`)
  const home = join(base, 'home')
  mkdirSync(home)
  env = {
    PATH: process.env.PATH ?? '',
    HOME: home,
    GIT_CONFIG_GLOBAL: cfg,
    GIT_CONFIG_NOSYSTEM: '1',
    GOTECHY_HOME: join(base, 'gotechy'),
    TERM: 'dumb',
  }
})

async function initWithPacks(root: string, packs = ['owner']) {
  initProject(root, { hooks: false })
  return installPacks(root, packs, { source: SOURCE, ref: REF }, env)
}

describe('팩 설치 (apm)', () => {
  test('apm이 PATH에 있다 (이 테스트들의 전제. bin/gotechy test나 CI의 apm 설치 단계로 돌린다)', () => {
    expect(APM).toBeTruthy()
  })

  test('owner 팩을 고정한 커밋으로 두 곳에 깔고, 락에는 로컬 경로가 없다', async () => {
    const root = newProject()
    const r = await initWithPacks(root)
    expect(r.errors).toEqual([])
    for (const d of ['.claude/skills', '.agents/skills'])
      expect(readFileSync(join(root, d, 'owner-protocol', 'SKILL.md'), 'utf8')).toBe(SKILL)
    const m = parse(readFileSync(join(root, 'apm.yml'), 'utf8'))
    expect(m.targets).toEqual(['claude', 'agent-skills'])
    expect(m.dependencies.apm).toEqual([DEP])
    const lockText = readFileSync(join(root, 'apm.lock.yaml'), 'utf8')
    expect(parse(lockText).dependencies[0].resolved_commit).toBe(REF)
    for (const local of [base, root, '/Users/', '/private/', '/home/', 'file://'])
      expect({ local, found: lockText.includes(local) }).toEqual({ local, found: false })
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('apm_modules/')
  })

  test('다시 실행해도 apm.yml과 락이 그대로다', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    const before = ['apm.yml', 'apm.lock.yaml'].map((f) => readFileSync(join(root, f), 'utf8'))
    const again = await initWithPacks(root)
    expect(again.errors).toEqual([])
    expect(again.skipped).toContain('apm.yml')
    const after = ['apm.yml', 'apm.lock.yaml'].map((f) => readFileSync(join(root, f), 'utf8'))
    expect(after).toEqual(before)
  })

  test('예전 init이 복사한 스킬 폴더가 있으면 덮어쓰지 않고 지울 폴더를 알린다', async () => {
    for (const dir of ['.claude/skills', '.agents/skills']) {
      const root = newProject()
      const old = join(root, dir, 'owner-protocol')
      mkdirSync(old, { recursive: true })
      writeFileSync(join(old, 'SKILL.md'), 'old copy\n')
      const r = await initWithPacks(root)
      expect(r.errors.join('\n')).toContain(`${dir}/owner-protocol`)
      expect(readFileSync(join(old, 'SKILL.md'), 'utf8')).toBe('old copy\n')
      expect(existsSync(join(root, 'apm.yml'))).toBe(false)
    }
  })

  test('apm이 없으면 팩을 깔지 않고 apm.yml도 쓰지 않는다', async () => {
    const root = newProject()
    initProject(root, { hooks: false })
    const r = await installPacks(
      root,
      ['owner'],
      { source: SOURCE, ref: REF },
      {
        ...env,
        PATH: '/usr/bin:/bin',
      },
    )
    expect(r.errors.join('\n')).toContain('apm')
    expect(existsSync(join(root, 'apm.yml'))).toBe(false)
  })

  test('apm install이 실패하면(없는 커밋) 오류를 돌려준다', async () => {
    const root = newProject()
    initProject(root, { hooks: false })
    const r = await installPacks(root, ['owner'], { source: SOURCE, ref: 'c'.repeat(40) }, env)
    expect(r.errors.join('\n')).toContain('apm install')
  })

  test('apm이 exit 0이어도 한 곳을 건너뛰었거나 다른 커밋으로 깔았으면 오류다', async () => {
    // 실제 apm은 관리하지 않는 폴더를 건너뛰고도 exit 0이다(2026-10-15 실험). 그런 apm을 흉내 내는 가짜 apm
    for (const [commit, files] of [
      [REF, ['.agents/skills/owner-protocol/SKILL.md']],
      [
        'd'.repeat(40),
        ['.agents/skills/owner-protocol/SKILL.md', '.claude/skills/owner-protocol/SKILL.md'],
      ],
    ] as const) {
      const root = newProject()
      initProject(root, { hooks: false })
      const bin = realpathSync(mkdtempSync(join(base, 'fakeapm-')))
      const lock = `dependencies:\n- repo_url: ${SOURCE}\n  virtual_path: skills/owner-protocol\n  resolved_commit: ${commit}\n  deployed_files:\n${files.map((f) => `  - ${f}`).join('\n')}\n`
      writeFileSync(join(bin, 'lock.yaml'), lock)
      writeFileSync(join(bin, 'apm'), `#!/bin/sh\ncp '${join(bin, 'lock.yaml')}' apm.lock.yaml\n`)
      chmodSync(join(bin, 'apm'), 0o755)
      const r = await installPacks(
        root,
        ['owner'],
        { source: SOURCE, ref: REF },
        {
          ...env,
          PATH: `${bin}:/usr/bin:/bin`,
        },
      )
      expect({ commit, failed: r.errors.length > 0 }).toEqual({ commit, failed: true })
    }
  })
})

describe('gotechy init (CLI, 실제 train)', () => {
  test('팩 없이 init하면 apm을 부르지 않고 apm.yml도 만들지 않는다', () => {
    const root = newProject()
    const r = gotechy(['init', '--packs', ''], root, { PATH: '/usr/bin:/bin' })
    expect(r.code).toBe(0)
    expect(existsSync(join(root, 'orchestration', 'tasks'))).toBe(true)
    expect(existsSync(join(root, 'apm.yml'))).toBe(false)
  })

  test('apm이 없으면 exit 1, 골격은 만든다', () => {
    const root = newProject()
    const r = gotechy(['init', '--packs', 'owner'], root, { PATH: '/usr/bin:/bin' })
    expect(r.code).toBe(1)
    expect(r.out).toContain('apm')
    expect(existsSync(join(root, 'orchestration', 'tasks'))).toBe(true)
    expect(existsSync(join(root, '.claude', 'skills', 'owner-protocol'))).toBe(false)
  })

  test('알 수 없는 팩이면 exit 1', () => {
    const r = gotechy(['init', '--packs', 'nope'], newProject())
    expect(r.code).toBe(1)
    expect(r.out).toContain('nope')
  })

  test('예전 init이 복사한 스킬 폴더가 있으면 exit 1, 폴더는 그대로', () => {
    const root = newProject()
    const old = join(root, '.claude', 'skills', 'owner-protocol')
    mkdirSync(old, { recursive: true })
    writeFileSync(join(old, 'SKILL.md'), 'old copy\n')
    const r = gotechy(['init', '--packs', 'owner'], root)
    expect(r.code).toBe(1)
    expect(r.out).toContain('.claude/skills/owner-protocol')
    expect(readFileSync(join(old, 'SKILL.md'), 'utf8')).toBe('old copy\n')
  })

  test('apm.yml에 같은 스킬이 train과 다른 커밋으로 있으면 바꾸지 않고 exit 1', () => {
    const root = newProject()
    const before = `name: p\nversion: 0.0.0\ntargets: [claude, agent-skills]\ndependencies:\n  apm:\n    - ${train.packs.source}/skills/owner-protocol#${'0'.repeat(40)}\n`
    writeFileSync(join(root, 'apm.yml'), before)
    const r = gotechy(['init', '--packs', 'owner'], root)
    expect(r.code).toBe(1)
    expect(r.out).toContain('0'.repeat(40))
    expect(readFileSync(join(root, 'apm.yml'), 'utf8')).toBe(before)
  })
})

describe('doctor의 프로젝트 팩 검사', () => {
  test('깔린 팩을 고치면 실패하고, apm install --frozen으로 되돌리면 통과한다', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    expect((await checkPacks(root, env))?.status).toBe('ok')

    writeFileSync(join(root, '.claude', 'skills', 'owner-protocol', 'SKILL.md'), `${SKILL}evil\n`)
    const bad = await checkPacks(root, env)
    expect(bad?.status).toBe('fail')
    expect(bad?.fix).toContain('apm install --frozen')

    const fix = Bun.spawnSync({ cmd: [APM as string, 'install', '--frozen'], cwd: root, env })
    expect(fix.exitCode).toBe(0)
    expect((await checkPacks(root, env))?.status).toBe('ok')
  })

  test('doctor를 프로젝트 안에서 돌리면 팩 검사가 결과에 들어간다', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    const opts = { trainFile: join(LIB, 'train.yaml'), libRoot: LIB, home: env.HOME as string }
    const inProject = await runDoctor({ ...opts, pathEnv: env.PATH, project: root })
    expect(inProject.checks.find((c) => c.name === '팩')?.status).toBe('ok')
    const outside = await runDoctor({ ...opts, pathEnv: env.PATH })
    expect(outside.checks.find((c) => c.name === '팩')).toBeUndefined()
  })

  test('apm.yml만 있고 락이 없으면 실패, 둘 다 없으면 검사하지 않는다', async () => {
    const root = newProject()
    expect(await checkPacks(root, env)).toBeUndefined()
    writeFileSync(join(root, 'apm.yml'), 'name: p\nversion: 0.0.0\n')
    const r = await checkPacks(root, env)
    expect(r?.status).toBe('fail')
    expect(r?.detail).toContain('apm.lock.yaml')
  })

  test('apm이 없으면 실패로 알린다', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    const r = await checkPacks(root, { ...env, PATH: '/usr/bin:/bin' })
    expect(r?.status).toBe('fail')
    expect(r?.detail).toContain('apm')
  })
})
