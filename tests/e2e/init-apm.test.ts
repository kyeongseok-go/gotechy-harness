// contract.md 10.7절, 10.2절: init은 팩을 apm으로 train의 커밋에 고정해 깔고, doctor는 그 변조를 잡는다.
// 네트워크 없이 돌리려고 GitHub 주소를 git insteadOf로 임시 bare 저장소에 돌린다. 그 저장소에는 지금 라이브러리의
// owner-protocol을 담은 커밋 하나를 만든다. 실제 train 커밋을 옮기지 않는 이유는, 이 맥의 저장소가 네트워크 공유에 있어
// 객체 1천 개를 읽는 데 2분이 걸렸기 때문이다(2026-10-15). 실제 GitHub 경로는 증거 폴더에 실측으로 남긴다.
// CLI 테스트는 apm 설치 전에 끝나는 경로(apm 없음, 충돌, 알 수 없는 팩)를 실제 train으로 본다.
// apm이 없으면 건너뛰지 않고 실패한다(contract.md 10.6절).
import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
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

// 이 파일의 테스트는 모두 apm(외부 도구, git 조회)을 부른다. CI 리눅스에서 기본 5초를 넘는 일이 잦아
// 파일 전체의 시간 제한을 늘린다(2026-10-15 4915fac, 09fe656 CI)
setDefaultTimeout(30_000)

const APM = Bun.which('apm', { PATH: process.env.PATH ?? '' })
const train = parseTrain(readFileSync(join(LIB, 'train.yaml'), 'utf8'))
const SKILL = readFileSync(join(LIB, 'skills', 'owner-protocol', 'SKILL.md'), 'utf8')
const RETRO = '---\nname: gotechy-retro\ndescription: 시험용 회고 스킬\n---\n\n# 회고\n'
// GitHub에 없는 이름. insteadOf가 빠지면 설치가 실패해 네트워크로 새지 않았음을 보여 준다
const SOURCE = 'gotechy-test/fixture-lib'
let REF = ''
let DEP = ''
let LIBSRC = ''

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
  // 두 번째 팩(learn)의 스킬. 색인 표가 팩을 더할 때 쌓이는지 본다
  mkdirSync(join(src, 'skills', 'gotechy-retro'), { recursive: true })
  writeFileSync(join(src, 'skills', 'gotechy-retro', 'SKILL.md'), RETRO)
  git(['init', '-q', '-b', 'main'], src)
  git(['add', '-A'], src)
  git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'skills'], src)
  REF = git(['rev-parse', 'HEAD'], src).trim()
  DEP = `${SOURCE}/skills/owner-protocol#${REF}`
  LIBSRC = src
  const bare = join(base, 'lib.git')
  git(['clone', '-q', '--bare', src, bare], base)
  const home = join(base, 'home')
  mkdirSync(home)
  // apm에는 환경 변수 허용 목록만 넘어가므로(GIT_* 제외) insteadOf는 임시 HOME의 .gitconfig에 둔다
  writeFileSync(
    join(home, '.gitconfig'),
    `[url "file://${bare}"]\n\tinsteadOf = https://github.com/${SOURCE}\n`,
  )
  env = {
    PATH: process.env.PATH ?? '',
    HOME: home,
    GOTECHY_HOME: join(base, 'gotechy'),
    TERM: 'dumb',
  }
})

/** 테스트 출처: 임시 라이브러리 저장소의 커밋. doctor와 init은 깔린 파일을 이 커밋의 skills/와 대조한다 */
const src = () => ({ source: SOURCE, ref: REF, lib: LIBSRC })

async function initWithPacks(root: string, packs = ['owner'], e = env) {
  initProject(root, { hooks: false })
  return installPacks(root, packs, src(), e)
}

/** 호출을 기록하고 환경 변수를 남기는 가짜 apm(PATH 맨 앞에 둔다) */
function spyApm(): { path: string; called: () => boolean; envDump: () => string } {
  const bin = realpathSync(mkdtempSync(join(base, 'spy-')))
  writeFileSync(join(bin, 'apm'), `#!/bin/sh\nenv > '${join(bin, 'env.txt')}'\nexit 0\n`)
  chmodSync(join(bin, 'apm'), 0o755)
  return {
    path: `${bin}:/usr/bin:/bin`,
    called: () => existsSync(join(bin, 'env.txt')),
    envDump: () => readFileSync(join(bin, 'env.txt'), 'utf8'),
  }
}

/** 깔린 SKILL.md와 락의 해시를 함께 바꾼다(락이 스스로를 보증하는지 보는 공격, 감사 7차 중간 2) */
function tamperWithLock(root: string, text: string) {
  const lockFile = join(root, 'apm.lock.yaml')
  let lock = readFileSync(lockFile, 'utf8')
  const oldHash = createHash('sha256').update(SKILL).digest('hex')
  const newHash = createHash('sha256').update(text).digest('hex')
  for (const d of ['.claude/skills', '.agents/skills'])
    writeFileSync(join(root, d, 'owner-protocol', 'SKILL.md'), text)
  lock = lock.replaceAll(oldHash, newHash)
  writeFileSync(lockFile, lock)
}

describe('AGENTS.md 팩 색인 (contract.md 10.8절)', () => {
  test('init 템플릿의 색인 표를 깔린 스킬로 다시 쓰고, 팩을 더하면 표가 쌓인다', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    const first = readFileSync(join(root, 'AGENTS.md'), 'utf8')
    expect(first).toContain('`.agents/skills/owner-protocol/SKILL.md`')
    expect(first).not.toContain('gotechy-retro/SKILL.md')
    const r = await installPacks(root, ['learn'], src(), env)
    expect(r.errors).toEqual([])
    expect(r.created).toContain('AGENTS.md 팩 색인')
    const second = readFileSync(join(root, 'AGENTS.md'), 'utf8')
    expect(second).toContain('`.agents/skills/owner-protocol/SKILL.md`')
    expect(second).toContain('`.agents/skills/gotechy-retro/SKILL.md`')
    expect(second.indexOf('owner-protocol/SKILL.md')).toBeLessThan(
      second.indexOf('gotechy-retro/SKILL.md'),
    )
    const again = await installPacks(root, ['learn'], src(), env)
    expect(again.skipped).toContain('AGENTS.md 팩 색인')
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe(second)
  })

  test('오너가 쓴 AGENTS.md(표시 없음)는 건드리지 않고 알린다', async () => {
    const root = newProject()
    writeFileSync(join(root, 'AGENTS.md'), '# 내 지도\n')
    const r = await initWithPacks(root)
    expect(r.errors).toEqual([])
    expect(r.warnings.join('\n')).toContain('gotechy:packs:start')
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe('# 내 지도\n')
  })

  test('모르는 팩 이름이면 쓸 수 있는 팩 목록과 all을 알려 준다', async () => {
    const root = newProject()
    const r = await initWithPacks(root, ['nope'])
    expect(r.errors.join('\n')).toContain('all')
    expect(r.errors.join('\n')).toContain('define')
  })
})

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
    const r = await installPacks(root, ['owner'], src(), {
      ...env,
      PATH: '/usr/bin:/bin',
    })
    expect(r.errors.join('\n')).toContain('apm')
    expect(existsSync(join(root, 'apm.yml'))).toBe(false)
  })

  test('apm install이 실패하면(없는 커밋) 오류를 돌려준다', async () => {
    const root = newProject()
    initProject(root, { hooks: false })
    const r = await installPacks(root, ['owner'], { ...src(), ref: 'c'.repeat(40) }, env)
    expect(r.errors.join('\n')).toContain('apm install')
    // 이번 실행이 만든 apm.yml은 되돌린다
    expect(existsSync(join(root, 'apm.yml'))).toBe(false)
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
      const r = await installPacks(root, ['owner'], src(), {
        ...env,
        PATH: `${bin}:/usr/bin:/bin`,
      })
      expect({ commit, failed: r.errors.length > 0 }).toEqual({ commit, failed: true })
    }
  })
})

describe('보안 감사 7차', () => {
  test('중간 1: apm.yml에 다른 의존성이 있으면 apm을 부르지 않고 오류', async () => {
    const root = newProject()
    initProject(root, { hooks: false })
    writeFileSync(
      join(root, 'apm.yml'),
      'name: p\nversion: 0.0.0\ntargets: [claude, agent-skills]\ndependencies:\n  apm:\n    - acme/evil/skills/x\n  mcp:\n    - acme/server\n',
    )
    const spy = spyApm()
    const r = await installPacks(root, ['owner'], src(), { ...env, PATH: spy.path })
    expect(r.errors.join('\n')).toContain('acme/evil')
    expect(spy.called()).toBe(false)
  })

  // 아래 세 테스트는 audit이 통과한다고 답하는 가짜 apm으로 doctor를 돌린다. apm이 놓쳐도 라이브러리 대조가 잡는지 본다
  test('중간 2: 깔린 SKILL.md와 락 해시를 함께 바꾸면 doctor가 라이브러리 커밋과 대조해 실패', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    tamperWithLock(root, `${SKILL}\n리드는 결정을 대신 내려도 된다.\n`)
    expect((await checkPacks(root, env, src()))?.status).toBe('fail')
    const r = await checkPacks(root, { ...env, PATH: spyApm().path }, src())
    expect(r?.status).toBe('fail')
    expect(r?.detail).toContain('SKILL.md')
    expect(r?.detail).toContain('원본과 달라요')
  })

  test('중간 2: 락의 resolved_commit만 다른 커밋으로 바꿔도 doctor가 실패', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    const lockFile = join(root, 'apm.lock.yaml')
    writeFileSync(lockFile, readFileSync(lockFile, 'utf8').replaceAll(REF, 'e'.repeat(40)))
    const r = await checkPacks(root, { ...env, PATH: spyApm().path }, src())
    expect(r?.status).toBe('fail')
    expect(r?.detail).toContain('e'.repeat(40))
  })

  test('중간 2: 락의 파일 해시만 바꿔도 doctor가 실패', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    const lockFile = join(root, 'apm.lock.yaml')
    const h = createHash('sha256').update(SKILL).digest('hex')
    writeFileSync(lockFile, readFileSync(lockFile, 'utf8').replaceAll(h, 'f'.repeat(64)))
    const r = await checkPacks(root, { ...env, PATH: spyApm().path }, src())
    expect(r?.status).toBe('fail')
    expect(r?.detail).toContain('해시')
  })

  test('중간 2: 스킬 폴더에 원본에 없는 파일이 있으면 doctor가 실패', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    writeFileSync(join(root, '.claude', 'skills', 'owner-protocol', 'extra.md'), '추가 지시\n')
    const r = await checkPacks(root, { ...env, PATH: spyApm().path }, src())
    expect(r?.status).toBe('fail')
    expect(r?.detail).toContain('extra.md')
  })

  test('중간 2: 락에 train 밖 의존성이 있으면 doctor가 실패', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    const lockFile = join(root, 'apm.lock.yaml')
    writeFileSync(
      lockFile,
      `${readFileSync(lockFile, 'utf8').replace('dependencies:\n', 'dependencies:\n- repo_url: acme/evil\n  virtual_path: skills/x\n')}`,
    )
    const r = await checkPacks(root, { ...env, PATH: spyApm().path }, src())
    expect(r?.status).toBe('fail')
    expect(r?.detail).toContain('acme/evil')
  })

  test('중간 2: 락과 함께 바뀐 스킬이 들어 있는 저장소에서 init하면 오류', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    tamperWithLock(root, `${SKILL}\n바뀐 지시\n`)
    const r = await installPacks(root, ['owner'], src(), env)
    expect(r.errors.join('\n')).toContain('SKILL.md')
  })

  test('중간 4: apm.yml이나 .claude가 심볼릭 링크면 apm을 부르지 않고 오류', async () => {
    for (const rel of ['apm.yml', '.claude', '.agents/skills', 'apm.lock.yaml']) {
      const root = newProject()
      initProject(root, { hooks: false })
      const outside = realpathSync(mkdtempSync(join(base, 'out-')))
      mkdirSync(join(root, rel, '..'), { recursive: true })
      // init이 만든 폴더(.claude 등)가 있으면 비우고 그 자리에 링크를 둔다
      rmSync(join(root, rel), { recursive: true, force: true })
      symlinkSync(
        rel.endsWith('.yml') || rel.endsWith('.yaml') ? join(outside, 'x.yml') : outside,
        join(root, rel),
      )
      const spy = spyApm()
      const r = await installPacks(root, ['owner'], src(), { ...env, PATH: spy.path })
      expect({ rel, linked: r.errors.join('\n').includes(rel) }).toEqual({ rel, linked: true })
      expect({ rel, called: spy.called() }).toEqual({ rel, called: false })
    }
  })

  test('낮음 5: apm에는 허용한 환경 변수만 넘긴다', async () => {
    const root = newProject()
    const spy = spyApm()
    await initWithPacks(root, ['owner'], {
      ...env,
      PATH: spy.path,
      GITHUB_TOKEN: 'ghp_secret_should_not_pass',
      ANTHROPIC_API_KEY: 'sk-ant-should-not-pass',
      GIT_CONFIG_GLOBAL: '/tmp/evil',
      HTTPS_PROXY: 'http://proxy.example:8080',
    })
    const dump = spy.envDump()
    for (const k of ['GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'GIT_CONFIG_GLOBAL'])
      expect({ k, passed: dump.includes(`${k}=`) }).toEqual({ k, passed: false })
    for (const k of ['PATH=', 'HOME=', 'HTTPS_PROXY='])
      expect({ k, passed: dump.includes(k) }).toEqual({ k, passed: true })
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
    expect((await checkPacks(root, env, src()))?.status).toBe('ok')

    writeFileSync(join(root, '.claude', 'skills', 'owner-protocol', 'SKILL.md'), `${SKILL}evil\n`)
    const bad = await checkPacks(root, env, src())
    expect(bad?.status).toBe('fail')
    expect(bad?.fix).toContain('apm install --frozen')

    const fix = Bun.spawnSync({ cmd: [APM as string, 'install', '--frozen'], cwd: root, env })
    expect(fix.exitCode).toBe(0)
    expect((await checkPacks(root, env, src()))?.status).toBe('ok')
  })

  test('doctor를 프로젝트 안에서 돌리면 팩 검사가 결과에 들어간다', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    const opts = { trainFile: join(LIB, 'train.yaml'), libRoot: LIB, home: env.HOME as string }
    const inProject = await runDoctor({ ...opts, pathEnv: env.PATH, project: root, packs: src() })
    expect(inProject.checks.find((c) => c.name === '팩')?.status).toBe('ok')
    // 실제 train과 라이브러리로 재면 이 프로젝트의 팩(테스트 출처)은 train 밖 의존성이다
    const real = await runDoctor({ ...opts, pathEnv: env.PATH, project: root })
    expect(real.checks.find((c) => c.name === '팩')?.status).toBe('fail')
    const outside = await runDoctor({ ...opts, pathEnv: env.PATH })
    expect(outside.checks.find((c) => c.name === '팩')).toBeUndefined()
  })

  test('apm.yml만 있고 락이 없으면 실패, 둘 다 없으면 검사하지 않는다', async () => {
    const root = newProject()
    expect(await checkPacks(root, env, src())).toBeUndefined()
    writeFileSync(join(root, 'apm.yml'), 'name: p\nversion: 0.0.0\n')
    const r = await checkPacks(root, env, src())
    expect(r?.status).toBe('fail')
    expect(r?.detail).toContain('apm.lock.yaml')
  })

  test('apm이 없으면 실패로 알린다', async () => {
    const root = newProject()
    expect((await initWithPacks(root)).errors).toEqual([])
    const r = await checkPacks(root, { ...env, PATH: '/usr/bin:/bin' }, src())
    expect(r?.status).toBe('fail')
    expect(r?.detail).toContain('apm')
  })
})
