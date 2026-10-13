// 결정 서명 키(contract.md 6.3절). 워커가 접근하는 프로젝트 폴더 밖, $GOTECHY_HOME/keys/에 둔다.
import { randomBytes } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const KEY_ID = /^k-\d{8}-[0-9a-f]{8}$/

export function gotechyHome(): string {
  return process.env.GOTECHY_HOME ?? join(homedir(), '.gotechy')
}

const keysDir = (home: string) => join(home, 'keys')
const activeFile = (home: string) => join(keysDir(home), 'active')
const keyFile = (home: string, id: string) => join(keysDir(home), `${id}.key`)

export type ActiveKey = { ok: true; id: string; key: Buffer } | { ok: false; problem: string }

export function activeKeyId(home: string): string | undefined {
  const f = activeFile(home)
  return existsSync(f) ? readFileSync(f, 'utf8').trim() || undefined : undefined
}

function newKey(home: string): string {
  const dir = keysDir(home)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  chmodSync(dir, 0o700)
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const id = `k-${stamp}-${randomBytes(4).toString('hex')}`
  writeFileSync(keyFile(home, id), `${randomBytes(32).toString('hex')}\n`, {
    mode: 0o600,
    flag: 'wx',
  })
  const tmp = `${activeFile(home)}.tmp-${process.pid}`
  writeFileSync(tmp, `${id}\n`, { mode: 0o600 })
  renameSync(tmp, activeFile(home))
  return id
}

/** 키가 없을 때만 만든다. */
export function initKey(home: string): { id: string; created: boolean } {
  const current = activeKeyId(home)
  if (current && existsSync(keyFile(home, current))) return { id: current, created: false }
  return { id: newKey(home), created: true }
}

/** 새 키로 바꾸고 이전 키를 지운다. 이전 키로 서명한 결정은 모두 다시 결정해야 한다. */
export function rotateKey(home: string): { id: string; previous: string | undefined } {
  const previous = activeKeyId(home)
  const id = newKey(home)
  if (previous) rmSync(keyFile(home, previous), { force: true })
  return { id, previous }
}

export function loadActiveKey(home: string): ActiveKey {
  const id = activeKeyId(home)
  if (!id) return { ok: false, problem: '서명 키가 없어요. gotechy keys init을 실행하세요' }
  // active 내용을 경로에 넣기 전에 형식을 본다
  if (!KEY_ID.test(id))
    return {
      ok: false,
      problem: `keys/active의 키 id 형식이 아니에요(${id.slice(0, 40)}). gotechy keys rotate로 새로 만드세요`,
    }
  const file = keyFile(home, id)
  if (lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink())
    return { ok: false, problem: `키 파일(${file})이 심볼릭 링크예요. 실제 파일만 써요` }
  if (!existsSync(file))
    return {
      ok: false,
      problem: `현재 키 파일(${file})이 없어요. gotechy keys rotate로 새로 만드세요`,
    }
  for (const [path, label] of [
    [keysDir(home), '키 폴더'],
    [file, '키 파일'],
  ] as const) {
    const mode = statSync(path).mode & 0o777
    if (mode & 0o077)
      return {
        ok: false,
        problem: `${label} 권한이 넓어요(${mode.toString(8)}). 다른 사용자가 읽을 수 있어요: chmod ${label === '키 폴더' ? 700 : 600} ${path}`,
      }
  }
  const key = Buffer.from(readFileSync(file, 'utf8').trim(), 'hex')
  if (key.length !== 32) return { ok: false, problem: `키 파일(${file})이 32바이트 hex가 아니에요` }
  return { ok: true, id, key }
}
