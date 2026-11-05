// radar의 순수 판정(contract.md 14절): 출처 형식, 릴리스와 피드 해석, 페이지 요약값, 판 비교, 주기.
// 웹에서 읽은 글은 신뢰하지 않는 데이터다. 여기서는 글을 해석만 하고, 보고서에 남길 때는 runtime이 다듬는다.
import { createHash } from 'node:crypto'
import { z } from 'zod'

export const RadarSource = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(1),
  version: z.union([z.string(), z.number()]).optional(),
  url: z.string().regex(/^https:\/\//),
  trust: z.enum(['official', 'standard', 'regulator', 'paper', 'community']),
  watch: z.enum(['github-releases', 'rss', 'page']),
  feed: z.string().optional(),
  cadence: z.enum(['weekly', 'monthly', 'quarterly']),
  covers: z.array(z.string()).optional(),
})
export type RadarSource = z.infer<typeof RadarSource>

export const RadarFile = z.object({
  skill: z.string().min(1),
  checked: z.union([z.string(), z.date()]).optional(),
  sources: z.array(RadarSource),
})
export type RadarFile = z.infer<typeof RadarFile>

/** 관찰 하나: label은 판이나 제목(릴리스, 피드), digest는 페이지 요약값 */
export type Observation = { label?: string; date?: string; digest?: string }

export function latestRelease(json: string): Observation | undefined {
  try {
    const o = JSON.parse(json) as { tag_name?: unknown; name?: unknown; published_at?: unknown }
    const label =
      typeof o.tag_name === 'string' ? o.tag_name : typeof o.name === 'string' ? o.name : ''
    if (!label) return undefined
    return { label, ...(typeof o.published_at === 'string' ? { date: o.published_at } : {}) }
  } catch {
    return undefined
  }
}

/** github.com/<repo>/releases/latest가 리다이렉트한 주소(/releases/tag/<태그>)에서 태그를 읽는다 */
export function releaseFromUrl(url: string): Observation | undefined {
  const m = /\/releases\/tag\/([^/?#]+)/.exec(url)
  if (!m?.[1]) return undefined
  try {
    return { label: decodeURIComponent(m[1]) }
  } catch {
    return { label: m[1] }
  }
}

/** 미리보기 판(alpha, beta, RC 등)은 "새 판"으로 알리지 않는다. 정식 출시 전이라 기준을 바꿀 일이 아니다 */
export function isPrerelease(label: string): boolean {
  return /\b(alpha|beta|rc|preview|pre-?release|nightly|canary|dev)\b|\d(a|b|rc)\d/i.test(label)
}

const decodeXml = (s: string) =>
  s
    // 닫히지 않은 CDATA와 꺾쇠가 많아도 길이에 비례해 끝나게 끝까지(|$) 또는 다음 < 앞까지만 본다(보안 감사 16차 낮음 3)
    .replace(/<!\[CDATA\[([\s\S]*?)(?:\]\]>|$)/g, '$1')
    .replace(/<[^<>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()

/** RSS의 첫 item 또는 Atom의 첫 entry 제목과 날짜 */
export function latestFeedItem(xml: string): Observation | undefined {
  const block =
    /<item[\s>][\s\S]*?<\/item>/i.exec(xml)?.[0] ?? /<entry[\s>][\s\S]*?<\/entry>/i.exec(xml)?.[0]
  if (!block) return undefined
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block)?.[1]
  if (title === undefined) return undefined
  const date =
    /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(block)?.[1] ??
    /<updated>([\s\S]*?)<\/updated>/i.exec(block)?.[1] ??
    /<published>([\s\S]*?)<\/published>/i.exec(block)?.[1]
  return { label: decodeXml(title), ...(date ? { date: decodeXml(date) } : {}) }
}

// 날짜와 시각 모양: 페이지의 "최근 수정" 같은 줄만 바뀌는 잡음을 지운다(U4, 2026-11-05 radar에서 바뀜 45건)
const MONTH =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
const DATE_LIKE = new RegExp(
  [
    '\\d{4}[-./]\\d{1,2}[-./]\\d{1,2}(?:T[\\d:.]+Z?)?',
    '\\d{4}년\\s*\\d{1,2}월(?:\\s*\\d{1,2}일)?',
    `${MONTH}\\.?\\s+\\d{1,2},?\\s+\\d{4}`,
    `\\d{1,2}\\s+${MONTH}\\.?,?\\s+\\d{4}`,
    '\\d{1,2}:\\d{2}(?::\\d{2})?',
  ].join('|'),
  'gi',
)
const BLOCK =
  /<\/?(?:p|div|h[1-6]|li|ul|ol|tr|td|th|table|section|article|br|pre|blockquote|dd|dt|dl)\b[^<>]*>/gi

/**
 * 페이지에서 사람이 읽는 본문 글만 뽑는다. script, style 등은 끝이 잘려 닫히지 않았어도 뺀다(크기 상한에서 잘린 페이지).
 * main이 있으면 그 안만 보고, 장식(nav, header, footer, aside)은 뺀다. 블록 태그는 줄로 나눈다.
 */
export function pageText(html: string): string {
  let h = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
  // main은 정규식 대신 위치로 찾는다. 닫히지 않은 <main>이 많으면 정규식이 길이의 제곱으로 느려진다(보안 감사 16차 낮음 3)
  const lower = h.toLowerCase()
  const open = lower.search(/<main\b/)
  const gt = open >= 0 ? h.indexOf('>', open) : -1
  const close = gt >= 0 ? lower.indexOf('</main', gt) : -1
  if (close >= 0) h = h.slice(gt + 1, close)
  h = h.replace(/<(nav|header|footer|aside)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
  return decodeXml(h.replace(BLOCK, '\n').replace(/<[^<>]*>/g, ' '))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n')
}

/** 지문을 만들 때만 날짜와 시각을 가린다. 보고서에 보여 줄 글(pageText)은 그대로 둔다 */
export function maskDates(text: string): string {
  return text.replace(DATE_LIKE, '#')
}

/** 페이지 글의 지문(2판). 본문만, 날짜와 시각은 가린 뒤 sha256 앞 16자 */
export function pageDigest(html: string): string {
  return createHash('sha256')
    .update(maskDates(pageText(html)))
    .digest('hex')
    .slice(0, 16)
}

/** 지문 방식의 판. 바뀌면 옛 지문과 비교하지 않고 처음 기록으로 다시 잡는다 */
export const PAGE_DIGEST_VERSION = 2

export type PageChange = { added: number; removed: number; firstAdded?: string }

/** 두 본문 글의 줄 단위 차이. 날짜만 바뀐 줄은 차이로 세지 않는다 */
export function pageChange(before: string, after: string): PageChange {
  const key = (l: string) => maskDates(l)
  const old = new Set(before.split('\n').map(key))
  const now = new Set(after.split('\n').map(key))
  const addedLines = after.split('\n').filter((l) => !old.has(key(l)))
  const removed = [...old].filter((k) => !now.has(k)).length
  return {
    added: addedLines.length,
    removed,
    ...(addedLines[0] !== undefined ? { firstAdded: addedLines[0] } : {}),
  }
}

const versionParts = (s: string): number[] | undefined =>
  /(\d+(?:\.\d+)*)/.exec(s)?.[1]?.split('.').map(Number)

/** label에서 읽은 판이 known보다 새로운가. 둘 중 하나라도 판을 읽을 수 없으면 false */
export function newerThan(label: string, known: string): boolean {
  const a = versionParts(label)
  const b = versionParts(known)
  if (!a || !b) return false
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

const DAYS: Record<RadarSource['cadence'], number> = { weekly: 7, monthly: 30, quarterly: 91 }

/** 마지막으로 본 때(ISO)에서 주기가 지났는가. 처음이면 본다 */
export function isDue(
  cadence: RadarSource['cadence'],
  last: string | undefined,
  now: Date,
): boolean {
  if (!last) return true
  const t = Date.parse(last)
  if (Number.isNaN(t)) return true
  return now.getTime() - t >= DAYS[cadence] * 86_400_000
}
