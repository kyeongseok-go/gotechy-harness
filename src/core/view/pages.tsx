/** @jsxImportSource hono/jsx */
// 읽기 전용 화면(contract.md 8.2절). 파일에서 읽은 문자열은 JSX가 이스케이프하고, Markdown은 renderMarkdown만 거친다.
// jsxImportSource를 파일에 적는 이유: Bun은 실행 위치의 tsconfig로 JSX를 변환해서, 다른 프로젝트 폴더에서 CLI를 돌리면 설정이 바뀐다.
import { raw } from 'hono/html'
import type { Child } from 'hono/jsx'
import {
  type Card,
  cardLabel,
  countLine,
  MAX_DECISION_LINES,
  signalLine,
  sortCards,
  displayText as t,
  truncate,
} from '../inbox'
import { extractEnglishTerms } from '../style'
import { type TermEntry, termsUsed } from '../terms'
import { renderMarkdown } from './markdown'

export const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"

const CSS = `
:root { color-scheme: light dark; --fg: #1d1d1f; --muted: #5f6368; --line: #d9dce1; --bg: #fff;
  --card: #f7f8fa; --decision: #b26a00; --failed: #c5221f; --done: #188038; }
@media (prefers-color-scheme: dark) { :root { --fg: #e8eaed; --muted: #9aa0a6; --line: #3c4043;
  --bg: #202124; --card: #292a2d; --decision: #fdd663; --failed: #f28b82; --done: #81c995; } }
body { margin: 0 auto; max-width: 46rem; padding: 1.5rem 1rem 4rem; background: var(--bg); color: var(--fg);
  font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
h1 { font-size: 1.4rem; margin: .2rem 0 .4rem; } h2 { font-size: 1.1rem; margin: 1.6rem 0 .4rem; }
a { color: inherit; } code, pre { font: .9em ui-monospace, SFMono-Regular, Menlo, monospace; }
pre { overflow-x: auto; padding: .6rem; background: var(--card); border-radius: 6px; }
.label { font-weight: 700; margin: 0; } .signal { color: var(--muted); margin: 0; }
.decision .label { color: var(--decision); } .failed .label { color: var(--failed); } .done .label { color: var(--done); }
.card { border: 1px solid var(--line); border-left-width: 4px; border-radius: 8px; padding: .8rem 1rem; margin: 1rem 0; }
.card.decision { border-left-color: var(--decision); } .card.failed { border-left-color: var(--failed); }
.card.done { border-left-color: var(--done); } .card h2 { margin: .2rem 0; }
.must { border: 2px solid var(--decision); border-radius: 8px; padding: .2rem 1rem; }
details { border-top: 1px solid var(--line); padding: .6rem 0; } summary { cursor: pointer; font-weight: 600; }
dt { font-weight: 600; margin-top: .4rem; } dd { margin-left: 1rem; }
footer { margin-top: 3rem; color: var(--muted); font-size: .9rem; }
`

const RISK = '건너뛴 것, 확인 못 한 것, 리스크'

function Layout(props: { title: string; children?: Child }) {
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Security-Policy" content={CSP} />
        <meta name="referrer" content="no-referrer" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{t(props.title)}</title>
        <style>{raw(CSS)}</style>
      </head>
      <body>{props.children}</body>
    </html>
  )
}

const page = (node: Child) => `<!doctype html>\n${String(node)}`
const md = (src: string | undefined) => raw(renderMarkdown(t(src ?? '없음')))

function Section(props: { card: Card; title: string; className?: string }) {
  return (
    <section class={props.className}>
      <h2>{props.title}</h2>
      {md(props.card.sections.get(props.title)?.content)}
    </section>
  )
}

function Fold(props: { card: Card; title: string; children?: Child }) {
  return (
    <details>
      <summary>{props.title}</summary>
      {md(props.card.sections.get(props.title)?.content)}
      {props.children}
    </details>
  )
}

function LeadFacts(props: { card: Card }) {
  const h = props.card.handoff
  if (!h) return null
  const u = h.usage
  const files = h.changed_files ?? []
  return (
    <details>
      <summary>리드 측정값</summary>
      <dl>
        <dt>검증</dt>
        <dd>
          {h.verified ? (
            <>
              <code>{t(h.verified.command)}</code> exit {h.verified.exit_code}, {t(h.verified.at)}
            </>
          ) : (
            '기록 없음'
          )}
        </dd>
        <dt>실행</dt>
        <dd>
          {t([h.agent, h.model, h.effort].filter(Boolean).join(', ') || '기록 없음')}
          {h.rev ? `, 판본 ${h.rev}` : ''}
        </dd>
        <dt>토큰</dt>
        <dd>
          {u
            ? `입력 ${u.input_tokens}, 캐시 읽기 ${u.cache_read_tokens}, 캐시 쓰기 ${u.cache_write_tokens}, 출력 ${u.output_tokens}`
            : '기록 없음'}
        </dd>
        <dt>비용</dt>
        <dd>{typeof u?.cost_usd === 'number' ? `$${u.cost_usd.toFixed(3)}` : '모름'}</dd>
        <dt>바뀐 파일 {files.length}개</dt>
        <dd>
          <ul>
            {files.map((f) => (
              <li>
                <code>{t(f)}</code>
              </li>
            ))}
          </ul>
        </dd>
        {h.lead_note && props.card.group !== 'failed' ? (
          <>
            <dt>리드 메모</dt>
            <dd>{t(h.lead_note)}</dd>
          </>
        ) : null}
      </dl>
    </details>
  )
}

export function renderHandoffPage(input: { card: Card; terms: TermEntry[] }): string {
  const c = input.card
  const h = c.handoff
  const body = [...c.sections.values()].map((s) => s.content).join('\n')
  const words = new Set([
    ...extractEnglishTerms(body, { honorIgnore: false }),
    ...(h?.new_terms ?? []).map((w) => w.toLowerCase()),
  ])
  const explained = termsUsed(input.terms, words)
  return page(
    <Layout title={`${c.id} ${c.title ?? ''}`}>
      <header class={c.group}>
        <p>
          <a href="index.html">인박스로</a>
        </p>
        <p class="label">[{cardLabel(c)}]</p>
        <h1>
          {c.id} {t(c.title ?? '(작업 명세 없음)')}
        </h1>
        <p class="signal">{t(signalLine(c))}</p>
      </header>
      <main>
        <Section card={c} title="결정 필요" className={c.blocking.length > 0 ? 'must' : ''} />
        <Section card={c} title="한 줄 요약" />
        {c.group === 'failed' && h?.lead_note ? (
          <section>
            <h2>리드 메모</h2>
            <p>{t(h.lead_note)}</p>
          </section>
        ) : null}
        <Section card={c} title="한 일" />
        <Section card={c} title={RISK} />
        <Fold card={c} title="증거" />
        <Fold card={c} title="새 용어">
          {explained.length > 0 ? (
            <dl>
              {explained.map((e) => (
                <>
                  <dt>{t(e.term)}</dt>
                  <dd>{t(e.easy)}</dd>
                </>
              ))}
            </dl>
          ) : null}
        </Fold>
        <Fold card={c} title="말해 보기" />
        <Fold card={c} title="다음 단계" />
        <LeadFacts card={c} />
      </main>
      <footer>읽기 전용 화면이에요. 결정은 터미널에서 해요.</footer>
    </Layout>,
  )
}

function InboxCard(props: { card: Card }) {
  const c = props.card
  const name = `${c.id} ${t(c.title ?? '(작업 명세 없음)')}`
  return (
    <section class={`card ${c.group}`}>
      <p class="label">[{cardLabel(c)}]</p>
      <h2>{c.problem ? name : <a href={`${c.id}.html`}>{name}</a>}</h2>
      {c.problem ? (
        <>
          <p>{t(c.problem)}</p>
          <p>
            <code>gotechy handoff lint {t(c.file)}</code>
          </p>
        </>
      ) : (
        <>
          <p class="signal">{t(signalLine(c))}</p>
          <p>{t(c.summary)}</p>
          {c.blocking.length > 0 ? (
            <ul>
              {c.blocking.slice(0, MAX_DECISION_LINES).map((d) => (
                <li>
                  결정: {t(d.question)}
                  {d.pick ? ` (추천 ${t(d.pick)})` : ''}
                </li>
              ))}
              {c.blocking.length > MAX_DECISION_LINES ? (
                <li>결정 외 {c.blocking.length - MAX_DECISION_LINES}건</li>
              ) : null}
            </ul>
          ) : null}
          {c.group === 'failed' && c.handoff?.lead_note ? (
            <p>리드: {t(truncate(c.handoff.lead_note.replace(/\s*\n\s*/g, ' '), 80))}</p>
          ) : null}
        </>
      )}
    </section>
  )
}

export function renderInboxPage(cards: Card[]): string {
  return page(
    <Layout title="인박스">
      <header>
        <h1>인박스</h1>
        <p class="signal">{countLine(cards)}</p>
      </header>
      <main>
        {sortCards(cards).map((c) => (
          <InboxCard card={c} />
        ))}
      </main>
      <footer>읽기 전용 화면이에요. 결정은 터미널에서 해요.</footer>
    </Layout>,
  )
}
