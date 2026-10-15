// 위임 작업에도 전문가 기준이 전달된다(contract.md 2절, 10.8절). 제한 모드 워커는 스킬을 스스로 로드하지 않아서
// (1a M1 Surprises), 리드가 작업 명세의 팩에 든 스킬 본문을 메인 체크아웃의 설치본에서 읽어 지시문에 넣는다.
import { describe, expect, test } from 'bun:test'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildWorkerPrompt, MAX_SKILL_BYTES } from '../../src/core/prompt'
import type { TaskFrontmatter } from '../../src/core/schema'
import { runTask } from '../../src/runtime/run'
import { FAKE, makeHome, makeProject, newTask } from './helpers'

const SKILL = (name: string, body: string) =>
  `---\nname: ${name}\ndescription: 시험용\n---\n\n${body}\n`

function recordingFixture(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fx-prompt-')))
  cpSync(join(FAKE, 'readme-ok'), dir, { recursive: true })
  writeFileSync(join(dir, 'record-prompt'), '')
  return dir
}

function install(root: string, name: string, body: string) {
  mkdirSync(join(root, '.agents', 'skills', name), { recursive: true })
  writeFileSync(join(root, '.agents', 'skills', name, 'SKILL.md'), SKILL(name, body))
}

describe('워커 지시문의 전문가 기준', () => {
  test('작업 팩의 스킬 본문을 넣고, 깔리지 않은 스킬은 알린다', async () => {
    const root = makeProject()
    install(root, 'gotechy-build', '# 구현 기준\n- 실패하는 테스트를 먼저 쓴다.')
    const id = newTask(root, {
      verify: 'grep -q 설치 README.md',
      packs: ['owner', 'build', 'verify'],
    })
    const fx = recordingFixture()
    const out = await runTask({ root }, id, { adapter: 'fake', fixtureDir: fx, home: makeHome() })
    expect(out.status).toBe('done')
    const prompt = readFileSync(join(fx, 'prompt.txt'), 'utf8')
    expect(prompt).toContain('## 이번 작업의 전문가 기준')
    expect(prompt).toContain('### gotechy-build')
    expect(prompt).toContain('실패하는 테스트를 먼저 쓴다.')
    expect(prompt).not.toContain('description: 시험용')
    expect(prompt).toContain('skills_loaded: [gotechy-build]')
    expect(out.messages.join('\n')).toContain('gotechy-quality')
  })

  test('스킬 파일이 링크면 읽지 않는다', async () => {
    const root = makeProject()
    const outside = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-outside-')))
    writeFileSync(join(outside, 'SKILL.md'), SKILL('gotechy-build', '밖의 글 OUTSIDE-MARK'))
    mkdirSync(join(root, '.agents', 'skills', 'gotechy-build'), { recursive: true })
    symlinkSync(
      join(outside, 'SKILL.md'),
      join(root, '.agents', 'skills', 'gotechy-build', 'SKILL.md'),
    )
    const id = newTask(root, { verify: 'grep -q 설치 README.md', packs: ['build'] })
    const fx = recordingFixture()
    await runTask({ root }, id, { adapter: 'fake', fixtureDir: fx, home: makeHome() })
    expect(readFileSync(join(fx, 'prompt.txt'), 'utf8')).not.toContain('OUTSIDE-MARK')
  })

  test('owner 팩만이면 전문가 절이 없다(보고 규칙은 지시문에 이미 있다)', () => {
    const task = {
      id: 'T-001',
      ownership: ['a'],
      verify: 'true',
      packs: ['owner'],
    } as TaskFrontmatter
    expect(buildWorkerPrompt(task, '## Target\n없음')).not.toContain('## 이번 작업의 전문가 기준')
  })

  test('스킬 본문은 합쳐서 상한까지만 넣고 잘렸다고 알린다', () => {
    const task = {
      id: 'T-001',
      ownership: ['a'],
      verify: 'true',
      packs: ['build'],
    } as TaskFrontmatter
    const p = buildWorkerPrompt(
      task,
      '## Target\n없음',
      [],
      [
        { name: 'gotechy-build', body: '가'.repeat(MAX_SKILL_BYTES) },
        { name: 'gotechy-quality', body: '나'.repeat(100) },
      ],
    )
    const section = p.slice(p.indexOf('## 이번 작업의 전문가 기준'), p.indexOf('## HANDOFF 작성'))
    expect(Buffer.byteLength(section)).toBeLessThanOrEqual(MAX_SKILL_BYTES + 1_000)
    expect(section).toContain('references/')
    expect(section).toContain('잘렸어요')
  })
})
