// contract.md 13절 교차 검증 감사관의 수용 테스트(1b Validation 12). 워커와 감사관 모두 녹화 재생(fake)으로 돈다.
import { describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { formatInbox } from '../../src/core/inbox'
import { auditTask } from '../../src/runtime/audit'
import { loadCards } from '../../src/runtime/inbox'
import { runTask } from '../../src/runtime/run'
import { FAKE, fm, makeHome, makeProject, newTask, runFake } from './helpers'

const AUD = join(import.meta.dir, '..', 'fixtures', 'auditor')
// 감사 기록은 커밋하지 않는 .gotechy/audits/에 둔다(보안 감사 12차 높음 1)
const auditFile = (root: string, id: string) => join(root, '.gotechy', 'audits', `${id}.md`)
const runLogs = (root: string, pattern: RegExp) =>
  readdirSync(join(root, '.gotechy', 'runs')).filter((f) => pattern.test(f))

async function ranProject(verify = 'echo VERIFY-MARK && grep -q 설치 README.md') {
  const root = makeProject()
  const home = makeHome()
  const id = newTask(root, { verify })
  const run = await runFake(root, home, id, 'audit-mismatch')
  expect(run.status).toBe('done')
  return { root, id }
}

describe('교차 검증 감사관 (1b Validation 12)', () => {
  test('요약과 diff가 다른 HANDOFF에서 지적을 file:line과 근거 확인 여부로 기록하고 인박스에 보여 준다', async () => {
    const { root, id } = await ranProject()
    const r = await auditTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: join(AUD, 'mismatch'),
    })
    expect(r.status).toBe('written')
    const file = auditFile(root, id)
    const meta = fm(file)
    expect(meta.task).toBe(id)
    expect(meta.findings).toBe(5)
    expect(meta.confirmed).toBe(1)
    expect(meta.cross_family).toBe(false)
    expect(meta.handoff_rev).toBe(1)
    const text = readFileSync(file, 'utf8')
    expect(text).toContain('README.md:2')
    expect(text).toContain('src/cache.ts:10')
    expect(text).toContain('diff에 src/cache.ts 변경이 없어요')
    expect(text.match(/근거 확인 안 됨/g)).toHaveLength(4)
    expect(text).toContain('README.md:99')
    expect(text.match(/근거 확인됨/g)).toHaveLength(1)
    expect(text).toContain('HANDOFF가 말한 캐시 변경이 diff에 없어요.')
    expect(formatInbox(loadCards({ root }, root))).toContain('감사: 근거 있는 지적 1건')
  })

  test('감사관 입력에는 HANDOFF, diff, 리드 verify 출력이 들어가고 기록으로 남는다', async () => {
    const { root, id } = await ranProject()
    expect(readFileSync(join(root, '.gotechy', 'runs', `${id}-verify.log`), 'utf8')).toContain(
      'VERIFY-MARK',
    )
    await auditTask({ root }, id, { adapter: 'fake', fixtureDir: join(AUD, 'mismatch') })
    const logs = runLogs(root, new RegExp(`^${id}-audit-fake-`))
    expect(logs).toHaveLength(1)
    const log = readFileSync(join(root, '.gotechy', 'runs', logs[0] as string), 'utf8')
    expect(log).toContain('src/cache.ts의 캐시 만료를 5분으로 바꿨어요')
    expect(log).toContain('+설치: bin/gotechy setup')
    expect(log).toContain('VERIFY-MARK')
  })

  test('출력에 JSON이 없으면 기록하지 않고 멈추며 원문을 남긴다', async () => {
    const { root, id } = await ranProject()
    const r = await auditTask({ root }, id, { adapter: 'fake', fixtureDir: join(AUD, 'garbage') })
    expect(r.status).toBe('refused')
    expect(r.messages.join('\n')).toContain('형식')
    expect(existsSync(auditFile(root, id))).toBe(false)
    expect(runLogs(root, new RegExp(`^${id}-audit-fake-`))).toHaveLength(1)
  })

  test('실행하지 않은 작업은 감사하지 않는다', async () => {
    const root = makeProject()
    const id = newTask(root)
    const r = await auditTask({ root }, id, { adapter: 'fake', fixtureDir: join(AUD, 'mismatch') })
    expect(r.status).toBe('refused')
    expect(existsSync(auditFile(root, id))).toBe(false)
  })

  test('작성 계열을 모르면(fake) 감사관을 직접 정하라고 한다', async () => {
    const { root, id } = await ranProject()
    const r = await auditTask({ root }, id, {})
    expect(r.status).toBe('refused')
    expect(r.messages.join('\n')).toContain('--adapter')
  })

  test('높음 1: 감사 기록은 커밋 대상 폴더(orchestration)에 쓰지 않는다', async () => {
    const { root, id } = await ranProject()
    await auditTask({ root }, id, { adapter: 'fake', fixtureDir: join(AUD, 'mismatch') })
    expect(existsSync(auditFile(root, id))).toBe(true)
    expect(existsSync(join(root, 'orchestration', 'audits'))).toBe(false)
  })

  test('높음 1: 감사관 답에 키 모양이 있으면 기록하지 않고 멈춘다', async () => {
    const { root, id } = await ranProject()
    const r = await auditTask({ root }, id, { adapter: 'fake', fixtureDir: join(AUD, 'secret') })
    expect(r.status).toBe('refused')
    expect(r.messages.join('\n')).toContain('비밀')
    expect(existsSync(auditFile(root, id))).toBe(false)
  })

  test('중간 1: codex 감사관에 비용 상한을 주면 걸 수 없다고 거부한다', async () => {
    const { root, id } = await ranProject()
    const r = await auditTask({ root }, id, { adapter: 'codex', budgetUsd: 0.1 })
    expect(r.status).toBe('refused')
    expect(r.messages.join('\n')).toContain('비용 상한')
  })

  test('낮음 1: verify 기록의 판본이 HANDOFF와 다르면 검증 기록이 없는 것으로 본다', async () => {
    const { root, id } = await ranProject()
    const h = join(root, 'orchestration', 'handoffs', `${id}.md`)
    writeFileSync(h, readFileSync(h, 'utf8').replace(/^rev: 1$/m, 'rev: 2'))
    await auditTask({ root }, id, { adapter: 'fake', fixtureDir: join(AUD, 'mismatch') })
    expect((fm(auditFile(root, id)).input as Record<string, unknown>).verify_log).toBe(false)
  })

  test('낮음 1: 워커가 git 설정을 바꿔 verify를 건너뛴 실행은 지난 verify 기록을 지운다', async () => {
    const { root, id } = await ranProject()
    const log = join(root, '.gotechy', 'runs', `${id}-verify.log`)
    expect(existsSync(log)).toBe(true)
    const task = join(root, 'orchestration', 'tasks', `${id}.md`)
    writeFileSync(task, readFileSync(task, 'utf8').replace(/^status: .*$/m, 'status: ready'))
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fx-audit-')))
    mkdirSync(join(dir, 'files'))
    writeFileSync(join(dir, 'files', 'README.md'), '# Sandbox\n설치: 다시\n')
    writeFileSync(
      join(dir, 'handoff.md'),
      readFileSync(join(FAKE, 'readme-ok', 'handoff.md'), 'utf8'),
    )
    writeFileSync(
      join(dir, 'writes.json'),
      JSON.stringify([{ path: '{{CWD}}/.git', content: 'gitdir: /tmp/evil-gitdir\n' }]),
    )
    const out = await runTask({ root }, id, { adapter: 'fake', fixtureDir: dir, home: makeHome() })
    expect(out.status).toBe('failed')
    expect(existsSync(log)).toBe(false)
  })

  test('없는 작업 번호는 거부한다', async () => {
    const root = makeProject()
    const r = await auditTask({ root }, 'T-999', { adapter: 'fake' })
    expect(r.status).toBe('refused')
  })
})
