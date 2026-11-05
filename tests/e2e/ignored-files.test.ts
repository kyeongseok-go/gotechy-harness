// TD-007: 허용 범위 검사는 무시 파일(.gitignore 대상)도 본다. 무시 경로에 심은 파일은 커밋에는 안 들어가지만
// verify가 도는 동안 작업 폴더에 남아 verify 결과를 바꿀 수 있다(예: node_modules에 가짜 모듈).
import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runTask } from '../../src/runtime/run'
import { FAKE, makeHome, makeProject, newTask, sh } from './helpers'

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
})
