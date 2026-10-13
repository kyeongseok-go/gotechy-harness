// contract.md 8.2절 읽기 전용 화면의 수용 테스트(Validation 7). 결과 HTML을 실제 HTML 파서(Bun HTMLRewriter)로 읽어 판정한다.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildCard } from '../../src/core/inbox'
import type { TermEntry } from '../../src/core/terms'
import { CSP, renderHandoffPage, renderInboxPage } from '../../src/core/view/pages'

const EVIL = join(import.meta.dir, '..', 'fixtures', 'render', 'evil', 'orchestration')
const handoffText = readFileSync(join(EVIL, 'handoffs', 'T-001.md'), 'utf8')
const title = "<script>alert('title')</script>"
const terms: TermEntry[] = readFileSync(join(EVIL, 'terms.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))

const card = buildCard({
  id: 'T-001',
  file: 'orchestration/handoffs/T-001.md',
  text: handoffText,
  title,
})
const page = renderHandoffPage({ card, terms })
const index = renderInboxPage([card])

const ALLOWED = new Set(
  (
    'html head meta title style body header main section nav footer h1 h2 h3 h4 h5 h6 p ul ol li ' +
    'a code pre strong em del s details summary span div table thead tbody tr th td blockquote hr br dl dt dd'
  ).split(' '),
)

// HTMLRewriter(lol-html)는 속성 값을 entity 디코딩 없이 돌려준다. 브라우저가 보는 값으로 바꿔 판정한다.
function decode(v: string | null): string | null {
  if (v === null) return null
  return v
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

type Scan = {
  tags: string[]
  onAttrs: string[]
  links: { href: string; rel: string | null; target: string | null }[]
  metas: { httpEquiv: string | null; content: string | null; name: string | null }[]
}
async function scan(html: string): Promise<Scan> {
  const s: Scan = { tags: [], onAttrs: [], links: [], metas: [] }
  await new HTMLRewriter()
    .on('*', {
      element(el) {
        s.tags.push(el.tagName)
        for (const [name] of el.attributes) if (name.startsWith('on')) s.onAttrs.push(name)
        if (el.tagName === 'a' && el.hasAttribute('href'))
          s.links.push({
            href: decode(el.getAttribute('href')) ?? '',
            rel: decode(el.getAttribute('rel')),
            target: decode(el.getAttribute('target')),
          })
        if (el.tagName === 'meta')
          s.metas.push({
            httpEquiv: decode(el.getAttribute('http-equiv')),
            content: decode(el.getAttribute('content')),
            name: decode(el.getAttribute('name')),
          })
      },
    })
    .transform(new Response(html))
    .text()
  return s
}

describe.each([
  ['HANDOFF 화면', page],
  ['인박스 화면', index],
])('%s 보안 규칙', (_name, html) => {
  test('악성 입력이 있어도 스크립트, 이벤트 속성, 허용 밖 요소가 생기지 않는다', async () => {
    const s = await scan(html)
    expect(s.tags.filter((t) => t === 'script')).toEqual([])
    expect(s.onAttrs).toEqual([])
    expect(s.tags.filter((t) => !ALLOWED.has(t))).toEqual([])
    expect(s.tags.filter((t) => t === 'style')).toHaveLength(1)
  })

  test('링크는 http(s) 외부 링크이거나 렌더러가 만든 화면 링크뿐이다', async () => {
    const s = await scan(html)
    for (const l of s.links) {
      const internal = /^(index|T-\d{3,})\.html$/.test(l.href)
      expect(internal || /^https?:\/\//.test(l.href)).toBe(true)
      if (!internal) {
        expect(l.rel).toBe('noopener noreferrer')
        expect(l.target).toBe('_blank')
      }
    }
  })

  test('CSP와 referrer meta가 있고 다른 http-equiv는 없다', async () => {
    const s = await scan(html)
    const equiv = s.metas.filter((m) => m.httpEquiv)
    expect(equiv).toEqual([{ httpEquiv: 'Content-Security-Policy', content: CSP, name: null }])
    expect(s.metas.some((m) => m.name === 'referrer' && m.content === 'no-referrer')).toBe(true)
  })
})

describe('HANDOFF 화면 내용', () => {
  test('CSP는 계약 문구 그대로다', () => {
    expect(CSP).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
    )
  })

  test('악성 입력은 지워지지 않고 글자로 보인다', () => {
    expect(page).toContain('&lt;script&gt;alert(&#39;title&#39;)&lt;/script&gt;')
    expect(page).toContain('&lt;SCRIPT&gt;alert(1)&lt;/SCRIPT&gt; 요약이에요.')
  })

  test('http(s) 링크는 살리고 javascript, data 링크는 글자로 둔다', async () => {
    const s = await scan(page)
    expect(s.links.map((l) => l.href)).toContain('https://example.com/docs')
    expect(page).toContain('[나쁜 링크](JAVASCRIPT:alert(1))')
  })

  test('결정, 요약, 한 일, 리스크는 펼쳐 두고 증거, 말해 보기, 다음 단계는 접는다', () => {
    const firstFold = page.indexOf('<details')
    expect(firstFold).toBeGreaterThan(0)
    for (const open of ['결정 필요', '한 줄 요약', '한 일', '건너뛴 것, 확인 못 한 것, 리스크'])
      expect(page.indexOf(`>${open}</h2>`)).toBeLessThan(firstFold)
    for (const folded of ['증거', '말해 보기', '다음 단계'])
      expect(page.indexOf(`>${folded}</summary>`)).toBeGreaterThan(firstFold)
  })

  test('본문에 나온 용어 중 용어 은행에 있는 것은 풀이를 보여 준다', () => {
    expect(page).toContain('한 저장소를 여러 폴더에 펼쳐 두는 git 기능')
  })

  test('3초 카드의 신호 줄을 화면 맨 위에 보여 준다', () => {
    expect(page).toContain('막는 결정 1, 검증 통과, 리스크 1, $0.10, 파일 2개')
  })
})
