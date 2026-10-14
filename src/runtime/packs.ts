// 팩 설치와 검사(contract.md 10.7절, 10.2절). 팩은 apm으로 train의 커밋에 고정해 깐다.
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { lockProblems, managedFiles, planManifest, SKILL_DIRS, skillDep } from '../core/apm'
import type { DoctorCheck } from './doctor'
import { runProc } from './proc'

export const PACKS: Record<string, string[]> = { owner: ['owner-protocol'] }

export type PackReport = { created: string[]; skipped: string[]; errors: string[] }
export type PackSource = { source: string; ref: string }
type Env = Record<string, string | undefined>

const APM_TIMEOUT_MS = 300_000

function findApm(env: Env): string | null {
  return Bun.which('apm', { PATH: env.PATH ?? '' })
}

function tail(text: string): string {
  return text.trim().split('\n').slice(-5).join('\n')
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

  // apm은 자기가 관리하지 않는 같은 이름 폴더를 건너뛰고도 exit 0으로 끝난다(2026-10-15 실험). 그래서 먼저 막는다
  const lockFile = join(root, 'apm.lock.yaml')
  const managed = managedFiles(existsSync(lockFile) ? readFileSync(lockFile, 'utf8') : undefined)
  for (const skill of skills)
    for (const dir of SKILL_DIRS) {
      const rel = `${dir}/${skill}`
      if (lstatSync(join(root, rel), { throwIfNoEntry: false }) && !managed.has(`${rel}/SKILL.md`))
        report.errors.push(
          `${rel}/이 이미 있는데 apm이 관리하지 않아요(예전 init이 복사한 폴더). 지운 뒤 다시 실행하세요`,
        )
    }
  if (report.errors.length > 0) return report

  const manifest = join(root, 'apm.yml')
  const deps = skills.map((s) => skillDep(src.source, s, src.ref))
  const plan = planManifest(
    existsSync(manifest) ? readFileSync(manifest, 'utf8') : undefined,
    basename(root),
    deps,
  )
  if (plan.conflicts.length > 0) {
    report.errors.push(...plan.conflicts)
    return report
  }
  const apm = findApm(env)
  if (!apm) {
    report.errors.push(
      'apm이 없어 팩을 깔지 않았어요. bin/gotechy로 실행하면 train의 mise가 apm을 PATH에 둬요',
    )
    return report
  }
  if (plan.changed) writeFileSync(manifest, plan.text)
  ;(plan.changed ? report.created : report.skipped).push('apm.yml')

  const r = await runProc([apm, 'install'], {
    cwd: root,
    env,
    replaceEnv: true,
    timeoutMs: APM_TIMEOUT_MS,
  })
  if (r.exitCode !== 0) {
    report.errors.push(
      `apm install이 실패했어요 (exit ${r.exitCode})\n${tail(`${r.stdout}\n${r.stderr}`)}`,
    )
    return report
  }
  const problems = lockProblems(
    existsSync(lockFile) ? readFileSync(lockFile, 'utf8') : '',
    skills.map((skill) => ({ source: src.source, skill, ref: src.ref })),
  )
  if (problems.length > 0) {
    report.errors.push(...problems)
    return report
  }
  for (const skill of skills)
    for (const dir of SKILL_DIRS) report.created.push(`${dir}/${skill}/ (apm)`)
  return report
}

/** 프로젝트의 팩이 락과 같은가. 팩을 쓰지 않는 프로젝트(apm.yml, 락 모두 없음)면 undefined */
export async function checkPacks(root: string, env: Env): Promise<DoctorCheck | undefined> {
  const hasManifest = existsSync(join(root, 'apm.yml'))
  const hasLock = existsSync(join(root, 'apm.lock.yaml'))
  if (!hasManifest && !hasLock) return undefined
  if (!hasLock)
    return {
      name: '팩',
      status: 'fail',
      detail: 'apm.yml은 있는데 apm.lock.yaml이 없어요',
      fix: '`gotechy init --packs owner`를 다시 실행하세요',
    }
  const apm = findApm(env)
  if (!apm)
    return {
      name: '팩',
      status: 'fail',
      detail: 'apm이 없어 팩을 검사하지 못했어요',
      fix: '라이브러리 폴더에서 `mise install --locked`를 실행하거나 bin/gotechy로 실행하세요',
    }
  const r = await runProc([apm, 'audit', '--ci'], {
    cwd: root,
    env,
    replaceEnv: true,
    timeoutMs: APM_TIMEOUT_MS,
  })
  return r.exitCode === 0
    ? { name: '팩', status: 'ok', detail: '깔린 팩이 apm.lock.yaml과 같아요' }
    : {
        name: '팩',
        status: 'fail',
        detail: `깔린 팩이 apm.lock.yaml과 달라요 (apm audit --ci exit ${r.exitCode})`,
        fix: '프로젝트 폴더에서 `apm install --frozen`으로 락대로 다시 까세요',
      }
}
