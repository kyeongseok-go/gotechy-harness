// 끝-끝: 임시 git 저장소에서 init → task new → run(fake) → HANDOFF. LLM 호출 없이 재현된다 (Validation 1·3·4).
import { beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseFrontmatter } from '../../src/core/frontmatter'
import { initProject } from '../../src/runtime/init'
import { runTask } from '../../src/runtime/run'
import { createTask } from '../../src/runtime/task-new'

const FIX = join(import.meta.dir, '..', 'fixtures', 'fake')
// 워커가 건드리면 안 되는 다른 작업의 게이트. 형식이 맞아야 한다(깨진 게이트는 모든 실행을 막는다).
const GATE =
  '---\nid: G-001\ntask: T-900\nclass: decision\nstatus: pending\nquestion: 남의 결정이에요\noptions: [가, 나]\nhandoff_rev: 1\n---\n'
const sh = (cmd: string[], cwd: string) => {
  const r = Bun.spawnSync({ cmd, cwd, stdout: 'pipe', stderr: 'pipe' })
  if (r.exitCode !== 0) throw new Error(`${cmd.join(' ')}: ${r.stderr.toString()}`)
  return r.stdout.toString()
}
const fm = (file: string) => {
  const r = parseFrontmatter(readFileSync(file, 'utf8'), file)
  if (!r.ok) throw new Error(`frontmatter 읽기 실패: ${file}`)
  return r.value.data
}

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gotechy-e2e-'))
  sh(['git', 'init', '-q', '-b', 'main'], root)
  writeFileSync(join(root, 'README.md'), '# Sandbox\n')
  initProject(root, { hooks: false })
  writeFileSync(join(root, 'orchestration', 'gates', 'G-001.md'), GATE)
  sh(['git', 'add', '-A'], root)
  sh(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init'], root)
})

const newTask = () =>
  createTask(
    { root },
    { title: 'README에 설치 한 줄', verify: 'grep -q 설치 README.md', ownership: ['README.md'] },
  ).id

describe('run --adapter fake', () => {
  test('정상: verify 통과, HANDOFF가 메인에 반영되고 작업은 done', async () => {
    const id = newTask()
    const out = await runTask({ root }, id, { adapter: 'fake', fixtureDir: join(FIX, 'readme-ok') })
    expect(out.status).toBe('done')
    const h = fm(join(root, 'orchestration', 'handoffs', `${id}.md`))
    expect(h.status).toBe('done')
    expect(h.rev).toBe(1)
    expect((h.verified as { exit_code: number }).exit_code).toBe(0)
    expect(h.changed_files).toEqual(['README.md', `orchestration/handoffs/${id}.md`])
    expect(fm(join(root, 'orchestration', 'tasks', `${id}.md`)).status).toBe('done')
    // 메인 체크아웃의 README는 그대로 — 변경은 작업 브랜치에만 있다
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe('# Sandbox\n')
    expect(sh(['git', 'log', '--oneline', `gotechy/${id}`], root)).toContain(id)
  })

  test('결정 파일을 건드리면 되돌리고 failed', async () => {
    const id = newTask()
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: join(FIX, 'touch-gate'),
    })
    expect(out.status).toBe('failed')
    expect(out.messages.join('\n')).toContain('orchestration/gates/G-001.md')
    const wt = join(root, '.gotechy', 'worktrees', id)
    expect(readFileSync(join(wt, 'orchestration', 'gates', 'G-001.md'), 'utf8')).toBe(GATE)
    expect(readFileSync(join(root, 'orchestration', 'gates', 'G-001.md'), 'utf8')).toBe(GATE)
    const h = fm(join(root, 'orchestration', 'handoffs', `${id}.md`))
    expect(h.status).toBe('failed')
    expect(String(h.lead_note)).toContain('허용 밖')
  })

  test('verify가 실패하면 워커가 done이라고 해도 failed', async () => {
    const id = createTask(
      { root },
      {
        title: '불가능한 검증',
        verify: 'grep -q 존재하지않는문구 README.md',
        ownership: ['README.md'],
      },
    ).id
    const out = await runTask({ root }, id, { adapter: 'fake', fixtureDir: join(FIX, 'readme-ok') })
    expect(out.status).toBe('failed')
    expect(
      (fm(join(root, 'orchestration', 'handoffs', `${id}.md`)).verified as { exit_code: number })
        .exit_code,
    ).not.toBe(0)
  })

  test('HANDOFF를 안 남기면 리드가 failed 기록을 만든다', async () => {
    const id = newTask()
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: join(FIX, 'no-handoff'),
    })
    expect(out.status).toBe('failed')
    const text = readFileSync(join(root, 'orchestration', 'handoffs', `${id}.md`), 'utf8')
    expect(text).toContain('HANDOFF를 남기지 않았습니다')
  })

  test('ready가 아니거나 비공개 데이터면 실행을 거부한다', async () => {
    const id = newTask()
    const file = join(root, 'orchestration', 'tasks', `${id}.md`)
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('data_class: public', 'data_class: internal'),
    )
    const out = await runTask({ root }, id, { adapter: 'fake', fixtureDir: join(FIX, 'readme-ok') })
    expect(out.status).toBe('refused')
    expect(existsSync(join(root, '.gotechy', 'worktrees', id))).toBe(false)
  })

  test('번호는 겹치지 않게 발급된다', () => {
    const ids = [newTask(), newTask(), newTask()]
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe('T-001')
  })
})
