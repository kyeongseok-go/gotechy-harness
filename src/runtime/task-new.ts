// gotechy task new: 번호를 발급하고 계약 형식의 작업 명세를 만든다.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { serializeFrontmatter } from '../core/frontmatter'
import type { TaskFrontmatter } from '../core/schema'
import { allocateTaskId, type Project, paths } from './project'

export type NewTaskInput = {
  title: string
  verify: string
  ownership: string[]
  tier?: TaskFrontmatter['tier']
  packs?: string[]
  agent?: TaskFrontmatter['agent']
  model?: string
  effort?: TaskFrontmatter['effort']
  status?: TaskFrontmatter['status']
}

export function createTask(p: Project, input: NewTaskInput): { id: string; file: string } {
  const id = allocateTaskId(p)
  const fm: TaskFrontmatter = {
    id,
    title: input.title,
    status: input.status ?? 'ready',
    packs: input.packs ?? ['owner'],
    tier: input.tier ?? 'T0',
    deps: [],
    ownership: input.ownership,
    data_class: 'public',
    autonomy: 'L0',
    verify: input.verify,
    irreversible: false,
    gate: 'none',
    created_at: new Date().toISOString(),
    ...(input.agent ? { agent: input.agent } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.effort ? { effort: input.effort } : {}),
  }
  const body = [
    '## Target',
    input.ownership.join(', '),
    '',
    '## Change',
    input.title,
    '',
    '## Constraints',
    '- ownership 밖의 파일은 바꾸지 않는다.',
    '',
    '## Ownership',
    input.ownership.map((o) => `- ${o}`).join('\n'),
    '',
    '## Observable acceptance',
    `- \`${input.verify}\` 가 exit 0`,
    '',
  ].join('\n')
  const file = paths.task(p, id)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, serializeFrontmatter(fm as unknown as Record<string, unknown>, body))
  return { id, file }
}
