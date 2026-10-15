#!/usr/bin/env bun
// gotechy CLI. 종료코드: 0 성공, 1 검사 실패(고칠 수 있는 문제), 2 환경 문제(도구·경로·상태).
import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { Command } from 'commander'
import { CORE_MIN, judgeCoverage, parseLcov, TOTAL_MIN } from './core/coverage'
import { parseFrontmatter } from './core/frontmatter'
import { guardBash } from './core/guard'
import { formatInbox } from './core/inbox'
import { formatIssue } from './core/issues'
import { hasErrors, lintHandoff } from './core/lint-handoff'
import { lintTask } from './core/lint-task'
import { lintStyle } from './core/style'
import { parseTrain } from './core/train'
import { acceptTask } from './runtime/accept'
import { auditTask } from './runtime/audit'
import { formatDoctor, runDoctor } from './runtime/doctor'
import { decideGate, listGates, pinOwner, verifyGates } from './runtime/gates'
import { gitProc, repoRoot } from './runtime/git'
import { loadCards, renderViews } from './runtime/inbox'
import { initProject } from './runtime/init'
import { gotechyHome, initOwnerKey, rotateOwnerKey } from './runtime/keys'
import { libraryRoot } from './runtime/library'
import { LOOP_BUDGET_CAP, runLoop } from './runtime/loop'
import { installPacks } from './runtime/packs'
import {
  CONTRACT_FILE_DIRS,
  findProject,
  linkedEntries,
  linkedPaths,
  PROJECT_DIRS,
} from './runtime/project'
import { runTask } from './runtime/run'
import { startServe } from './runtime/serve'
import { applySetup, formatPlan, planSetup, restoreSetup } from './runtime/setup'
import { createTask } from './runtime/task-new'
import { loadKnownTerms } from './runtime/terms'

// 부트스트랩(bin/gotechy)은 mise exec -C로 라이브러리 폴더에서 실행되므로, 사용자가 있던 폴더로 돌아간다(contract.md 10.5절)
// 읽은 뒤에는 지운다. 남겨 두면 이 CLI가 부르는 다른 gotechy(테스트, hook)까지 같은 폴더로 이동한다
const startCwd = process.env.GOTECHY_CWD
delete process.env.GOTECHY_CWD
if (startCwd) process.chdir(startCwd)

const program = new Command()
program
  .name('gotechy')
  .description('파일 계약 기반 에이전트 작업 위임 (하네스 v2)')
  .version('2.0.0-alpha.0')

/** 가드가 hook 입력을 기다리는 시간(밀리초). 테스트는 GOTECHY_GUARD_STDIN_MS로 줄인다 */
const GUARD_STDIN_MS = Number(process.env.GOTECHY_GUARD_STDIN_MS ?? 5000)

/** 표준 입력을 기한과 크기 상한 안에서 읽는다. 넘으면 undefined */
async function readStdin(ms: number, max: number): Promise<string | undefined> {
  const reader = Bun.stdin.stream().getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'late'>((r) => {
    timer = setTimeout(() => r('late'), ms)
  })
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), late])
      if (next === 'late') return undefined
      if (next.done) break
      size += next.value.length
      if (size > max) return undefined
      chunks.push(next.value)
    }
    return Buffer.concat(chunks).toString('utf8')
  } finally {
    // 타이머가 남으면 판정이 끝나도 프로세스가 기한까지 살아 있다
    clearTimeout(timer)
    reader.releaseLock()
  }
}

/** 오너 키를 만들거나 바꾸는 명령은 대화형 터미널에서만. rotate는 지난 결정을 모두 무효로 만든다(감사 10차 중간 6) */
function requireOwnerTerminal(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('오너 키 명령은 대화형 터미널에서만 실행해요. 터미널에서 직접 실행하세요.')
    process.exit(2)
  }
}

function insideProject(root: string, dir: string): boolean {
  const real = (x: string) => {
    try {
      return realpathSync(x)
    } catch {
      return x
    }
  }
  const r = real(root)
  const d = real(dir)
  return d === r || d.startsWith(`${r}/`)
}

/** orchestration/owner.pub가 커밋되지 않았거나 커밋과 다르면 경고 문장 */
async function pinCommitWarning(root: string): Promise<string | undefined> {
  if (!existsSync(join(root, 'orchestration', 'owner.pub'))) return undefined
  const tracked = await gitProc(['ls-files', '--error-unmatch', 'orchestration/owner.pub'], root)
  if (tracked.exitCode !== 0)
    return '주의: orchestration/owner.pub가 커밋되지 않았어요. 커밋해야 오너 키가 바뀐 것이 git diff에 드러나요.'
  const same = await gitProc(['diff', '--quiet', 'HEAD', '--', 'orchestration/owner.pub'], root)
  if (same.exitCode !== 0)
    return '주의: orchestration/owner.pub가 마지막 커밋과 달라요. 오너가 keys pin으로 바꾼 것이 아니라면 원인부터 보세요.'
  return undefined
}

function requireProject() {
  const p = findProject(process.cwd())
  if (!p) {
    console.error(
      'gotechy 프로젝트가 아닙니다 (orchestration/tasks/ 없음). 먼저 `gotechy init`을 실행하세요.',
    )
    process.exit(2)
  }
  // 남의 저장소가 커밋한 링크를 따라 저장소 밖에 쓰지 않는다(보안 감사 7차 중간 4, 9차 중간 1과 2)
  const linked = [
    ...linkedPaths(p.root, PROJECT_DIRS),
    ...linkedEntries(p.root, CONTRACT_FILE_DIRS),
  ]
  if (linked.length > 0) {
    console.error(
      `심볼릭 링크라서 멈췄어요: ${linked.join(', ')}. 링크를 지우거나 실제 폴더로 바꾼 뒤 다시 실행하세요.`,
    )
    process.exit(2)
  }
  // 오너 키와 장부 끝 기록이 있는 폴더를 프로젝트 안으로 돌려 검증을 속이지 못하게 한다(보안 감사 11차 중간 1)
  if (insideProject(p.root, gotechyHome())) {
    console.error(
      'GOTECHY_HOME(없으면 HOME/.gotechy)이 프로젝트 안을 가리켜서 멈췄어요. 오너 키와 장부 끝 기록은 프로젝트 밖에 있어야 해요.',
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
  .description(
    '현재 폴더에 계약 골격(orchestration/), AGENTS.md 라우터, 팩을 깐다 (팩은 apm, contract.md 10.7절)',
  )
  .option('--packs <list>', '설치할 팩 (쉼표 구분)', 'owner')
  .action(async (o: { packs: string }) => {
    const root = process.cwd()
    let r: ReturnType<typeof initProject>
    try {
      r = initProject(root)
    } catch (e) {
      console.error((e as Error).message)
      process.exit(2)
    }
    for (const c of r.created) console.log(`created: ${c}`)
    for (const s of r.skipped) console.log(`kept:    ${s}`)
    for (const w of r.warnings) console.warn(`warning: ${w}`)
    const packs = o.packs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (packs.length === 0) return
    // 팩의 출처는 라이브러리의 train만 따른다(setup과 같음)
    const train = parseTrain(readFileSync(join(libraryRoot(), 'train.yaml'), 'utf8'))
    const p = await installPacks(root, packs, { ...train.packs, lib: libraryRoot() }, process.env)
    for (const c of p.created) console.log(`created: ${c}`)
    for (const s of p.skipped) console.log(`kept:    ${s}`)
    for (const e of p.errors) console.error(`error:   ${e}`)
    if (p.errors.length > 0) process.exit(1)
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
    process.stdout.write(
      formatInbox(loadCards(requireProject(), process.cwd(), { recordShown: true })),
    )
  })

program
  .command('render')
  .description('읽기 전용 HTML 화면을 .gotechy/view/에 만든다 (contract.md 8.2절)')
  .argument('[taskId]', '이 작업 화면의 주소를 출력 (없으면 인박스 화면)')
  .action((taskId?: string) => {
    const r = renderViews(requireProject(), process.cwd(), { recordShown: true })
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
  .description('작업 하나를 워커에게 맡기고 검증한다 (contract.md 2절, 6.6절)')
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
    process.exit(
      out.status === 'refused' ? 2 : out.status === 'failed' || out.status === 'blocked' ? 1 : 0,
    )
  })

program
  .command('audit')
  .description(
    '작업의 HANDOFF를 실제 diff와 검증 출력에 대조하는 교차 검증 감사관 (contract.md 13절)',
  )
  .argument('<taskId>')
  .option('--adapter <name>', 'codex | claude | fake (기본은 작성 계열의 반대)')
  .option('--model <model>', '감사관 모델')
  .option('--fixture <dir>', 'fake 감사관이 재생할 녹화 폴더')
  .option('--budget <usd>', 'claude 감사관 비용 상한(달러, 기본 0.5)')
  .action(
    async (
      taskId: string,
      o: { adapter?: string; model?: string; fixture?: string; budget?: string },
    ) => {
      const p = requireProject()
      if (o.adapter && !['codex', 'claude', 'fake'].includes(o.adapter)) {
        console.error(`감사관은 codex, claude, fake 중 하나예요: ${o.adapter}`)
        process.exit(2)
      }
      const budget = o.budget === undefined ? undefined : Number(o.budget)
      if (budget !== undefined && !(Number.isFinite(budget) && budget > 0)) {
        console.error(`--budget은 0보다 큰 숫자예요: ${o.budget}`)
        process.exit(2)
      }
      const out = await auditTask(p, taskId, {
        ...(o.adapter ? { adapter: o.adapter as 'codex' } : {}),
        ...(o.model ? { model: o.model } : {}),
        ...(o.fixture ? { fixtureDir: o.fixture } : {}),
        ...(budget !== undefined ? { budgetUsd: budget } : {}),
        log: (s) => console.log(s),
      })
      for (const m of out.messages) console.log(m)
      process.exit(out.status === 'written' ? 0 : 1)
    },
  )

const keys = program
  .command('keys')
  .description('오너 키: Secure Enclave 키와 Touch ID로 결정에 서명한다 (contract.md 6.3절)')
keys
  .command('init')
  .description('오너 키가 없으면 만든다. 서명 도구는 실행할 때마다 소스에서 swiftc로 다시 빌드한다')
  .action(() => {
    requireOwnerTerminal()
    try {
      const r = initOwnerKey(gotechyHome(), libraryRoot(), { rebuildTool: true })
      console.log(r.created ? `오너 키를 만들었어요: ${r.id}` : `이미 오너 키가 있어요: ${r.id}`)
    } catch (e) {
      console.error((e as Error).message)
      process.exit(2)
    }
  })
keys
  .command('rotate')
  .description('새 오너 키로 바꾸고 이전 키를 지운다. 이전 키로 한 결정은 다시 결정해야 한다')
  .action(() => {
    requireOwnerTerminal()
    try {
      const r = rotateOwnerKey(gotechyHome(), libraryRoot(), { rebuildTool: true })
      console.log(`새 키: ${r.id}${r.previous ? ` (지운 키: ${r.previous})` : ''}`)
      console.log(
        '프로젝트마다 그 폴더에서 gotechy keys pin으로 새 키를 고정하세요. 고정하면 이전 키로 서명한 결정은 gotechy gate verify에서 실패하니 다시 결정하세요.',
      )
    } catch (e) {
      console.error((e as Error).message)
      process.exit(2)
    }
  })

keys
  .command('pin')
  .description(
    '이 맥의 오너 키를 프로젝트에 고정하고(orchestration/owner.pub), 이 폴더의 장부 끝 기록을 다시 쓴다',
  )
  .action(async () => {
    requireOwnerTerminal()
    const p = requireProject()
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      const r = await pinOwner(p, gotechyHome(), {
        confirm: async (summary) => {
          console.log(summary)
          return (await rl.question('고정할까요? [y/N] ')).trim().toLowerCase() === 'y'
        },
      })
      console.log(
        `오너 키 ${r.keyId}를 고정했어요${r.previous && r.previous !== r.keyId ? ` (이전 ${r.previous})` : ''}. orchestration/owner.pub를 커밋하세요.`,
      )
    } catch (e) {
      rl.close()
      console.error((e as Error).message)
      process.exit(1)
    }
    rl.close()
  })

program
  .command('decide')
  .description('게이트를 결정한다. 대화형 터미널에서만 (contract.md 6.4절)')
  .argument('<gateId>')
  .argument('<choice>', '선택지 중 하나')
  .argument('[instruction]', '워커에게 줄 다음 지시')
  .action(async (gateId: string, choice: string, instruction?: string) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.error(
        '결정은 대화형 터미널에서만 받아요. 에이전트나 스크립트가 실수로 결정하는 것을 막는 장치이고, 의도적인 우회(예: script 명령)까지 막지는 못해요. 터미널에서 직접 실행하세요.',
      )
      process.exit(2)
    }
    const p = requireProject()
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    // readline이 Ctrl-C를 가로채면 프로세스 SIGINT가 오지 않아 잠금이 남는다. 프로세스 SIGINT로 넘겨 잠금을 풀게 한다
    rl.on('SIGINT', () => process.emit('SIGINT', 'SIGINT'))
    // 확인 코드(nonce 앞 4자리)를 Touch ID 창 문구에도 넣는다. 같은 코드가 보이는 창만 승인하게 한다(감사 8차 중간 5)
    const nonce = randomBytes(16).toString('hex')
    const code = nonce.slice(0, 4).toUpperCase()
    const pinnedBefore = existsSync(join(p.root, 'orchestration', 'owner.pub'))
    try {
      let introduced = false
      const g = await decideGate(p, gotechyHome(), gateId, {
        choice,
        instruction: instruction ?? null,
        nonce,
        answer: async (question) => {
          if (!introduced) {
            console.log(
              '되돌리기 어려운 결정이에요. 결정하기 전에 자기 말로 답해 주세요 (답은 private에만 남아요).',
            )
            introduced = true
          }
          return rl.question(`${question}\n> `)
        },
        confirm: async (summary) => {
          console.log(summary)
          const answer = await rl.question('확정할까요? [y/N] ')
          const yes = answer.trim().toLowerCase() === 'y'
          if (yes)
            console.log(
              `확인 창(Touch ID, 지문 장치가 없으면 맥 암호)에 "확인 ${code}"가 보이면 승인하세요. 다른 코드면 취소하세요.`,
            )
          return yes
        },
      })
      console.log(`${g.id}: ${g.resolution}로 결정했어요 (오너 키 ${g.key_id}).`)
      if (!pinnedBefore && existsSync(join(p.root, 'orchestration', 'owner.pub')))
        console.log(
          '이 프로젝트에 오너 키를 처음 고정했어요(orchestration/owner.pub). 이 파일을 커밋하세요.',
        )
    } catch (e) {
      rl.close()
      console.error((e as Error).message)
      process.exit(1)
    }
    rl.close()
  })

program
  .command('serve')
  .description('화면에서 게이트를 결정하는 로컬 서버를 연다 (contract.md 8.3절)')
  .option('--port <번호>', '포트 (기본은 빈 포트)', '0')
  .action((o: { port: string }) => {
    // decide처럼 대화형 터미널에서만 연다. 에이전트의 셸이 토큰을 받아 오너 몰래 제출하지 못하게 한다(감사 8차 중간 4)
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.error(
        'serve는 대화형 터미널에서만 열어요. 출력되는 주소에 한 번 쓰는 토큰이 들어 있어서, 에이전트나 스크립트가 받지 않게 하는 장치예요. 터미널에서 직접 실행하세요.',
      )
      process.exit(2)
    }
    const p = requireProject()
    const home = gotechyHome()
    const port = Number(o.port)
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      console.error(`포트는 0~65535의 정수여야 해요: ${o.port}`)
      process.exit(2)
    }
    const s = startServe({
      project: p,
      home,
      port,
      log: (line) => console.log(`[${new Date().toLocaleTimeString('ko-KR')}] ${line}`),
      // autonomy가 허용한 작업만 온다(serve가 확인). 워커는 작업 명세의 agent로 돈다
      autoRun: (taskId) =>
        runTask(p, taskId, { home, log: (line) => console.log(line) }).then((r) =>
          console.log(`${taskId}: ${r.status}`),
        ),
    })
    console.log(`열 주소: ${s.origin}/auth?t=${s.token}`)
    console.log(
      '이 주소는 한 번만 열 수 있어요. 제출과 자동 실행은 여기에 한 줄씩 남아요. 끝내려면 Ctrl-C.',
    )
    process.on('SIGINT', () => {
      const busy = s.running()
      if (busy.length > 0)
        console.log(
          `실행 중이던 작업: ${busy.join(', ')}. 상태가 running으로 남을 수 있어요. 다시 run하면 이어서 돌아요.`,
        )
      s.stop()
      process.exit(130)
    })
  })

program
  .command('loop')
  .description(
    'autonomy L2 이상인 작업을 예산과 멈춤 규칙 안에서 차례로 돌리고 아침 보고서를 만든다 (contract.md 11절)',
  )
  .option('--budget <달러>', '이번 루프의 예산(시작한 작업 budget_usd의 합)', '5')
  .option('--max-attempts <N>', '작업마다 시도 상한', '3')
  .option('--reset', '이어 가기 상태를 비우고, 루프가 멈춘 작업도 다시 시도한다')
  .action(async (o: { budget: string; maxAttempts: string; reset?: boolean }) => {
    const p = requireProject()
    const home = gotechyHome()
    const budgetUsd = Number(o.budget)
    const maxAttempts = Number(o.maxAttempts)
    if (
      !Number.isFinite(budgetUsd) ||
      budgetUsd <= 0 ||
      budgetUsd > LOOP_BUDGET_CAP ||
      !Number.isInteger(maxAttempts) ||
      maxAttempts < 1 ||
      maxAttempts > 10
    ) {
      console.error(
        `--budget은 0보다 크고 ${LOOP_BUDGET_CAP} 이하인 수, --max-attempts는 1~10의 정수여야 해요`,
      )
      process.exit(2)
    }
    const log = (line: string) => console.log(line)
    const r = await runLoop(p, {
      home,
      budgetUsd,
      maxAttempts,
      ...(o.reset ? { reset: true } : {}),
      log,
      run: (taskId) => runTask(p, taskId, { home, log }),
    })
    for (const x of r.results)
      console.log(`${x.task}: ${x.outcome}${x.reason ? ` (${x.reason})` : ''}`)
    console.log(`아침 보고서: ${r.digest}`)
  })

program
  .command('guard')
  .description(
    'Claude Code PreToolUse hook: 리드의 부작용 명령을 막는다. 표준 입력의 hook JSON을 읽는다 (contract.md 12절)',
  )
  .action(async () => {
    const deny = (reason: string) =>
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason,
          },
        }),
      )
    // 무엇이 잘못되든 막는 쪽으로 끝낸다(감사 10차 중간 4, 낮음 8, 9)
    try {
      await (async () => {
        const text = await readStdin(GUARD_STDIN_MS, 1_000_000)
        if (text === undefined)
          return deny('gotechy 가드가 hook 입력을 제때 받지 못해 명령을 막았어요')
        let input: unknown
        try {
          input = JSON.parse(text)
        } catch {
          return deny('gotechy 가드가 hook 입력을 읽지 못해 명령을 막았어요')
        }
        const o = input as { tool_name?: unknown; tool_input?: { command?: unknown } } | null
        if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.tool_name !== 'string')
          return deny('gotechy 가드가 hook 입력의 형식을 몰라 명령을 막았어요')
        if (o.tool_name !== 'Bash') return
        const command = o.tool_input?.command
        if (typeof command !== 'string')
          return deny('gotechy 가드가 Bash 명령을 읽지 못해 막았어요')
        const d = guardBash(command)
        if (d.deny) deny(d.reason)
      })()
    } catch (e) {
      deny(`gotechy 가드에 오류가 나 명령을 막았어요: ${(e as Error).message}`)
    }
    // 닫히지 않은 표준 입력이 프로세스를 붙잡지 않게 판정 뒤 바로 끝낸다
    process.exit(0)
  })

program
  .command('status')
  .description('열린 결정 수를 보여 준다. --line은 Claude Code 상태 줄용 한 줄 (contract.md 12절)')
  .option('--line', '한 줄로')
  .action(() => {
    const p = findProject(process.cwd())
    if (!p) return
    // 상태 줄은 자주 불린다. 링크(예: /dev/zero)를 따라 끝없이 읽지 않게 링크가 있으면 아무것도 보여 주지 않는다
    if (
      linkedPaths(p.root, PROJECT_DIRS).length > 0 ||
      linkedEntries(p.root, CONTRACT_FILE_DIRS).length > 0
    )
      return
    const open = listGates(p).filter((g) => g.status === 'pending').length
    console.log(open > 0 ? `gotechy 결정 대기 ${open}` : 'gotechy 대기 없음')
  })

program
  .command('accept')
  .description('승인한 작업 브랜치를 메인에 병합한다 (contract.md 9.4절)')
  .argument('<taskId>')
  .action(async (taskId: string) => {
    const out = await acceptTask(requireProject(), gotechyHome(), taskId)
    for (const m of out.messages) console.log(m)
    process.exit(out.status === 'accepted' ? 0 : 1)
  })

program
  .command('gate')
  .description('게이트')
  .command('verify')
  .description('결정 서명과 판본을 검증한다 (contract.md 6.5절)')
  .argument('[gateIds...]')
  .action(async (ids: string[]) => {
    const p = requireProject()
    const verdicts = verifyGates(p, gotechyHome(), ids.length > 0 ? ids : undefined)
    if (verdicts.length === 0) console.log('게이트가 없어요')
    // 고정 키는 커밋돼 있어야 바뀐 것이 git diff에 드러난다(보안 감사 11차 낮음 5)
    const pinWarning = await pinCommitWarning(p.root)
    if (pinWarning) console.error(pinWarning)
    for (const v of verdicts)
      console.log(`${v.id} ${v.status}${v.reasons.length > 0 ? `: ${v.reasons.join(' / ')}` : ''}`)
    process.exit(verdicts.some((v) => v.status === 'fail') ? 1 : 0)
  })

program
  .command('doctor')
  .description('설치 상태가 train과 같은지, 정책과 라이브러리 규칙을 검사한다 (contract.md 10.2절)')
  .option('--history', '현재 저장소의 git 이력 전체를 gitleaks로 검사')
  .action(async (o: { history?: boolean }) => {
    const lib = libraryRoot()
    let history: { root: string; gitleaks: string } | undefined
    if (o.history) {
      const gitleaks =
        process.env.GOTECHY_GITLEAKS ?? Bun.which('gitleaks', { PATH: process.env.PATH ?? '' })
      const root = await repoRoot(process.cwd())
      if (!gitleaks || !root) {
        console.error(
          !gitleaks
            ? 'gitleaks가 없어요. train대로 설치하세요 (라이브러리 폴더에서 mise install --locked).'
            : 'git 저장소 안에서 실행하세요.',
        )
        process.exit(2)
      }
      history = { root, gitleaks }
    }
    const trainFile = process.env.GOTECHY_TRAIN ?? join(lib, 'train.yaml')
    // train의 check 명령을 셸로 실행하므로 라이브러리 안의 파일만 받는다(M3 보안 리뷰 중간 4)
    if (!existsSync(trainFile) || !realpathSync(trainFile).startsWith(`${realpathSync(lib)}/`)) {
      console.error(`GOTECHY_TRAIN은 라이브러리(${lib}) 안의 파일만 쓸 수 있어요: ${trainFile}`)
      process.exit(2)
    }
    const project = findProject(process.cwd())
    const report = await runDoctor({
      trainFile,
      libRoot: lib,
      home: homedir(),
      gotechyHome: gotechyHome(),
      ...(history ? { history } : {}),
      ...(project ? { project: project.root } : {}),
    })
    process.stdout.write(formatDoctor(report))
    process.exit(report.checks.some((c) => c.status === 'fail') ? 1 : 0)
  })

program
  .command('setup')
  .description('train의 정책을 전역 설정에 넣는다. 바꾸기 전에 백업한다 (contract.md 10.3절)')
  .option('--dry-run', '바꿀 내용만 보여 주고 아무것도 쓰지 않는다')
  .option('--restore <stamp>', '이 시각의 백업으로 되돌린다')
  .action((o: { dryRun?: boolean; restore?: string }) => {
    const opts = {
      home: homedir(),
      gotechyHome: gotechyHome(),
      // setup은 GOTECHY_TRAIN을 받지 않는다. 전역 설정에 넣을 값은 라이브러리의 train만 따른다
      trainFile: join(libraryRoot(), 'train.yaml'),
    }
    try {
      if (o.restore) {
        restoreSetup(opts, o.restore)
        console.log(`${o.restore} 백업으로 되돌렸어요.`)
        return
      }
      const plan = planSetup(opts)
      console.log(formatPlan(plan))
      if (o.dryRun || plan.changes.length === 0) return
      const stamp = applySetup(plan, opts)
      console.log(`적용했어요. 되돌리려면: gotechy setup --restore ${stamp}`)
    } catch (e) {
      console.error((e as Error).message)
      process.exit(1)
    }
  })

program
  .command('test')
  .description(
    `라이브러리 테스트를 돌리고 커버리지 기준(전체 ${TOTAL_MIN}%, 핵심 모듈 ${CORE_MIN}%)을 본다 (contract.md 10.6절)`,
  )
  .action(async () => {
    const lib = libraryRoot()
    const dir = mkdtempSync(join(tmpdir(), 'gotechy-coverage-'))
    const proc = Bun.spawn(
      [
        process.execPath,
        'test',
        '--coverage',
        '--coverage-reporter=text',
        '--coverage-reporter=lcov',
        `--coverage-dir=${dir}`,
      ],
      // env를 생략하면 bun은 지운 GOTECHY_CWD까지 넘긴다(Surprises)
      { cwd: lib, stdin: 'ignore', stdout: 'inherit', stderr: 'inherit', env: process.env },
    )
    if ((await proc.exited) !== 0) {
      console.error('테스트가 실패했어요. 커버리지 기준은 보지 않았어요.')
      process.exit(1)
    }
    const j = judgeCoverage(parseLcov(readFileSync(join(dir, 'lcov.info'), 'utf8'), lib))
    console.log(`전체 줄 커버리지 ${j.totalPct.toFixed(2)}% (기준 ${TOTAL_MIN}%)`)
    const low = j.core.filter((c) => c.pct !== null).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
    console.log(
      `핵심 모듈 ${j.core.length}개, 가장 낮은 것 ${low[0]?.file ?? '-'} ${low[0]?.pct?.toFixed(2) ?? '-'}% (기준 ${CORE_MIN}%)`,
    )
    if (!j.ok) {
      for (const f of j.failures) console.error(`실패 ${f}`)
      process.exit(1)
    }
    console.log('커버리지 기준을 통과했어요')
  })

await program.parseAsync()
