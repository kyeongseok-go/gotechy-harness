// gotechy audit T-###(contract.md 13절): 워커의 HANDOFF를 실제 diff와 리드 verify 출력에 대조하는 교차 검증 감사관.
// 지적은 권고다. 게이트나 작업 상태를 바꾸지 않고 orchestration/audits/에 기록만 남긴다.
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type AuditorName,
  type AuditRecord,
  buildAuditPrompt,
  type CheckedFinding,
  cutDiff,
  defaultAuditor,
  parseAuditOutput,
  renderAudit,
  safeRelPath,
} from '../core/audit'
import { parseFrontmatter } from '../core/frontmatter'
import { HandoffFrontmatter } from '../core/schema'
import { auditors } from './auditors'
import { gitProc } from './git'
import { libraryRoot } from './library'
import { appendEvent, type Project, paths } from './project'

export type AuditOptions = {
  adapter?: AuditorName
  model?: string
  fixtureDir?: string
  budgetUsd?: number
  log?: (s: string) => void
}

export type AuditOutcome = {
  status: 'written' | 'refused'
  messages: string[]
  file?: string
}

const TIMEOUT_MS = 600_000
const DEFAULT_BUDGET = 0.5
const NO_VERIFY_LOG = '검증 기록 없음'
const FAMILY: Record<string, string> = { claude: 'anthropic', codex: 'openai', fake: 'fake' }

export const auditPath = (p: Project, id: string) =>
  join(p.root, 'orchestration', 'audits', `${id}.md`)
export const verifyLogPath = (p: Project, id: string) =>
  join(p.root, '.gotechy', 'runs', `${id}-verify.log`)

const refuse = (...messages: string[]): AuditOutcome => ({ status: 'refused', messages })

export async function auditTask(
  p: Project,
  id: string,
  o: AuditOptions = {},
): Promise<AuditOutcome> {
  if (!/^T-\d{3,}$/.test(id)) return refuse(`작업 번호 형식이 아니에요: ${id}`)
  const handoffFile = paths.handoff(p, id)
  if (!existsSync(handoffFile))
    return refuse(`${id}의 HANDOFF가 없어요. 먼저 gotechy run ${id}로 실행하세요.`)
  const handoffText = readFileSync(handoffFile, 'utf8')
  const parsed = parseFrontmatter(handoffText, handoffFile)
  const h = parsed.ok ? HandoffFrontmatter.safeParse(parsed.value.data) : undefined
  if (!h?.success)
    return refuse(`${id}의 HANDOFF를 읽을 수 없어요: gotechy handoff lint로 확인하세요.`)

  const wt = paths.worktree(p, id)
  const baseFile = `${wt}.base`
  const branch = `refs/heads/gotechy/${id}`
  const branchOk =
    (await gitProc(['rev-parse', '--verify', '--quiet', branch], p.root)).exitCode === 0
  if (!existsSync(baseFile) || !existsSync(wt) || !branchOk)
    return refuse(`${id}의 작업 브랜치나 worktree가 없어요(실행 전이거나 병합 뒤 정리됨).`)
  const base = readFileSync(baseFile, 'utf8').trim()

  const author = h.data.agent ?? null
  const adapter = o.adapter ?? defaultAuditor(author)
  if (!adapter)
    return refuse(
      `작성 계열(${author ?? '모름'})의 반대 감사관을 정할 수 없어요. --adapter codex|claude로 정하세요.`,
    )
  const crossFamily = FAMILY[author ?? ''] !== FAMILY[adapter]
  const messages: string[] = []
  if (!crossFamily)
    messages.push(
      `주의: 감사관(${adapter})이 작성 계열(${author ?? '모름'})과 같아요. 같은 실수를 함께 놓칠 수 있어요.`,
    )

  const diffRun = await gitProc(['diff', '--no-color', base, branch], p.root)
  if (diffRun.exitCode !== 0) return refuse(`diff를 만들지 못했어요: ${diffRun.stderr.trim()}`)
  const diff = cutDiff(diffRun.stdout)
  const logFile = verifyLogPath(p, id)
  const verifyLog = existsSync(logFile) ? readFileSync(logFile, 'utf8') : NO_VERIFY_LOG

  const template = promptTemplate()
  const prompt = buildAuditPrompt(
    template,
    { handoff: handoffText, diff: diff.text, verifyLog },
    () => randomBytes(8).toString('hex'),
  )
  o.log?.(`${id}: ${adapter} 감사관 실행`)
  const res = await auditors[adapter]({
    cwd: wt,
    prompt,
    model: o.model ?? null,
    budgetUsd: o.budgetUsd ?? DEFAULT_BUDGET,
    timeoutMs: TIMEOUT_MS,
    ...(o.fixtureDir ? { fixtureDir: o.fixtureDir } : {}),
  })
  const raw = saveAuditLog(p, id, adapter, prompt, res.raw, res.stderr)
  if (res.timedOut || res.exitCode !== 0)
    return refuse(
      `감사관 실행이 실패했어요(exit ${res.exitCode}${res.timedOut ? ', 시간 초과' : ''}). 원문: ${raw}`,
      ...(res.stderr.trim() ? [res.stderr.trim().slice(0, 300)] : []),
    )
  const out = parseAuditOutput(res.text)
  if (!out.ok) return refuse(`감사관 답의 형식 오류: ${out.error}. 기록하지 않았어요. 원문: ${raw}`)

  const checked: CheckedFinding[] = []
  for (const f of out.findings)
    checked.push({ ...f, confirmed: await evidenceExists(p, branch, f.file, f.line) })
  const record: AuditRecord = {
    task: id,
    handoff_rev: h.data.rev ?? null,
    at: new Date().toISOString(),
    auditor: { adapter, model: res.model ?? o.model ?? null },
    author: { agent: author, model: h.data.model ?? null },
    cross_family: crossFamily,
    input: {
      diff_bytes: Buffer.byteLength(diffRun.stdout),
      diff_truncated: diff.truncated,
      verify_log: verifyLog !== NO_VERIFY_LOG,
    },
    findings: checked.length,
    confirmed: checked.filter((f) => f.confirmed).length,
    cost_usd: res.costUsd ?? null,
  }
  const file = auditPath(p, id)
  mkdirSync(join(p.root, 'orchestration', 'audits'), { recursive: true })
  writeFileSync(file, renderAudit(record, checked, out.summary))
  appendEvent(p, {
    type: 'audit',
    task: id,
    adapter,
    findings: record.findings,
    confirmed: record.confirmed,
  })
  messages.push(
    `감사 기록: orchestration/audits/${id}.md (지적 ${record.findings}건, 근거 있는 지적 ${record.confirmed}건)`,
  )
  return { status: 'written', messages, file }
}

/** prompts/auditor.md의 "# 프롬프트" 아래만 보낸다 */
function promptTemplate(): string {
  const text = readFileSync(join(libraryRoot(), 'prompts', 'auditor.md'), 'utf8')
  const at = text.indexOf('\n# 프롬프트\n')
  if (at === -1) throw new Error('prompts/auditor.md에 "# 프롬프트" 절이 없어요')
  return text.slice(at + '\n# 프롬프트\n'.length).trim()
}

/** 근거가 작업 브랜치의 실제 파일과 줄을 가리키는가. 밖을 가리키는 경로는 git에 묻지도 않는다. */
async function evidenceExists(
  p: Project,
  branch: string,
  file: string,
  line: number,
): Promise<boolean> {
  // git도 `..`, 절대 경로, 폴더를 거부한다. 이 검사는 겹 방어라 빼도 테스트 결과가 같다(mutation 확인)
  if (!safeRelPath(file)) return false
  const blob = await gitProc(['cat-file', 'blob', `${branch}:${file}`], p.root)
  if (blob.exitCode !== 0) return false
  const lines = blob.stdout.endsWith('\n')
    ? blob.stdout.split('\n').length - 1
    : blob.stdout.split('\n').length
  return line <= lines
}

function saveAuditLog(
  p: Project,
  id: string,
  adapter: string,
  prompt: string,
  raw: string,
  stderr: string,
): string {
  const dir = join(p.root, '.gotechy', 'runs')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `${id}-audit-${adapter}-${stamp}.log`
  writeFileSync(join(dir, name), `${prompt}\n--- 감사관 답 ---\n${raw}\n--- stderr ---\n${stderr}`)
  return `.gotechy/runs/${name}`
}
