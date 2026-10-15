// TD-016: HANDOFF가 계약을 어기면 리드가 같은 worktree에서 워커에게 HANDOFF만 다시 쓰게 한다(최대 2회).
// 스펙 harness-v2.md "HANDOFF lint 실패 시 워커가 재작성(최대 2회)", contract.md 6.6절.
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildRewritePrompt } from '../../src/core/prompt'
import { addUsage } from '../../src/core/usage'
import { runTask } from '../../src/runtime/run'
import { FAKE, fm, handoffFile, makeHome, makeProject, newTask } from './helpers'

const rawLogs = (root: string, id: string) =>
  readdirSync(join(root, '.gotechy', 'runs')).filter((f) => f.startsWith(`${id}-fake-`))
const verifyCount = (root: string) =>
  readFileSync(join(root, 'orchestration', 'private', 'events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .filter((l) => JSON.parse(l).type === 'verify').length

async function run(fixture: string) {
  const root = makeProject()
  const home = makeHome()
  // verify를 돌 때마다 run이 이벤트를 하나 남긴다(다시 쓰기에서는 verify를 다시 돌리지 않아야 한다)
  const id = newTask(root, { verify: 'grep -q 설치 README.md' })
  const out = await runTask({ root }, id, {
    adapter: 'fake',
    fixtureDir: join(FAKE, fixture),
    home,
  })
  return { root, id, out }
}

describe('HANDOFF 다시 쓰기 (TD-016)', () => {
  test('형식 오류가 있으면 워커가 HANDOFF만 한 번 다시 써서 done이 되고, verify는 한 번만 돈다', async () => {
    const { root, id, out } = await run('rewrite-ok')
    expect(out.status).toBe('done')
    expect(rawLogs(root, id)).toHaveLength(2)
    const h = fm(handoffFile(root, id))
    expect(h.status).toBe('done')
    expect(h.rev).toBe(1)
    expect(readFileSync(handoffFile(root, id), 'utf8')).toContain(
      'README에 설치 방법 한 줄을 추가했어요.',
    )
    expect(out.messages.join('\n')).toContain('다시 쓰기')
  })

  test('두 번 다시 써도 고쳐지지 않으면 failed로 끝난다(워커 실행은 처음 한 번과 다시 쓰기 두 번)', async () => {
    const { root, id, out } = await run('rewrite-never')
    expect(out.status).toBe('failed')
    expect(rawLogs(root, id)).toHaveLength(3)
    expect(out.messages.join('\n')).toContain('HANDOFF가 계약을 어깁니다')
  })

  test('다시 쓰기에서 HANDOFF 밖 파일을 바꾸면 되돌리고 failed로 끝난다', async () => {
    const { root, id, out } = await run('rewrite-touch')
    expect(out.status).toBe('failed')
    expect(out.messages.join('\n')).toContain('README.md')
    const wt = join(root, '.gotechy', 'worktrees', id)
    expect(readFileSync(join(wt, 'README.md'), 'utf8')).not.toContain('다시 쓰기에서 바꿈')
  })

  test('다시 쓰기에서 HANDOFF를 링크로 바꾸면 되돌리고 failed로 끝난다', async () => {
    const { root, id, out } = await run('rewrite-link')
    expect(out.status).toBe('failed')
    expect(out.messages.join('\n')).toContain('링크')
    expect(rawLogs(root, id)).toHaveLength(2)
  })

  test('verify는 다시 쓰기 때 다시 돌지 않는다', async () => {
    const { root } = await run('rewrite-ok')
    expect(verifyCount(root)).toBe(1)
  })

  test('허용 밖 변경으로 막힌 실행은 다시 쓰게 하지 않는다', async () => {
    const root = makeProject()
    const home = makeHome()
    const id = newTask(root, { ownership: ['a.txt'], verify: 'true' })
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: join(FAKE, 'rewrite-never'),
      home,
    })
    expect(out.status).toBe('failed')
    expect(rawLogs(root, id)).toHaveLength(1)
  })
})

describe('다시 쓰기 지시문과 사용량 합', () => {
  test('지시문에는 HANDOFF 경로, 오류, 다른 파일을 바꾸지 말라는 말이 들어간다', () => {
    const p = buildRewritePrompt('T-007', [
      { rule: 'handoff-summary', message: '한 줄 요약은 60자 이하', line: 12 },
    ])
    expect(p).toContain('orchestration/handoffs/T-007.md')
    expect(p).toContain('한 줄 요약은 60자 이하')
    expect(p).toContain('다른 파일')
  })

  test('사용량은 더하고, 비용을 모르는 쪽이 있으면 모름이다', () => {
    const u = (cost: number | null) => ({
      input_tokens: 1,
      cache_read_tokens: 2,
      cache_write_tokens: 3,
      output_tokens: 4,
      cost_usd: cost,
    })
    expect(addUsage(u(0.1), u(0.2))).toEqual({
      input_tokens: 2,
      cache_read_tokens: 4,
      cache_write_tokens: 6,
      output_tokens: 8,
      cost_usd: 0.30000000000000004,
    })
    expect(addUsage(u(0.1), u(null)).cost_usd).toBeNull()
  })
})
