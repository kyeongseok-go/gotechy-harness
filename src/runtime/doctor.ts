// gotechy doctor(contract.md 10.2절): 설치 상태가 train과 같은지, 정책이 들어가 있는지, 라이브러리가 규칙을 지키는지.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseVersion, scriptProblems, skillProblems } from '../core/doctor'
import { parseTrain } from '../core/train'
import { checkPacks, type PackSource } from './packs'
import { runProc } from './proc'
import { planSetup } from './setup'

export type DoctorCheck = {
  name: string
  status: 'ok' | 'fail' | 'info'
  detail: string
  fix?: string
}
export type DoctorReport = { train: string; checks: DoctorCheck[] }
export type DoctorOptions = {
  trainFile: string
  libRoot: string
  /** 사용자 홈(정책 파일 위치) */
  home: string
  /** 도구를 찾을 PATH. 기본은 현재 PATH */
  pathEnv?: string
  /** 부트스트랩이 둔 mise 바이너리를 train 체크섬과 대조한다 */
  gotechyHome?: string
  /** 주면 이 저장소의 git 이력 전체를 gitleaks로 검사한다 */
  history?: { root: string; gitleaks: string }
  /** 프로젝트 안에서 실행했으면 그 프로젝트의 팩을 apm 락과 대조한다(contract.md 10.2절) */
  project?: string
  /** 팩 대조 기준. 기본은 train의 packs와 라이브러리 저장소 */
  packs?: PackSource
}

const MAX_SKILLS = 15

function walk(dir: string, accept: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p, accept))
    else if (accept(name)) out.push(p)
  }
  return out
}

export async function runDoctor(o: DoctorOptions): Promise<DoctorReport> {
  const train = parseTrain(readFileSync(o.trainFile, 'utf8'))
  const checks: DoctorCheck[] = []
  const env = { PATH: o.pathEnv ?? process.env.PATH ?? '/usr/bin:/bin', HOME: o.home }

  for (const [name, tool] of Object.entries(train.tools)) {
    const r = await runProc(['sh', '-c', tool.check], {
      cwd: o.libRoot,
      env,
      replaceEnv: true,
      timeoutMs: 20_000,
    })
    const got = r.exitCode === 0 ? parseVersion(`${r.stdout}\n${r.stderr}`) : undefined
    const soft = tool.pin === 'C'
    // A등급은 mise가 락대로 설치한다. B등급은 mise 밖에서 설치하므로 다시 설치하거나 검증 뒤 train을 올려야 한다
    const reinstall =
      tool.pin === 'A'
        ? '라이브러리 폴더에서 `mise install --locked`를 실행하고 PATH에 mise 도구가 잡히는지 확인하세요'
        : `${name}를 train 버전(${tool.version})으로 다시 설치하거나, 새 버전을 검증한 뒤 train을 올리세요. 자동 업데이트는 \`gotechy setup\`의 정책이 막아요`
    if (!got) {
      checks.push({
        name,
        status: soft ? 'info' : 'fail',
        detail: `설치되지 않았거나 버전을 읽지 못했어요 (\`${tool.check}\`)`,
        ...(soft ? {} : { fix: reinstall }),
      })
    } else if (got !== tool.version) {
      checks.push({
        name,
        status: soft ? 'info' : 'fail',
        detail: `${got} (train ${train.train}의 버전은 ${tool.version})`,
        ...(soft
          ? {}
          : {
              fix:
                tool.pin === 'A'
                  ? `train 버전으로 맞추세요: 라이브러리 폴더에서 \`mise install --locked\`. 다른 설치본이 PATH 앞에 있으면 지우거나 순서를 바꾸세요 (\`which ${name}\`)`
                  : reinstall,
            }),
      })
    } else {
      checks.push({ name, status: 'ok', detail: got })
    }
  }

  if (o.gotechyHome) {
    const bin = join(o.gotechyHome, 'bin', 'mise')
    const platform = `${process.platform === 'darwin' ? 'macos' : 'linux'}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`
    if (existsSync(bin)) {
      const got = createHash('sha256').update(readFileSync(bin)).digest('hex')
      checks.push(
        got === train.mise.sha256[platform]
          ? { name: 'mise 바이너리', status: 'ok', detail: `${bin} 체크섬이 train과 같아요` }
          : {
              name: 'mise 바이너리',
              status: 'fail',
              detail: `${bin} 체크섬이 train(${platform})과 달라요`,
              fix: '그 파일을 지우고 bin/gotechy를 다시 실행해 train의 mise를 받으세요',
            },
      )
    }
  }

  try {
    const plan = planSetup({ home: o.home, gotechyHome: '', trainFile: o.trainFile })
    if (plan.changes.length === 0)
      checks.push({ name: '정책', status: 'ok', detail: '전역 설정에 정책이 들어가 있어요' })
    for (const c of plan.changes)
      checks.push({
        name: `정책: ${c.path}`,
        status: 'fail',
        detail: `빠진 설정: ${c.summary.join(', ')}`,
        fix: '`gotechy setup --dry-run`으로 확인한 뒤 `gotechy setup`',
      })
  } catch (e) {
    checks.push({
      name: '정책',
      status: 'fail',
      detail: (e as Error).message,
      fix: '설정 파일의 문법을 고치세요',
    })
  }

  const skills = walk(join(o.libRoot, 'skills'), (n) => n === 'SKILL.md')
  for (const f of skills) {
    const problems = skillProblems(readFileSync(f, 'utf8'))
    if (problems.length > 0)
      checks.push({
        name: `스킬: ${f.slice(o.libRoot.length + 1)}`,
        status: 'fail',
        detail: problems.join(', '),
        fix: 'SKILL.md frontmatter와 길이를 고치세요',
      })
  }
  checks.push(
    skills.length > MAX_SKILLS
      ? {
          name: '스킬 수',
          status: 'fail',
          detail: `${skills.length}개 (${MAX_SKILLS}개 이하)`,
          fix: '자주 쓰지 않는 스킬을 팩으로 빼세요',
        }
      : { name: '스킬 수', status: 'ok', detail: `${skills.length}개` },
  )

  const scripts = [
    ...walk(join(o.libRoot, 'bin'), () => true),
    ...walk(join(o.libRoot, 'scripts'), (n) => n.endsWith('.sh')),
    ...walk(join(o.libRoot, '.claude', 'hooks'), (n) => n.endsWith('.sh')),
    ...walk(join(o.libRoot, '.githooks'), () => true),
    ...walk(join(o.libRoot, 'templates'), (n) => n.endsWith('.sh') || n === 'pre-commit'),
  ]
  for (const f of scripts) {
    const problems = scriptProblems(readFileSync(f, 'utf8'))
    if (problems.length > 0)
      checks.push({
        name: `스크립트: ${f.slice(o.libRoot.length + 1)}`,
        status: 'fail',
        detail: problems.join(', '),
        fix: 'macOS 기본 셸에서 도는 문법으로 바꾸세요 (contract.md 10.2절)',
      })
  }

  if (o.project) {
    const packs = await checkPacks(o.project, env, o.packs ?? { ...train.packs, lib: o.libRoot })
    if (packs) checks.push(packs)
  }

  if (o.history) {
    // 저장소의 .gitleaks.toml이 아니라 라이브러리의 설정을 쓴다. 저장소가 검사를 끄지 못하게 한다
    const config = join(o.libRoot, 'templates', 'project', 'gitleaks.toml')
    const r = await runProc(
      [o.history.gitleaks, 'git', '--no-banner', '--redact', '--config', config, '.'],
      { cwd: o.history.root, timeoutMs: 300_000 },
    )
    checks.push(
      r.exitCode === 0
        ? { name: 'git 이력', status: 'ok', detail: '비밀 값이 보이지 않아요' }
        : {
            name: 'git 이력',
            status: 'fail',
            detail: `gitleaks가 비밀 값으로 보이는 것을 찾았어요 (exit ${r.exitCode})`,
            fix: '찾은 값을 폐기(키 재발급)하고, 이력에서 지우려면 오너와 상의하세요 (git filter-repo, force push는 오너 승인 필요)',
          },
    )
  }
  return { train: train.train, checks }
}

export function formatDoctor(r: DoctorReport): string {
  const lines = [`train ${r.train}`]
  for (const c of r.checks) {
    lines.push(
      `${c.status === 'ok' ? 'ok  ' : c.status === 'info' ? '정보' : '실패'} ${c.name}: ${c.detail}`,
    )
    if (c.fix) lines.push(`     고치는 법: ${c.fix}`)
  }
  const fails = r.checks.filter((c) => c.status === 'fail').length
  lines.push(fails === 0 ? '모두 통과했어요' : `실패 ${fails}건`)
  return `${lines.join('\n')}\n`
}
