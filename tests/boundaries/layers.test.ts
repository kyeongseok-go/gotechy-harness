// ARCHITECTURE.md "경계" 절의 기계 강제(`npm run check:boundaries`). 소스의 import와 호출을 읽어 레이어 규칙을 본다.
import { expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')

function files(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...files(p))
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}
const src = files(join(ROOT, 'src')).map((f) => ({
  rel: relative(ROOT, f),
  text: readFileSync(f, 'utf8'),
}))
const imports = (text: string) => [...text.matchAll(/from '([^']+)'/g)].map((m) => m[1] as string)

test('core는 순수하다: runtime, cli, 파일과 프로세스와 네트워크를 쓰지 않는다', () => {
  for (const f of src.filter((x) => x.rel.startsWith('src/core/'))) {
    const bad = imports(f.text).filter(
      (i) =>
        i.includes('/runtime') ||
        i.includes('/cli') ||
        /^node:(fs|child_process|net|http|https|os)$/.test(i),
    )
    const calls = f.text.match(/\bBun\.(spawn|spawnSync|serve|file|write)\b|\bfetch\(/g) ?? []
    expect({ file: f.rel, bad, calls }).toEqual({ file: f.rel, bad: [], calls: [] })
  }
})

test('runtime은 cli를 import하지 않는다', () => {
  for (const f of src.filter((x) => x.rel.startsWith('src/runtime/')))
    expect({ file: f.rel, cli: imports(f.text).some((i) => /\/cli$/.test(i)) }).toEqual({
      file: f.rel,
      cli: false,
    })
})

test('워커 로그인 값(API 키) 이름은 어댑터와 run의 로그인 값 검사에서만 다룬다', () => {
  const allowed = new Set([
    'src/runtime/adapters/claude.ts',
    'src/runtime/adapters/codex.ts',
    'src/runtime/run.ts',
  ])
  for (const f of src)
    if (/ANTHROPIC_API_KEY|OPENAI_API_KEY/.test(f.text))
      expect({ file: f.rel, allowed: allowed.has(f.rel) }).toEqual({ file: f.rel, allowed: true })
})
