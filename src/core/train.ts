// train.yaml 스키마(contract.md 10.1절).
import { parse } from 'yaml'
import { z } from 'zod'

export const TrainTool = z
  .object({ version: z.string().min(1), pin: z.enum(['A', 'B', 'C']), check: z.string().min(1) })
  .strict()

export const Train = z
  .object({
    train: z.string().min(1),
    mise: z
      .object({
        version: z.string(),
        sha256: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
      })
      .strict(),
    tools: z.record(z.string(), TrainTool),
    policy: z
      .object({
        claude: z
          .object({ env: z.record(z.string(), z.string()), deny: z.array(z.string()) })
          .strict(),
        codex: z.object({ check_for_update_on_startup: z.boolean() }).strict(),
      })
      .strict(),
  })
  .strict()
export type Train = z.infer<typeof Train>

export function parseTrain(text: string): Train {
  return Train.parse(parse(text, { version: '1.2' }))
}
