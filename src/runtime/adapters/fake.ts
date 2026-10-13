// 테스트용 워커: 녹화 폴더의 files/를 작업 폴더에 덮어쓰고 handoff.md를 HANDOFF 자리에 둔다. LLM 호출 없이 결과를 재현한다.
import {
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { handoffPathFor } from '../../core/paths'
import type { WorkerAdapter, WorkerRequest, WorkerResult } from './types'

export const fakeAdapter: WorkerAdapter = {
  name: 'fake',
  async run(req: WorkerRequest): Promise<WorkerResult> {
    const dir = req.fixtureDir
    if (!dir || !existsSync(dir)) {
      return {
        exitCode: 2,
        timedOut: false,
        rawOutput: '',
        stderr: `fake 어댑터에는 --fixture <폴더>가 필요합니다 (받은 값: ${dir ?? '없음'})`,
      }
    }
    const files = join(dir, 'files')
    if (existsSync(files)) cpSync(files, req.cwd, { recursive: true })
    // 공격 재현용: symlinks.json의 [{path, target}]대로 작업 폴더에 심볼릭 링크를 만든다
    const links = join(dir, 'symlinks.json')
    if (existsSync(links)) {
      for (const l of JSON.parse(readFileSync(links, 'utf8')) as {
        path: string
        target: string
      }[]) {
        const at = join(req.cwd, l.path.replaceAll('{{TASK}}', req.taskId))
        mkdirSync(dirname(at), { recursive: true })
        rmSync(at, { force: true })
        symlinkSync(l.target, at)
      }
    }
    // 공격 재현용: hardlinks.json의 [{path, target}]대로 하드 링크를 만든다
    const hard = join(dir, 'hardlinks.json')
    if (existsSync(hard)) {
      for (const l of JSON.parse(readFileSync(hard, 'utf8')) as {
        path: string
        target: string
      }[]) {
        const at = join(req.cwd, l.path)
        mkdirSync(dirname(at), { recursive: true })
        rmSync(at, { force: true })
        linkSync(l.target, at)
      }
    }
    const handoffSrc = join(dir, 'handoff.md')
    if (existsSync(handoffSrc)) {
      const target = join(req.cwd, handoffPathFor(req.taskId))
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, readFileSync(handoffSrc, 'utf8').replaceAll('{{TASK}}', req.taskId))
    }
    return {
      exitCode: 0,
      timedOut: false,
      rawOutput: '',
      stderr: '',
      usage: {
        input_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
      },
      model: 'fake',
    }
  },
}
