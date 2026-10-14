/** @jsxImportSource hono/jsx */
// 읽기 전용 화면(contract.md 8.2절). 파일에서 읽은 문자열은 JSX가 이스케이프하고, Markdown은 renderMarkdown만 거친다.
// jsxImportSource를 파일에 적는 이유: Bun은 실행 위치의 tsconfig로 JSX를 변환해서, 다른 프로젝트 폴더에서 CLI를 돌리면 설정이 바뀐다.
import { raw } from 'hono/html'
import type { Child } from 'hono/jsx'
import {
  type Card,
  cardLabel,
  countLine,
  decisionLine,
  gateCommand,
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
/** serve 화면(contract.md 8.3절): 결정 폼을 같은 출처로만 보낸다. 스크립트는 여전히 없다 */
export const SERVE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"

/** serve 모드면 화면끼리의 링크가 서버 경로가 되고 열린 게이트가 결정 화면으로 이어진다 */
export type ViewMode = 'file' | 'serve'
const pageHref = (mode: ViewMode, id: string) => (mode === 'serve' ? `/${id}` : `${id}.html`)
const FOOTER: Record<ViewMode, string> = {
  file: '읽기 전용 화면이에요. 결정은 터미널에서 해요.',
  serve: '결정은 결정 화면에서 제출하면 Touch ID로 서명돼요.',
}

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
fieldset { border: 1px solid var(--line); border-radius: 8px; margin: 1rem 0; padding: .6rem 1rem; }
label { display: block; margin: .3rem 0; } textarea { width: 100%; min-height: 4rem; font: inherit; }
button { font: inherit; font-weight: 700; padding: .5rem 1.2rem; border-radius: 8px; }
`

const RISK = '건너뛴 것, 확인 못 한 것, 리스크'

function Layout(props: { title: string; mode?: ViewMode; children?: Child }) {
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta
          http-equiv="Content-Security-Policy"
          content={props.mode === 'serve' ? SERVE_CSP : CSP}
        />
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

export function renderHandoffPage(input: {
  card: Card
  terms: TermEntry[]
  mode?: ViewMode
}): string {
  const c = input.card
  const mode = input.mode ?? 'file'
  const open = openGates(c)
  const h = c.handoff
  const body = [...c.sections.values()].map((s) => s.content).join('\n')
  const words = new Set([
    ...extractEnglishTerms(body, { honorIgnore: false }),
    ...(h?.new_terms ?? []).map((w) => w.toLowerCase()),
  ])
  const explained = termsUsed(input.terms, words)
  return page(
    <Layout title={`${c.id} ${c.title ?? ''}`} mode={mode}>
      <header class={c.group}>
        <p>
          <a href={mode === 'serve' ? '/' : 'index.html'}>인박스로</a>
        </p>
        <p class="label">[{cardLabel(c)}]</p>
        <h1>
          {c.id} {t(c.title ?? '(작업 명세 없음)')}
        </h1>
        <p class="signal">{t(signalLine(c))}</p>
      </header>
      <main>
        {mode === 'serve' && open.length > 0 ? (
          <section class="must">
            <h2>결정하기</h2>
            <ul>
              {open.map((g) => (
                <li>
                  <a href={`/${g.id}`}>{g.id}</a> {t(g.label)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
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
      <footer>{FOOTER[mode]}</footer>
    </Layout>,
  )
}

/** 카드에서 아직 결정하지 않은 게이트(막는 결정, 승인, 시작 승인) */
function openGates(c: Card): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  if (c.startGate) out.push({ id: c.startGate.id, label: '시작 승인' })
  for (const d of c.blocking)
    if (d.gate && !d.decided) out.push({ id: d.gate, label: decisionLine(d) })
  if (c.approval) out.push({ id: c.approval.id, label: '결과 승인' })
  return out
}

/** serve 화면에서 열린 게이트를 결정 화면으로 잇는다 */
function GateLink(props: { id: string }) {
  return <a href={`/${props.id}`}>{props.id}</a>
}

function InboxCard(props: { card: Card; mode: ViewMode }) {
  const c = props.card
  const mode = props.mode
  const name = `${c.id} ${t(c.title ?? '(작업 명세 없음)')}`
  const linked = !c.problem && c.handoff
  return (
    <section class={`card ${c.group}`}>
      <p class="label">[{cardLabel(c)}]</p>
      <h2>{linked ? <a href={pageHref(mode, c.id)}>{name}</a> : name}</h2>
      {c.startGate ? (
        mode === 'serve' ? (
          <p>
            시작 승인 대기 <GateLink id={c.startGate.id} />
          </p>
        ) : (
          <p>
            시작 승인 대기 {c.startGate.id}: <code>{t(gateCommand(c.startGate))}</code>
          </p>
        )
      ) : c.problem ? (
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
              {c.blocking.slice(0, MAX_DECISION_LINES).map((d) =>
                mode === 'serve' && d.gate && !d.decided ? (
                  <li>
                    <GateLink id={d.gate} /> {t(decisionLine(d))}
                  </li>
                ) : (
                  <li>{t(decisionLine(d))}</li>
                ),
              )}
              {c.blocking.length > MAX_DECISION_LINES ? (
                <li>결정 외 {c.blocking.length - MAX_DECISION_LINES}건</li>
              ) : null}
            </ul>
          ) : null}
          {mode === 'file' && c.blocking.some((d) => d.gate && !d.decided) ? (
            <p>
              결정하려면: <code>gotechy decide &lt;게이트 번호&gt; &lt;선택&gt;</code>
            </p>
          ) : null}
          {c.approval ? (
            mode === 'serve' ? (
              <p>
                승인 대기 <GateLink id={c.approval.id} />
              </p>
            ) : (
              <p>
                승인 대기 {c.approval.id}: <code>{t(gateCommand(c.approval))}</code>
              </p>
            )
          ) : null}
          {c.newTerms.length > 0 ? <p>새 용어: {t(c.newTerms.join(', '))}</p> : null}
          {c.handoff?.lead_note && c.group !== 'done' ? (
            <p>리드: {t(truncate(c.handoff.lead_note.replace(/\s*\n\s*/g, ' '), 80))}</p>
          ) : null}
        </>
      )}
    </section>
  )
}

export function renderInboxPage(cards: Card[], mode: ViewMode = 'file'): string {
  return page(
    <Layout title="인박스" mode={mode}>
      <header>
        <h1>인박스</h1>
        <p class="signal">{countLine(cards)}</p>
      </header>
      <main>
        {sortCards(cards).map((c) => (
          <InboxCard card={c} mode={mode} />
        ))}
      </main>
      <footer>{FOOTER[mode]}</footer>
    </Layout>,
  )
}

export type GateForm = {
  id: string
  task: string
  title: string
  question: string
  options: string[]
  recommended: string | null
  summary: string
  /** 되돌리기 어려운 결정의 이해 문항(contract.md 9.1절). 없으면 빈 목록 */
  questions: string[]
  csrf: string
  view: string
}

/** 결정 화면(contract.md 8.3절). 문자열은 모두 JSX가 이스케이프한다 */
export function renderGatePage(f: GateForm): string {
  return page(
    <Layout title={`${f.id} ${f.title}`} mode="serve">
      <header class="decision">
        <p>
          <a href="/">인박스로</a> <a href={`/${f.task}`}>{f.task} 보고서</a>
        </p>
        <p class="label">[결정 필요] {f.id}</p>
        <h1>{t(f.question)}</h1>
        <p class="signal">
          {f.task} {t(f.title)}
        </p>
        {f.summary ? <p>{t(f.summary)}</p> : null}
      </header>
      <main>
        <form method="post" action={`/${f.id}`}>
          <input type="hidden" name="csrf" value={f.csrf} />
          <input type="hidden" name="view" value={f.view} />
          <fieldset>
            <legend>선택</legend>
            {f.options.map((o) => (
              <label>
                <input type="radio" name="choice" value={o} required />
                {t(o)}
                {o === f.recommended ? ' (추천)' : ''}
              </label>
            ))}
          </fieldset>
          {f.questions.length > 0 ? (
            <fieldset>
              <legend>되돌리기 어려운 결정이에요. 결정하기 전에 자기 말로 답해 주세요</legend>
              {f.questions.map((q, i) => (
                <label>
                  {t(q)}
                  <textarea name={`answer_${i}`} />
                </label>
              ))}
            </fieldset>
          ) : null}
          <label>
            다음 지시 (선택)
            <textarea name="instruction" />
          </label>
          <button type="submit">결정하고 Touch ID로 서명</button>
        </form>
      </main>
      <footer>
        제출하면 Mac에 "gotechy {f.id}: 선택" 확인 창이 떠요. 지금 제출한 결정의 창만 승인하세요.
      </footer>
    </Layout>,
  )
}

/** 결정 결과나 오류를 보여 주는 짧은 화면 */
export function renderMessagePage(title: string, lines: string[], back?: string): string {
  return page(
    <Layout title={title} mode="serve">
      <main>
        <h1>{t(title)}</h1>
        {lines.map((l) => (
          <p>{t(l)}</p>
        ))}
        <p>
          <a href={back ?? '/'}>{back ? '돌아가기' : '인박스로'}</a>
        </p>
      </main>
    </Layout>,
  )
}
