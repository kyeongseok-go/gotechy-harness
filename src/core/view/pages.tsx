/** @jsxImportSource hono/jsx */
// 읽기 전용 화면(contract.md 8.2절). 파일에서 읽은 문자열은 JSX가 이스케이프하고, Markdown은 renderMarkdown만 거친다.
// jsxImportSource를 파일에 적는 이유: Bun은 실행 위치의 tsconfig로 JSX를 변환해서, 다른 프로젝트 폴더에서 CLI를 돌리면 설정이 바뀐다.
import { raw } from 'hono/html'
import type { Child } from 'hono/jsx'
import {
  type AuditItem,
  auditLine,
  type Card,
  cardLabel,
  countLine,
  decisionLine,
  gateCommand,
  MAX_DECISION_LINES,
  resumeCommand,
  signalLine,
  sortCards,
  displayText as t,
  truncate,
} from '../inbox'
import { isNone } from '../sections'
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
  serve: '결정은 결정 화면에서 제출하면 Touch ID(지문 장치가 없으면 맥 암호)로 서명돼요.',
}

const CSS = `
:root { color-scheme: light dark; --fg: #1d1d1f; --muted: #5f6368; --line: #d9dce1; --bg: #fff;
  --card: #f7f8fa; --decision: #b26a00; --failed: #c5221f; --resume: #1a73e8; --done: #188038; }
@media (prefers-color-scheme: dark) { :root { --fg: #e8eaed; --muted: #9aa0a6; --line: #3c4043;
  --bg: #202124; --card: #292a2d; --decision: #fdd663; --failed: #f28b82; --resume: #8ab4f8; --done: #81c995; } }
body { margin: 0 auto; max-width: 46rem; padding: 1.5rem 1rem 4rem; background: var(--bg); color: var(--fg);
  font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
h1 { font-size: 1.4rem; margin: .2rem 0 .4rem; } h2 { font-size: 1.1rem; margin: 1.6rem 0 .4rem; }
a { color: inherit; } code, pre { font: .9em ui-monospace, SFMono-Regular, Menlo, monospace; }
pre { overflow-x: auto; padding: .6rem; background: var(--card); border-radius: 6px; }
.label { font-weight: 700; margin: 0; } .signal { color: var(--muted); margin: 0; }
.decision .label { color: var(--decision); } .failed .label { color: var(--failed); } .done .label { color: var(--done); }
.resume .label { color: var(--resume); } .card.resume { border-left-color: var(--resume); }
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
.summary { font-size: 1.15rem; margin: .6rem 0 1rem; }
.chips { display: flex; flex-wrap: wrap; gap: .4rem; margin: .4rem 0 1rem; padding: 0; list-style: none; }
.chips li { border: 1px solid var(--line); border-radius: 999px; padding: .15rem .7rem; font-size: .9rem; }
.chips .ok { border-color: var(--done); color: var(--done); } .chips .warn { border-color: var(--decision); color: var(--decision); }
.chips .bad { border-color: var(--failed); color: var(--failed); }
.dcard { border: 2px solid var(--decision); border-radius: 10px; padding: .6rem 1rem .8rem; margin: .8rem 0; }
.dcard .q { font-weight: 700; margin: .2rem 0 .6rem; } .dcard .gid { color: var(--muted); font-size: .85rem; margin: 0; }
.opts { display: flex; flex-wrap: wrap; gap: .5rem; margin: .2rem 0 .5rem; }
.opts a, .opts span { display: inline-block; border: 1px solid var(--line); border-radius: 8px; padding: .45rem .9rem;
  text-decoration: none; min-height: 44px; box-sizing: border-box; line-height: 1.6; }
.opts .rec { border: 2px solid var(--decision); font-weight: 700; }
.why { color: var(--muted); margin: 0; font-size: .95rem; }
.tag { font-size: .8rem; border-radius: 4px; padding: 0 .35rem; margin-left: .3rem; border: 1px solid var(--line); white-space: nowrap; }
.tag.ok { color: var(--done); border-color: var(--done); } .tag.inf { color: var(--decision); border-color: var(--decision); }
.tag.est { color: var(--failed); border-color: var(--failed); }
.finding { border-left: 4px solid var(--failed); padding: .2rem .8rem; margin: .4rem 0; }
.finding.unconfirmed { border-left-color: var(--line); } .sev { color: var(--failed); font-weight: 700; }
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
        {/* serve는 same-origin: no-referrer면 Chrome이 같은 출처 폼 POST에도 Origin: null을 보내 결정이 막힌다(2026-10-15 실험) */}
        <meta name="referrer" content={props.mode === 'serve' ? 'same-origin' : 'no-referrer'} />
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
  const h = c.handoff
  const body = [...c.sections.values()].map((s) => s.content).join('\n')
  const words = new Set([
    ...extractEnglishTerms(body, { honorIgnore: false }),
    ...(h?.new_terms ?? []).map((w) => w.toLowerCase()),
  ])
  const explained = termsUsed(input.terms, words)
  const done = listItems(c.sections.get('한 일')?.content)
  const findings = c.audit?.current ? c.audit.items : []
  const pairs = pairFindings(
    done.map((i) => i.text),
    findings,
  )
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
        <p class="summary">{t(c.summary)}</p>
        <Chips card={c} />
      </header>
      <main>
        {c.group === 'failed' && h?.lead_note ? (
          <section>
            <h2>리드 메모</h2>
            <p>{t(h.lead_note)}</p>
          </section>
        ) : null}
        <Decisions card={c} mode={mode} />
        <AuditSection card={c} unpaired={pairs.unpaired} />
        <section>
          <h2>한 일</h2>
          <Items items={done} fallback={c.sections.get('한 일')?.content} findings={pairs.byItem} />
        </section>
        <section>
          <h2>{RISK}</h2>
          <Items
            items={listItems(c.sections.get(RISK)?.content)}
            fallback={c.sections.get(RISK)?.content}
          />
        </section>
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

/** 3초 상태 칩(contract.md 8.2절): 검증, 형식 오류, 감사, 리스크, 비용과 파일 수 */
function Chips(props: { card: Card }) {
  const c = props.card
  const h = c.handoff
  if (!h) return null
  const chips: { text: string; tone: 'ok' | 'warn' | 'bad' | '' }[] = []
  const v = h.verified
  chips.push(
    !v
      ? { text: '검증 기록 없음', tone: 'warn' }
      : v.exit_code === 0
        ? { text: '검증 통과', tone: 'ok' }
        : { text: `검증 실패 exit ${v.exit_code}`, tone: 'bad' },
  )
  if (c.formatErrors > 0) chips.push({ text: `형식 오류 ${c.formatErrors}건`, tone: 'bad' })
  const a = c.audit
  if (!a) chips.push({ text: '감사 전', tone: '' })
  else if (!a.current) chips.push({ text: '감사: 지난 판본 기준', tone: 'warn' })
  else if (a.confirmed > 0)
    chips.push({ text: `감사 지적 ${a.confirmed}건(근거 확인됨)`, tone: 'bad' })
  else if (a.items.length > 0)
    chips.push({ text: `감사 지적 ${a.items.length}건(근거 확인 안 됨)`, tone: 'warn' })
  else chips.push({ text: '감사 지적 없음', tone: 'ok' })
  chips.push(
    c.risks === undefined
      ? { text: '리스크 기록 없음', tone: 'warn' }
      : c.risks > 0
        ? { text: `리스크 ${c.risks}`, tone: 'warn' }
        : { text: '리스크 없음', tone: 'ok' },
  )
  const cost = h.usage?.cost_usd
  const files = h.changed_files?.filter((f) => !f.startsWith('orchestration/handoffs/'))
  chips.push({
    text: `${typeof cost === 'number' ? `$${cost.toFixed(2)}` : '비용 모름'}, ${files ? `파일 ${files.length}개` : '파일 기록 없음'}`,
    tone: '',
  })
  return (
    <ul class="chips">
      {chips.map((x) => (
        <li class={x.tone}>{t(x.text)}</li>
      ))}
    </ul>
  )
}

/** 결정 카드(시안 B). 막는 결정, 시작 승인, 결과 승인을 카드로, 기본값은 접고 알림은 목록으로 */
function Decisions(props: { card: Card; mode: ViewMode }) {
  const c = props.card
  const mode = props.mode
  const cards: Child[] = []
  if (c.startGate)
    cards.push(
      <GateCard
        id={c.startGate.id}
        kind="시작 승인"
        question="이 작업을 시작할까요?"
        options={c.startGate.options}
        mode={mode}
      />,
    )
  for (const d of c.blocking)
    cards.push(
      <section class="dcard">
        <p class="gid">
          {d.gate ? (
            <>
              <GateId id={d.gate} open={!d.decided} mode={mode} />, 막는 결정
            </>
          ) : (
            '막는 결정(게이트 없음)'
          )}
        </p>
        <p class="q">{t(d.question)}</p>
        {d.decided ? (
          <p>결정함: {t(d.decided)}</p>
        ) : (
          <Options
            gate={d.gate}
            options={d.options ?? (d.pick ? [d.pick] : [])}
            pick={d.pick}
            mode={mode}
          />
        )}
        {d.reason ? <p class="why">이유: {t(d.reason)}</p> : null}
      </section>,
    )
  if (c.approval)
    cards.push(
      <GateCard
        id={c.approval.id}
        kind="결과 승인"
        question="이 결과를 승인할까요?"
        options={c.approval.options}
        mode={mode}
      />,
    )
  if (cards.length === 0 && c.defaultItems.length === 0 && c.alerts.length === 0) return null
  return (
    <section>
      {cards.length > 0 ? <h2>결정할 것 {cards.length}건</h2> : null}
      {cards}
      {c.defaultItems.length > 0 ? (
        <details>
          <summary>기본값으로 진행한 것 {c.defaultItems.length}건</summary>
          <ul>
            {c.defaultItems.map((d) => (
              <li>
                {t(d.question)}
                {d.pick ? ` 추천대로 "${t(d.pick)}"로 진행했어요.` : ''}
                {d.reason ? ` 이유: ${t(d.reason)}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {c.alerts.length > 0 ? (
        <>
          <h2>알릴 것</h2>
          <ul>
            {c.alerts.map((a) => (
              <li>{t(a)}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

function GateCard(props: {
  id: string
  kind: string
  question: string
  options: string[]
  mode: ViewMode
}) {
  return (
    <section class="dcard">
      <p class="gid">
        <GateId id={props.id} open mode={props.mode} />, {props.kind}
      </p>
      <p class="q">{props.question}</p>
      <Options gate={props.id} options={props.options} pick={undefined} mode={props.mode} />
    </section>
  )
}

/** serve 화면의 열린 게이트 번호는 미리 고르지 않은 결정 화면으로 잇는다 */
function GateId(props: { id: string; open: boolean; mode: ViewMode }) {
  return props.mode === 'serve' && props.open ? (
    <a href={`/${props.id}`}>{props.id}</a>
  ) : (
    <>{props.id}</>
  )
}

/** 선택지. serve에서 열린 게이트면 그 선택을 미리 고른 결정 화면으로 잇고, 파일 화면이면 decide 명령을 보여 준다 */
function Options(props: {
  gate: string | undefined
  options: string[]
  pick: string | undefined
  mode: ViewMode
}) {
  const { gate, mode } = props
  return (
    <>
      <div class="opts">
        {props.options.map((o) => {
          const label = `${t(o)}${o === props.pick ? ' (추천)' : ''}`
          const cls = o === props.pick ? 'rec' : ''
          return mode === 'serve' && gate ? (
            <a href={`/${gate}?choice=${encodeURIComponent(o)}`} class={cls}>
              {label}
            </a>
          ) : (
            <span class={cls}>{label}</span>
          )
        })}
      </div>
      {mode === 'file' && gate ? (
        <p>
          <code>gotechy decide {gate} &lt;선택&gt;</code>
        </p>
      ) : null}
    </>
  )
}

/** 한 일 항목과 짝짓지 못한 감사 지적. 지난 판본 감사면 지적 없이 한 줄만 */
function AuditSection(props: { card: Card; unpaired: AuditItem[] }) {
  const a = props.card.audit
  if (!a) return null
  if (!a.current)
    return (
      <section>
        <h2>감사관이 본 것</h2>
        <p class="why">
          지난 판본 기준 감사라 지적을 붙이지 않았어요. 다시 감사하려면{' '}
          <code>gotechy audit {props.card.id}</code>
        </p>
      </section>
    )
  if (props.unpaired.length === 0) return null
  return (
    <section>
      <h2>감사관이 본 것</h2>
      <p class="why">
        다른 계열 모델이 HANDOFF를 실제 변경과 대조한 권고예요. 한 일 항목과 짝짓지 못한 지적만 여기
        모아요.
      </p>
      {props.unpaired.map((f) => (
        <Finding f={f} />
      ))}
    </section>
  )
}

const SEVERITY: Record<AuditItem['severity'], string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
}
function Finding(props: { f: AuditItem }) {
  const f = props.f
  return (
    <div class={f.confirmed ? 'finding' : 'finding unconfirmed'}>
      <p>
        <span class="sev">[{SEVERITY[f.severity]}]</span> 감사:{' '}
        <code>{t(`${f.file}:${f.line}`)}</code>, {f.confirmed ? '근거 확인됨' : '근거 확인 안 됨'}
      </p>
      <p class="why">실제: {t(f.actual)}</p>
    </div>
  )
}

type Item = { text: string; tag: 'ok' | 'inf' | 'est' | undefined }
const TAGS: Record<string, Item['tag']> = { 확인: 'ok', 추론: 'inf', 추정: 'est' }
const TAG_TEXT: Record<NonNullable<Item['tag']>, string> = { ok: '확인', inf: '추론', est: '추정' }

/** 절의 목록 항목(맨 위 수준). 목록이 아닌 글이 섞이면 빈 배열을 돌려 원문 그대로 보여 주게 한다 */
function listItems(content: string | undefined): Item[] {
  if (!content || isNone(content)) return []
  const out: string[] = []
  for (const line of content.split('\n')) {
    if (line.trim() === '') continue
    const top = /^[-*]\s+(.*)$/.exec(line)
    if (top) out.push(top[1] ?? '')
    else if (/^\s+\S/.test(line) && out.length > 0) out[out.length - 1] += `\n${line}`
    else return []
  }
  return out.map((raw) => {
    const m = /\s*\[(확인|추론|추정)\]\s*$/.exec(raw)
    return m
      ? { text: raw.slice(0, m.index), tag: TAGS[m[1] ?? ''] }
      : { text: raw, tag: undefined }
  })
}

function Items(props: {
  items: Item[]
  fallback: string | undefined
  findings?: Map<number, AuditItem[]>
}) {
  if (props.items.length === 0) return md(props.fallback)
  return (
    <ul>
      {props.items.map((item, i) => (
        <li>
          {raw(renderMarkdown(t(item.text)).replace(/^<p>([\s\S]*)<\/p>\n?$/, '$1'))}
          {item.tag ? <span class={`tag ${item.tag}`}>{TAG_TEXT[item.tag]}</span> : null}
          {(props.findings?.get(i) ?? []).map((f) => (
            <Finding f={f} />
          ))}
        </li>
      ))}
    </ul>
  )
}

/** 감사 지적을 주장이 가장 닮은 한 일 항목 하나에 짝짓는다(문자 두 개씩 묶은 조각의 Dice 계수 0.4 이상) */
export const PAIR_MIN = 0.4
export function pairFindings(
  items: string[],
  findings: AuditItem[],
): { byItem: Map<number, AuditItem[]>; unpaired: AuditItem[] } {
  const byItem = new Map<number, AuditItem[]>()
  const unpaired: AuditItem[] = []
  const keys = items.map(bigrams)
  for (const f of findings) {
    const claim = bigrams(f.claim)
    let best = -1
    let score = 0
    keys.forEach((k, i) => {
      const s = dice(k, claim)
      if (s > score) {
        score = s
        best = i
      }
    })
    if (best >= 0 && score >= PAIR_MIN) byItem.set(best, [...(byItem.get(best) ?? []), f])
    else unpaired.push(f)
  }
  return { byItem, unpaired }
}

function bigrams(s: string): Map<string, number> {
  const chars = [
    ...s
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}]/gu, ''),
  ]
  const out = new Map<string, number>()
  for (let i = 0; i + 1 < chars.length; i++) {
    const g = `${chars[i]}${chars[i + 1]}`
    out.set(g, (out.get(g) ?? 0) + 1)
  }
  return out
}

function dice(a: Map<string, number>, b: Map<string, number>): number {
  let total = 0
  let shared = 0
  for (const n of a.values()) total += n
  for (const n of b.values()) total += n
  for (const [g, n] of a) shared += Math.min(n, b.get(g) ?? 0)
  return total === 0 ? 0 : (2 * shared) / total
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
          {c.group === 'resume' ? (
            <p>
              결정을 모두 마쳤어요. 다음: <code>{t(resumeCommand(c))}</code>
            </p>
          ) : null}
          {auditLine(c) ? <p>{t(auditLine(c) ?? '')}</p> : null}
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
  /** 확인 코드. Touch ID 창 문구에도 같은 코드가 들어간다 */
  code: string
  handoffRev: number | null
  handoffSha: string | null
  autonomy: string | undefined
  budgetUsd: number | undefined
  /** 결정했지만 검증에 실패해 다시 결정하는 경우의 사유 */
  failing: string[]
  /** HANDOFF 화면의 선택지 버튼에서 온 선택. 선택지 중 하나일 때만 미리 고른다 */
  preselect?: string | null
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
          {f.handoffRev !== null ? ` (HANDOFF rev ${f.handoffRev}, ${f.handoffSha ?? ''})` : ''}
        </p>
        {f.summary ? <p>{t(f.summary)}</p> : null}
        {f.failing.length > 0 ? (
          <section class="must">
            <h2>이미 결정했지만 검증에 실패해서 다시 결정해요</h2>
            <ul>
              {f.failing.map((r) => (
                <li>{t(r)}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <p class="must">
          확인 코드 <strong>{f.code}</strong>. 제출하면 Mac에 "gotechy {f.id} {f.task}: 선택 (확인{' '}
          {f.code})" 창이 떠요. 이 코드가 보이는 창만 승인하세요.
        </p>
        <p class="signal">
          {f.autonomy && f.autonomy !== 'L0'
            ? `autonomy ${f.autonomy}: 결정 뒤 작업이 준비되면 바로 다시 실행해요 (예산 $${(f.budgetUsd ?? 1).toFixed(2)})`
            : '결정만 기록해요. 다음 실행은 리드가 해요 (autonomy L0)'}
        </p>
      </header>
      <main>
        <form method="post" action={`/${f.id}`}>
          <input type="hidden" name="csrf" value={f.csrf} />
          <input type="hidden" name="view" value={f.view} />
          <fieldset>
            <legend>선택</legend>
            {f.options.map((o) => (
              <label>
                <input type="radio" name="choice" value={o} required checked={o === f.preselect} />
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
                  <textarea name={`answer_${i}`} autocomplete="off" />
                </label>
              ))}
            </fieldset>
          ) : null}
          <label>
            다음 지시 (선택)
            <textarea name="instruction" autocomplete="off" />
          </label>
          <button type="submit">결정하고 서명하기</button>
        </form>
      </main>
      <footer>빈 답도 받지만 핵심어 적중 0으로 남아요.</footer>
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
