// 팩 설치와 검사(contract.md 10.7절, 10.2절). 팩은 apm으로 train의 커밋에 고정해 깔고,
// 깔린 파일은 라이브러리 저장소의 그 커밋과 대조한다. 락은 스스로를 보증하지 못한다(보안 감사 7차 중간 2).
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parse } from 'yaml'
import { lockProblems, managedFiles, planManifest, SKILL_DIRS, skillDep } from '../core/apm'
import type { DoctorCheck } from './doctor'
import { gitProc } from './git'
import { runProc } from './proc'
import { linkedPaths } from './project'

export const PACKS: Record<string, string[]> = { owner: ['owner-protocol'] }

export type PackReport = { created: string[]; skipped: string[]; errors: string[] }
/** train의 packs와, 그 커밋을 담은 라이브러리 저장소(대조 기준) */
export type PackSource = { source: string; ref: string; lib: string }
type Env = Record<string, string | undefined>

const APM_TIMEOUT_MS = 300_000
const KNOWN_SKILLS = [...new Set(Object.values(PACKS).flat())]
/** init과 apm이 쓰는 경로. 링크면 apm이 그 너머에 쓰거나 gotechy가 저장소 밖 파일을 고친다(보안 감사 7차 중간 4) */
const APM_PATHS = [
  'apm.yml',
  'apm.lock.yaml',
  'apm_modules',
  '.claude',
  '.claude/skills',
  '.agents',
  '.agents/skills',
]

/** apm에 넘기는 환경 변수 허용 목록(보안 감사 7차 낮음 5). 팩 출처는 공개 저장소라 토큰이 필요 없다 */
const ENV_KEYS = new Set([
  'PATH',
  'HOME',
  'TMPDIR',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'TERM',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'all_proxy',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'REQUESTS_CA_BUNDLE',
  'CURL_CA_BUNDLE',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
])

export function apmEnv(env: Env): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env))
    if (v !== undefined && (ENV_KEYS.has(k) || k.startsWith('LC_'))) out[k] = v
  return out
}

const allowedDeps = (src: PackSource) => KNOWN_SKILLS.map((s) => skillDep(src.source, s, src.ref))
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')
/** git blob id. 라이브러리의 ls-tree 값과 비교해 blob 내용을 읽지 않고 대조한다 */
const blobId = (b: Buffer) =>
  createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b]))
    .digest('hex')

function findApm(env: Env): string | null {
  return Bun.which('apm', { PATH: env.PATH ?? '' })
}

function tail(text: string): string {
  return text.trim().split('\n').slice(-5).join('\n')
}

/** 라이브러리 저장소의 ref에 있는 skills/<스킬>/ 파일(스킬 폴더 기준 경로)과 blob id */
async function expectedFiles(
  src: PackSource,
  skill: string,
): Promise<Map<string, string> | string> {
  const prefix = `skills/${skill}/`
  const r = await gitProc(['ls-tree', '-r', '-z', '--full-tree', src.ref, '--', prefix], src.lib)
  if (r.exitCode !== 0)
    return `라이브러리 저장소에서 커밋 ${src.ref}의 ${prefix}를 읽지 못했어요 (${r.stderr.trim()})`
  const files = new Map<string, string>()
  for (const entry of r.stdout.split('\0')) {
    if (!entry) continue
    const [meta, path] = entry.split('\t')
    const [mode, type, sha] = (meta ?? '').split(' ')
    if (type !== 'blob' || (mode !== '100644' && mode !== '100755') || !path || !sha)
      return `라이브러리 원본 ${path ?? '?'}가 일반 파일이 아니에요 (mode ${mode})`
    files.set(path.slice(prefix.length), sha)
  }
  if (files.size === 0) return `라이브러리 커밋 ${src.ref}에 ${prefix}가 없어요`
  return files
}

function filesUnder(dir: string, rel = ''): { files: string[]; links: string[] } {
  const out = { files: [] as string[], links: [] as string[] }
  for (const name of readdirSync(join(dir, rel))) {
    const r = rel ? `${rel}/${name}` : name
    const st = lstatSync(join(dir, r))
    if (st.isSymbolicLink()) out.links.push(r)
    else if (st.isDirectory()) {
      const sub = filesUnder(dir, r)
      out.files.push(...sub.files)
      out.links.push(...sub.links)
    } else out.files.push(r)
  }
  return out
}

type LockDep = {
  repo_url?: unknown
  virtual_path?: unknown
  resolved_commit?: unknown
  deployed_file_hashes?: unknown
}

/** 깔린 팩을 라이브러리 커밋(내용)과 락(해시, 커밋) 둘 다와 대조한다 */
async function integrityProblems(
  root: string,
  src: PackSource,
  skills: string[],
  lockText: string,
): Promise<string[]> {
  let deps: LockDep[] = []
  try {
    const data = parse(lockText) as { dependencies?: unknown } | null
    if (Array.isArray(data?.dependencies)) deps = data.dependencies as LockDep[]
  } catch {
    return ['apm.lock.yaml을 읽지 못했어요']
  }
  const problems: string[] = []
  for (const d of deps)
    if (d?.repo_url !== src.source)
      problems.push(
        `apm.lock.yaml에 train 밖 의존성(${String(d?.repo_url)}/${String(d?.virtual_path)})이 있어요`,
      )
  for (const skill of skills) {
    const expected = await expectedFiles(src, skill)
    if (typeof expected === 'string') {
      problems.push(expected)
      continue
    }
    const d = deps.find((x) => x?.repo_url === src.source && x.virtual_path === `skills/${skill}`)
    if (!d) {
      problems.push(`apm.lock.yaml에 ${skill}이 없어요`)
      continue
    }
    if (d.resolved_commit !== src.ref)
      problems.push(`${skill}이 ${String(d.resolved_commit)} 커밋으로 깔렸어요 (train ${src.ref})`)
    const hashes = (d.deployed_file_hashes ?? {}) as Record<string, unknown>
    for (const dir of SKILL_DIRS) {
      const base = join(root, dir, skill)
      if (!existsSync(base)) {
        problems.push(`${dir}/${skill}/가 없어요`)
        continue
      }
      const found = filesUnder(base)
      for (const l of found.links) problems.push(`${dir}/${skill}/${l}가 심볼릭 링크예요`)
      for (const f of found.files)
        if (!expected.has(f))
          problems.push(`${dir}/${skill}/${f}는 라이브러리 원본에 없는 파일이에요`)
      for (const [rel, blob] of expected) {
        const at = `${dir}/${skill}/${rel}`
        if (!found.files.includes(rel)) {
          problems.push(`${at}가 없어요`)
          continue
        }
        const bytes = readFileSync(join(root, at))
        if (blobId(bytes) !== blob)
          problems.push(`${at}가 라이브러리 커밋 ${src.ref.slice(0, 12)}의 원본과 달라요`)
        if (hashes[at] !== `sha256:${sha256(bytes)}`)
          problems.push(`apm.lock.yaml의 ${at} 해시가 깔린 파일과 달라요`)
      }
    }
  }
  return problems
}

export async function installPacks(
  root: string,
  packs: string[],
  src: PackSource,
  env: Env,
): Promise<PackReport> {
  const report: PackReport = { created: [], skipped: [], errors: [] }
  const skills: string[] = []
  for (const pack of packs) {
    const list = PACKS[pack]
    if (list) skills.push(...list)
    else report.errors.push(`알 수 없는 팩: ${pack} (사용 가능: ${Object.keys(PACKS).join(', ')})`)
  }
  if (report.errors.length > 0 || skills.length === 0) return report

  const linked = linkedPaths(root, [
    ...APM_PATHS,
    ...skills.flatMap((s) => SKILL_DIRS.map((d) => `${d}/${s}`)),
  ])
  if (linked.length > 0) {
    report.errors.push(
      `심볼릭 링크라서 팩을 깔지 않았어요: ${linked.join(', ')}. 링크를 지운 뒤 다시 실행하세요`,
    )
    return report
  }

  // apm은 자기가 관리하지 않는 같은 이름 폴더를 건너뛰고도 exit 0으로 끝난다(2026-10-15 실험). 그래서 먼저 막는다
  const lockFile = join(root, 'apm.lock.yaml')
  const lockBefore = existsSync(lockFile) ? readFileSync(lockFile, 'utf8') : undefined
  const managed = managedFiles(lockBefore)
  const present: string[] = []
  for (const skill of skills)
    for (const dir of SKILL_DIRS) {
      const rel = `${dir}/${skill}`
      if (!lstatSync(join(root, rel), { throwIfNoEntry: false })) continue
      if (managed.has(`${rel}/SKILL.md`)) present.push(skill)
      else
        report.errors.push(
          `${rel}/이 이미 있는데 apm이 관리하지 않아요(예전 init이 복사한 폴더). 지운 뒤 다시 실행하세요`,
        )
    }
  if (report.errors.length > 0) return report
  // 락이 관리한다고 적은 폴더도 믿지 않는다. 락과 파일을 함께 바꾼 저장소일 수 있다
  const already = [...new Set(present)]
  if (already.length > 0 && lockBefore !== undefined) {
    const problems = await integrityProblems(root, src, already, lockBefore)
    if (problems.length > 0) {
      report.errors.push(
        '이미 깔린 팩이 라이브러리 원본과 달라 설치하지 않았어요. 그 폴더와 apm.lock.yaml을 지운 뒤 다시 실행하세요',
        ...problems,
      )
      return report
    }
  }

  const manifest = join(root, 'apm.yml')
  const manifestBefore = existsSync(manifest) ? readFileSync(manifest, 'utf8') : undefined
  const plan = planManifest(
    manifestBefore,
    basename(root),
    skills.map((s) => skillDep(src.source, s, src.ref)),
    allowedDeps(src),
  )
  if (plan.conflicts.length > 0) {
    report.errors.push(...plan.conflicts)
    return report
  }
  const e = apmEnv(env)
  const apm = findApm(e)
  if (!apm) {
    report.errors.push(
      'apm이 없어 팩을 깔지 않았어요. bin/gotechy로 실행하면 train의 mise가 apm을 PATH에 둬요',
    )
    return report
  }
  if (plan.changed) writeFileSync(manifest, plan.text)
  ;(plan.changed ? report.created : report.skipped).push('apm.yml')
  const rollback = (why: string[]) => {
    // 이번 실행이 바꾼 apm.yml만 되돌린다. apm이 깐 파일과 락은 남을 수 있어 오너에게 알린다
    if (plan.changed) {
      if (manifestBefore === undefined) rmSync(manifest, { force: true })
      else writeFileSync(manifest, manifestBefore)
    }
    report.errors.push(
      ...why,
      'apm.yml은 원래대로 되돌렸어요. apm이 깐 파일과 apm.lock.yaml은 남았을 수 있으니 확인 뒤 지우세요',
    )
    return report
  }

  const r = await runProc([apm, 'install'], {
    cwd: root,
    env: e,
    replaceEnv: true,
    timeoutMs: APM_TIMEOUT_MS,
  })
  if (r.exitCode !== 0)
    return rollback([
      `apm install이 실패했어요 (exit ${r.exitCode})\n${tail(`${r.stdout}\n${r.stderr}`)}`,
    ])
  const lockText = existsSync(lockFile) ? readFileSync(lockFile, 'utf8') : ''
  const problems = [
    ...lockProblems(
      lockText,
      skills.map((skill) => ({ source: src.source, skill, ref: src.ref })),
    ),
    ...(await integrityProblems(root, src, skills, lockText)),
  ]
  if (problems.length > 0) return rollback(problems)
  for (const skill of skills)
    for (const dir of SKILL_DIRS) report.created.push(`${dir}/${skill}/ (apm)`)
  return report
}

/** 프로젝트의 팩이 락과 라이브러리 커밋과 같은가. 팩을 쓰지 않는 프로젝트(apm.yml, 락 모두 없음)면 undefined */
export async function checkPacks(
  root: string,
  env: Env,
  src: PackSource,
): Promise<DoctorCheck | undefined> {
  const fail = (detail: string, fix: string): DoctorCheck => ({
    name: '팩',
    status: 'fail',
    detail,
    fix,
  })
  const linked = linkedPaths(root, APM_PATHS)
  if (linked.length > 0)
    return fail(
      `심볼릭 링크예요: ${linked.join(', ')}`,
      '링크를 지우고 `gotechy init`을 다시 실행하세요',
    )
  const hasManifest = existsSync(join(root, 'apm.yml'))
  const hasLock = existsSync(join(root, 'apm.lock.yaml'))
  if (!hasManifest && !hasLock) return undefined
  if (!hasLock)
    return fail(
      'apm.yml은 있는데 apm.lock.yaml이 없어요',
      '`gotechy init --packs owner`를 다시 실행하세요',
    )
  const e = apmEnv(env)
  const apm = findApm(e)
  if (!apm)
    return fail(
      'apm이 없어 팩을 검사하지 못했어요',
      '라이브러리 폴더에서 `mise install --locked`를 실행하거나 bin/gotechy로 실행하세요',
    )
  const r = await runProc([apm, 'audit', '--ci'], {
    cwd: root,
    env: e,
    replaceEnv: true,
    timeoutMs: APM_TIMEOUT_MS,
  })
  if (r.exitCode !== 0)
    return fail(
      `깔린 팩이 apm.lock.yaml과 달라요 (apm audit --ci exit ${r.exitCode})`,
      '프로젝트 폴더에서 `apm install --frozen`으로 락대로 다시 까세요',
    )
  const manifestText = hasManifest ? readFileSync(join(root, 'apm.yml'), 'utf8') : ''
  const plan = planManifest(manifestText, basename(root), [], allowedDeps(src))
  let listed: unknown
  try {
    listed = (parse(manifestText) as { dependencies?: { apm?: unknown } } | null)?.dependencies?.apm
  } catch {
    listed = undefined
  }
  const skills = KNOWN_SKILLS.filter(
    (s) => Array.isArray(listed) && listed.includes(skillDep(src.source, s, src.ref)),
  )
  const problems = [
    ...plan.conflicts,
    ...(await integrityProblems(
      root,
      src,
      skills,
      readFileSync(join(root, 'apm.lock.yaml'), 'utf8'),
    )),
  ]
  if (problems.length > 0)
    return fail(
      `깔린 팩이 train의 라이브러리 커밋과 달라요: ${problems.slice(0, 3).join('; ')}`,
      '그 스킬 폴더와 apm.lock.yaml을 지우고 `gotechy init --packs owner`를 다시 실행하세요',
    )
  return { name: '팩', status: 'ok', detail: '깔린 팩이 apm.lock.yaml, train의 커밋과 같아요' }
}
