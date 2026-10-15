// 계정 정보(getpwuid)에서 읽은 진짜 홈(TD-019). Bun의 os.homedir와 userInfo().homedir는 환경 변수 HOME을 따라서,
// 명령의 환경을 바꿀 수 있는 쪽이 샌드박스가 막는 비밀 폴더와 끝 기록 위치를 옮길 수 있었다(보안 감사 11차 중간 1).

import { CString, dlopen, FFIType, type Pointer, read } from 'bun:ffi'
import { realpathSync } from 'node:fs'

// struct passwd에서 pw_dir의 위치(바이트). 2026-10-15 실험: macOS arm64는 48, glibc x64와 arm64는 32
const PW_DIR_OFFSET: Partial<Record<NodeJS.Platform, number>> = { darwin: 48, linux: 32 }
const LIBC: Partial<Record<NodeJS.Platform, string>> = {
  darwin: '/usr/lib/libSystem.B.dylib',
  linux: 'libc.so.6',
}

let cached: string | undefined | null = null

/** 계정의 홈 폴더. 읽을 수 없는 환경이면 undefined */
export function accountHome(): string | undefined {
  if (cached !== null) return cached
  cached = undefined
  const offset = PW_DIR_OFFSET[process.platform]
  const lib = LIBC[process.platform]
  if (offset === undefined || lib === undefined) return cached
  try {
    const c = dlopen(lib, {
      getuid: { args: [], returns: FFIType.u32 },
      getpwuid: { args: [FFIType.u32], returns: FFIType.ptr },
    })
    const pw = c.symbols.getpwuid(c.symbols.getuid())
    if (pw) {
      const dir = read.ptr(pw, offset)
      if (dir) cached = new CString(dir as Pointer).toString() || undefined
    }
    c.close()
  } catch {
    // FFI를 쓸 수 없으면 계정 홈을 모르는 것으로 둔다. 호출한 쪽은 환경 변수 HOME만 쓴다
  }
  return cached
}

const real = (p: string) => {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

/**
 * GOTECHY_HOME 없이 HOME이 계정 홈과 다르면 경고 문장. 오너 키와 끝 기록은 HOME 기준 위치를 쓰므로,
 * 다른 HOME으로 검증하면 끝 기록 검사가 다른 기록을 본다
 */
export function homeMismatch(env: Record<string, string | undefined>): string | undefined {
  if (env.GOTECHY_HOME) return undefined
  const account = accountHome()
  if (!account || !env.HOME) return undefined
  if (real(env.HOME) === real(account)) return undefined
  return `주의: HOME(${env.HOME})이 계정 홈(${account})과 달라요. 오너 키와 끝 기록은 HOME 기준 위치(${env.HOME}/.gotechy)를 써요. 의도한 것이 아니라면 HOME을 고친 뒤 다시 실행하세요.`
}
