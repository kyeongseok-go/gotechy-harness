// 오너 키(contract.md 6.3절). 개인 키는 Secure Enclave 안에 있고, $GOTECHY_HOME/owner/에는 Secure Enclave가 감싼 blob과
// 공개 키만 둔다. 서명은 서명 도구($GOTECHY_HOME/bin/gotechy-ownerkey)가 오너 확인(Touch ID) 뒤에 한다.
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
import { OWNER_KEY_ID, ownerKeyId } from '../core/gate'

export function gotechyHome(): string {
  return process.env.GOTECHY_HOME ?? join(homedir(), '.gotechy')
}

const ownerDir = (home: string) => join(home, 'owner')
const activeFile = (home: string) => join(ownerDir(home), 'active')
const blobFile = (home: string, id: string) => join(ownerDir(home), `${id}.blob`)
const pubFile = (home: string, id: string) => join(ownerDir(home), `${id}.pub`)
export const ownerToolPath = (home: string) => join(home, 'bin', 'gotechy-ownerkey')

/** 서명 도구 종료 코드(native/ownerkey.swift) */
const EXIT_NO_ENCLAVE = 3
const EXIT_CANCELLED = 4
const EXIT_NO_PRESENCE = 5

export class OwnerCancelled extends Error {}

export type OwnerKey = { ok: true; id: string; pub: string } | { ok: false; problem: string }

export function activeOwnerId(home: string): string | undefined {
  const f = activeFile(home)
  return existsSync(f) ? readFileSync(f, 'utf8').trim() || undefined : undefined
}

const isLink = (p: string) => lstatSync(p, { throwIfNoEntry: false })?.isSymbolicLink() === true

/** 키 id에 맞는 공개 키. 형식, 링크, 지문을 모두 본다. 장부의 지난 키 줄을 검증할 때도 쓴다. */
export function ownerPub(home: string, id: string): string | undefined {
  if (!OWNER_KEY_ID.test(id)) return undefined
  const f = pubFile(home, id)
  if (!existsSync(f) || isLink(f)) return undefined
  const pub = readFileSync(f, 'utf8').trim()
  return ownerKeyId(pub) === id ? pub : undefined
}

/** 현재 오너 키(검증에는 공개 키만 필요하다). */
export function loadOwnerKey(home: string): OwnerKey {
  const id = activeOwnerId(home)
  if (!id) return { ok: false, problem: '오너 키가 없어요. gotechy keys init을 실행하세요' }
  // active 내용을 경로에 넣기 전에 형식을 본다
  if (!OWNER_KEY_ID.test(id))
    return {
      ok: false,
      problem: `owner/active의 키 id 형식이 아니에요(${id.slice(0, 40)}). gotechy keys rotate로 새로 만드세요`,
    }
  const dir = ownerDir(home)
  const mode = statSync(dir).mode & 0o777
  if (mode & 0o077)
    return {
      ok: false,
      problem: `오너 키 폴더 권한이 넓어요(${mode.toString(8)}). 다른 사용자가 바꿀 수 있어요: chmod 700 ${dir}`,
    }
  for (const f of [activeFile(home), pubFile(home, id)])
    if (isLink(f)) return { ok: false, problem: `${f}가 심볼릭 링크예요. 실제 파일만 써요` }
  if (!existsSync(pubFile(home, id)))
    return {
      ok: false,
      problem: `현재 키의 공개 키 파일이 없어요. gotechy keys rotate로 새로 만드세요`,
    }
  const pub = ownerPub(home, id)
  if (!pub)
    return {
      ok: false,
      problem: `공개 키 파일(${pubFile(home, id)})이 키 id와 맞지 않아요. 누군가 바꿨을 수 있어요`,
    }
  return { ok: true, id, pub }
}

/**
 * native/ownerkey.swift를 swiftc로 빌드한다. rebuild면 이미 있어도 다시 빌드한다(keys init과 rotate.
 * 남아 있던 테스트 빌드나 낡은 도구로 키를 만들지 않게, 보안 감사 6차 낮음 3). 테스트는 rebuild 없이 가짜 도구를 쓴다.
 */
export function ensureOwnerTool(home: string, libRoot: string, rebuild = false): string {
  const tool = ownerToolPath(home)
  if (existsSync(tool) && !rebuild) return tool
  if (process.platform !== 'darwin')
    throw new Error('오너 키는 macOS(Secure Enclave)에서만 만들 수 있어요')
  const swiftc = Bun.which('swiftc', { PATH: process.env.PATH ?? '' })
  if (!swiftc)
    throw new Error(
      'swiftc가 없어요. Xcode Command Line Tools를 설치하세요: xcode-select --install',
    )
  mkdirSync(join(home, 'bin'), { recursive: true, mode: 0o700 })
  const tmp = `${tool}.build-${randomBytes(4).toString('hex')}`
  const r = Bun.spawnSync({
    cmd: [swiftc, '-O', '-o', tmp, join(libRoot, 'native', 'ownerkey.swift')],
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  if (r.exitCode !== 0)
    throw new Error(`서명 도구를 빌드하지 못했어요: ${r.stderr.toString().trim()}`)
  renameSync(tmp, tool)
  return tool
}

export type KeyOptions = { rebuildTool?: boolean }

function createKey(home: string, libRoot: string, opts: KeyOptions = {}): string {
  const tool = ensureOwnerTool(home, libRoot, opts.rebuildTool)
  const dir = ownerDir(home)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  chmodSync(dir, 0o700)
  const tmpBlob = join(dir, `.new-${randomBytes(4).toString('hex')}.blob`)
  const r = Bun.spawnSync({
    cmd: [tool, 'create', tmpBlob],
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  if (r.exitCode !== 0) {
    rmSync(tmpBlob, { force: true })
    const why = r.stderr.toString().trim()
    throw new Error(
      r.exitCode === EXIT_NO_ENCLAVE
        ? `이 컴퓨터에서는 Secure Enclave를 쓸 수 없어요: ${why}`
        : `오너 키를 만들지 못했어요(화면이 잠겨 있으면 풀고 다시 하세요): ${why}`,
    )
  }
  // 만든 키가 서명마다 사람 확인을 요구하는지 본다. 확인 없이 서명되면 쓰지 않는다
  const probe = Bun.spawnSync({
    cmd: [tool, 'probe', tmpBlob],
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  if (probe.exitCode !== 0) {
    rmSync(tmpBlob, { force: true })
    throw new Error(
      probe.exitCode === EXIT_NO_PRESENCE
        ? '만든 키가 사람 확인 없이 서명돼요. 서명 도구를 다시 빌드하세요(gotechy keys init). 키는 쓰지 않았어요'
        : `만든 키를 확인하지 못했어요: ${probe.stderr.toString().trim()}`,
    )
  }
  const pub = r.stdout.toString().trim()
  const id = ownerKeyId(pub)
  renameSync(tmpBlob, blobFile(home, id))
  writeFileSync(pubFile(home, id), `${pub}\n`, { mode: 0o600, flag: 'wx' })
  const tmp = `${activeFile(home)}.tmp-${process.pid}`
  writeFileSync(tmp, `${id}\n`, { mode: 0o600 })
  renameSync(tmp, activeFile(home))
  return id
}

/** 오너 키가 없을 때만 만든다. 만들 때는 Touch ID가 필요 없다. */
export function initOwnerKey(
  home: string,
  libRoot: string,
  opts: KeyOptions = {},
): { id: string; created: boolean } {
  const current = loadOwnerKey(home)
  if (current.ok && existsSync(blobFile(home, current.id)))
    return { id: current.id, created: false }
  return { id: createKey(home, libRoot, opts), created: true }
}

/** 새 키로 바꾸고 이전 blob을 지운다. 공개 키는 장부의 지난 줄을 검증하려고 남긴다. */
export function rotateOwnerKey(
  home: string,
  libRoot: string,
  opts: KeyOptions = {},
): { id: string; previous: string | undefined } {
  const previous = activeOwnerId(home)
  const id = createKey(home, libRoot, opts)
  if (previous && OWNER_KEY_ID.test(previous)) rmSync(blobFile(home, previous), { force: true })
  return { id, previous }
}

/**
 * 결정 서명 대상과 그 장부 줄을 한 번의 오너 확인으로 서명한다. 서명 도구가 둘이 맞는지 검사하고,
 * 확인 창 문구(게이트 번호와 선택)도 서명 대상에서 직접 만든다. 오너가 취소하면 OwnerCancelled.
 */
export async function signWithOwnerKey(
  home: string,
  payload: string,
  ledgerLine: string,
): Promise<[string, string]> {
  const messages = [payload, ledgerLine]
  const key = loadOwnerKey(home)
  if (!key.ok) throw new Error(key.problem)
  const blob = blobFile(home, key.id)
  if (!existsSync(blob) || isLink(blob))
    throw new Error(`현재 키의 blob(${blob})이 없어요. gotechy keys rotate로 새로 만드세요`)
  const tool = ownerToolPath(home)
  if (!existsSync(tool)) throw new Error('서명 도구가 없어요. gotechy keys init을 다시 실행하세요')
  const proc = Bun.spawn({
    cmd: [tool, 'sign', blob],
    stdin: new Blob([JSON.stringify(messages)]),
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code === EXIT_CANCELLED)
    throw new OwnerCancelled('오너 확인을 취소했어요. 아무것도 기록하지 않았어요')
  if (code !== 0) throw new Error(`서명하지 못했어요: ${err.trim()}`)
  const sigs = JSON.parse(out) as unknown
  if (
    !Array.isArray(sigs) ||
    sigs.length !== messages.length ||
    !sigs.every((x) => typeof x === 'string')
  )
    throw new Error('서명 도구의 출력이 서명 배열이 아니에요')
  return sigs as [string, string]
}
