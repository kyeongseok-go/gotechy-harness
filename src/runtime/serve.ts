// gotechy serve: 화면에서 게이트를 결정하는 로컬 서버(contract.md 8.3절, 1b N2).
// 결정은 decide와 같은 decideGate를 지나고 같은 오너 키 서명(Touch ID)을 요구한다. 바뀌는 것은 확인을 받는 방법뿐이다.
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import {
  renderGatePage,
  renderHandoffPage,
  renderInboxPage,
  renderMessagePage,
  SERVE_CSP,
} from '../core/view/pages'
import {
  decideGate,
  gateCheck,
  gateView,
  nonceInLedger,
  readTask,
  StaleViewError,
  verifyGates,
} from './gates'
import { loadCards, recordShown } from './inbox'
import { appendEvent, type Project, paths } from './project'
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
  /** serve 터미널에 남길 기록(세션, 제출, 자동 실행). 오너가 자기가 하지 않은 제출을 알아보게 한다 */
  log?: (s: string) => void
}

export type ServeHandle = {
  origin: string
  token: string
  /** 네트워크 없이 요청을 넣는다(테스트에서 Host 같은 헤더를 바꿀 때) */
  handle: (req: Request) => Promise<Response>
  /** 자동 실행으로 시작한 run들 */
  runs: Promise<unknown>[]
  /** 지금 자동 실행 중인 작업 */
  running: () => string[]
  stop: () => void
}

type Session = {
  csrf: string
  lastSeen: number
  /** 게이트마다 결정 화면을 처음 보여 준 시각과, 그 화면의 nonce(확인 코드의 원천) */
  shown: Map<string, Date>
  nonces: Map<string, string>
}

/** 세션은 이 시간 동안 요청이 없으면 끝난다 */
export const SESSION_IDLE_MS = 30 * 60_000
const TASK_PATH = /^\/(T-\d{3,})$/
const GATE_PATH = /^\/(G-\d{3,})$/
const AUTONOMOUS = new Set(['L1', 'L2', 'L3'])

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': SERVE_CSP,
  'x-frame-options': 'DENY',
  // no-referrer면 Chrome이 같은 출처 폼 POST에도 Origin: null을 보내 오너의 제출이 막힌다(2026-10-15 실험, 감사 8차 중간 1)
  'referrer-policy': 'same-origin',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

const secret = () => randomBytes(32).toString('base64url')

/** 길이가 달라도 시간 차이로 값을 흘리지 않게 해시로 맞춰 비교한다 */
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

export function startServe(o: ServeOptions): ServeHandle {
  const now = o.now ?? (() => new Date())
  const log = o.log ?? (() => {})
  const token = secret()
  let tokenUsed = false
  const sessions = new Map<string, Session>()
  /** 결정 중인 게이트. 같은 게이트의 두 번째 제출은 기다리지 않고 409(감사 8차 중간 2) */
  const deciding = new Set<string>()
  /** 자동 실행 중인 작업. serve가 같은 작업을 두 번 시작하지 않는다(감사 8차 중간 3) */
  const running = new Set<string>()
  const runs: Promise<unknown>[] = []
  let origin = ''
  let host = ''
  let cookieName = ''

  /** 같은 이름의 쿠키가 여럿이면(다른 로컬 서버가 심은 것 포함) 모두 맞춰 본다(감사 8차 낮음 3) */
  const sessionOf = (req: Request): Session | undefined => {
    const values: string[] = []
    for (const part of (req.headers.get('cookie') ?? '').split(';')) {
      const [k, ...v] = part.trim().split('=')
      if (k === cookieName) values.push(v.join('='))
    }
    for (const [id, s] of sessions)
      if (values.some((v) => same(v, id))) {
        if (now().getTime() - s.lastSeen > SESSION_IDLE_MS) {
          sessions.delete(id)
          return undefined
        }
        s.lastSeen = now().getTime()
        return s
      }
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
    const nonce = s.nonces.get(gateId)
    if (!nonce)
      return message(
        409,
        '결정하지 않았어요',
        ['결정 화면을 먼저 열어 확인 코드를 보세요.'],
        `/${gateId}`,
      )
    if (deciding.has(gateId))
      return message(409, '결정하지 않았어요', [
        `${gateId}의 다른 결정이 진행 중이에요. Touch ID 창을 확인하고, 끝나면 새로 고침하세요.`,
      ])
    deciding.add(gateId)
    log(`제출: ${gateId} ${choice} (확인 ${nonce.slice(0, 4).toUpperCase()})`)
    const answers = current.questions.map((_, i) => field(`answer_${i}`) ?? '')
    let next = 0
    const pinnedBefore = existsSync(paths.ownerPin(o.project))
    try {
      const shownAt = s.shown.get(gateId)
      const g = await decideGate(o.project, o.home, gateId, {
        choice,
        instruction: field('instruction')?.trim() || null,
        // 폼 제출이 확인 질문의 y를 대신한다. 그다음 서명 도구가 Touch ID를 받는다
        confirm: async () => true,
        answer: async () => answers[next++] ?? '',
        now,
        nonce,
        expectView: field('view') ?? '',
        ...(shownAt ? { shownAt } : {}),
      })
      s.nonces.delete(gateId)
      s.shown.delete(gateId)
      log(`결정함: ${g.id} ${g.resolution}`)
      const lines = [`${g.id}: ${g.resolution}로 결정했어요 (오너 키 ${g.key_id}).`]
      // 첫 결정이 프로젝트에 오너 키를 고정했으면 커밋하라고 알린다. 커밋해야 키가 바뀐 것이 git diff에 드러난다(감사 11차 낮음 5)
      if (!pinnedBefore && existsSync(paths.ownerPin(o.project))) {
        const pinNote =
          '이 프로젝트에 오너 키를 처음 고정했어요(orchestration/owner.pub). 이 파일을 커밋하세요.'
        lines.push(pinNote)
        log(pinNote)
      }
      try {
        const started = startIfAllowed(g.task)
        if (started)
          lines.push(
            `${g.task} 실행을 시작했어요 (autonomy ${started}). 결과는 serve 터미널과 인박스에서 보세요.`,
          )
      } catch (e) {
        lines.push(`자동 실행은 시작하지 못했어요: ${(e as Error).message}`)
      }
      return message(200, '결정했어요', lines)
    } catch (e) {
      // 기록 뒤 단계에서 난 오류면 "기록하지 않았다"고 말하지 않는다(감사 8차 낮음 1)
      const recorded = gateView(o.project, gateId)?.gate.nonce === nonce
      // 장부 줄만 남고 결정 파일을 못 썼으면 "아무것도 기록하지 않았다"고 하지 않는다(감사 11차 낮음 3)
      const partial = !recorded && nonceInLedger(o.project, nonce)
      log(
        `${recorded ? '기록 뒤 오류' : partial ? '결정 못 끝냄' : '결정 안 함'}: ${gateId} ${(e as Error).message}`,
      )
      if (partial)
        return message(500, '결정을 끝내지 못했어요', [
          `${gateId}의 서명과 장부 줄은 남았지만 결정 파일을 쓰지 못했어요: ${(e as Error).message}`,
          '이 게이트는 결정 전으로 남아 있어요. 새로 고침해서 다시 결정하세요.',
        ])
      if (recorded)
        return message(500, '결정은 기록했어요', [
          `${gateId}의 결정은 서명해 기록했지만, 그 뒤 단계에서 오류가 났어요: ${(e as Error).message}`,
          'gotechy gate verify로 확인하세요.',
        ])
      const stale = e instanceof StaleViewError
      return message(
        stale ? 409 : 400,
        '결정하지 않았어요',
        [(e as Error).message, '아무것도 기록하지 않았어요.'],
        `/${gateId}`,
      )
    } finally {
      deciding.delete(gateId)
    }
  }

  /** 결정으로 작업이 ready가 됐고, autonomy가 허용하고, run의 강제(6.6절)에 걸리지 않으면 시작한다 */
  function startIfAllowed(taskId: string): string | undefined {
    const task = readTask(o.project, taskId)
    if (task?.status !== 'ready' || !AUTONOMOUS.has(task.autonomy)) return undefined
    if (running.has(taskId)) return undefined
    if (gateCheck(o.project, o.home, task).blockers.length > 0) return undefined
    running.add(taskId)
    log(`${taskId} 자동 실행 시작 (autonomy ${task.autonomy})`)
    runs.push(
      Promise.resolve()
        .then(() => o.autoRun(taskId))
        .then(
          () => appendEvent(o.project, { type: 'run.auto', task: taskId, ok: true }),
          (e) => {
            log(`${taskId} 자동 실행 실패: ${(e as Error).message}`)
            appendEvent(o.project, { type: 'run.auto', task: taskId, ok: false })
          },
        )
        .finally(() => running.delete(taskId)),
    )
    return task.autonomy
  }

  function gatePage(req: Request, s: Session, id: string): Response {
    const v = gateView(o.project, id)
    if (!v) return message(404, '없는 화면이에요', [])
    const verdict = verifyGates(o.project, o.home, [id])[0]
    if (verdict?.status === 'ok')
      return message(200, `${id}는 이미 결정했어요`, [`고른 것: ${v.gate.resolution ?? ''}`])
    if (verdict?.status === 'superseded')
      return message(200, `${id}는 지난 판본의 게이트예요`, [
        '기록으로만 남아요. 인박스에서 지금 판본의 게이트를 보세요.',
      ])
    // 같은 사이트(다른 포트)의 페이지가 이 주소를 불러도 측정값과 확인 코드를 바꾸지 못하게 한다(감사 8차 낮음 3)
    const site = req.headers.get('sec-fetch-site')
    const ownView = !site || site === 'same-origin' || site === 'none'
    if (ownView && !s.shown.has(id)) {
      recordShown(o.project, [id])
      s.shown.set(id, now())
    }
    let nonce = s.nonces.get(id)
    if (!nonce) {
      nonce = randomBytes(16).toString('hex')
      if (ownView) s.nonces.set(id, nonce)
    }
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
        code: nonce.slice(0, 4).toUpperCase(),
        handoffRev: v.gate.handoff_rev,
        handoffSha: v.handoffSha,
        autonomy: v.autonomy,
        budgetUsd: v.budgetUsd,
        failing: verdict?.status === 'fail' ? verdict.reasons : [],
      }),
    )
  }

  async function route(req: Request): Promise<Response> {
    const url = new URL(req.url)
    // DNS rebinding: 다른 이름으로 이 포트에 닿은 요청은 받지 않는다
    if (req.headers.get('host') !== host) return message(403, '허용하지 않는 주소예요', [])
    if (url.pathname === '/auth') {
      // 토큰은 한 번만 쓴다. 브라우저 기록에 남은 주소로 다시 세션을 만들지 못한다(감사 8차 낮음 2)
      if (req.method !== 'GET' || tokenUsed || !same(url.searchParams.get('t'), token))
        return message(403, '열 수 없어요', [
          '이 주소는 이미 썼거나 맞지 않아요. 다른 창에서 열려면 serve를 다시 시작하세요.',
        ])
      tokenUsed = true
      const id = secret()
      sessions.set(id, {
        csrf: secret(),
        lastSeen: now().getTime(),
        shown: new Map(),
        nonces: new Map(),
      })
      log('화면 세션을 열었어요')
      return new Response(null, {
        status: 303,
        headers: {
          ...HEADERS,
          location: '/',
          'set-cookie': `${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=/`,
        },
      })
    }
    const s = sessionOf(req)
    if (!s) return message(403, '열 수 없어요', ['serve를 다시 시작하고 새 주소로 여세요.'])

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
    if (gate) return gatePage(req, s, gate[1] as string)
    return message(404, '없는 화면이에요', [])
  }

  /** 예외가 나도 스택을 보여 주지 않고 같은 보안 헤더로 500을 돌려준다(감사 8차 낮음 7) */
  async function handle(req: Request): Promise<Response> {
    try {
      return await route(req)
    } catch (e) {
      log(`오류: ${(e as Error).message}`)
      return message(500, '오류가 났어요', ['serve 터미널의 기록을 보세요.'])
    }
  }

  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: o.port ?? 0,
    development: false,
    fetch: handle,
    error: () => message(500, '오류가 났어요', ['serve 터미널의 기록을 보세요.']),
  })
  host = `127.0.0.1:${server.port}`
  origin = `http://${host}`
  // 포트마다 다른 이름. 127.0.0.1의 다른 포트 서버와 쿠키가 섞이지 않게 한다
  cookieName = `gotechy_${server.port}`
  return {
    origin,
    token,
    handle,
    runs,
    running: () => [...running],
    stop: () => server.stop(true),
  }
}
