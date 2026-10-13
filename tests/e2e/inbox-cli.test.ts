// contract.md 8.1절 인박스의 수용 테스트(Validation 6). CLI를 그대로 띄워 고정 fixture의 기대 출력과 비교한다.
import { describe, expect, test } from 'bun:test'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CLI = join(import.meta.dir, '..', '..', 'src', 'cli.ts')
const FIX = join(import.meta.dir, '..', 'fixtures')

function gotechy(args: string[], cwd: string) {
  const r = Bun.spawnSync({
    cmd: [process.execPath, CLI, ...args],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() }
}

describe('gotechy inbox', () => {
  test('결정 필요, 실패, 완료 순으로 묶고 같은 묶음은 오래 기다린 것부터 보여 준다', () => {
    const r = gotechy(['inbox'], join(FIX, 'inbox', 'project'))
    expect(r.err).toBe('')
    expect(r.out).toBe(readFileSync(join(FIX, 'inbox', 'expected.txt'), 'utf8'))
    expect(r.code).toBe(0)
  })

  test('HANDOFF가 없으면 "대기 중인 일 없음" 한 줄만 보여 준다', () => {
    const root = mkdtempSync(join(tmpdir(), 'gotechy-inbox-'))
    mkdirSync(join(root, 'orchestration', 'tasks'), { recursive: true })
    const r = gotechy(['inbox'], root)
    expect(r.out).toBe('대기 중인 일 없음\n')
    expect(r.code).toBe(0)
  })
})

describe('gotechy render', () => {
  const copy = () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-render-')))
    cpSync(join(FIX, 'inbox', 'project'), root, { recursive: true })
    return root
  }

  test('인박스 화면과 HANDOFF마다 화면 파일을 만들고 인박스 주소를 출력한다', () => {
    const root = copy()
    const r = gotechy(['render'], root)
    expect(r.code).toBe(0)
    const view = join(root, '.gotechy', 'view')
    expect(existsSync(join(view, 'index.html'))).toBe(true)
    for (const id of ['T-001', 'T-002', 'T-003', 'T-004', 'T-005', 'T-007'])
      expect(existsSync(join(view, `${id}.html`))).toBe(true)
    expect(r.out.trim()).toEndWith(`file://${join(view, 'index.html')}`)
  })

  test('작업 번호를 주면 그 화면의 주소를 출력한다', () => {
    const root = copy()
    const r = gotechy(['render', 'T-002'], root)
    expect(r.code).toBe(0)
    expect(r.out.trim()).toEndWith(`file://${join(root, '.gotechy', 'view', 'T-002.html')}`)
  })

  test('없는 작업 번호는 거부한다', () => {
    const r = gotechy(['render', 'T-999'], copy())
    expect(r.code).toBe(1)
    expect(r.err).toContain('T-999')
  })
})
