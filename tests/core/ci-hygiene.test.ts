// 보안 감사 7차 낮음 6: CI 토큰의 범위를 좁힌다. 워크플로 파일을 읽어 규칙을 단언한다.
import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

type Step = {
  uses?: string
  run?: string
  with?: Record<string, unknown>
  env?: Record<string, string>
}
const wf = parse(
  readFileSync(join(import.meta.dir, '..', '..', '.github', 'workflows', 'ci.yml'), 'utf8'),
) as { permissions?: Record<string, string>; jobs: Record<string, { steps: Step[] }> }
const steps = Object.values(wf.jobs).flatMap((j) => j.steps)

test('워크플로 토큰은 읽기 권한만 가진다', () => {
  expect(wf.permissions).toEqual({ contents: 'read' })
})

test('action은 커밋 SHA로 고정한다 (태그는 가리키는 커밋이 바뀔 수 있다)', () => {
  for (const s of steps.filter((x) => x.uses))
    expect({ uses: s.uses, pinned: /@[0-9a-f]{40}$/.test(s.uses as string) }).toEqual({
      uses: s.uses,
      pinned: true,
    })
})

test('checkout은 자격 증명을 .git/config에 남기지 않는다', () => {
  for (const s of steps.filter((x) => x.uses?.startsWith('actions/checkout@')))
    expect(s.with?.['persist-credentials']).toBe(false)
})

test('GitHub 토큰은 CLI나 부트스트랩을 실행하는 단계에 넘기지 않는다', () => {
  for (const s of steps.filter((x) => JSON.stringify(x.env ?? {}).includes('github.token')))
    expect({ run: s.run, cli: /bin\/gotechy|bun /.test(s.run ?? '') }).toEqual({
      run: s.run,
      cli: false,
    })
})

test('테스트 안에서는 claude, codex, orca가 가짜 실행 파일로 잡힌다(실제 유료 실행 방지, 2026-10-15)', () => {
  const dir = process.env.GOTECHY_TEST_NO_AGENTS
  expect(dir).toBeDefined()
  for (const name of ['claude', 'codex', 'orca']) {
    const r = Bun.spawnSync({ cmd: [name, '--version'], env: process.env, stderr: 'pipe' })
    expect({ name, exit: r.exitCode }).toEqual({ name, exit: 97 })
  }
})

test('U8: CI는 커버리지 기준까지 보는 gotechy test를 돌린다(맨 bun test --coverage가 아니라)', () => {
  const runs = steps.map((x) => x.run ?? '')
  expect(runs.some((r) => /bun src\/cli\.ts test\b/.test(r))).toBe(true)
  expect(runs.some((r) => /^bun test --coverage\s*$/.test(r.trim()))).toBe(false)
})

test('U8: 진행 중인 ExecPlan은 살아 있는 문서의 필수 절을 모두 가진다(docs/PLANS.md)', () => {
  const dir = join(import.meta.dir, '..', '..', 'docs', 'exec-plans', 'active')
  const required = [
    '## Progress',
    '## Surprises & Discoveries',
    '## Decision Log',
    '## Outcomes & Retrospective',
    '## Validation and Acceptance',
  ]
  const missing: string[] = []
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const text = readFileSync(join(dir, f), 'utf8')
    for (const h of required) if (!text.includes(`\n${h}`)) missing.push(`${f}: ${h}`)
  }
  expect(missing).toEqual([])
})
