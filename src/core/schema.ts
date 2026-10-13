// 파일 계약의 스키마. 원천 문서는 docs/references/contract.md — 어긋나면 문서를 먼저 고친다.
import { z } from 'zod'

export const TaskId = z.string().regex(/^T-\d{3,}$/, 'T- 뒤에 3자리 이상 숫자 (예: T-001)')
export const TaskStatus = z.enum([
  'draft',
  'ready',
  'running',
  'done',
  'failed',
  'needs-decision',
  'accepted',
])
export const HandoffStatus = z.enum(['done', 'failed', 'needs-decision'])
export const Agent = z.enum(['claude', 'codex', 'fake'])

export const TaskFrontmatter = z
  .object({
    id: TaskId,
    title: z.string().min(1).max(80),
    status: TaskStatus,
    packs: z.array(z.string().min(1)),
    tier: z.enum(['T0', 'T1', 'T2', 'T3']),
    agent: Agent.optional(),
    model: z.string().min(1).nullable().optional(),
    effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).nullable().optional(),
    deps: z.array(TaskId),
    ownership: z.array(z.string().min(1)).min(1),
    data_class: z.enum(['public', 'internal', 'confidential']),
    autonomy: z.enum(['L0', 'L1', 'L2', 'L3']),
    verify: z.string().min(1),
    irreversible: z.boolean(),
    gate: z.enum(['none', 'before', 'after']),
    budget_usd: z.number().positive().max(20).optional(),
    timeout_min: z.number().int().positive().max(240).optional(),
    created_at: z.string().optional(),
  })
  .strict()
export type TaskFrontmatter = z.infer<typeof TaskFrontmatter>

export const Usage = z
  .object({
    input_tokens: z.number().int().nonnegative(),
    cache_read_tokens: z.number().int().nonnegative(),
    cache_write_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    cost_usd: z.number().nonnegative().nullable(),
  })
  .strict()
export type Usage = z.infer<typeof Usage>

export const HandoffFrontmatter = z
  .object({
    // 워커가 쓰는 값
    task: TaskId,
    status: HandoffStatus,
    packs: z.array(z.string()).default([]),
    skills_loaded: z.array(z.string()).default([]),
    new_terms: z.array(z.string()).default([]),
    /** "말해 보기" 질문마다 좋은 답의 핵심어. 이해 게이트 채점용이라 화면에 보이지 않는다(contract.md 9.1절) */
    comprehension_keys: z.array(z.array(z.string())).optional(),
    // 리드가 측정해 덧붙이는 값
    rev: z.number().int().positive().optional(),
    agent: Agent.optional(),
    model: z.string().nullable().optional(),
    effort: z.string().nullable().optional(),
    usage: Usage.optional(),
    verified: z
      .object({ command: z.string(), exit_code: z.number().int(), at: z.string() })
      .strict()
      .optional(),
    changed_files: z.array(z.string()).optional(),
    lead_note: z.string().optional(),
  })
  .strict()
export type HandoffFrontmatter = z.infer<typeof HandoffFrontmatter>

export const TASK_SECTIONS = [
  'Target',
  'Change',
  'Constraints',
  'Ownership',
  'Observable acceptance',
] as const

export const HANDOFF_SECTIONS = [
  '결정 필요',
  '한 줄 요약',
  '한 일',
  '증거',
  '건너뛴 것, 확인 못 한 것, 리스크',
  '새 용어',
  '말해 보기',
  '다음 단계',
] as const
