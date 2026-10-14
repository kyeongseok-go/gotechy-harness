// gotechy serve: 화면에서 게이트를 결정하는 로컬 서버(contract.md 8.3절, 1b N2).
// 결정은 decide와 같은 decideGate를 지나고 같은 오너 키 서명(Touch ID)을 요구한다. 바뀌는 것은 확인을 받는 방법뿐이다.
import { randomBytes, timingSafeEqual } from 'node:crypto'
import {
  renderGatePage,
  renderHandoffPage,
  renderInboxPage,
  renderMessagePage,
  SERVE_CSP,
} from '../core/view/pages'
import { decideGate, gateCheck, gateView, readTask, StaleViewError } from './gates'
import { loadCards, recordShown } from './inbox'
import type { Project } from './project'
import { loadTermBank } from './terms'

export type ServeOptions = {
  project: Project
  /** 오너 키 위치($GOTECHY_HOME) */
  home: string
  /** 0이면 운영체제가 빈 포트를 고른다 */
  port?: number
  now?: () => Date
  /** 결정 뒤 autonomy가 L1 이상이고 막는 사유가 없는 작업을 시작한다. CLI는 runTask, 테스트는 함수 */
  autoRun: (taskId: string) => unknown
  log?: (s: string) => void
}

export type ServeHandle = {
  origin: string
  token: string
  /** 네트워크 없이 요청을 넣는다(테스트에서 Host 같은 헤더를 바꿀 때) */
  handle: (req: Request) => Promise<Response>
  /** 자동 실행으로 시작한 run들 */
  runs: Promise<unknown>[]
  stop: () => void
}

type Session = { csrf: string; shown: Map<string, Date> }

const COOKIE = 'gotechy'
const TASK_PATH = /^\/(T-\d{3,})$/
const GATE_PATH = /^\/(G-\d{3,})$/
const AUTONOMOUS = new Set(['L1', 'L2', 'L3'])

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': SERVE_CSP,
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

const secret = () => randomBytes(32).toString('base64url')

/** 길이가 달라도 시간 차이로 값을 흘리지 않게 해시 길이로 맞춰 비교한다 */
function same(a: string | null | undefined, b: string): boolean {
  if (typeof a !== 'string') return false
  const x = new Bun.CryptoHasher('sha256').update(a).digest()
  const y = new Bun.CryptoHasher('sha256').update(b).digest()
  return timingSafeEqual(x, y) && a.length === b.length
}

function html(body: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { ...HEADERS, ...extra } })
}

const message = (status: number, title: string, lines: string[], back?: string) =>
  html(renderMessagePage(title, lines, back), status)

function cookieOf(req: Request): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE) return v.join('=')
  }
  return undefined
}

export function startServe(o: ServeOptions): ServeHandle {
  const now = o.now ?? (() => new Date())
  const log = o.log ?? (() => {})
  const token = secret()
  const sessions = new Map<string, Session>()
  const runs: Promise<unknown>[] = []
  let origin = ''
  let host = ''

  const sessionOf = (req: Request): Session | undefined => {
    const c = cookieOf(req)
    if (!c) return undefined
    for (const [id, s] of sessions) if (same(c, id)) return s
    return undefined
  }

  async function decide(req: Request, s: Session, gateId: string): Promise<Response> {
    const form = await req.formData().catch(() => undefined)
    const field = (k: string) => {
      const v = form?.get(k)
      return typeof v === 'string' ? v : undefined
    }
    if (!form || !same(field('csrf'), s.csrf))
      return message(403, '결정하지 않았어요', ['이 화면에서 보낸 요청이 아니에요.'])
    const current = gateView(o.project, gateId)
    if (!current) return message(404, '게이트가 없어요', [gateId])
    const choice = field('choice') ?? ''
    if (!current.gate.options.includes(choice))
      return message(
        400,
        '결정하지 않았어요',
        [`선택은 다음 중 하나여야 해요: ${current.gate.options.join(', ')}`],
        `/${gateId}`,
      )
    const answers = current.questions.map((_, i) => field(`answer_${i}`) ?? '')
    let next = 0
    try {
      const shownAt = s.shown.get(gateId)
      const g = await decideGate(o.project, o.home, gateId, {
        choice,
        instruction: field('instruction')?.trim() || null,
        // 폼 제출이 확인 질문의 y를 대신한다. 그다음 서명 도구가 Touch ID를 받는다
        confirm: async () => true,
        answer: async () => answers[next++] ?? '',
        now,
        expectView: field('view') ?? '',
        ...(shownAt ? { shownAt } : {}),
      })
      const lines = [`${g.id}: ${g.resolution}로 결정했어요 (오너 키 ${g.key_id}).`]
      const started = startIfAllowed(g.task)
      if (started) lines.push(`${g.task}을 다시 시작했어요 (autonomy ${started}).`)
      return message(200, '결정했어요', lines)
    } catch (e) {
      const stale = e instanceof StaleViewError
      return message(
        stale ? 409 : 400,
        '결정하지 않았어요',
        [(e as Error).message, '아무것도 기록하지 않았어요.'],
        `/${gateId}`,
      )
    }
  }

  /** 결정으로 작업이 ready가 됐고, autonomy가 허용하고, run의 강제(6.6절)에 걸리지 않으면 시작한다 */
  function startIfAllowed(taskId: string): string | undefined {
    const task = readTask(o.project, taskId)
    if (task?.status !== 'ready' || !AUTONOMOUS.has(task.autonomy)) return undefined
    if (gateCheck(o.project, o.home, task).blockers.length > 0) return undefined
    log(`${taskId} 자동 실행 (autonomy ${task.autonomy})`)
    runs.push(
      Promise.resolve()
        .then(() => o.autoRun(taskId))
        .catch((e) => log(`${taskId} 자동 실행 실패: ${(e as Error).message}`)),
    )
    return task.autonomy
  }

  async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    // DNS rebinding: 다른 이름으로 이 포트에 닿은 요청은 받지 않는다
    if (req.headers.get('host') !== host) return message(403, '허용하지 않는 주소예요', [])
    if (url.pathname === '/auth') {
      if (req.method !== 'GET' || !same(url.searchParams.get('t'), token))
        return message(403, '열 수 없어요', ['serve가 출력한 주소로 다시 여세요.'])
      const id = secret()
      sessions.set(id, { csrf: secret(), shown: new Map() })
      return new Response(null, {
        status: 303,
        headers: {
          ...HEADERS,
          location: '/',
          'set-cookie': `${COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/`,
        },
      })
    }
    const s = sessionOf(req)
    if (!s) return message(403, '열 수 없어요', ['serve가 출력한 주소로 다시 여세요.'])

    if (req.method === 'POST') {
      const fetchSite = req.headers.get('sec-fetch-site')
      if (req.headers.get('origin') !== origin || (fetchSite && fetchSite !== 'same-origin'))
        return message(403, '결정하지 않았어요', ['이 화면에서 보낸 요청이 아니에요.'])
      const m = GATE_PATH.exec(url.pathname)
      if (!m) return message(404, '없는 화면이에요', [])
      return decide(req, s, m[1] as string)
    }
    if (req.method !== 'GET') return message(405, '지원하지 않는 요청이에요', [])

    if (url.pathname === '/')
      return html(
        renderInboxPage(loadCards(o.project, o.project.root, { recordShown: true }), 'serve'),
      )
    const task = TASK_PATH.exec(url.pathname)
    if (task) {
      const card = loadCards(o.project, o.project.root).find(
        (c) => c.id === task[1] && !c.problem && c.handoff,
      )
      if (!card) return message(404, '없는 화면이에요', [])
      return html(renderHandoffPage({ card, terms: loadTermBank(o.project.root), mode: 'serve' }))
    }
    const gate = GATE_PATH.exec(url.pathname)
    if (gate) {
      const id = gate[1] as string
      const v = gateView(o.project, id)
      if (!v) return message(404, '없는 화면이에요', [])
      if (v.gate.status !== 'pending')
        return message(200, `${id}는 이미 결정했어요`, [`고른 것: ${v.gate.resolution ?? ''}`])
      recordShown(o.project, [id])
      s.shown.set(id, now())
      return html(
        renderGatePage({
          id,
          task: v.gate.task,
          title: v.title,
          question: v.gate.question,
          options: v.gate.options,
          recommended: v.gate.recommended ?? null,
          summary: v.summary,
          questions: v.questions,
          csrf: s.csrf,
          view: v.view,
        }),
      )
    }
    return message(404, '없는 화면이에요', [])
  }

  const server = Bun.serve({ hostname: '127.0.0.1', port: o.port ?? 0, fetch: handle })
  host = `127.0.0.1:${server.port}`
  origin = `http://${host}`
  return { origin, token, handle, runs, stop: () => server.stop(true) }
}
