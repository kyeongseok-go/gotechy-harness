// 보안 감사 7차 낮음 6: CI 토큰의 범위를 좁힌다. 워크플로 파일을 읽어 규칙을 단언한다.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
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
