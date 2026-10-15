// e2e 공용: 임시 git 저장소 프로젝트, 임시 GOTECHY_HOME, fake 워커 실행.
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseFrontmatter } from '../../src/core/frontmatter'
import { initProject } from '../../src/runtime/init'
import { initOwnerKey, ownerToolPath } from '../../src/runtime/keys'
import { runTask } from '../../src/runtime/run'
import { createTask, type NewTaskInput } from '../../src/runtime/task-new'

export const FAKE = join(import.meta.dir, '..', 'fixtures', 'fake')
export const yes = async () => true

export function sh(cmd: string[], cwd: string): string {
  const r = Bun.spawnSync({ cmd, cwd, stdout: 'pipe', stderr: 'pipe' })
  if (r.exitCode !== 0) throw new Error(`${cmd.join(' ')}: ${r.stderr.toString()}`)
  return r.stdout.toString()
}

export function fm(file: string): Record<string, unknown> {
  const r = parseFrontmatter(readFileSync(file, 'utf8'), file)
  if (!r.ok) throw new Error(`frontmatter 읽기 실패: ${file}`)
  return r.value.data
}

export function makeProject(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-p-')))
  sh(['git', 'init', '-q', '-b', 'main'], root)
  writeFileSync(join(root, 'README.md'), '# Sandbox\n')
  // 테스트 커밋이 gitleaks hook에 막히지 않게 hook은 켜지 않는다(gitleaks.test.ts가 따로 검사)
  initProject(root, { hooks: false })
  sh(['git', 'add', '-A'], root)
  sh(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init'], root)
  return root
}

export const LIB = realpathSync(join(import.meta.dir, '..', '..'))
const FAKE_OWNERKEY = join(import.meta.dir, '..', 'fixtures', 'ownerkey', 'fake-ownerkey.ts')

/** 임시 GOTECHY_HOME에 테스트용 서명 도구(소프트웨어 키, 사람 확인 없음)를 깐다. 실제 도구와 명령, 종료 코드가 같다 */
export function installFakeOwnerTool(home: string): void {
  mkdirSync(join(home, 'bin'), { recursive: true, mode: 0o700 })
  writeFileSync(
    ownerToolPath(home),
    `#!/bin/sh\nexec '${process.execPath}' '${FAKE_OWNERKEY}' "$@"\n`,
  )
  chmodSync(ownerToolPath(home), 0o755)
}

/**
 * 라이브러리 train에 자동 업데이트 끄기 두 값을 더한 train 파일을 임시 폴더에 만든다. 라이브러리 train에는
 * 이 값이 없지만(2026-10-15 오너 결정, T-005) setup은 train에 있으면 넣을 수 있어야 한다
 */
export function fullPolicyTrain(): string {
  let text = readFileSync(join(LIB, 'train.yaml'), 'utf8')
  for (const [from, to] of [
    ['    env: {}', '    env:\n      DISABLE_AUTOUPDATER: "1"'],
    ['  codex: {}', '  codex:\n    check_for_update_on_startup: false'],
  ] as const) {
    if (!text.includes(from)) throw new Error(`train.yaml에 ${from.trim()} 줄이 없어요`)
    text = text.replace(from, to)
  }
  const f = join(realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-train-'))), 'train.yaml')
  writeFileSync(f, text)
  return f
}

export function makeHome(): string {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-h-')))
  installFakeOwnerTool(home)
  initOwnerKey(home, LIB)
  return home
}

/** 현재 오너 키의 blob 경로(가짜 도구의 취소 표시, 받은 문구 기록이 그 옆에 생긴다) */
export const ownerBlob = (home: string) =>
  join(home, 'owner', `${readFileSync(join(home, 'owner', 'active'), 'utf8').trim()}.blob`)

export function newTask(root: string, over: Partial<NewTaskInput> = {}): string {
  return createTask({ root }, { title: '작업', verify: 'true', ownership: ['README.md'], ...over })
    .id
}

export function runFake(root: string, home: string, id: string, fixture: string) {
  return runTask({ root }, id, { adapter: 'fake', fixtureDir: join(FAKE, fixture), home })
}

export const taskFile = (root: string, id: string) =>
  join(root, 'orchestration', 'tasks', `${id}.md`)
export const handoffFile = (root: string, id: string) =>
  join(root, 'orchestration', 'handoffs', `${id}.md`)
export const gateFile = (root: string, id: string) =>
  join(root, 'orchestration', 'gates', `${id}.md`)
