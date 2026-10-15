// TD-020: 보호 경로는 대소문자와 유니코드 접기를 무시하고 비교한다. macOS(APFS)는 `.CLAUDE/`와 `.agentſ/`를
// `.claude/`, `.agents/`로 읽지만, 아직 없는 폴더를 그 이름으로 만들면 git은 다른 경로로 보여 준다(2026-10-15 실험).
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { disallowedChanges, isProtected, ownershipProblem } from '../../src/core/paths'
import { runTask } from '../../src/runtime/run'
import { FAKE, makeHome, makeProject, newTask } from '../e2e/helpers'

describe('보호 경로의 대소문자와 유니코드 접기 (TD-020)', () => {
  test('대소문자만 다른 보호 경로도 보호한다', () => {
    for (const p of [
      '.CLAUDE/settings.json',
      '.Agents/skills/x/SKILL.md',
      'Orchestration/Gates/G-001.md',
      'ORCHESTRATION/owner.PUB',
      'agents.md',
      'Claude.MD',
      'MISE.toml',
      'Policy/x',
      '.GIT/config',
    ])
      expect({ p, protected: isProtected(p) }).toEqual({ p, protected: true })
  })

  test('APFS가 접는 유니코드 글자(ſ, Kelvin 기호)로 쓴 보호 경로도 보호한다', () => {
    expect(isProtected('.agentſ/skills/x/SKILL.md')).toBe(true)
    expect(isProtected(`mise.loc${String.fromCodePoint(0x212a)}`)).toBe(true)
  })

  test('접히지 않는 글자(전각)는 다른 경로로 본다', () => {
    expect(isProtected('.ｃlaude/settings.json')).toBe(false)
  })

  test('ownership에 대소문자만 다른 보호 경로나 그것을 품은 폴더를 넣을 수 없다', () => {
    expect(ownershipProblem('.CLAUDE/')).toBeDefined()
    expect(ownershipProblem('ORCHESTRATION/')).toBeDefined()
    expect(ownershipProblem('Orchestration/Tasks/T-001.md')).toBeDefined()
    expect(ownershipProblem('src/')).toBeUndefined()
  })

  test('허용 범위 검사도 대소문자만 다른 보호 경로를 막는다', () => {
    expect(disallowedChanges(['.CLAUDE/settings.json'], ['.CLAUDE/'], 'T-001')).toEqual([
      '.CLAUDE/settings.json',
    ])
  })

  test('허용 범위에 대소문자만 다른 보호 폴더를 넣은 작업은 run이 거부한다', async () => {
    const root = makeProject()
    const home = makeHome()
    const id = newTask(root, { ownership: ['README.md', '.Agents/'] })
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: join(FAKE, 'readme-ok'),
      home,
    })
    expect(out.status).toBe('refused')
    expect(out.messages.join('\n')).toContain('보호 경로')
  })
})
