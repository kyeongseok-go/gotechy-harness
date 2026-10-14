// contract.md 10.2, 10.3절 doctor와 setup의 수용 테스트(Validation 13, 14, 15). 가짜 도구와 임시 HOME에서만 돈다.
import { beforeEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runDoctor } from '../../src/runtime/doctor'
import { applySetup, planSetup, restoreSetup } from '../../src/runtime/setup'

const LIB = join(import.meta.dir, '..', '..')
const TRAIN = join(LIB, 'train.yaml')
const MISMATCH = join(LIB, 'tests', 'fixtures', 'train', 'train-mismatch.yaml')
const VERSIONS: Record<string, string> = {
  mise: '2026.10.8 macos-arm64 (2026-10-11)',
  bun: '1.4.3',
  node: 'v24.21.0',
  uv: 'uv 0.13.0',
  gh: 'gh version 2.102.0 (2026-09-30)',
  apm: '0.33.0',
  gitleaks: '8.30.1',
  claude: '2.1.296 (Claude Code)',
  codex: 'codex-cli 0.162.1',
}
const tmp = (p: string) => realpathSync(mkdtempSync(join(tmpdir(), p)))
const sha = (f: string) =>
  existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex') : 'none'

let home: string
let bin: string
let ghome: string
const claudeFile = () => join(home, '.claude', 'settings.json')
const codexFile = () => join(home, '.codex', 'config.toml')
const CLAUDE_ORIGINAL =
  '{\n  "model": "opus",\n  "permissions": { "deny": ["Read(./secret.txt)"] }\n}\n'

function fakeTool(name: string, out: string) {
  const f = join(bin, name)
  writeFileSync(f, `#!/bin/sh\necho "${out}"\n`)
  chmodSync(f, 0o755)
}

beforeEach(() => {
  home = tmp('gotechy-home-')
  ghome = join(home, '.gotechy')
  bin = tmp('gotechy-bin-')
  for (const [k, v] of Object.entries(VERSIONS)) fakeTool(k, v)
  mkdirSync(join(home, '.claude'), { recursive: true })
  mkdirSync(join(home, '.codex'), { recursive: true })
  writeFileSync(claudeFile(), CLAUDE_ORIGINAL)
  chmodSync(claudeFile(), 0o640)
  writeFileSync(
    codexFile(),
    '# 내 설정\nmodel = "gpt-6.1-sol"\n\n[profiles.fast]\nmodel = "mini"\n',
  )
})

const opts = () => ({ home, gotechyHome: ghome, trainFile: TRAIN })
const doctor = (train = TRAIN) =>
  runDoctor({ trainFile: train, libRoot: LIB, home, pathEnv: `${bin}:/usr/bin:/bin` })

describe('setup (Validation 13, 14)', () => {
  test('--dry-run 계획은 두 설정 파일과 GOTECHY_HOME을 바꾸지 않는다', () => {
    const before = [sha(claudeFile()), sha(codexFile())]
    const plan = planSetup(opts())
    expect(plan.changes.map((c) => c.path).sort()).toEqual([claudeFile(), codexFile()].sort())
    expect([sha(claudeFile()), sha(codexFile())]).toEqual(before)
    expect(existsSync(ghome)).toBe(false)
  })

  test('적용하면 정책이 들어가고 기존 키, 주석, 권한은 그대로다', () => {
    applySetup(planSetup(opts()), opts())
    const c = JSON.parse(readFileSync(claudeFile(), 'utf8'))
    expect(c.model).toBe('opus')
    expect(c.env.DISABLE_AUTOUPDATER).toBe('1')
    expect(c.permissions.deny).toEqual(
      expect.arrayContaining(['Read(./secret.txt)', 'Bash(gotechy decide:*)', 'Bash(script:*)']),
    )
    expect(statSync(claudeFile()).mode & 0o777).toBe(0o640)
    const t = readFileSync(codexFile(), 'utf8')
    expect(t).toContain('# 내 설정')
    expect(t).toContain('[profiles.fast]')
    expect(t.indexOf('check_for_update_on_startup = false')).toBeLessThan(
      t.indexOf('[profiles.fast]'),
    )
    expect(planSetup(opts()).changes).toEqual([])
  })

  test('복원하면 바이트와 권한이 원본과 같고, 원래 없던 파일은 지워진다', () => {
    rmSync(codexFile())
    const stamp = applySetup(planSetup(opts()), opts())
    expect(existsSync(codexFile())).toBe(true)
    restoreSetup(opts(), stamp)
    expect(readFileSync(claudeFile(), 'utf8')).toBe(CLAUDE_ORIGINAL)
    expect(statSync(claudeFile()).mode & 0o777).toBe(0o640)
    expect(existsSync(codexFile())).toBe(false)
  })

  test('적용 뒤 사용자가 파일을 바꿨으면 복원은 아무것도 바꾸지 않고 멈춘다', () => {
    const stamp = applySetup(planSetup(opts()), opts())
    writeFileSync(codexFile(), `${readFileSync(codexFile(), 'utf8')}\n# 사용자가 더한 줄\n`)
    const claudeNow = sha(claudeFile())
    expect(() => restoreSetup(opts(), stamp)).toThrow('바뀌었')
    expect(sha(claudeFile())).toBe(claudeNow)
  })

  test('계획 뒤에 파일이 바뀌면 적용은 아무것도 쓰지 않고 멈춘다', () => {
    const plan = planSetup(opts())
    writeFileSync(codexFile(), '# 다른 프로그램이 고침\n')
    const claudeBefore = sha(claudeFile())
    expect(() => applySetup(plan, opts())).toThrow('바뀌었')
    expect(sha(claudeFile())).toBe(claudeBefore)
    expect(existsSync(join(ghome, 'backup'))).toBe(false)
  })

  test('설정 파일이 심볼릭 링크면 실제 파일을 고치고 링크는 그대로 둔다', () => {
    const real = join(tmp('gotechy-dotfiles-'), 'settings.json')
    writeFileSync(real, CLAUDE_ORIGINAL)
    rmSync(claudeFile())
    symlinkSync(real, claudeFile())
    applySetup(planSetup(opts()), opts())
    expect(lstatSync(claudeFile()).isSymbolicLink()).toBe(true)
    expect(JSON.parse(readFileSync(real, 'utf8')).env.DISABLE_AUTOUPDATER).toBe('1')
  })
})

describe('doctor (Validation 15)', () => {
  test('버전과 정책이 train과 맞으면 실패가 없다', async () => {
    applySetup(planSetup(opts()), opts())
    const r = await doctor()
    expect(r.checks.filter((c) => c.status === 'fail')).toEqual([])
  })

  test('train 불일치를 주입하면 실패하고 고치는 명령을 알려 주며, 고친 뒤에는 통과한다', async () => {
    applySetup(planSetup(opts()), opts())
    const bad = await doctor(MISMATCH)
    const fails = bad.checks.filter((c) => c.status === 'fail')
    expect(fails.map((c) => c.name)).toEqual(['gh'])
    expect(fails[0]?.fix).toContain('mise install --locked')
    expect(fails[0]?.detail).toContain('2.101.0')
    fakeTool('gh', 'gh version 2.101.0 (2026-09-01)')
    expect((await doctor(MISMATCH)).checks.filter((c) => c.status === 'fail')).toEqual([])
  })

  test('B등급 도구가 어긋나면 mise 설치가 아니라 다시 설치하거나 train을 올리라고 알려 준다', async () => {
    applySetup(planSetup(opts()), opts())
    const pinB = join(home, 'train-pin-b.yaml')
    writeFileSync(
      pinB,
      readFileSync(TRAIN, 'utf8').replace(
        /^ {2}claude: \{[^}]*\}$/m,
        '  claude: { version: 2.1.296, pin: B, check: claude --version }',
      ),
    )
    fakeTool('claude', '2.1.299 (Claude Code)')
    const c = (await doctor(pinB)).checks.find((x) => x.name === 'claude')
    expect(c?.status).toBe('fail')
    expect(c?.fix).not.toContain('mise install')
    expect(c?.fix).toContain('train')
  })

  test('정책이 없으면 실패하고 gotechy setup을 고치는 명령으로 준다', async () => {
    const r = await doctor()
    const policy = r.checks.filter((c) => c.status === 'fail' && c.name.startsWith('정책'))
    expect(policy.length).toBeGreaterThan(0)
    expect(policy[0]?.fix).toContain('gotechy setup')
  })

  test('도구가 없으면 실패하고, 고정 등급 C 도구는 없어도 기록만 한다', async () => {
    applySetup(planSetup(opts()), opts())
    rmSync(join(bin, 'uv'))
    const r = await doctor()
    expect(r.checks.find((c) => c.name === 'uv')?.status).toBe('fail')
    expect(r.checks.find((c) => c.name === 'orca')?.status).toBe('info')
  })
})
