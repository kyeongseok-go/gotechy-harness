#!/usr/bin/env bun
// gotechy CLI. 종료코드: 0 성공, 1 검사 실패(고칠 수 있는 문제), 2 환경 문제(도구·경로·상태).
import { existsSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Command } from 'commander'
import { parseFrontmatter } from './core/frontmatter'
import { formatInbox } from './core/inbox'
import { formatIssue } from './core/issues'
import { hasErrors, lintHandoff } from './core/lint-handoff'
import { lintTask } from './core/lint-task'
import { lintStyle } from './core/style'
import { loadCards, renderViews } from './runtime/inbox'
import { initProject } from './runtime/init'
import { findProject } from './runtime/project'
import { runTask } from './runtime/run'
import { createTask } from './runtime/task-new'
import { loadKnownTerms } from './runtime/terms'

const program = new Command()
program
  .name('gotechy')
  .description('파일 계약 기반 에이전트 작업 위임 (하네스 v2)')
  .version('2.0.0-alpha.0')

function requireProject() {
  const p = findProject(process.cwd())
  if (!p) {
    console.error(
      'gotechy 프로젝트가 아닙니다 (orchestration/tasks/ 없음). 먼저 `gotechy init`을 실행하세요.',
    )
    process.exit(2)
  }
  return p
}

function textStyleIssues(text: string, rel: string) {
  // frontmatter가 있으면 본문만, 없으면 전체를 문체 검사한다
  const parsed = text.startsWith('---') ? parseFrontmatter(text, rel) : undefined
  if (parsed?.ok) return lintStyle(parsed.value.body, rel, parsed.value.bodyLine)
  return lintStyle(text, rel, 1)
}

function lintFiles(files: string[], kind: 'task' | 'handoff' | 'text'): number {
  let bad = 0
  for (const f of files) {
    if (!existsSync(f)) {
      console.error(`${f}: 파일이 없습니다`)
      return 2
    }
    const text = readFileSync(f, 'utf8')
    const rel = relative(process.cwd(), f) || f
    const issues =
      kind === 'task'
        ? lintTask(text, rel).issues
        : kind === 'handoff'
          ? lintHandoff(text, rel, { knownTerms: loadKnownTerms(findProject(process.cwd())?.root) })
              .issues
          : textStyleIssues(text, rel)
    if (issues.length === 0) console.log(`${rel}: ok`)
    for (const i of issues) console.log(formatIssue(i))
    if (hasErrors(issues)) bad++
    else if (issues.length > 0) console.log(`${rel}: 경고 ${issues.length}건 (오류 없음)`)
  }
  return bad > 0 ? 1 : 0
}

program
  .command('init')
  .description('현재 폴더에 계약 골격(orchestration/), AGENTS.md 라우터, 팩을 깐다')
  .option('--packs <list>', '설치할 팩 (쉼표 구분)', 'owner')
  .action((o: { packs: string }) => {
    const r = initProject(
      process.cwd(),
      o.packs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    for (const c of r.created) console.log(`created: ${c}`)
    for (const s of r.skipped) console.log(`kept:    ${s}`)
    for (const w of r.warnings) console.warn(`warning: ${w}`)
  })

const task = program.command('task').description('작업 명세')
task
  .command('new')
  .argument('<title>', '작업 제목 (80자 이내)')
  .requiredOption('--verify <cmd>', '리드가 완료를 판정할 셸 명령')
  .requiredOption('--ownership <list>', '워커가 바꿀 수 있는 경로 (쉼표 구분)')
  .option('--tier <tier>', '라우팅 등급 T0~T3', 'T0')
  .option('--agent <name>', 'claude | codex | fake')
  .option('--model <id>', '워커 모델 (예: claude-opus-5-5, gpt-6.1-sol)')
  .option('--effort <level>', 'low | medium | high | xhigh | max')
  .option('--packs <list>', '팩 (쉼표 구분)', 'owner')
  .action(
    (
      title: string,
      o: {
        verify: string
        ownership: string
        tier: string
        agent?: string
        model?: string
        effort?: string
        packs: string
      },
    ) => {
      const p = requireProject()
      const { id, file } = createTask(p, {
        title,
        verify: o.verify,
        ownership: o.ownership
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        tier: o.tier as 'T0',
        packs: o.packs.split(',').map((s) => s.trim()),
        ...(o.agent ? { agent: o.agent as 'claude' } : {}),
        ...(o.model ? { model: o.model } : {}),
        ...(o.effort ? { effort: o.effort as 'low' } : {}),
      })
      const code = lintFiles([file], 'task')
      console.log(`created ${relative(process.cwd(), file)} (${id})`)
      process.exit(code)
    },
  )
task
  .command('lint')
  .argument('<files...>')
  .action((files: string[]) => process.exit(lintFiles(files, 'task')))

program
  .command('handoff')
  .description('HANDOFF')
  .command('lint')
  .argument('<files...>')
  .action((files: string[]) => process.exit(lintFiles(files, 'handoff')))

program
  .command('text')
  .description('사람용 문서')
  .command('lint')
  .description('문체 규칙(contract.md 7절, AI 티) 검사')
  .argument('<files...>')
  .action((files: string[]) => process.exit(lintFiles(files, 'text')))

program
  .command('inbox')
  .description('HANDOFF를 결정 필요, 실패, 완료 순의 3초 카드로 보여 준다 (contract.md 8.1절)')
  .action(() => {
    process.stdout.write(formatInbox(loadCards(requireProject())))
  })

program
  .command('render')
  .description('읽기 전용 HTML 화면을 .gotechy/view/에 만든다 (contract.md 8.2절)')
  .argument('[taskId]', '이 작업 화면의 주소를 출력 (없으면 인박스 화면)')
  .action((taskId?: string) => {
    const r = renderViews(requireProject())
    const target = taskId ? r.pages.get(taskId) : r.index
    if (!target) {
      console.error(
        `${taskId}: 화면을 만들 HANDOFF가 없어요. orchestration/handoffs/${taskId}.md가 없거나 읽을 수 없어요 (gotechy inbox로 확인).`,
      )
      process.exit(1)
    }
    console.log(
      `화면 ${r.pages.size + 1}개를 만들었어요: ${relative(process.cwd(), r.dir) || r.dir}`,
    )
    console.log(pathToFileURL(target).href)
  })

program
  .command('run')
  .argument('<taskId>')
  .option('--adapter <name>', 'claude | codex | fake (작업의 agent보다 우선)')
  .option('--fixture <dir>', 'fake 어댑터가 재생할 녹화 폴더')
  .action(async (taskId: string, o: { adapter?: string; fixture?: string }) => {
    const p = requireProject()
    const out = await runTask(p, taskId, {
      ...(o.adapter ? { adapter: o.adapter as 'claude' } : {}),
      ...(o.fixture ? { fixtureDir: o.fixture } : {}),
      log: (s) => console.log(s),
    })
    for (const m of out.messages) console.log(m)
    if (out.handoffFile)
      console.log(`HANDOFF: ${relative(process.cwd(), out.handoffFile)} (${out.status})`)
    process.exit(out.status === 'refused' ? 2 : out.status === 'failed' ? 1 : 0)
  })

await program.parseAsync()
