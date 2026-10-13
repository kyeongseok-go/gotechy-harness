// 저장소 위생: 소스와 문서에 보이지 않는 제어 문자가 없다. 양방향 제어 문자는 코드를 다르게 보이게 하는
// 공격(Trojan Source)에 쓰이고, 편집 도구가 escape 표기를 실제 문자로 바꿔 넣은 적이 있다(ExecPlan M2b Surprises).
import { expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const DIRS = ['src', 'tests', 'docs', 'skills', 'knowledge', 'templates', '.claude', '.github']
const TEXT = /\.(ts|tsx|js|json|jsonl|md|ya?ml|toml|sh|txt|html|css)$/
const UNSAFE = /(?![\n\t\r])[\p{Cc}\p{Bidi_Control}]/u

function* walk(dir: string): Generator<string> {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (name === 'node_modules' || name === '.git') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (TEXT.test(name)) yield p
  }
}

test('소스와 문서에 보이지 않는 제어 문자가 없다', () => {
  const hits: string[] = []
  for (const top of [...DIRS.map((d) => join(ROOT, d)), ROOT]) {
    const files =
      top === ROOT
        ? readdirSync(ROOT)
            .filter((n) => TEXT.test(n))
            .map((n) => join(ROOT, n))
        : [...walk(top)]
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const m = UNSAFE.exec(line)
          if (m)
            hits.push(
              `${relative(ROOT, file)}:${i + 1} U+${m[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`,
            )
        })
    }
  }
  expect(hits).toEqual([])
})
