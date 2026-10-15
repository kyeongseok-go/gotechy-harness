// TD-012: accept는 워커 변경을 메인에 합치기 전에 gitleaks로 비밀 값을 찾는다(contract.md 9.4절).
// 설정과 무시 목록은 라이브러리 것만 쓴다. 워커가 심은 .gitleaks.toml 허용 목록, .gitleaksignore, gitleaks:allow 주석이
// 검사를 끄지 못해야 한다(2026-10-16 실험: 검사 대상 폴더의 .gitleaks.toml이 있으면 기본 실행은 exit 0이 됐다).
// 키 모양 문자열은 저장소에 남기지 않고 실행할 때 조각을 이어 만든다(gitleaks 오탐, 295002c).
import { beforeEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { acceptTask } from '../../src/runtime/accept'
import { runTask } from '../../src/runtime/run'
import { FAKE, fm, handoffFile, makeHome, makeProject, newTask, sh, taskFile } from './helpers'

setDefaultTimeout(30_000)

const KEY = ['ghp', 'AAAAAAAAAABx7kQ9mZ2pL4vN8rT1yW3cE5uI6oP0'].join('_')
let root: string
let home: string
beforeEach(() => {
  root = makeProject()
  home = makeHome()
})

/** 워커가 files의 파일을 쓰는 녹화 폴더 */
function fixture(files: Record<string, string>): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fx-secret-')))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, 'files', name, '..'), { recursive: true })
    writeFileSync(join(dir, 'files', name), text)
  }
  writeFileSync(join(dir, 'handoff.md'), readFileSync(join(FAKE, 'write-a', 'handoff.md'), 'utf8'))
  return dir
}

async function ranWith(files: Record<string, string>) {
  const id = newTask(root, { ownership: Object.keys(files), verify: 'test -f config.txt' })
  const out = await runTask({ root }, id, { adapter: 'fake', fixtureDir: fixture(files), home })
  expect(out.status).toBe('done')
  return id
}

describe('accept의 비밀 값 검사 (TD-012)', () => {
  test('워커 변경에 키 모양 값이 있으면 합치지 않고, 기록에는 값 대신 위치와 규칙만 남긴다', async () => {
    const id = await ranWith({ 'config.txt': `token = "${KEY}"\n` })
    const before = sh(['git', 'rev-parse', 'HEAD'], root)
    const out = await acceptTask({ root }, home, id)
    expect(out.status).toBe('secret-found')
    expect(sh(['git', 'rev-parse', 'HEAD'], root)).toBe(before)
    expect(fm(taskFile(root, id)).status).toBe('needs-decision')
    const note = String(fm(handoffFile(root, id)).lead_note)
    expect(note).toContain('config.txt:1')
    expect(note).toContain('gotechy task restart')
    expect(`${note}\n${out.messages.join('\n')}`).not.toContain(KEY)
  })

  test('워커가 심은 허용 목록(.gitleaks.toml, .gitleaksignore, gitleaks:allow 주석)으로 끌 수 없다', async () => {
    const id = await ranWith({
      'config.txt': `token = "${KEY}" # gitleaks:allow\n`,
      '.gitleaks.toml': '[extend]\nuseDefault = true\n[allowlist]\npaths = [".*"]\n',
      '.gitleaksignore': 'config.txt:github-pat:1\n',
    })
    expect((await acceptTask({ root }, home, id)).status).toBe('secret-found')
  })

  test('gitleaks를 실행할 수 없으면 합치지 않고 작업 상태도 그대로 둔다(fail-closed)', async () => {
    const id = await ranWith({ 'config.txt': 'ok\n' })
    const before = sh(['git', 'rev-parse', 'HEAD'], root)
    const saved = process.env.GOTECHY_GITLEAKS
    process.env.GOTECHY_GITLEAKS = '/nonexistent/gitleaks'
    try {
      const out = await acceptTask({ root }, home, id)
      expect(out.status).toBe('rejected')
      expect(out.messages.join('\n')).toContain('gitleaks')
    } finally {
      if (saved === undefined) delete process.env.GOTECHY_GITLEAKS
      else process.env.GOTECHY_GITLEAKS = saved
    }
    expect(sh(['git', 'rev-parse', 'HEAD'], root)).toBe(before)
    expect(fm(taskFile(root, id)).status).toBe('done')
  })

  test('앞선 작업이 메인에 허용 목록(.gitleaks.toml)을 넣어 두었어도 뒤 작업의 비밀 값을 잡는다', async () => {
    const plant = await ranWith({
      'config.txt': 'ok\n',
      '.gitleaks.toml': '[extend]\nuseDefault = true\n[allowlist]\npaths = [".*"]\n',
    })
    expect((await acceptTask({ root }, home, plant)).status).toBe('accepted')
    expect(readFileSync(join(root, '.gitleaks.toml'), 'utf8')).toContain('allowlist')
    const leak = await ranWith({ 'config.txt': `token = "${KEY}"\n` })
    expect((await acceptTask({ root }, home, leak)).status).toBe('secret-found')
  })

  test('gitleaks가 오류로 끝나면(찾음과 다른 종료 코드) 합치지 않는다', async () => {
    const id = await ranWith({ 'config.txt': 'ok\n' })
    const bin = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-badgl-')))
    writeFileSync(join(bin, 'gitleaks'), '#!/bin/sh\necho broken >&2\nexit 1\n')
    chmodSync(join(bin, 'gitleaks'), 0o755)
    const saved = process.env.GOTECHY_GITLEAKS
    process.env.GOTECHY_GITLEAKS = join(bin, 'gitleaks')
    try {
      const out = await acceptTask({ root }, home, id)
      expect(out.status).toBe('rejected')
      expect(out.messages.join('\n')).toContain('exit 1')
    } finally {
      if (saved === undefined) delete process.env.GOTECHY_GITLEAKS
      else process.env.GOTECHY_GITLEAKS = saved
    }
  })

  test('비밀 값이 없으면 그대로 합친다', async () => {
    const id = await ranWith({ 'config.txt': 'name = "gotechy"\n' })
    expect((await acceptTask({ root }, home, id)).status).toBe('accepted')
  })
})
