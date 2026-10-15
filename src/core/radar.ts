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
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
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

/** 페이지 글의 요약값. 스크립트, 스타일, 태그, 공백 차이는 무시한다(그래도 날짜나 광고가 바뀌면 잡음이 생긴다) */
export function pageDigest(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
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
