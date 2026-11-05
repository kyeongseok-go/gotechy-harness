// gotechy radar(contract.md 14절, R2): 팩의 최신화 출처를 주기에 맞춰 보고, 바뀐 것과 새 판을 보고서로 남긴다.
// 네트워크 없이 가짜 fetch로 판정한다. 웹에서 읽은 글은 데이터라 보고서에는 다듬은 짧은 글만 남긴다.
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isDue,
  isPrerelease,
  latestFeedItem,
  latestRelease,
  newerThan,
  pageChange,
  pageDigest,
  pageText,
  releaseFromUrl,
} from '../../src/core/radar'
import { runRadar } from '../../src/runtime/radar'

const RSS = `<?xml version="1.0"?><rss><channel><title>t</title>
<item><title>Node v24.23.0 (LTS)</title><link>https://nodejs.org/x</link><pubDate>Tue, 14 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Node v24.22.0</title></item></channel></rss>`
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title>f</title>
<entry><title type="html">Release 5.1 &amp; notes</title><link href="https://ex.com/a"/><updated>2026-10-10T00:00:00Z</updated></entry></feed>`

describe('해석', () => {
  test('GitHub 최신 릴리스의 태그와 날짜', () => {
    expect(latestRelease('{"tag_name":"v7.0.3","published_at":"2026-10-15T00:00:00Z"}')).toEqual({
      label: 'v7.0.3',
      date: '2026-10-15T00:00:00Z',
    })
    expect(latestRelease('깨짐')).toBeUndefined()
  })

  test('리다이렉트 주소에서 태그를 읽고, 미리보기 판은 가려낸다', () => {
    expect(releaseFromUrl('https://github.com/a/b/releases/tag/v7.0.3')?.label).toBe('v7.0.3')
    expect(releaseFromUrl('https://github.com/a/b/releases')).toBeUndefined()
    expect(isPrerelease('PostgreSQL 19 RC 1 Released!')).toBe(true)
    expect(isPrerelease('Python 3.16.0a1')).toBe(true)
    expect(isPrerelease('v7.0.3')).toBe(false)
    expect(isPrerelease('Node v24.23.0 (LTS)')).toBe(false)
  })

  test('RSS와 Atom의 첫 항목', () => {
    expect(latestFeedItem(RSS)?.label).toBe('Node v24.23.0 (LTS)')
    expect(latestFeedItem(ATOM)?.label).toBe('Release 5.1 & notes')
    expect(latestFeedItem('<html></html>')).toBeUndefined()
  })

  test('페이지 요약값은 스크립트, 스타일, 태그, 공백 차이를 무시한다', () => {
    const a = '<html><script>var t=1</script><p>WCAG 2.2</p>\n\n<style>p{}</style></html>'
    const b = '<html><script>var t=2</script><p>WCAG   2.2</p></html>'
    expect(pageDigest(a)).toBe(pageDigest(b))
    expect(pageDigest(a)).not.toBe(pageDigest('<p>WCAG 3.0</p>'))
  })

  test('U4: 페이지 글은 본문(main)만 보고 nav, header, footer, aside는 뺀다. 블록은 줄로 나눈다', () => {
    const html =
      '<header>메뉴 A</header><nav>목록</nav><div>main 밖 추천 글</div><main><h1>제목</h1><p>첫 문단</p><aside>광고</aside><p>둘째 &amp; 문단</p></main><footer>바닥</footer>'
    expect(pageText(html)).toBe('제목\n첫 문단\n둘째 & 문단')
    // main이 없으면 body 전체에서 장식만 뺀다
    expect(pageText('<nav>목록</nav><div>본문</div><footer>바닥</footer>')).toBe('본문')
  })

  test('U4: 크기 상한에서 잘려 닫히지 않은 script와 style도 뺀다(2026-11-05 실측: 2MB 넘는 페이지의 지문이 매번 달랐다)', () => {
    const a = '<p>본문</p><script>var nonce="abc123"; var big='
    const b = '<p>본문</p><script>var nonce="zz9"; var other='
    expect(pageDigest(a)).toBe(pageDigest(b))
  })

  test('U4: 날짜와 시각만 바뀐 페이지는 같은 지문이다', () => {
    const page = (d: string) => `<main><p>보안 지침</p><p>Last updated: ${d}</p></main>`
    for (const [x, y] of [
      ['November 5, 2026', 'October 16, 2026'],
      ['2026-11-05', '2026-10-16'],
      ['2026년 11월 5일 13:20', '2026년 10월 16일 09:05'],
      ['5 Nov 2026', '16 Oct 2026'],
    ])
      expect(pageDigest(page(x as string))).toBe(pageDigest(page(y as string)))
    expect(pageDigest(page('2026-11-05'))).not.toBe(pageDigest('<main><p>새 지침</p></main>'))
  })

  test('U4: 바뀐 곳 요약은 새로 생긴 줄과 사라진 줄의 수, 새 줄의 앞부분을 준다', () => {
    const c = pageChange('제목\n그대로\n사라질 줄', '제목\n그대로\nASVS 5.0.1 추가\n두 번째 새 줄')
    expect(c).toEqual({ added: 2, removed: 1, firstAdded: 'ASVS 5.0.1 추가' })
    expect(pageChange('a\nb', 'a\nb')).toEqual({ added: 0, removed: 0 })
  })

  test('보안 감사 16차 낮음 3: 닫히지 않은 꺾쇠나 main이 많아도 본문 뽑기가 길이에 비례해 끝난다', () => {
    for (const html of ['<'.repeat(400_000), '<main>'.repeat(100_000), '<p '.repeat(200_000)]) {
      const t = performance.now()
      pageText(html)
      expect({ len: html.length, slow: performance.now() - t > 1500 }).toEqual({
        len: html.length,
        slow: false,
      })
    }
  })

  test('판 비교는 숫자 단위로 한다(v 접두사, 꼬리 글 무시)', () => {
    expect(newerThan('v7.0.3', '7.0.2')).toBe(true)
    expect(newerThan('7.0.2', '7.0.2')).toBe(false)
    expect(newerThan('v1.10.0', '1.9.9')).toBe(true)
    expect(newerThan('Node v24.23.0 (LTS)', '24.22.0')).toBe(true)
    expect(newerThan('release notes', '1.0')).toBe(false)
    expect(newerThan('7.0.1', '7.0.2')).toBe(false)
    expect(newerThan('v1.9.9', '1.10.0')).toBe(false)
  })

  test('주기가 지났을 때만 본다(처음이면 본다)', () => {
    const now = new Date('2026-10-16T00:00:00Z')
    expect(isDue('weekly', undefined, now)).toBe(true)
    expect(isDue('weekly', '2026-10-12T00:00:00Z', now)).toBe(false)
    expect(isDue('weekly', '2026-10-08T00:00:00Z', now)).toBe(true)
    expect(isDue('monthly', '2026-09-20T00:00:00Z', now)).toBe(false)
    expect(isDue('quarterly', '2026-07-01T00:00:00Z', now)).toBe(true)
  })
})

function lib(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-radar-')))
  mkdirSync(join(root, 'radar', 'sources'), { recursive: true })
  writeFileSync(
    join(root, 'radar', 'sources', 'gotechy-build.yaml'),
    [
      'skill: gotechy-build',
      'checked: 2026-10-16',
      'sources:',
      '  - id: ts',
      '    title: TypeScript',
      '    version: "7.0.2"',
      '    url: https://github.com/microsoft/TypeScript/releases',
      '    trust: official',
      '    watch: github-releases',
      '    feed: microsoft/TypeScript',
      '    cadence: weekly',
      '    covers: [references/stack-typescript.md]',
      '  - id: node',
      '    title: Node',
      '    version: "24.22.0"',
      '    url: https://nodejs.org',
      '    trust: official',
      '    watch: rss',
      '    feed: https://nodejs.org/feed.xml',
      '    cadence: weekly',
      '  - id: page',
      '    title: 문서',
      '    url: https://ex.com/doc',
      '    trust: official',
      '    watch: page',
      '    cadence: weekly',
      '  - id: down',
      '    title: 닫힌 곳',
      '    url: https://down.example/x',
      '    trust: community',
      '    watch: page',
      '    cadence: weekly',
    ].join('\n'),
  )
  return root
}

const pages: Record<string, string> = {
  'https://github.com/microsoft/TypeScript/releases/latest':
    'REDIRECT https://github.com/microsoft/TypeScript/releases/tag/v7.0.3',
  'https://nodejs.org/feed.xml': RSS,
  'https://ex.com/doc': '<p>처음 글</p>',
}
/** 'REDIRECT <주소>'로 적은 값은 리다이렉트로 흉내 낸다 */
const fetcher = (map: Record<string, string>) => async (url: string) => {
  if (!(url in map)) throw new Error(`연결 실패 ${url}`)
  const v = map[url] as string
  return v.startsWith('REDIRECT ') ? { text: '', url: v.slice(9) } : { text: v, url }
}

describe('gotechy radar', () => {
  test('처음 실행: 새 판은 알리고, 나머지는 기준으로 기록하고, 못 읽은 곳은 따로 적는다', async () => {
    const root = lib()
    const r = await runRadar({
      lib: root,
      stateDir: join(root, '.gotechy', 'radar'),
      now: new Date('2026-10-16T00:00:00Z'),
      fetchText: fetcher(pages),
    })
    expect(r.counts).toEqual({
      checked: 4,
      newer: 2,
      changed: 0,
      baseline: 1,
      same: 0,
      failed: 1,
      skipped: 0,
    })
    const report = readFileSync(r.report, 'utf8')
    expect(report).toContain('gotechy-build')
    expect(report).toContain('v7.0.3')
    expect(report).toContain('7.0.2')
    expect(report).toContain('references/')
    expect(report).toContain('down')
  })

  test('다시 실행: 주기가 안 지난 출처는 건너뛰고, 페이지가 바뀌면 알린다', async () => {
    const root = lib()
    const stateDir = join(root, '.gotechy', 'radar')
    await runRadar({
      lib: root,
      stateDir,
      now: new Date('2026-10-16T00:00:00Z'),
      fetchText: fetcher(pages),
    })
    const soon = await runRadar({
      lib: root,
      stateDir,
      now: new Date('2026-10-17T00:00:00Z'),
      fetchText: fetcher(pages),
    })
    // 못 읽은 곳은 다음에도 다시 본다
    expect(soon.counts.skipped).toBe(3)
    const later = await runRadar({
      lib: root,
      stateDir,
      now: new Date('2026-10-24T00:00:00Z'),
      fetchText: fetcher({ ...pages, 'https://ex.com/doc': '<p>바뀐 글</p>' }),
    })
    expect(later.counts.changed).toBe(1)
  })

  test('U4: 바뀐 페이지는 보고서에 새로 생긴 줄을 보여 주고, 날짜만 바뀌면 같음으로 센다', async () => {
    const root = lib()
    const stateDir = join(root, '.gotechy', 'radar')
    const doc = (body: string) => ({ ...pages, 'https://ex.com/doc': body })
    const run = (day: string, map: Record<string, string>) =>
      runRadar({ lib: root, stateDir, now: new Date(day), all: true, fetchText: fetcher(map) })
    await run('2026-10-16T00:00:00Z', doc('<main><p>규칙 하나</p><p>Updated 2026-10-16</p></main>'))
    const dateOnly = await run(
      '2026-10-24T00:00:00Z',
      doc('<main><p>규칙 하나</p><p>Updated 2026-10-24</p></main>'),
    )
    expect(dateOnly.counts.changed).toBe(0)
    const real = await run(
      '2026-11-01T00:00:00Z',
      doc('<main><p>규칙 하나</p><p>규칙 둘이 새로 생김</p><p>Updated 2026-11-01</p></main>'),
    )
    expect(real.counts.changed).toBe(1)
    const report = readFileSync(real.report, 'utf8')
    expect(report).toContain('규칙 둘이 새로 생김')
    expect(report).toContain('새 줄 1')
  })

  test('U4: 글이 없는 피드는 형식 오류가 아니라 비었다고 알린다(2026-11-05 ears 출처)', async () => {
    const root = lib()
    const r = await runRadar({
      lib: root,
      stateDir: join(root, '.gotechy', 'radar'),
      now: new Date('2026-10-16T00:00:00Z'),
      fetchText: fetcher({
        ...pages,
        'https://nodejs.org/feed.xml': '<rss><channel><title>t</title></channel></rss>',
      }),
    })
    expect(readFileSync(r.report, 'utf8')).toContain('피드에 글이 하나도 없어요')
  })

  test('보안 감사 16차 낮음 4: 보고서의 웹 글은 마크다운이나 HTML로 그려지지 않게 바꾼다', async () => {
    const root = lib()
    const stateDir = join(root, '.gotechy', 'radar')
    const run = (day: string, body: string) =>
      runRadar({
        lib: root,
        stateDir,
        now: new Date(day),
        all: true,
        fetchText: fetcher({ ...pages, 'https://ex.com/doc': body }),
      })
    await run('2026-10-16T00:00:00Z', '<main><p>규칙</p></main>')
    const r = await run(
      '2026-11-01T00:00:00Z',
      '<main><p>규칙</p><p>&lt;img src=https://evil/p&gt; [공지](https://evil)</p></main>',
    )
    const report = readFileSync(r.report, 'utf8')
    expect(report).not.toContain('<img')
    expect(report).not.toContain('[공지](')
  })

  test('U4: 옛 방식 지문만 있는 출처는 바뀜이 아니라 처음 기록으로 다시 잡는다', async () => {
    const root = lib()
    const stateDir = join(root, '.gotechy', 'radar')
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(
      join(stateDir, 'state.json'),
      JSON.stringify({
        'gotechy-build/page': {
          at: '2026-10-16T00:00:00.000Z',
          ok: true,
          digest: 'old1234567890abc',
        },
      }),
    )
    const r = await runRadar({
      lib: root,
      stateDir,
      now: new Date('2026-11-05T00:00:00Z'),
      all: true,
      fetchText: fetcher(pages),
    })
    expect(r.counts.changed).toBe(0)
    expect(r.counts.baseline).toBe(1)
  })

  test('보고서에 웹 글의 제어 문자와 긴 글은 남기지 않는다', async () => {
    const root = lib()
    const esc = String.fromCodePoint(0x1b)
    const r = await runRadar({
      lib: root,
      stateDir: join(root, '.gotechy', 'radar'),
      now: new Date('2026-10-16T00:00:00Z'),
      fetchText: fetcher({
        ...pages,
        'https://github.com/microsoft/TypeScript/releases/latest': `REDIRECT https://github.com/microsoft/TypeScript/releases/tag/v9.9.9${encodeURIComponent(`${esc}[2J${'x'.repeat(500)}`)}`,
      }),
    })
    const report = readFileSync(r.report, 'utf8')
    expect(report).not.toContain(esc)
    expect(report).not.toContain('x'.repeat(200))
  })

  test('형식이 틀린 출처 파일은 실행을 멈추지 않고 보고서에 적는다', async () => {
    const root = lib()
    writeFileSync(join(root, 'radar', 'sources', 'broken.yaml'), 'skill: x\nsources: 3\n')
    const r = await runRadar({
      lib: root,
      stateDir: join(root, '.gotechy', 'radar'),
      now: new Date('2026-10-16T00:00:00Z'),
      fetchText: fetcher(pages),
    })
    expect(readFileSync(r.report, 'utf8')).toContain('broken.yaml')
    expect(r.counts.checked).toBe(4)
  })
})
