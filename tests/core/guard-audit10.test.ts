// 보안 감사 10차(N4 가드) 수정의 수용 테스트. 셸 문법을 셸처럼 읽어 뒤 명령을 놓치지 않고, 일상 명령은 막지 않는다.
import { describe, expect, test } from 'bun:test'
import { guardBash } from '../../src/core/guard'

const expectAll = (cmds: string[], deny: boolean) => {
  for (const cmd of cmds) expect({ cmd, deny: guardBash(cmd).deny }).toEqual({ cmd, deny })
}
const FP = ['git', 'push', '--force'].join(' ')

describe('중간 1: 주석, here-doc, 줄 이어 쓰기, 백슬래시, 닫히지 않은 따옴표', () => {
  test('뒤 명령을 놓치지 않는다', () => {
    expectAll(
      [
        `# rebased, it's safe now\n${FP} origin feat`,
        `cat > NOTES.md <<'EOF'\nit's done\nEOF\nnpm publish`,
        `git push origin feat \\\n--force`,
        `vercel deploy \\\n--prod`,
        `echo It\\'s done && ${FP}`,
        `echo "a \\" b"; gotechy decide G-001 y`,
        `git commit -m "$(cat <<'EOF'\n13" 화면\nEOF\n)" && ${FP}`,
        `echo 'unclosed && ${FP}`,
        `echo "unclosed && ${FP}`,
        `echo $(gotechy serve`,
        `bash <<EOF\n${FP}\nEOF`,
      ],
      true,
    )
  })

  test('Claude Code의 표준 커밋과 PR 본문 형태는 막지 않는다', () => {
    expectAll(
      [
        "# it's the first step\nls -la",
        `git commit -m "$(cat <<'EOF'\nfix: it's the guard (gotechy decide stays owner-only)\n\nCo-Authored-By: x\nEOF\n)" && git push -u origin feat`,
        `gh pr create --title "t" --body "$(cat <<'EOF'\n## Summary\n- \`npm publish\` is blocked\nEOF\n)"`,
        `cat > notes.md <<'EOF'\n$(gotechy decide G-001 x)\nEOF`,
      ],
      false,
    )
  })
})

describe('중간 2: 예약어, 묶음, 감싸는 명령의 옵션 값', () => {
  test('안쪽 명령을 꺼내 판정한다', () => {
    expectAll(
      [
        `for b in main dev; do ${FP} origin $b; done`,
        'if true; then npm publish; fi',
        `(${FP})`,
        '{ gotechy keys rotate; }',
        '! gotechy serve',
        'timeout 600 npx wrangler deploy',
        'nice -n 10 gotechy keys rotate',
        'sudo -u me gotechy serve',
        'env -u FOO gotechy serve',
        'caffeinate -t 3600 gotechy loop',
        "git branch -r --merged | sed 's#origin/##' | xargs -n1 git push origin --delete",
        `find . -name x -exec ${FP} \\;`,
        'mise exec -- bun src/cli.ts serve',
      ],
      true,
    )
  })

  test('일상적인 반복문, 서브셸, 시간 제한은 막지 않는다', () => {
    expectAll(
      ['for f in *.md; do echo $f; done', '(cd sub && git status)', 'timeout 5 bun test'],
      false,
    )
  })
})

describe('중간 3: 러너와 전역 옵션을 거친 배포와 발행', () => {
  test('막는다', () => {
    expectAll(
      [
        'npx wrangler deploy',
        'bunx vercel --prod',
        'npx -y netlify deploy --prod',
        'wrangler pages deploy dist',
        'flyctl deploy',
        'vercel deploy --target=production',
        'vercel promote https://x.vercel.app',
        'pnpm -r publish',
        'npm --workspace x publish',
        'yarn npm publish',
        'gh -R owner/repo pr merge 3',
        'gh workflow run deploy.yml',
        'npm run deploy',
        'bun run release:prod',
      ],
      true,
    )
  })

  test('개발용 실행과 조회는 막지 않는다', () => {
    expectAll(
      [
        'npx vercel dev',
        'npx wrangler dev',
        'pnpm -r build',
        'gh release download v1',
        'gh release view v1',
        'npm publish --dry-run',
      ],
      false,
    )
  })
})

describe('낮음 7, 10, 11, 12: 셸 옵션 묶음, 오탐, 위키, 이름', () => {
  test('셸의 -lc, -ic, -ec, --command 형태와 fish도 다시 판정한다', () => {
    expectAll(
      [
        `bash -lc '${FP}'`,
        `zsh -ic '${FP}'`,
        `sh -ec '${FP}'`,
        `fish -c '${FP}'`,
        `bash --login -c '${FP}'`,
      ],
      true,
    )
  })

  test('작은따옴표 안과 이스케이프한 백틱은 명령이 아니다', () => {
    expectAll(
      ['git commit -m "가드: \\`gotechy decide\\` 막기"', "echo '`npm publish` 는 막혀요'"],
      false,
    )
  })

  test('위키는 쓰기 대상 자리에서만 막고, 대소문자와 cd 뒤 상대 경로도 본다', () => {
    expectAll(
      [
        'cd ~/Documents/Obsidian/Gotechy-Wiki && cp /repo/a.md raw/',
        'cp a.md ~/documents/obsidian/gotechy-wiki/raw/',
        'echo x > ~/Documents/Obsidian/Gotechy-Wiki/raw/a.md',
        'tee ~/Documents/Obsidian/Gotechy-Wiki/raw/a.md < a.md',
      ],
      true,
    )
    expectAll(
      [
        'ls ~/Documents/Obsidian/Gotechy-Wiki 2>/dev/null',
        'cp ~/Documents/Obsidian/Gotechy-Wiki/a.md /tmp/',
        'grep -rn x ~/Documents/Obsidian/Gotechy-Wiki',
      ],
      false,
    )
  })

  test('npm run gotechy --, 대문자, =gotechy도 gotechy로 본다', () => {
    expectAll(['npm run gotechy -- keys rotate', 'GOTECHY decide G-001 x', '=gotechy serve'], true)
  })

  test('너무 깊게 감싼 명령은 막는다', () => {
    expect(guardBash(`${'eval '.repeat(20)}ls`).deny).toBe(true)
  })
})
