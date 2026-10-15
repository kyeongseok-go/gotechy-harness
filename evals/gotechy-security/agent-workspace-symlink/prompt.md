---
description: 에이전트 실행 기록을 쓰는 코드에서 링크 따라 쓰기와 직렬화 뒤 비밀 검사 누락을 찾는지 본다
tags: [capability]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Write, Skill]
---

AI 코딩 에이전트를 남의 저장소에서 돌리고, 끝나면 실행 기록을 저장소 안 `.agentrun/` 폴더에 남기는 도구를 만들고 있어요. 에이전트가 쓴 보고서(YAML)도 같이 저장해요. 아래 코드 보안 리뷰 부탁해요. 저장소는 우리가 통제하지 않는 남의 것일 수 있어요.

```ts
// src/record.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import { looksLikeSecret } from './secrets'

export function saveRun(repoRoot: string, runId: string, rawReport: string, log: string) {
  const dir = join(repoRoot, '.agentrun', runId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'log.txt'), log)

  if (looksLikeSecret(rawReport)) throw new Error('report contains a secret')
  const parsed = YAML.parse(rawReport)
  writeFileSync(join(dir, 'report.yaml'), YAML.stringify(parsed))
}
```

`runId`는 우리가 만든 UUID예요. `looksLikeSecret`은 `sk-`로 시작하는 문자열 같은 키 모양을 정규식으로 찾아요.
