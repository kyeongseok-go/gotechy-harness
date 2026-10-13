// gotechy setup(contract.md 10.3절): train의 정책을 전역 설정(~/.claude/settings.json, ~/.codex/config.toml)에 넣고,
// 바꾸기 전에 백업과 manifest를 남겨 그대로 되돌릴 수 있게 한다. 1a의 setup은 정책만 다룬다(도구 설치는 부트스트랩).
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
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
  before: string | null
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

const sha = (text: string | Buffer) => createHash('sha256').update(text).digest('hex')

function current(path: string): { target: string; text: string | null; mode: number | null } {
  if (!existsSync(path)) return { target: path, text: null, mode: null }
  const target = realpathSync(path)
  return { target, text: readFileSync(target, 'utf8'), mode: statSync(target).mode & 0o777 }
}

function claudeAfter(text: string | null, train: Train): { after: string; summary: string[] } {
  const obj = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  const summary: string[] = []
  const env = { ...((obj.env as Record<string, string>) ?? {}) }
  for (const [k, v] of Object.entries(train.policy.claude.env)) {
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
  const next = { ...obj, env, permissions: { ...permissions, deny } }
  return { after: `${JSON.stringify(next, null, 2)}\n`, summary }
}

/** TOML은 줄 단위로 고친다. 첫 표([table]) 앞의 최상위 키만 다루고 주석과 나머지는 그대로 둔다. */
function codexAfter(text: string | null, train: Train): { after: string; summary: string[] } {
  const want = `check_for_update_on_startup = ${train.policy.codex.check_for_update_on_startup}`
  const lines = (text ?? '').split('\n')
  const firstTable = lines.findIndex((l) => /^\s*\[/.test(l))
  const top = firstTable === -1 ? lines.length : firstTable
  const at = lines.slice(0, top).findIndex((l) => /^\s*check_for_update_on_startup\s*=/.test(l))
  if (at !== -1) {
    if (lines[at]?.trim() === want) return { after: text ?? '', summary: [] }
    lines[at] = want
    return { after: lines.join('\n'), summary: [want] }
  }
  const body = text ? `${want}\n${text}` : `${want}\n`
  return { after: body, summary: [want] }
}

export function planSetup(o: SetupOptions): Plan {
  const train = parseTrain(readFileSync(o.trainFile, 'utf8'))
  const files = [
    { path: join(o.home, '.claude', 'settings.json'), edit: claudeAfter },
    { path: join(o.home, '.codex', 'config.toml'), edit: codexAfter },
  ]
  const changes: Change[] = []
  for (const f of files) {
    const cur = current(f.path)
    let edited: { after: string; summary: string[] }
    try {
      edited = f.edit(cur.text, train)
    } catch (e) {
      throw new Error(`${f.path}를 읽을 수 없어 setup을 멈췄어요: ${(e as Error).message}`)
    }
    if (cur.text !== null && edited.after === cur.text) continue
    changes.push({
      path: f.path,
      target: cur.target,
      existed: cur.text !== null,
      beforeSha: cur.text === null ? null : sha(cur.text),
      before: cur.text,
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

/** 임시 파일에 쓰고 권한을 맞춘 뒤 이름을 바꾼다. */
function writeAtomic(target: string, text: string | Buffer, mode: number): void {
  mkdirSync(dirname(target), { recursive: true })
  const tmp = `${target}.gotechy-tmp-${process.pid}`
  writeFileSync(tmp, text, { mode })
  chmodSync(tmp, mode)
  renameSync(tmp, target)
}

/** 적용하고 백업 시각을 돌려준다. 계획 뒤에 파일이 바뀌었으면 아무것도 쓰지 않고 멈춘다. */
export function applySetup(plan: Plan, o: SetupOptions, now = new Date()): string {
  for (const c of plan.changes) {
    const cur = current(c.path)
    const curSha = cur.text === null ? null : sha(cur.text)
    if (curSha !== c.beforeSha)
      throw new Error(
        `${c.path}가 계획을 세운 뒤에 바뀌었어요. 다시 실행하세요 (아무것도 바꾸지 않았어요)`,
      )
  }
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')
  const dir = join(o.gotechyHome, 'backup', stamp)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
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
  for (const c of plan.changes) writeAtomic(c.target, c.after, c.mode ?? 0o600)
  return stamp
}

/** manifest대로 되돌린다. 적용 뒤 사용자가 바꾼 파일이 있으면 아무것도 바꾸지 않고 멈춘다. */
export function restoreSetup(o: SetupOptions, stamp: string): void {
  if (!/^\d{8}T\d{6}Z$/.test(stamp)) throw new Error(`백업 시각 형식이 아니에요: ${stamp}`)
  const dir = join(o.gotechyHome, 'backup', stamp)
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as {
    entries: Entry[]
  }
  for (const e of manifest.entries) {
    const now = existsSync(e.target) ? sha(readFileSync(e.target)) : null
    if (now !== e.after_sha256)
      throw new Error(
        `${e.path}가 setup 뒤에 바뀌었어요. 사용자의 변경을 덮어쓰지 않으려고 복원을 멈췄어요 (아무것도 바꾸지 않았어요)`,
      )
  }
  for (const e of manifest.entries) {
    if (e.existed && e.backup)
      writeAtomic(e.target, readFileSync(join(dir, e.backup)), e.mode ?? 0o600)
    else unlinkSync(e.target)
  }
}
