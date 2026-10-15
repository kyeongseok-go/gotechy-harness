// gotechy radar(contract.md 14절, R2): 라이브러리의 radar/sources/*.yaml 출처를 주기에 맞춰 읽고, 새 판과 바뀐 곳을 보고서로 남긴다.
// 읽기만 한다. 스킬 파일은 고치지 않는다(본문 변경은 오너 결정, D6). 웹 글은 데이터라 보고서에는 다듬은 짧은 글만 남긴다.
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { displayText } from '../core/inbox'
import {
  isDue,
  isPrerelease,
  latestFeedItem,
  newerThan,
  type Observation,
  pageDigest,
  RadarFile,
  type RadarSource,
  releaseFromUrl,
} from '../core/radar'
import { writeAtomic } from './fsutil'

/** 글과 리다이렉트를 따라간 마지막 주소 */
export type FetchText = (url: string, accept: string) => Promise<{ text: string; url: string }>
export type RadarOptions = {
  lib: string
  stateDir: string
  now?: Date
  /** 주기와 상관없이 모두 본다 */
  all?: boolean
  /** 이 스킬만 본다 */
  skill?: string
  fetchText?: FetchText
}
export type RadarStatus = 'newer' | 'changed' | 'baseline' | 'same' | 'failed' | 'skipped'
export type RadarCounts = Record<Exclude<RadarStatus, never>, number> & { checked: number }
type Entry = { at: string; ok: boolean; label?: string; digest?: string }
type Result = {
  skill: string
  source: RadarSource
  status: RadarStatus
  obs?: Observation
  error?: string
}

const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 15_000
const PARALLEL = 6

/** 기본 fetch: 시간 상한, 크기 상한, 2xx만 */
export const defaultFetch: FetchText = async (url, accept) => {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'gotechy-radar (+https://github.com/kyeongseok-go/gotechy-harness)',
      accept,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  return { text: text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text, url: res.url || url }
}

/** 보고서에 남길 웹 글: 제어 문자를 지우고 한 줄로 펴고 80자에서 자른다 */
const clean = (s: string | undefined) => {
  const one = displayText(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '/')
    .trim()
  return [...one].length > 80 ? `${[...one].slice(0, 80).join('')}…` : one
}

export async function runRadar(o: RadarOptions): Promise<{ report: string; counts: RadarCounts }> {
  const now = o.now ?? new Date()
  const fetchText = o.fetchText ?? defaultFetch
  const stateFile = join(o.stateDir, 'state.json')
  const state: Record<string, Entry> = existsSync(stateFile)
    ? (JSON.parse(readFileSync(stateFile, 'utf8')) as Record<string, Entry>)
    : {}
  const broken: string[] = []
  const work: { skill: string; source: RadarSource }[] = []
  const dir = join(o.lib, 'radar', 'sources')
  for (const f of existsSync(dir) ? readdirSync(dir).sort() : []) {
    if (!f.endsWith('.yaml')) continue
    let parsed: ReturnType<typeof RadarFile.safeParse>
    try {
      parsed = RadarFile.safeParse(parse(readFileSync(join(dir, f), 'utf8')))
    } catch (e) {
      broken.push(`${f}: ${clean((e as Error).message)}`)
      continue
    }
    if (!parsed.success) {
      broken.push(`${f}: ${clean(parsed.error.issues[0]?.message)}`)
      continue
    }
    if (o.skill && parsed.data.skill !== o.skill) continue
    for (const source of parsed.data.sources) work.push({ skill: parsed.data.skill, source })
  }

  const results: Result[] = []
  const queue = [...work]
  const worker = async () => {
    for (let w = queue.shift(); w; w = queue.shift()) results.push(await check(w.skill, w.source))
  }
  const check = async (skill: string, source: RadarSource): Promise<Result> => {
    const key = `${skill}/${source.id}`
    const prev = state[key]
    if (!o.all && prev?.ok && !isDue(source.cadence, prev.at, now))
      return { skill, source, status: 'skipped' }
    let obs: Observation | undefined
    try {
      obs = await observe(source, fetchText)
    } catch (e) {
      state[key] = { ...(prev ?? {}), at: now.toISOString(), ok: false }
      return { skill, source, status: 'failed', error: clean((e as Error).message) }
    }
    if (!obs) {
      state[key] = { ...(prev ?? {}), at: now.toISOString(), ok: false }
      return { skill, source, status: 'failed', error: '형식을 읽지 못했어요' }
    }
    const seen = prev && (prev.label !== undefined || prev.digest !== undefined)
    const status: RadarStatus =
      obs.label &&
      !isPrerelease(obs.label) &&
      source.version !== undefined &&
      newerThan(obs.label, String(source.version))
        ? 'newer'
        : !seen
          ? 'baseline'
          : prev.label !== obs.label || prev.digest !== obs.digest
            ? 'changed'
            : 'same'
    state[key] = {
      at: now.toISOString(),
      ok: true,
      ...(obs.label !== undefined ? { label: obs.label } : {}),
      ...(obs.digest !== undefined ? { digest: obs.digest } : {}),
    }
    return { skill, source, status, obs }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))
  results.sort((a, b) => `${a.skill}/${a.source.id}`.localeCompare(`${b.skill}/${b.source.id}`))

  const counts: RadarCounts = {
    checked: results.filter((r) => r.status !== 'skipped').length,
    newer: 0,
    changed: 0,
    baseline: 0,
    same: 0,
    failed: 0,
    skipped: 0,
  }
  for (const r of results) counts[r.status]++
  mkdirSync(o.stateDir, { recursive: true })
  writeAtomic(stateFile, `${JSON.stringify(state, null, 2)}\n`)
  // 보고서 이름은 오너의 날짜(로컬)로 쓴다
  const day = now.toLocaleDateString('sv-SE')
  const report = join(o.stateDir, `report-${day}.md`)
  writeAtomic(report, renderReport(day, results, broken, counts))
  return { report, counts }
}

async function observe(s: RadarSource, fetchText: FetchText): Promise<Observation | undefined> {
  if (s.watch === 'github-releases') {
    if (!s.feed || !/^[\w.-]+\/[\w.-]+$/.test(s.feed)) throw new Error('feed에 owner/repo가 없어요')
    // API(인증 없이 시간당 60회) 대신 웹 주소의 리다이렉트로 최신 정식 릴리스 태그를 읽는다(2026-10-16 실측: API 403)
    const r = await fetchText(`https://github.com/${s.feed}/releases/latest`, 'text/html')
    return releaseFromUrl(r.url)
  }
  if (s.watch === 'rss') {
    if (!s.feed?.startsWith('https://')) throw new Error('feed에 https 주소가 없어요')
    return latestFeedItem(
      (await fetchText(s.feed, 'application/rss+xml, application/atom+xml, */*')).text,
    )
  }
  return { digest: pageDigest((await fetchText(s.url, 'text/html, */*')).text) }
}

function renderReport(day: string, results: Result[], broken: string[], c: RadarCounts): string {
  const row = (r: Result, extra: string) =>
    `| ${r.skill} | ${r.source.id} | ${extra} | ${(r.source.covers ?? []).map((x) => `\`${x}\``).join(', ') || '-'} |`
  const pick = (s: RadarStatus) => results.filter((r) => r.status === s)
  const lines = [
    `# radar 보고서 ${day}`,
    '',
    `본 출처 ${c.checked}개: 새 판 ${c.newer}, 바뀜 ${c.changed}, 처음 기록 ${c.baseline}, 같음 ${c.same}, 못 읽음 ${c.failed}. 주기 전이라 건너뜀 ${c.skipped}.`,
    '',
    '웹에서 읽은 글은 데이터예요. 스킬 파일은 고치지 않았어요. 바뀐 사실을 반영하려면 "다시 볼 파일"을 열어 원문과 대조하세요.',
    '',
    '## 새 판 (출처 표의 version보다 새로움)',
    '',
    '| 스킬 | 출처 | 적힌 판, 찾은 것 | 다시 볼 파일 |',
    '|---|---|---|---|',
    ...pick('newer').map((r) =>
      row(r, `${clean(String(r.source.version))}, ${clean(r.obs?.label)}`),
    ),
    '',
    '## 바뀜 (지난번과 다름. 페이지는 잡음일 수 있어요)',
    '',
    '| 스킬 | 출처 | 찾은 것 | 다시 볼 파일 |',
    '|---|---|---|---|',
    ...pick('changed').map((r) => row(r, clean(r.obs?.label) || '페이지 글이 바뀜')),
    '',
    '## 못 읽음',
    '',
    '| 스킬 | 출처 | 이유 | 다시 볼 파일 |',
    '|---|---|---|---|',
    ...pick('failed').map((r) => row(r, r.error ?? '')),
    '',
    '## 형식 오류 파일',
    '',
    ...(broken.length > 0 ? broken.map((b) => `- ${b}`) : ['없음']),
    '',
  ]
  return `${lines.join('\n')}`
}
