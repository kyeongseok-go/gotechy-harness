// train.yaml 스키마(contract.md 10.1절).
import { parse } from 'yaml'
import { z } from 'zod'

export const TrainTool = z
  .object({
    version: z.string().min(1),
    pin: z.enum(['A', 'B', 'C']),
    check: z.string().min(1),
    /** A등급 도구의 mise 도구 이름(예: aqua:cli/cli). 라이브러리 mise.toml의 키와 같아야 한다 */
    mise: z.string().min(1).optional(),
  })
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
    tools: z.record(z.string(), TrainTool).superRefine((tools, ctx) => {
      // mise 자신은 부트스트랩이 체크섬으로 설치하므로 빼고, A등급은 mise가 설치할 이름이 있어야 한다
      for (const [name, t] of Object.entries(tools))
        if (t.pin === 'A' && name !== 'mise' && !t.mise)
          ctx.addIssue({
            code: 'custom',
            path: [name, 'mise'],
            message: 'A등급 도구에는 mise 이름이 필요해요',
          })
    }),
    policy: z
      .object({
        claude: z
          .object({
            // 전역 설정에 들어가므로 허용한 키만 받는다(M3 보안 리뷰 중간 4). 예: ANTHROPIC_BASE_URL 같은 키는 거부
            env: z
              .object({
                DISABLE_AUTOUPDATER: z.string().optional(),
                DISABLE_TELEMETRY: z.string().optional(),
                DISABLE_ERROR_REPORTING: z.string().optional(),
              })
              .strict(),
            deny: z.array(z.string().regex(/^(Bash|Read|Edit|Write)\(.+\)$/)),
          })
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
