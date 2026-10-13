// gotechy setup(contract.md 10.3절): train의 정책을 전역 설정(~/.claude/settings.json, ~/.codex/config.toml)에 넣고,
// 바꾸기 전에 백업과 manifest를 남겨 그대로 되돌릴 수 있게 한다. 1a의 setup은 정책만 다룬다(도구 설치는 부트스트랩).
import { createHash, randomBytes } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { parseTrain, type Train } from '../core/train'

export type SetupOptions = {
  /** 사용자 홈. 테스트는 임시 폴더를 준다 */
  home: string
  gotechyHome: string
  trainFile: string
}

export type Change = {
  /** 설정 파일 경로(링크일 수 있음) */
  path: string
  /** 실제로 고칠 파일(링크면 대상) */
  target: string
  existed: boolean
  beforeSha: string | null
  after: string
  mode: number | null
  summary: string[]
}
export type Plan = { changes: Change[] }

type Entry = {
  path: string
  target: string
  existed: boolean
  before_sha256: string | null
  after_sha256: string
  mode: number | null
  backup: string | null
}

const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
const BOM = '﻿'
const CODEX_KEY = 'check_for_update_on_startup'

const configPaths = (home: string) => [
  join(home, '.claude', 'settings.json'),
  join(home, '.codex', 'config.toml'),
]

/** 링크면 대상 파일을 읽는다. 대상이 없는 깨진 링크는 일반 파일로 바꿔 버리지 않도록 멈춘다. */
function current(path: string): {
  target: string
  bytes: Buffer | null
  mode: number | null
} {
  const st = lstatSync(path, { throwIfNoEntry: false })
  if (!st) return { target: path, bytes: null, mode: null }
  if (st.isSymbolicLink() && !existsSync(path))
    throw new Error(`${path}는 대상이 없는 심볼릭 링크예요. 링크를 고친 뒤 다시 실행하세요`)
  const target = realpathSync(path)
  return { target, bytes: readFileSync(target), mode: statSync(target).mode & 0o777 }
}

function claudeAfter(text: string | null, train: Train): { after: string; summary: string[] } {
  const obj = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  const summary: string[] = []
  const env = { ...((obj.env as Record<string, string>) ?? {}) }
  for (const [k, v] of Object.entries(train.policy.claude.env)) {
    if (v === undefined) continue
    if (env[k] !== v) summary.push(`env.${k} = "${v}"`)
    env[k] = v
  }
  const permissions = { ...((obj.permissions as Record<string, unknown>) ?? {}) }
  const deny = [...((permissions.deny as string[]) ?? [])]
  for (const d of train.policy.claude.deny)
    if (!deny.includes(d)) {
      deny.push(d)
      summary.push(`permissions.deny += ${d}`)
    }
  if (summary.length === 0) return { after: text ?? '', summary }
  const next = { ...obj, env, permissions: { ...permissions, deny } }
  return { after: `${JSON.stringify(next, null, 2)}\n`, summary }
}

/**
 * TOML은 줄 단위로 고쳐 주석과 나머지를 지킨다. 대신 결과를 TOML 파서로 다시 읽어, 원하는 값이 되고
 * 다른 값은 그대로인지 확인한다. 자동으로 고칠 수 없으면(여러 줄 문자열 안의 [ 줄 같은) 쓰지 않고 멈춘다.
 */
function codexAfter(text: string | null, train: Train): { after: string; summary: string[] } {
  const want = train.policy.codex.check_for_update_on_startup
  const line = `${CODEX_KEY} = ${want}`
  const manual = `자동으로 고치지 못했어요. ~/.codex/config.toml의 첫 [표] 앞에 이 줄을 손으로 넣어 주세요: ${line}`
  let before: Record<string, unknown> = {}
  if (text) {
    try {
      before = Bun.TOML.parse(text) as Record<string, unknown>
    } catch (e) {
      throw new Error(`~/.codex/config.toml이 TOML로 읽히지 않아요: ${(e as Error).message}`)
    }
  }
  if (before[CODEX_KEY] === want) return { after: text ?? '', summary: [] }
  const bom = text?.startsWith(BOM) ? BOM : ''
  const lines = (text ?? '').slice(bom.length).split('\n')
  const firstTable = lines.findIndex((l) => /^\s*\[/.test(l))
  const top = firstTable === -1 ? lines.length : firstTable
  const keyRe = new RegExp(`^\\s*["']?${CODEX_KEY}["']?\\s*=`)
  const at = lines.slice(0, top).findIndex((l) => keyRe.test(l))
  let after: string
  if (at !== -1) {
    lines[at] = line
    after = bom + lines.join('\n')
  } else {
    after = text ? `${bom}${line}\n${lines.join('\n')}` : `${line}\n`
  }
  let parsed: Record<string, unknown>
  try {
    parsed = Bun.TOML.parse(after) as Record<string, unknown>
  } catch {
    throw new Error(manual)
  }
  const { [CODEX_KEY]: got, ...rest } = parsed
  const { [CODEX_KEY]: _old, ...restBefore } = before
  if (got !== want || JSON.stringify(rest) !== JSON.stringify(restBefore)) throw new Error(manual)
  return { after, summary: [line] }
}

export function planSetup(o: SetupOptions): Plan {
  const train = parseTrain(readFileSync(o.trainFile, 'utf8'))
  const [claude, codex] = configPaths(o.home) as [string, string]
  const files = [
    { path: claude, edit: claudeAfter },
    { path: codex, edit: codexAfter },
  ]
  const changes: Change[] = []
  for (const f of files) {
    const cur = current(f.path)
    const text = cur.bytes === null ? null : cur.bytes.toString('utf8')
    let edited: { after: string; summary: string[] }
    try {
      edited = f.edit(text, train)
    } catch (e) {
      throw new Error(`${f.path}: ${(e as Error).message} (setup을 멈췄어요)`)
    }
    if (edited.summary.length === 0) continue
    changes.push({
      path: f.path,
      target: cur.target,
      existed: cur.bytes !== null,
      beforeSha: cur.bytes === null ? null : sha(cur.bytes),
      after: edited.after,
      mode: cur.mode,
      summary: edited.summary,
    })
  }
  return { changes }
}

export function formatPlan(plan: Plan): string {
  if (plan.changes.length === 0) return '바꿀 것이 없어요. 정책이 이미 들어가 있어요.'
  return plan.changes
    .map((c) =>
      [`${c.path}${c.existed ? '' : ' (새로 만듦)'}`, ...c.summary.map((s) => `  ${s}`)].join('\n'),
    )
    .join('\n')
}

/** 같은 폴더의 무작위 이름 임시 파일에 새로 만들어 쓰고(덮어쓰기 금지), 권한을 맞춘 뒤 이름을 바꾼다. */
function writeAtomic(target: string, data: string | Buffer, mode: number): void {
  mkdirSync(dirname(target), { recursive: true })
  const tmp = `${target}.gotechy-${randomBytes(6).toString('hex')}`
  writeFileSync(tmp, data, { mode, flag: 'wx' })
  chmodSync(tmp, mode)
  renameSync(tmp, target)
}

/** 적용하고 백업 시각을 돌려준다. 계획 뒤에 파일이 바뀌었으면 아무것도 쓰지 않고 멈춘다. */
export function applySetup(plan: Plan, o: SetupOptions, now = new Date()): string {
  for (const c of plan.changes) {
    const cur = current(c.path)
    const curSha = cur.bytes === null ? null : sha(cur.bytes)
    if (curSha !== c.beforeSha)
      throw new Error(
        `${c.path}가 계획을 세운 뒤에 바뀌었어요. 다시 실행하세요 (아무것도 바꾸지 않았어요)`,
      )
  }
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')
  const parent = join(o.gotechyHome, 'backup')
  mkdirSync(parent, { recursive: true, mode: 0o700 })
  const dir = join(parent, stamp)
  try {
    // 같은 시각의 백업이 있으면 덮어쓰지 않는다
    mkdirSync(dir, { mode: 0o700 })
  } catch {
    throw new Error(`같은 시각(${stamp})의 백업이 이미 있어요. 잠시 뒤 다시 실행하세요`)
  }
  const entries: Entry[] = plan.changes.map((c, i) => {
    let backup: string | null = null
    if (c.existed) {
      backup = `${i}.orig`
      copyFileSync(c.target, join(dir, backup))
    }
    return {
      path: c.path,
      target: c.target,
      existed: c.existed,
      before_sha256: c.beforeSha,
      after_sha256: sha(c.after),
      mode: c.mode,
      backup,
    }
  })
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify({ stamp, entries }, null, 2)}\n`, {
    mode: 0o600,
  })
  // 하나라도 쓰지 못하면 이미 쓴 파일을 원래대로 돌려 부분 적용을 남기지 않는다
  const written: Entry[] = []
  try {
    for (const [i, c] of plan.changes.entries()) {
      writeAtomic(c.target, c.after, c.mode ?? 0o600)
      written.push(entries[i] as Entry)
    }
  } catch (e) {
    for (const w of written) {
      if (w.existed && w.backup)
        writeAtomic(w.target, readFileSync(join(dir, w.backup)), w.mode ?? 0o600)
      else unlinkSync(w.target)
    }
    throw new Error(
      `설정을 쓰다 실패해서 이미 바꾼 파일을 되돌렸어요 (백업 ${stamp}): ${(e as Error).message}`,
    )
  }
  return stamp
}

/** manifest대로 되돌린다. 적용 뒤 사용자가 바꾼 파일이 있으면 아무것도 바꾸지 않고 멈춘다. */
export function restoreSetup(o: SetupOptions, stamp: string): void {
  if (!/^\d{8}T\d{6}Z$/.test(stamp)) throw new Error(`백업 시각 형식이 아니에요: ${stamp}`)
  const dir = join(o.gotechyHome, 'backup', stamp)
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as {
    entries: Entry[]
  }
  const allowed = configPaths(o.home)
  const todo: Entry[] = []
  for (const e of manifest.entries) {
    // manifest는 같은 사용자가 고칠 수 있는 파일이다. 경로와 백업 이름을 다시 확인한다
    if (!allowed.includes(e.path) || (e.backup !== null && !/^\d+\.orig$/.test(e.backup)))
      throw new Error(`manifest에 허용 밖 경로나 백업 이름이 있어 복원하지 않았어요: ${e.path}`)
    const target = existsSync(e.path) ? realpathSync(e.path) : e.target
    if (target !== e.target)
      throw new Error(`manifest의 실제 파일(${e.target})이 지금 링크 대상(${target})과 달라요`)
    if (e.backup && sha(readFileSync(join(dir, e.backup))) !== e.before_sha256)
      throw new Error(`manifest의 백업 ${e.backup}이 원본 해시와 달라요`)
    const now = existsSync(e.target) ? sha(readFileSync(e.target)) : null
    if (now === e.before_sha256) continue
    if (now !== e.after_sha256)
      throw new Error(
        `${e.path}가 setup 뒤에 바뀌었어요. 사용자의 변경을 덮어쓰지 않으려고 복원을 멈췄어요 (아무것도 바꾸지 않았어요)`,
      )
    todo.push(e)
  }
  for (const e of todo) {
    if (e.existed && e.backup)
      writeAtomic(e.target, readFileSync(join(dir, e.backup)), e.mode ?? 0o600)
    else unlinkSync(e.target)
  }
}
