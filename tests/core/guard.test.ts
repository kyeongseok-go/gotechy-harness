// contract.md 12절: 리드 에이전트의 부작용 명령 가드(1b N4, Validation 9, TD-008).
import { describe, expect, test } from 'bun:test'
import { guardBash } from '../../src/core/guard'

const denied = (cmd: string) => guardBash(cmd).deny

describe('막는 명령 (Validation 9)', () => {
  test('결정, 화면 서버, 오너 키 명령은 어떤 이름으로 불러도 막는다', () => {
    for (const cmd of [
      'gotechy decide G-001 5분',
      'gotechy serve',
      'gotechy keys rotate',
      '/Users/x/lib/bin/gotechy decide G-001 승인',
      './bin/gotechy serve --port 8080',
      'bin/gotechy keys init',
      'bun src/cli.ts decide G-001 y',
      'bun /abs/path/src/cli.ts serve',
      'npm run dev -- decide G-001 진행',
      'bun run dev -- serve',
      'FOO=1 gotechy decide G-001 x',
      'env GOTECHY_HOME=/tmp gotechy decide G-001 x',
      'cd /repo && gotechy decide G-001 x',
      'true; gotechy serve',
      'echo y | gotechy decide G-001 x',
      'bash -c "gotechy decide G-001 x"',
      "sh -c 'cd /p && gotechy serve'",
      'command gotechy keys rotate',
      'gotechy loop --budget 50',
      'nohup gotechy serve &',
      'echo $(gotechy decide G-001 x)',
      'echo `gotechy serve`',
    ])
      expect({ cmd, deny: denied(cmd) }).toEqual({ cmd, deny: true })
  })

  test('TTY 검사를 속이는 도구(script, expect)는 막는다', () => {
    for (const cmd of [
      'script -q /dev/null gotechy inbox',
      'expect -c "spawn ls"',
      'unbuffer gotechy decide',
    ])
      expect({ cmd, deny: denied(cmd) }).toEqual({ cmd, deny: true })
  })

  test('force push와 원격 브랜치 삭제는 막는다', () => {
    for (const cmd of [
      'git push --force',
      'git push -f origin main',
      'git push origin main --force-with-lease',
      'git push origin +main',
      'git push origin :old-branch',
      'git push --delete origin old',
      'git -C /repo push -f',
      'git push --mirror',
    ])
      expect({ cmd, deny: denied(cmd) }).toEqual({ cmd, deny: true })
  })

  test('발행, 병합, 배포, 위키 적재는 막는다', () => {
    for (const cmd of [
      'npm publish',
      'bun publish',
      'gh release create v1',
      'gh pr merge 12 --squash',
      'vercel --prod',
      'vercel deploy --prod',
      'wrangler deploy',
      'fly deploy',
      'netlify deploy --prod',
      'cp note.md ~/Documents/Obsidian/Gotechy-Wiki/raw/',
    ])
      expect({ cmd, deny: denied(cmd) }).toEqual({ cmd, deny: true })
  })

  test('막을 때 이유를 알려 준다', () => {
    expect(guardBash('gotechy decide G-001 5분').reason).toContain('오너')
    expect(guardBash('git push -f').reason).toContain('force push')
  })
})

describe('통과하는 명령', () => {
  test('일상 명령과 읽기 전용 gotechy 명령은 막지 않는다', () => {
    for (const cmd of [
      'gotechy inbox',
      'gotechy gate verify',
      'gotechy run T-001',
      'gotechy task new "결정 화면 문구"',
      'git push origin harness-v2',
      'git push -u origin feature',
      'git status && git log --oneline -3',
      'grep -rn "gotechy decide" docs/',
      'echo "decide later"',
      'bun test tests/e2e/serve.test.ts',
      'gh pr view 12',
      'npm run build',
      'ls ~/Documents',
    ])
      expect({ cmd, deny: denied(cmd) }).toEqual({ cmd, deny: false })
  })
})
