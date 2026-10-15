// 테스트가 실제 에이전트 CLI(claude, codex, orca)를 부르지 못하게 PATH 맨 앞에 가짜 실행 파일을 둔다.
// 2026-10-15 오후: 거부 로직을 넣기 전에 돈 테스트가 실제 codex 감사관을 실행했다(유료 실행 금지 위반).
// 가짜 CLI가 필요한 테스트는 자기 폴더를 이보다 앞에 둔다(adapter-env.test.ts처럼).
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'gotechy-noagents-'))
for (const name of ['claude', 'codex', 'orca']) {
  const f = join(dir, name)
  writeFileSync(
    f,
    `#!/bin/sh\necho "테스트가 실제 ${name} CLI를 부르려 했어요. 가짜 실행 파일을 쓰세요" >&2\nexit 97\n`,
  )
  chmodSync(f, 0o755)
}
process.env.PATH = `${dir}:${process.env.PATH ?? ''}`
process.env.GOTECHY_TEST_NO_AGENTS = dir
