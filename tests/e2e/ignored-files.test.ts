// TD-007: 허용 범위 검사는 무시 파일(.gitignore 대상)도 본다. 무시 경로에 심은 파일은 커밋에는 안 들어가지만
// verify가 도는 동안 작업 폴더에 남아 verify 결과를 바꿀 수 있다(예: node_modules에 가짜 모듈).
import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { updateFrontmatter } from '../../src/runtime/project'
import { runTask } from '../../src/runtime/run'
import { FAKE, makeHome, makeProject, newTask, sh } from './helpers'

const updateStatus = (root: string, id: string, status: string) =>
  updateFrontmatter(join(root, 'orchestration', 'tasks', `${id}.md`), { status })

setDefaultTimeout(30_000)

function projectIgnoring(pattern: string): string {
  const root = makeProject()
  writeFileSync(
    join(root, '.gitignore'),
    `${readFileSync(join(root, '.gitignore'), 'utf8')}${pattern}\n`,
  )
  sh(['git', 'add', '.gitignore'], root)
  sh(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'ignore'], root)
  return root
}

/** readme-ok 녹화에 무시 경로 파일 하나를 더한 녹화 폴더 */
function fixtureWith(rel: string, body: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fx7-')))
  cpSync(join(FAKE, 'readme-ok'), dir, { recursive: true })
  const at = join(dir, 'files', rel)
  mkdirSync(join(at, '..'), { recursive: true })
  writeFileSync(at, body)
  return dir
}

describe('TD-007: 무시 파일도 허용 범위로 본다', () => {
  test('허용 밖 무시 경로에 심은 파일은 verify 전에 지우고 사유를 남기며 실행은 failed', async () => {
    const root = projectIgnoring('node_modules/')
    const id = newTask(root, {
      ownership: ['README.md'],
      // verify가 도는 동안 심은 파일이 남아 있으면 실패한다
      verify: 'grep -q 설치 README.md && test ! -e node_modules/evil/index.js',
    })
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: fixtureWith('node_modules/evil/index.js', 'module.exports = "pwned"\n'),
      home: makeHome(),
    })
    const msg = out.messages.join('\n')
    expect(msg).toMatch(/허용 밖[^\n]*node_modules\/evil\/index\.js/)
    // verify가 돌 때는 이미 지워져 있다(심은 파일이 verify에 닿지 않음)
    expect(msg).toMatch(/리드 verify:[^\n]*exit 0/)
    // 허용 밖 변경이 있었던 실행은 계약대로 failed(되돌린 사실을 오너가 보게)
    expect(out.status).toBe('failed')
  })

  test('허용 범위 안의 무시 경로는 그대로 둔다', async () => {
    const root = projectIgnoring('dist/')
    const id = newTask(root, {
      ownership: ['README.md', 'dist/'],
      verify: 'grep -q 설치 README.md && test -f dist/out.js',
    })
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: fixtureWith('dist/out.js', 'built\n'),
      home: makeHome(),
    })
    expect(out.messages.join('\n')).not.toContain('허용 밖')
    expect(out.status).toBe('done')
  })

  test('보안 감사 16차 중간 1: 읽을 수 없는 무시 파일(실행 권한만)도 빠지지 않고 허용 밖으로 잡힌다', async () => {
    const root = projectIgnoring('node_modules/')
    const id = newTask(root, {
      ownership: ['README.md'],
      verify: 'grep -q 설치 README.md && test ! -e node_modules/.bin/tool',
    })
    const fx = fixtureWith('node_modules/.bin/tool', '#!/bin/sh\nexit 0\n')
    // 녹화 재생이 파일을 복사한 뒤 실행 권한만 남긴다(리드가 내용을 읽을 수 없음)
    writeFileSync(
      join(fx, 'modes.json'),
      JSON.stringify([{ path: 'node_modules/.bin/tool', mode: '111' }]),
    )
    const out = await runTask({ root }, id, { adapter: 'fake', fixtureDir: fx, home: makeHome() })
    expect(out.messages.join('\n')).toMatch(/허용 밖[^\n]*node_modules\/\.bin\/tool/)
    expect(out.status).toBe('failed')
  })

  test('보안 감사 16차 중간 2: 지난 실행이 남긴 무시 파일은 워커 전에 비운다(기준선에 섞이지 않게)', async () => {
    const root = projectIgnoring('node_modules/')
    const home = makeHome()
    const id = newTask(root, {
      ownership: ['README.md'],
      verify: 'grep -q 설치 README.md && test ! -e node_modules/leftover.js',
    })
    // 첫 실행으로 worktree를 만든 뒤, 비정상 종료가 남긴 것처럼 무시 파일을 심는다
    await runTask({ root }, id, { adapter: 'fake', fixtureDir: join(FAKE, 'readme-ok'), home })
    const wt = join(root, '.gotechy', 'worktrees', id)
    mkdirSync(join(wt, 'node_modules'), { recursive: true })
    writeFileSync(join(wt, 'node_modules', 'leftover.js'), 'pwned\n')
    sh(['git', '-C', root, 'checkout', '-q', '--', '.'], root)
    updateStatus(root, id, 'ready')
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: join(FAKE, 'readme-ok'),
      home,
    })
    expect(existsSync(join(wt, 'node_modules', 'leftover.js'))).toBe(false)
    expect(out.messages.join('\n')).toMatch(/리드 verify:[^\n]*exit 0/)
    // 워커가 만들지 않은 파일로 이 실행을 허용 밖 실패로 몰지 않는다(비우지 않으면 남은 파일이 워커 탓이 된다)
    expect(out.messages.join('\n')).not.toContain('허용 밖')
    expect(out.status).toBe('done')
  })

  test('보안 감사 16차 중간 1: git이 읽지 못하는 무시 폴더가 생기면 실패로 끝내고 verify를 돌리지 않는다', async () => {
    const root = projectIgnoring('node_modules/')
    const id = newTask(root, { ownership: ['README.md'], verify: 'grep -q 설치 README.md' })
    const fx = fixtureWith('node_modules/locked/evil.js', 'pwned\n')
    // 녹화 재생 뒤 폴더를 읽기 불가로 바꾼다(git status가 안을 나열하지 못함)
    writeFileSync(
      join(fx, 'modes.json'),
      JSON.stringify([{ path: 'node_modules/locked', mode: '311' }]),
    )
    const out = await runTask({ root }, id, { adapter: 'fake', fixtureDir: fx, home: makeHome() })
    const wt = join(root, '.gotechy', 'worktrees', id)
    chmodSync(join(wt, 'node_modules', 'locked'), 0o755)
    expect(out.status).toBe('failed')
    expect(out.messages.join('\n')).not.toMatch(/리드 verify:/)
  })
})
