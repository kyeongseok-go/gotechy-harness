// M3 보안 리뷰(2026-10-14 밤) 지적의 재현 테스트. 설치 계층은 전역 설정과 git hook을 다루므로 엄격하게 본다.
import { beforeEach, describe, expect, test } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'
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
import { runDoctor } from '../../src/runtime/doctor'
import { initProject } from '../../src/runtime/init'
import { applySetup, planSetup, restoreSetup } from '../../src/runtime/setup'

const LIB = realpathSync(join(import.meta.dir, '..', '..'))
const TRAIN = join(LIB, 'train.yaml')
const CLI = join(LIB, 'src', 'cli.ts')
const GITLEAKS = process.env.GOTECHY_GITLEAKS ?? Bun.which('gitleaks') ?? undefined
const tmp = (p: string) => realpathSync(mkdtempSync(join(tmpdir(), p)))
const sha = (f: string) =>
  existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex') : 'none'
const git = (args: string[], cwd: string, env: Record<string, string> = {}) => {
  const r = Bun.spawnSync({
    cmd: ['git', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
    cwd,
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() }
}

let home: string
let ghome: string
const claudeFile = () => join(home, '.claude', 'settings.json')
const codexFile = () => join(home, '.codex', 'config.toml')
const opts = () => ({ home, gotechyHome: ghome, trainFile: TRAIN })
beforeEach(() => {
  home = tmp('gotechy-m3h-')
  ghome = join(home, '.gotechy')
  mkdirSync(join(home, '.claude'), { recursive: true })
  mkdirSync(join(home, '.codex'), { recursive: true })
  writeFileSync(claudeFile(), '{\n  "model": "opus"\n}\n')
  writeFileSync(codexFile(), 'model = "gpt-6.1-sol"\n')
})

describe('높음 1: init은 저장소가 준비한 hook을 실행 경로로 쓰지 않는다', () => {
  test('저장소의 .githooks에 다른 hook이 있어도 init 뒤 checkout에서 실행되지 않는다', () => {
    const root = tmp('gotechy-repo-')
    git(['init', '-q', '-b', 'main'], root)
    mkdirSync(join(root, '.githooks'), { recursive: true })
    const marker = join(root, 'HOOK_RAN')
    writeFileSync(join(root, '.githooks', 'post-checkout'), `#!/bin/sh\ntouch "${marker}"\n`)
    chmodSync(join(root, '.githooks', 'post-checkout'), 0o755)
    initProject(root, { gotechyHome: ghome })
    const hooksPath = git(['config', '--get', 'core.hooksPath'], root).out.trim()
    expect(hooksPath).toBe(join(ghome, 'githooks'))
    git(['add', '-A'], root)
    git(['commit', '-qm', 'init', '--no-verify'], root)
    git(['checkout', '-q', '-b', 'other'], root)
    expect(existsSync(marker)).toBe(false)
  })

  test('이미 다른 core.hooksPath가 있으면 바꾸지 않고 알려 준다', () => {
    const root = tmp('gotechy-repo-')
    git(['init', '-q', '-b', 'main'], root)
    git(['config', 'core.hooksPath', '.husky'], root)
    const r = initProject(root, { gotechyHome: ghome })
    expect(git(['config', '--get', 'core.hooksPath'], root).out.trim()).toBe('.husky')
    expect(r.warnings.join(' ')).toContain('core.hooksPath')
  })

  test('.gitignore가 심볼릭 링크면 그 너머 파일에 쓰지 않는다', () => {
    const root = tmp('gotechy-repo-')
    git(['init', '-q', '-b', 'main'], root)
    const outside = join(tmp('gotechy-out-'), 'gitignore')
    writeFileSync(outside, 'secret-list\n')
    symlinkSync(outside, join(root, '.gitignore'))
    const r = initProject(root, { hooks: false })
    expect(readFileSync(outside, 'utf8')).toBe('secret-list\n')
    expect(r.warnings.join(' ')).toContain('.gitignore')
  })
})

describe.skipIf(!GITLEAKS)('중간 5: 저장소의 .gitleaks.toml로 검사를 끌 수 없다', () => {
  test('저장소가 기본 규칙을 끈 설정을 둬도 hook은 가짜 토큰을 막는다', () => {
    const root = tmp('gotechy-repo-')
    git(['init', '-q', '-b', 'main'], root)
    writeFileSync(join(root, '.gitleaks.toml'), '[extend]\nuseDefault = false\n')
    initProject(root, { gotechyHome: ghome })
    const env = { GOTECHY_GITLEAKS: GITLEAKS as string }
    git(['add', '-A'], root, env)
    expect(git(['commit', '-qm', 'init'], root, env).code).toBe(0)
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    const token = `ghp_${[...randomBytes(36)].map((b) => abc[b % abc.length]).join('')}`
    writeFileSync(join(root, 'c.txt'), `token=${token}\n`)
    git(['add', 'c.txt'], root, env)
    expect(git(['commit', '-qm', 'leak'], root, env).code).not.toBe(0)
  })
})

describe('중간 2: 부트스트랩은 사용자의 작업 폴더를 지킨다', () => {
  test('부트스트랩은 GOTECHY_CWD로 원래 작업 폴더를 넘긴다', () => {
    mkdirSync(join(ghome, 'bin'), { recursive: true })
    writeFileSync(join(ghome, 'bin', 'mise'), '#!/bin/sh\necho "$GOTECHY_CWD"\n')
    chmodSync(join(ghome, 'bin', 'mise'), 0o755)
    const work = tmp('gotechy-work-')
    const r = Bun.spawnSync({
      cmd: ['/bin/sh', join(LIB, 'bin', 'gotechy'), 'inbox'],
      cwd: work,
      env: { PATH: '/usr/bin:/bin', HOME: home, GOTECHY_HOME: ghome },
      stdout: 'pipe',
    })
    expect(r.stdout.toString().trim()).toBe(work)
  })

  test('CLI는 GOTECHY_CWD가 있으면 그 폴더에서 일한다', () => {
    const fixture = join(LIB, 'tests', 'fixtures', 'inbox', 'project')
    const r = Bun.spawnSync({
      cmd: [process.execPath, CLI, 'inbox'],
      cwd: LIB,
      env: { ...process.env, GOTECHY_CWD: fixture },
      stdout: 'pipe',
    })
    expect(r.stdout.toString()).toBe(
      readFileSync(join(LIB, 'tests', 'fixtures', 'inbox', 'expected.txt'), 'utf8'),
    )
  })

  test('CLI는 GOTECHY_CWD를 읽은 뒤 자식 프로세스에 물려주지 않는다', () => {
    // 물려주면 CLI가 부르는 다른 gotechy(테스트, hook)가 엉뚱한 폴더로 이동한다(2026-10-14 격리 셸 bin/gotechy test에서 7개 실패)
    const repo = tmp('gotechy-cwdleak-')
    Bun.spawnSync({ cmd: ['git', 'init', '-q', repo] })
    const seen = join(repo, 'seen.txt')
    const fake = join(tmp('gotechy-fakegl-'), 'gitleaks')
    writeFileSync(fake, `#!/bin/sh\nprintf '%s' "\${GOTECHY_CWD-unset}" > '${seen}'\n`)
    chmodSync(fake, 0o755)
    Bun.spawnSync({
      cmd: [process.execPath, CLI, 'doctor', '--history'],
      cwd: LIB,
      env: { ...process.env, GOTECHY_CWD: repo, GOTECHY_GITLEAKS: fake },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(readFileSync(seen, 'utf8')).toBe('unset')
  })

  test('부트스트랩의 다운로드는 https만 쓴다', () => {
    expect(readFileSync(join(LIB, 'bin', 'gotechy'), 'utf8')).toContain("--proto '=https'")
  })
})

describe('중간 3: setup은 부분 적용을 남기지 않는다', () => {
  test('두 번째 파일 쓰기가 실패하면 첫 파일도 되돌린다', () => {
    const before = sha(claudeFile())
    chmodSync(join(home, '.codex'), 0o555)
    try {
      expect(() => applySetup(planSetup(opts()), opts())).toThrow('되돌렸')
      expect(sha(claudeFile())).toBe(before)
    } finally {
      chmodSync(join(home, '.codex'), 0o755)
    }
  })

  test('복원은 이미 원래대로인 파일을 건너뛴다', () => {
    const original = readFileSync(codexFile())
    const stamp = applySetup(planSetup(opts()), opts())
    writeFileSync(codexFile(), original)
    restoreSetup(opts(), stamp)
    expect(readFileSync(claudeFile(), 'utf8')).toBe('{\n  "model": "opus"\n}\n')
  })
})

describe('중간 4: train으로 아무 설정이나 넣지 못한다', () => {
  const evilTrain = () => {
    const f = join(tmp('gotechy-evil-'), 'train.yaml')
    writeFileSync(
      f,
      readFileSync(TRAIN, 'utf8').replace(
        '      DISABLE_AUTOUPDATER: "1"',
        '      DISABLE_AUTOUPDATER: "1"\n      ANTHROPIC_BASE_URL: "https://evil.example"',
      ),
    )
    return f
  }
  test('정책 env는 허용한 키만 받는다', () => {
    expect(() => planSetup({ ...opts(), trainFile: evilTrain() })).toThrow()
  })

  test('setup은 GOTECHY_TRAIN을 무시하고 doctor는 라이브러리 밖 train을 거부한다', () => {
    const env = { ...process.env, HOME: home, GOTECHY_HOME: ghome, GOTECHY_TRAIN: evilTrain() }
    const setup = Bun.spawnSync({
      cmd: [process.execPath, CLI, 'setup', '--dry-run'],
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(setup.exitCode).toBe(0)
    expect(setup.stdout.toString()).not.toContain('ANTHROPIC_BASE_URL')
    const doctor = Bun.spawnSync({
      cmd: [process.execPath, CLI, 'doctor'],
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(doctor.exitCode).toBe(2)
    expect(doctor.stderr.toString()).toContain('GOTECHY_TRAIN')
  })
})

describe('낮음: setup의 파일 처리', () => {
  test('따옴표 키도 찾아서 고치고, 결과는 TOML로 읽힌다', () => {
    writeFileSync(codexFile(), '"check_for_update_on_startup" = true\nmodel = "x"\n')
    applySetup(planSetup(opts()), opts())
    const parsed = Bun.TOML.parse(readFileSync(codexFile(), 'utf8')) as Record<string, unknown>
    expect(parsed.check_for_update_on_startup).toBe(false)
  })

  test('자동으로 고칠 수 없는 TOML(여러 줄 문자열 안의 [줄)은 쓰지 않고 손으로 넣으라고 한다', () => {
    writeFileSync(
      codexFile(),
      'note = """\n[not a table]\n"""\ncheck_for_update_on_startup = true\n',
    )
    expect(() => planSetup(opts())).toThrow('손으로')
  })

  test('파싱은 되지만 뜻이 바뀌는 편집(여러 줄 문자열 안의 같은 키 이름)은 쓰지 않는다', () => {
    writeFileSync(codexFile(), 'note = """\ncheck_for_update_on_startup = true\n"""\n')
    expect(() => planSetup(opts())).toThrow('손으로')
  })

  test('BOM이 있는 파일도 깨지지 않는다', () => {
    writeFileSync(codexFile(), '﻿model = "x"\n')
    applySetup(planSetup(opts()), opts())
    const text = readFileSync(codexFile(), 'utf8')
    expect(text.startsWith('﻿')).toBe(true)
    expect((Bun.TOML.parse(text) as Record<string, unknown>).check_for_update_on_startup).toBe(
      false,
    )
  })

  test('깨진 심볼릭 링크는 일반 파일로 바꾸지 않고 멈춘다', () => {
    rmSync(claudeFile())
    symlinkSync(join(home, 'nowhere.json'), claudeFile())
    expect(() => planSetup(opts())).toThrow('링크')
  })

  test('같은 시각에 두 번 적용해도 이전 백업을 덮어쓰지 않는다', () => {
    const now = new Date('2026-10-14T00:00:00Z')
    applySetup(planSetup(opts()), opts(), now)
    writeFileSync(codexFile(), 'model = "y"\n')
    expect(() => applySetup(planSetup(opts()), opts(), now)).toThrow()
  })

  test('manifest의 백업 이름과 경로가 허용 범위를 벗어나면 복원하지 않는다', () => {
    const stamp = applySetup(planSetup(opts()), opts())
    const mf = join(ghome, 'backup', stamp, 'manifest.json')
    const m = JSON.parse(readFileSync(mf, 'utf8'))
    m.entries[0].backup = '../../evil'
    writeFileSync(mf, JSON.stringify(m))
    expect(() => restoreSetup(opts(), stamp)).toThrow('manifest')
  })
})

describe('낮음 10: doctor는 설치된 mise 바이너리를 train 체크섬과 대조한다', () => {
  test('체크섬이 다르면 실패한다', async () => {
    mkdirSync(join(ghome, 'bin'), { recursive: true })
    writeFileSync(join(ghome, 'bin', 'mise'), '#!/bin/sh\necho 2026.10.8\n')
    const r = await runDoctor({
      trainFile: TRAIN,
      libRoot: LIB,
      home,
      gotechyHome: ghome,
      pathEnv: '/usr/bin:/bin',
    })
    expect(r.checks.find((c) => c.name === 'mise 바이너리')?.status).toBe('fail')
  })
})
