// apm.yml 계획과 apm.lock.yaml 검사(contract.md 10.7절). 파일을 읽고 쓰는 일은 runtime/packs.ts가 한다.
import { isMap, isSeq, parse, parseDocument, stringify } from 'yaml'

export const TARGETS = ['claude', 'agent-skills'] as const
export const SKILL_DIRS = ['.claude/skills', '.agents/skills'] as const

export type ManifestPlan = { text: string; changed: boolean; conflicts: string[] }
export type WantedSkill = { source: string; skill: string; ref: string }

export function skillDep(source: string, skill: string, ref: string): string {
  return `${source}/skills/${skill}#${ref}`
}

function projectName(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'project'
}

function depBase(dep: string): string {
  const i = dep.indexOf('#')
  return i === -1 ? dep : dep.slice(0, i)
}

/** init이 다루는 apm.yml 키. 나머지(scripts, registries, devDependencies, mcp 등)는 apm이 무엇을 할지 init이 보장하지 못한다 */
const MANIFEST_KEYS = new Set(['name', 'version', 'description', 'targets', 'dependencies'])

/**
 * 있는 apm.yml에 빠진 의존성만 더한다. 바꾸면 안 되는 상태는 충돌로 돌려준다: 다른 커밋, 다른 대상, 읽기 실패,
 * 그리고 allowed(train의 출처와 커밋으로 만든 팩 줄) 밖의 의존성이나 키. 남이 만든 저장소의 apm.yml을
 * init이 통째로 설치하지 않게 한다(보안 감사 7차 중간 1)
 */
export function planManifest(
  existing: string | undefined,
  name: string,
  deps: string[],
  allowed: readonly string[],
): ManifestPlan {
  if (existing === undefined) {
    const text = stringify({
      name: projectName(name),
      version: '0.0.0',
      targets: [...TARGETS],
      dependencies: { apm: deps },
    })
    return { text, changed: true, conflicts: [] }
  }
  const keep = (conflicts: string[]): ManifestPlan => ({
    text: existing,
    changed: false,
    conflicts,
  })
  const doc = parseDocument(existing)
  if (doc.errors.length > 0 || !isMap(doc.contents))
    return keep([
      `apm.yml을 읽지 못했어요: ${doc.errors[0]?.message ?? '맨 위가 키와 값의 목록이 아니에요'}`,
    ])

  const conflicts: string[] = []
  for (const k of doc.contents.items.map((i) =>
    String((i.key as { value?: unknown })?.value ?? i.key),
  ))
    if (!MANIFEST_KEYS.has(k) && k !== 'target')
      conflicts.push(
        `apm.yml에 init이 다루지 않는 키(${k})가 있어요. 이 하네스의 팩만 apm으로 깔아요. 그 키를 지우거나 다른 폴더에서 설치하세요`,
      )
  if (doc.has('target'))
    conflicts.push('apm.yml에 `target`이 있어요. `targets: [claude, agent-skills]`로 바꿔 주세요')
  const targets = doc.get('targets')
  let addTargets = false
  if (targets === undefined) addTargets = !doc.has('target')
  else {
    const list = isSeq(targets) ? targets.toJSON() : []
    const missing = TARGETS.filter((t) => !list.includes(t))
    if (missing.length > 0)
      conflicts.push(
        `apm.yml의 targets에 ${missing.join(', ')}가 없어요. 넣으면 다른 의존성의 설치 위치도 바뀌니 직접 넣어 주세요`,
      )
  }

  const depsNode = doc.get('dependencies')
  if (depsNode !== undefined && !isMap(depsNode))
    return keep([...conflicts, 'apm.yml의 dependencies가 키와 값의 목록이 아니에요'])
  if (isMap(depsNode))
    for (const i of depsNode.items) {
      const k = String((i.key as { value?: unknown })?.value ?? i.key)
      if (k !== 'apm')
        conflicts.push(
          `apm.yml의 dependencies에 ${k}가 있어요. init은 이 하네스의 팩(dependencies.apm)만 다뤄요`,
        )
    }
  const apmNode = doc.getIn(['dependencies', 'apm'])
  if (apmNode !== undefined && !isSeq(apmNode))
    return keep([...conflicts, 'apm.yml의 dependencies.apm이 목록이 아니에요'])
  const current: unknown[] = isSeq(apmNode) ? apmNode.toJSON() : []
  for (const c of current) {
    if (typeof c !== 'string') {
      conflicts.push(
        'apm.yml의 dependencies.apm에 문자열이 아닌 항목이 있어요. 팩 줄은 문자열로만 써요',
      )
      continue
    }
    if (allowed.includes(c)) continue
    // 같은 스킬의 다른 커밋은 아래에서 따로 알린다
    if (deps.some((d) => depBase(d) === depBase(c))) continue
    conflicts.push(
      `apm.yml에 init이 관리하지 않는 의존성(${c})이 있어요. 이 하네스의 팩만 apm으로 깔아요. 그 줄을 지우거나 다른 폴더에서 설치하세요`,
    )
  }

  const add: string[] = []
  for (const dep of deps) {
    if (current.includes(dep)) continue
    const other = current.find((c) => typeof c === 'string' && depBase(c) === depBase(dep)) as
      | string
      | undefined
    if (other !== undefined) {
      conflicts.push(
        `apm.yml에 ${depBase(dep)}가 다른 커밋(${other.slice(depBase(dep).length + 1) || '고정 없음'})으로 있어요. train의 커밋으로 맞추려면 그 줄을 지우고 다시 실행하세요`,
      )
      continue
    }
    add.push(dep)
  }
  if (conflicts.length > 0) return keep(conflicts)
  if (!addTargets && add.length === 0) return keep([])

  if (addTargets) doc.set('targets', doc.createNode([...TARGETS], { flow: true }))
  if (add.length > 0) {
    if (isSeq(apmNode)) for (const d of add) apmNode.add(doc.createNode(d))
    else doc.setIn(['dependencies', 'apm'], doc.createNode(add))
  }
  return { text: doc.toString(), changed: true, conflicts: [] }
}

type LockDep = {
  repo_url?: unknown
  virtual_path?: unknown
  resolved_commit?: unknown
  deployed_files?: unknown
}

function lockDeps(text: string | undefined): LockDep[] | undefined {
  if (!text) return undefined
  try {
    const data = parse(text) as { dependencies?: unknown } | null
    const deps = data?.dependencies
    if (!Array.isArray(deps) || deps.some((d) => typeof d !== 'object' || d === null))
      return undefined
    return deps as LockDep[]
  } catch {
    return undefined
  }
}

/** 락이 관리하는(설치한) 파일 경로. 락이 없거나 읽을 수 없으면 빈 목록 */
export function managedFiles(text: string | undefined): Set<string> {
  const out = new Set<string>()
  for (const d of lockDeps(text) ?? [])
    if (Array.isArray(d.deployed_files))
      for (const f of d.deployed_files) if (typeof f === 'string') out.add(f)
  return out
}

/** 설치 뒤 락 검사: 스킬마다 train의 커밋으로 풀렸고 두 곳의 SKILL.md가 깔렸는가 */
export function lockProblems(text: string, want: WantedSkill[]): string[] {
  const deps = lockDeps(text)
  if (!deps) return ['apm.lock.yaml을 읽지 못했어요']
  const problems: string[] = []
  for (const w of want) {
    const d = deps.find((x) => x.repo_url === w.source && x.virtual_path === `skills/${w.skill}`)
    if (!d) {
      problems.push(`apm.lock.yaml에 ${w.skill}이 없어요`)
      continue
    }
    if (d.resolved_commit !== w.ref)
      problems.push(`${w.skill}이 ${String(d.resolved_commit)} 커밋으로 깔렸어요 (train ${w.ref})`)
    const files = Array.isArray(d.deployed_files) ? d.deployed_files : []
    for (const dir of SKILL_DIRS) {
      const f = `${dir}/${w.skill}/SKILL.md`
      if (!files.includes(f)) problems.push(`${f}가 깔리지 않았어요`)
    }
  }
  return problems
}
