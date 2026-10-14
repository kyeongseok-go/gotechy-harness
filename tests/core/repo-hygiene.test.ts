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

test('src의 Bun.spawn과 Bun.spawnSync는 env를 명시한다', () => {
  // bun은 env를 생략하면 시작 시점의 환경을 넘기고, process.env에서 지운 값(GOTECHY_CWD 같은)을 반영하지 않는다
  // (2026-10-14 실험, ExecPlan Surprises). 그래서 지운 값이 자식에게 새지 않도록 늘 env를 준다.
  const missing: string[] = []
  for (const f of walk(join(ROOT, 'src'))) {
    const text = readFileSync(f, 'utf8')
    for (const m of text.matchAll(/Bun\.spawn(Sync)?\(/g)) {
      // 호출의 여는 괄호부터 짝이 맞는 닫는 괄호까지
      let depth = 0
      let end = m.index + m[0].length - 1
      for (; end < text.length; end++) {
        if (text[end] === '(') depth++
        else if (text[end] === ')' && --depth === 0) break
      }
      if (!/\benv\s*:/.test(text.slice(m.index, end)))
        missing.push(`${relative(ROOT, f)}:${text.slice(0, m.index).split('\n').length}`)
    }
  }
  expect(missing).toEqual([])
})

test('src의 Bun.which는 PATH를 명시한다', () => {
  // Bun.which도 PATH를 생략하면 시작 시점의 PATH를 쓴다(2026-10-14 실험). process.env.PATH를 바꾼 뒤 찾으면 엉뚱한 결과가 나온다
  const missing: string[] = []
  for (const f of walk(join(ROOT, 'src'))) {
    const text = readFileSync(f, 'utf8')
    for (const m of text.matchAll(/Bun\.which\(([^)]*)\)/g))
      if (!/PATH/.test(m[1] ?? ''))
        missing.push(`${relative(ROOT, f)}:${text.slice(0, m.index).split('\n').length}`)
  }
  expect(missing).toEqual([])
})
