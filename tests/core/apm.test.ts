// contract.md 10.7절: init이 쓰는 apm.yml과, 설치 뒤 apm.lock.yaml 검사.
import { describe, expect, test } from 'bun:test'
import { parse } from 'yaml'
import { lockProblems, managedFiles, planManifest, skillDep } from '../../src/core/apm'

const SRC = 'kyeongseok-go/gotechy-harness'
const REF = 'a'.repeat(40)
const OTHER = 'b'.repeat(40)
const DEP = skillDep(SRC, 'owner-protocol', REF)
const DEP2 = skillDep(SRC, 'other-skill', REF)
/** train의 출처와 커밋으로 만든, init이 관리하는 줄 전부 */
const ALLOWED = [DEP, DEP2]

const lock = (
  o: { commit?: string; files?: string[]; path?: string } = {},
) => `lockfile_version: '1'
apm_version: 0.33.0
dependencies:
- repo_url: ${SRC}
  name: owner-protocol
  host: github.com
  resolved_commit: ${o.commit ?? REF}
  virtual_path: ${o.path ?? 'skills/owner-protocol'}
  is_virtual: true
  deployed_files:
${(o.files ?? ['.agents/skills/owner-protocol/SKILL.md', '.claude/skills/owner-protocol/SKILL.md']).map((f) => `  - ${f}`).join('\n')}
`

describe('apm.yml 계획', () => {
  test('스킬 의존성은 출처, skills 경로, 커밋을 잇는다', () => {
    expect(DEP).toBe(`${SRC}/skills/owner-protocol#${REF}`)
  })

  test('apm.yml이 없으면 두 대상과 의존성으로 새로 만든다', () => {
    const p = planManifest(undefined, 'My Project', [DEP], ALLOWED)
    expect(p.conflicts).toEqual([])
    expect(p.changed).toBe(true)
    const m = parse(p.text)
    expect(m.targets).toEqual(['claude', 'agent-skills'])
    expect(m.dependencies.apm).toEqual([DEP])
    expect(m.name).toBe('my-project')
    expect(m.version).toBe('0.0.0')
  })

  test('있는 apm.yml에는 빠진 줄만 더하고 주석과 허용한 키는 지킨다', () => {
    const before = `# 팀 설정\nname: p\nversion: 1.2.3\ndescription: 우리 팀\ntargets: [claude, agent-skills]\ndependencies:\n  apm:\n    - ${DEP2}\n`
    const p = planManifest(before, 'p', [DEP], ALLOWED)
    expect(p.conflicts).toEqual([])
    expect(p.changed).toBe(true)
    expect(p.text).toContain('# 팀 설정')
    const m = parse(p.text)
    expect(m.version).toBe('1.2.3')
    expect(m.dependencies.apm).toEqual([DEP2, DEP])
  })

  test('보안 감사 7차 중간 1: init이 관리하지 않는 의존성, MCP, 다른 키가 있으면 apm을 부르지 않게 충돌로 알린다', () => {
    const base = 'name: p\nversion: 0.0.0\ntargets: [claude, agent-skills]\n'
    for (const [bad, word] of [
      [`${base}dependencies:\n  apm:\n    - acme/tools/skills/x#${OTHER}\n`, 'acme/tools/skills/x'],
      [`${base}dependencies:\n  apm:\n    - ${DEP}\n    - acme/evil\n`, 'acme/evil'],
      [
        `${base}dependencies:\n  apm:\n    - git: ${SRC}\n      path: skills/owner-protocol\n`,
        '문자열',
      ],
      [`${base}dependencies:\n  mcp:\n    - acme/server\n`, 'mcp'],
      [`${base}devDependencies:\n  apm:\n    - acme/dev\n`, 'devDependencies'],
      [`${base}scripts:\n  start: echo\n`, 'scripts'],
      [`${base}registries:\n  default: x\n`, 'registries'],
    ] as const) {
      const p = planManifest(bad, 'p', [DEP], ALLOWED)
      expect({ word, changed: p.changed, conflict: p.conflicts.join('\n').includes(word) }).toEqual(
        {
          word,
          changed: false,
          conflict: true,
        },
      )
    }
  })

  test('같은 줄이 이미 있으면 바꾸지 않는다', () => {
    const before = `name: p\nversion: 0.0.0\ntargets: [claude, agent-skills]\ndependencies:\n  apm:\n    - ${DEP}\n`
    const p = planManifest(before, 'p', [DEP], ALLOWED)
    expect(p).toEqual({ text: before, changed: false, conflicts: [] })
  })

  test('같은 스킬이 다른 커밋으로 있으면 바꾸지 않고 충돌로 알린다', () => {
    const before = `name: p\nversion: 0.0.0\ntargets: [claude, agent-skills]\ndependencies:\n  apm:\n    - ${SRC}/skills/owner-protocol#${OTHER}\n`
    const p = planManifest(before, 'p', [DEP], ALLOWED)
    expect(p.changed).toBe(false)
    expect(p.text).toBe(before)
    expect(p.conflicts.join('\n')).toContain(OTHER)
  })

  test('대상에 claude나 agent-skills가 빠져 있으면 충돌이다', () => {
    const p = planManifest('name: p\nversion: 0.0.0\ntargets: [copilot]\n', 'p', [DEP], ALLOWED)
    expect(p.changed).toBe(false)
    expect(p.conflicts.join('\n')).toContain('targets')
  })

  test('대상을 적지 않은 apm.yml에는 두 대상을 넣는다', () => {
    const p = planManifest('name: p\nversion: 0.0.0\n', 'p', [DEP], ALLOWED)
    expect(p.conflicts).toEqual([])
    expect(parse(p.text).targets).toEqual(['claude', 'agent-skills'])
  })

  test('읽을 수 없는 apm.yml은 충돌이다', () => {
    for (const bad of ['name: [', '- a\n- b\n', 'dependencies: 3\n', 'dependencies:\n  apm: x\n']) {
      const p = planManifest(bad, 'p', [DEP], ALLOWED)
      expect({ bad, changed: p.changed, conflict: p.conflicts.length > 0 }).toEqual({
        bad,
        changed: false,
        conflict: true,
      })
    }
  })
})

describe('apm.lock.yaml 검사', () => {
  const want = [{ source: SRC, skill: 'owner-protocol', ref: REF }]

  test('커밋과 두 곳의 SKILL.md가 맞으면 문제없다', () => {
    expect(lockProblems(lock(), want)).toEqual([])
  })

  test('락에 스킬이 없으면 문제다', () => {
    expect(lockProblems(lock({ path: 'skills/other' }), want).join('\n')).toContain(
      'owner-protocol',
    )
  })

  test('커밋이 train과 다르면 문제다', () => {
    expect(lockProblems(lock({ commit: OTHER }), want).join('\n')).toContain(OTHER)
  })

  test('한 곳이라도 깔리지 않았으면 문제다', () => {
    const p = lockProblems(lock({ files: ['.agents/skills/owner-protocol/SKILL.md'] }), want)
    expect(p.join('\n')).toContain('.claude/skills/owner-protocol/SKILL.md')
  })

  test('읽을 수 없는 락은 문제다', () => {
    for (const bad of ['', 'x: [', 'dependencies: 3\n', 'dependencies:\n- 3\n'])
      expect({ bad, n: lockProblems(bad, want).length > 0 }).toEqual({ bad, n: true })
  })

  test('락이 관리하는 파일 목록을 읽는다', () => {
    expect([...managedFiles(lock())].sort()).toEqual([
      '.agents/skills/owner-protocol/SKILL.md',
      '.claude/skills/owner-protocol/SKILL.md',
    ])
    expect(managedFiles(undefined).size).toBe(0)
    expect(managedFiles('x: [').size).toBe(0)
  })
})
