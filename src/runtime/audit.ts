// gotechy audit T-###(contract.md 13절): 워커의 HANDOFF를 실제 diff와 리드 verify 출력에 대조하는 교차 검증 감사관.
// 지적은 권고다. 게이트나 작업 상태를 바꾸지 않고, 커밋하지 않는 .gotechy/audits/에 기록만 남긴다.
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type AuditorName,
  type AuditRecord,
  buildAuditPrompt,
  type CheckedFinding,
  cutDiff,
  cutText,
  defaultAuditor,
  findLeaks,
  MAX_HANDOFF_BYTES,
  parseAuditOutput,
  parseVerifyLog,
  renderAudit,
  safeRelPath,
} from '../core/audit'
import { parseFrontmatter } from '../core/frontmatter'
import { HandoffFrontmatter } from '../core/schema'
import { CLAUDE_ENV } from './adapters/claude'
import { CODEX_ENV } from './adapters/codex'
import { auditors } from './auditors'
import { writeAtomic } from './fsutil'
import { gitProc } from './git'
import { libraryRoot } from './library'
import { appendEvent, type Project, paths } from './project'
import { verifyLogFile, withTaskLock } from './run'

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

// 비용 상한이 없는 codex가 오래 돌지 않게 짧게 둔다(보안 감사 12차 중간 1)
const TIMEOUT_MS = 300_000
const DEFAULT_BUDGET = 0.5
const NO_VERIFY_LOG = '검증 기록 없음'
const FAMILY: Record<string, string> = { claude: 'anthropic', codex: 'openai', fake: 'fake' }

/** 감사 기록. 감사관 글은 워커 글에 주입될 수 있어 커밋하지 않는 폴더에 둔다(보안 감사 12차 높음 1) */
export const auditPath = (p: Project, id: string) => join(p.root, '.gotechy', 'audits', `${id}.md`)

const refuse = (...messages: string[]): AuditOutcome => ({ status: 'refused', messages })

export async function auditTask(
  p: Project,
  id: string,
  o: AuditOptions = {},
): Promise<AuditOutcome> {
  if (!/^T-\d{3,}$/.test(id)) return refuse(`작업 번호 형식이 아니에요: ${id}`)
  const locked = await withTaskLock(p, id, () => auditLocked(p, id, o))
  return locked.ok ? locked.value : refuse(locked.reason)
}

async function auditLocked(p: Project, id: string, o: AuditOptions): Promise<AuditOutcome> {
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
  if (!/^[0-9a-f]{40,64}$/.test(base))
    return refuse(`${id}의 기준 커밋 기록이 커밋 번호가 아니에요.`)

  const author = h.data.agent ?? null
  const adapter = o.adapter ?? defaultAuditor(author)
  if (!adapter)
    return refuse(
      `작성 계열(${author ?? '모름'})의 반대 감사관을 정할 수 없어요. --adapter codex|claude로 정하세요.`,
    )
  if (adapter === 'codex' && o.budgetUsd !== undefined)
    return refuse(
      'codex 감사관에는 비용 상한을 걸 수 없어요(TD-015). --budget 없이 실행하면 시간 상한 5분만 걸려요.',
    )
  const crossFamily = FAMILY[author ?? ''] !== FAMILY[adapter]
  const messages: string[] = []
  if (!crossFamily)
    messages.push(
      `주의: 감사관(${adapter})이 작성 계열(${author ?? '모름'})과 같아요. 같은 실수를 함께 놓칠 수 있어요.`,
    )
  if (adapter === 'codex')
    messages.push('codex 감사관은 비용 상한이 없어요(시간 상한 5분, TD-015).')

  const gitDiff = ['diff', '--no-color', '--no-ext-diff', '--no-textconv']
  const nameStatus = await gitProc(
    [...gitDiff, '--name-status', '--no-renames', base, branch],
    p.root,
  )
  const diffRun = await gitProc([...gitDiff, base, branch], p.root)
  if (diffRun.exitCode !== 0 || nameStatus.exitCode !== 0)
    return refuse(`diff를 만들지 못했어요: ${(diffRun.stderr || nameStatus.stderr).trim()}`)
  const diff = cutDiff(diffRun.stdout)
  // 잘려도 바뀐 파일 전체 목록은 늘 보이게 앞에 둔다(보안 감사 12차 중간 3)
  const diffText = `바뀐 파일 전체 목록:\n${nameStatus.stdout.trim()}\n\n${diff.text}`
  const handoff = cutText(handoffText, MAX_HANDOFF_BYTES, '(HANDOFF가 64KB를 넘어 잘렸어요)')
  const verifyLog = currentVerifyLog(p, id, h.data.rev ?? null)

  const template = promptTemplate()
  const prompt = buildAuditPrompt(
    template,
    { handoff: handoff.text, diff: diffText, verifyLog },
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
  const secrets = [...CLAUDE_ENV, ...CODEX_ENV].map((k) => process.env[k] ?? '')
  const leaks = findLeaks(
    [out.summary, ...out.findings.flatMap((f) => [f.claim, f.actual, f.file])].join('\n'),
    secrets,
  )
  if (leaks.length > 0)
    return refuse(
      `감사관 답에 비밀로 보이는 글(${[...new Set(leaks)].join(', ')})이 있어 기록하지 않았어요. 감사관이 작업 폴더 밖을 읽었을 수 있어요. 원문: ${raw}`,
    )

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
    prompt_sha256: createHash('sha256').update(template).digest('hex'),
    findings: checked.length,
    confirmed: checked.filter((f) => f.confirmed).length,
    cost_usd: res.costUsd ?? null,
    items: checked,
  }
  const file = auditPath(p, id)
  writeAtomic(file, renderAudit(record, checked, out.summary))
  appendEvent(p, {
    type: 'audit',
    task: id,
    adapter,
    findings: record.findings,
    confirmed: record.confirmed,
  })
  messages.push(
    `감사 기록: .gotechy/audits/${id}.md (지적 ${record.findings}건, 근거 있는 지적 ${record.confirmed}건)`,
  )
  return { status: 'written', messages, file }
}

/** 지금 HANDOFF 판본의 verify 기록만 쓴다. 판본이 다르거나 머리가 없으면 기록이 없는 것으로 본다 */
function currentVerifyLog(p: Project, id: string, rev: number | null): string {
  const file = verifyLogFile(p, id)
  if (!existsSync(file)) return NO_VERIFY_LOG
  const log = parseVerifyLog(readFileSync(file, 'utf8'))
  return log && log.rev === rev ? log.body : NO_VERIFY_LOG
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
  writeFileSync(
    join(dir, name),
    `${prompt}\n--- 감사관 답 ---\n${raw}\n--- stderr ---\n${stderr}`,
    {
      flag: 'wx',
    },
  )
  return `.gotechy/runs/${name}`
}
