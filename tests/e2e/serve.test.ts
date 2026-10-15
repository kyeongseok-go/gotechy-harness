// contract.md 8.3절: gotechy serve. 화면에서 결정하는 로컬 서버(1b N2, Validation 4~6).
// 서명은 테스트용 가짜 서명 도구(소프트웨어 키)가 한다. 실제 Touch ID는 오너가 scripts/owner-touchid-check.sh로 확인한다.
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  appendFileSync,
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TaskFrontmatter } from '../../src/core/schema'
import { gateCheck, pinOwner, verifyGates } from '../../src/runtime/gates'
import { rotateOwnerKey } from '../../src/runtime/keys'
import { runTask } from '../../src/runtime/run'
import { type ServeHandle, startServe } from '../../src/runtime/serve'
import {
  FAKE,
  fm,
  gateFile,
  handoffFile,
  LIB,
  makeHome,
  makeProject,
  newTask,
  ownerBlob,
  runFake,
  taskFile,
} from './helpers'

let root: string
let home: string
let srv: ServeHandle | undefined
let clock = new Date('2026-10-15T01:00:00Z')

beforeEach(() => {
  root = makeProject()
  home = makeHome()
  clock = new Date('2026-10-15T01:00:00Z')
})
afterEach(() => {
  srv?.stop()
  srv = undefined
})

function serve(over: Partial<Parameters<typeof startServe>[0]> = {}): ServeHandle {
  srv = startServe({ project: { root }, home, now: () => clock, autoRun: () => {}, ...over })
  return srv
}

/** 토큰으로 세션 쿠키를 받는다 */
async function login(s: ServeHandle): Promise<string> {
  const r = await fetch(`${s.origin}/auth?t=${s.token}`, { redirect: 'manual' })
  expect(r.status).toBe(303)
  const cookie = r.headers.get('set-cookie') ?? ''
  return cookie.split(';')[0] as string
}

/** 결정 화면에서 숨은 값(csrf, view)을 읽는다 */
async function formOf(s: ServeHandle, cookie: string, gate: string) {
  const r = await fetch(`${s.origin}/${gate}`, { headers: { cookie } })
  expect(r.status).toBe(200)
  const html = await r.text()
  const field = (name: string) => html.match(new RegExp(`name="${name}" value="([^"]+)"`))?.[1]
  return { html, csrf: field('csrf') as string, view: field('view') as string }
}

async function submit(
  s: ServeHandle,
  cookie: string,
  gate: string,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
) {
  return fetch(`${s.origin}/${gate}`, {
    method: 'POST',
    headers: {
      cookie,
      origin: s.origin,
      'content-type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual',
  })
}

const taskOf = (id: string) => fm(taskFile(root, id)) as unknown as TaskFrontmatter

async function decisionProject() {
  const id = newTask(root, { title: '캐시 설정', verify: 'grep -q 설치 README.md' })
  await runFake(root, home, id, 'needs-decision')
  return id
}

describe('보안 감사 11차 (serve)', () => {
  test('낮음 5: 화면의 첫 결정이 오너 키를 고정하면 커밋하라고 알린다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    const r = await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('처음 고정했어요')
  })

  test('낮음 3: 장부 줄은 남고 결정 파일을 못 쓰면 "기록하지 않았다"고 하지 않는다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    writeFileSync(`${ownerBlob(home)}.delay`, '300')
    const pending = submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })
    await Bun.sleep(100)
    const gates = join(root, 'orchestration', 'gates')
    chmodSync(gates, 0o500)
    try {
      const r = await pending
      expect(r.status).toBe(500)
      const html = await r.text()
      expect(html).toContain('결정을 끝내지 못했어요')
      expect(html).not.toContain('아무것도 기록하지 않았어요')
    } finally {
      chmodSync(gates, 0o700)
    }
  })
})

describe('세션과 요청 검사 (Validation 5)', () => {
  test('토큰이나 세션 쿠키 없이 부르면 403', async () => {
    const s = serve()
    expect((await fetch(`${s.origin}/`)).status).toBe(403)
    expect((await fetch(`${s.origin}/auth?t=wrong`, { redirect: 'manual' })).status).toBe(403)
    expect((await fetch(`${s.origin}/auth`, { redirect: 'manual' })).status).toBe(403)
    expect((await fetch(`${s.origin}/`, { headers: { cookie: 'gotechy=forged' } })).status).toBe(
      403,
    )
  })

  test('맞는 토큰은 HttpOnly, SameSite=Strict 세션 쿠키를 주고 인박스로 보낸다', async () => {
    const s = serve()
    const r = await fetch(`${s.origin}/auth?t=${s.token}`, { redirect: 'manual' })
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/')
    const c = r.headers.get('set-cookie') ?? ''
    expect(c).toContain('HttpOnly')
    expect(c).toContain('SameSite=Strict')
    expect(c).toContain('Path=/')
    const page = await fetch(`${s.origin}/`, { headers: { cookie: c.split(';')[0] as string } })
    expect(page.status).toBe(200)
  })

  test('127.0.0.1에서만 열고, 토큰은 실행마다 다르다', () => {
    const a = serve()
    expect(a.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    const first = a.token
    a.stop()
    const b = serve()
    expect(b.token).not.toBe(first)
    expect(b.token.length).toBeGreaterThanOrEqual(43)
  })

  test('Host가 다르면 세션이 있어도 403 (DNS rebinding)', async () => {
    const s = serve()
    const cookie = await login(s)
    const r = await s.handle(
      new Request(`${s.origin}/`, { headers: { cookie, host: 'evil.example:80' } }),
    )
    expect(r.status).toBe(403)
  })

  test('POST의 Origin이 없거나 다르거나 cross-site면 403이고 기록하지 않는다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    const fields = { choice: '5분', csrf: f.csrf, view: f.view }
    const bad: Record<string, string>[] = [
      { origin: 'http://evil.example' },
      { origin: 'null' },
      { 'sec-fetch-site': 'cross-site' },
    ]
    for (const h of bad) {
      const r = await submit(s, cookie, 'G-001', fields, h)
      expect({ h, status: r.status }).toEqual({ h, status: 403 })
    }
    const noOrigin = await s.handle(
      new Request(`${s.origin}/G-001`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
      }),
    )
    expect(noOrigin.status).toBe(403)
    expect(fm(gateFile(root, 'G-001')).status).toBe('pending')
  })

  test('CSRF 값이 틀리거나 없으면 403이고 기록하지 않는다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    expect(
      (await submit(s, cookie, 'G-001', { choice: '5분', view: f.view, csrf: 'x' })).status,
    ).toBe(403)
    expect((await submit(s, cookie, 'G-001', { choice: '5분', view: f.view })).status).toBe(403)
    expect(fm(gateFile(root, 'G-001')).status).toBe('pending')
  })

  test('낮음 2: 토큰은 한 번만 쓸 수 있다', async () => {
    const s = serve()
    await login(s)
    const again = await fetch(`${s.origin}/auth?t=${s.token}`, { redirect: 'manual' })
    expect(again.status).toBe(403)
  })

  test('낮음 2: 세션은 30분 동안 요청이 없으면 끝난다', async () => {
    const s = serve()
    const cookie = await login(s)
    clock = new Date(clock.getTime() + 31 * 60_000)
    expect((await fetch(`${s.origin}/`, { headers: { cookie } })).status).toBe(403)
  })

  test('낮음 3: 같은 사이트(다른 포트)에서 온 POST도 403', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    const r = await submit(
      s,
      cookie,
      'G-001',
      { choice: '5분', csrf: f.csrf, view: f.view },
      { origin: 'http://127.0.0.1:5173', 'sec-fetch-site': 'same-site' },
    )
    expect(r.status).toBe(403)
    expect(fm(gateFile(root, 'G-001')).status).toBe('pending')
  })

  test('낮음 3: 같은 이름의 가짜 쿠키가 먼저 와도 진짜 세션으로 연다', async () => {
    const s = serve()
    const cookie = await login(s)
    const name = cookie.split('=')[0]
    const r = await fetch(`${s.origin}/`, { headers: { cookie: `${name}=forged; ${cookie}` } })
    expect(r.status).toBe(200)
  })

  test('없는 경로와 형식이 틀린 번호는 404', async () => {
    const s = serve()
    const cookie = await login(s)
    for (const path of ['/G-999', '/T-999', '/nope', '/G-1', '/T-001/../x'])
      expect({
        path,
        status: (await fetch(`${s.origin}${path}`, { headers: { cookie } })).status,
      }).toEqual({
        path,
        status: 404,
      })
  })
})

describe('화면에서 결정 (Validation 4)', () => {
  test('선택하고 제출하면 게이트가 서명되고 gate verify가 ok, 다음 지시도 남는다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    expect(f.html).toContain('캐시 만료를 얼마로 할까요?')
    const r = await submit(s, cookie, 'G-001', {
      choice: '5분',
      instruction: '조회 API에만 적용',
      csrf: f.csrf,
      view: f.view,
    })
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('결정했어요')
    const g = fm(gateFile(root, 'G-001'))
    expect(g.resolution).toBe('5분')
    expect(g.instruction).toBe('조회 API에만 적용')
    expect(verifyGates({ root }, home, ['G-001'])[0]?.status).toBe('ok')
    // 확인 창 문구는 서명 도구가 서명 대상에서 만든다
    expect(readFileSync(`${ownerBlob(home)}.reasons`, 'utf8')).toMatch(
      /^gotechy G-001 T-\d{3}: 5분 \(확인 [0-9A-F]{4}\)\n$/,
    )
  })

  test('active_seconds는 결정 화면을 보여 준 때부터 제출까지다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    clock = new Date(clock.getTime() + 42_000)
    expect(
      (await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })).status,
    ).toBe(200)
    expect(fm(gateFile(root, 'G-001')).active_seconds).toBe(42)
    const events = readFileSync(join(root, 'orchestration', 'private', 'events.jsonl'), 'utf8')
    expect(events).toContain('"gate.shown"')
  })

  test('화면을 그린 뒤 HANDOFF가 바뀌면 409이고 기록하지 않는다', async () => {
    const id = await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    appendFileSync(handoffFile(root, id), '\n')
    const r = await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })
    expect(r.status).toBe(409)
    expect(await r.text()).toContain('새로 고침')
    expect(fm(gateFile(root, 'G-001')).status).toBe('pending')
  })

  test('선택지 밖의 값은 거부하고 기록하지 않는다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    const r = await submit(s, cookie, 'G-001', { choice: '1년', csrf: f.csrf, view: f.view })
    expect(r.status).toBe(400)
    expect(fm(gateFile(root, 'G-001')).status).toBe('pending')
  })

  test('Touch ID를 취소하면 기록하지 않고 이유를 보여 준다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    writeFileSync(`${ownerBlob(home)}.cancel`, '')
    const r = await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })
    expect(r.status).toBe(400)
    expect(await r.text()).toContain('기록하지 않았어요')
    expect(fm(gateFile(root, 'G-001')).status).toBe('pending')
    expect(existsSync(join(root, 'orchestration', 'private', 'decisions.jsonl'))).toBe(false)
  })

  test('이미 결정하고 검증도 통과한 게이트를 다시 제출하면 거부한다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    expect(
      (await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })).status,
    ).toBe(200)
    const again = await submit(s, cookie, 'G-001', { choice: '10분', csrf: f.csrf, view: f.view })
    expect(again.status).toBeGreaterThanOrEqual(400)
    expect(fm(gateFile(root, 'G-001')).resolution).toBe('5분')
  })

  test('되돌리기 어려운 결정은 이해 문항 칸이 있고, 답은 private에만 남는다', async () => {
    const id = newTask(root, { title: '배포 스크립트', gate: 'before', irreversible: true })
    gateCheck({ root }, home, taskOf(id))
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    expect(f.html).toContain('되돌리기 어려운 이유를 자기 말로 설명해 보세요')
    expect(f.html).toContain('name="answer_0"')
    const secret = '운영 서버에 바로 반영되기 때문이에요'
    const r = await submit(s, cookie, 'G-001', {
      choice: '진행',
      answer_0: secret,
      csrf: f.csrf,
      view: f.view,
    })
    expect(r.status).toBe(200)
    expect(await r.text()).not.toContain(secret)
    expect(readFileSync(gateFile(root, 'G-001'), 'utf8')).not.toContain(secret)
    expect(
      readFileSync(join(root, 'orchestration', 'private', 'comprehension.jsonl'), 'utf8'),
    ).toContain(secret)
    expect(fm(gateFile(root, 'G-001')).comprehension).toEqual({ questions: 1, hits: 0, keys: 0 })
  })
})

describe('화면과 이동', () => {
  test('인박스와 HANDOFF 화면의 열린 게이트가 결정 화면으로 이어진다', async () => {
    const id = await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const inbox = await (await fetch(`${s.origin}/`, { headers: { cookie } })).text()
    expect(inbox).toContain('href="/G-001"')
    expect(inbox).toContain(`href="/${id}"`)
    const page = await (await fetch(`${s.origin}/${id}`, { headers: { cookie } })).text()
    expect(page).toContain('href="/G-002"')
  })

  test('HANDOFF 화면의 선택지 버튼은 그 선택을 미리 고른 결정 화면을 연다(선택지에 없는 값은 무시)', async () => {
    const id = await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const page = await (await fetch(`${s.origin}/${id}`, { headers: { cookie } })).text()
    const href = /href="(\/G-\d+\?choice=[^"]+)"/.exec(page)?.[1]
    expect(href).toBeDefined()
    const choice = decodeURIComponent((href ?? '').split('choice=')[1] ?? '')
    const gate = await (await fetch(`${s.origin}${href}`, { headers: { cookie } })).text()
    expect(gate.match(/checked/g)).toHaveLength(1)
    expect(gate).toContain(`value="${choice}" required="" checked`)
    const bad = await (
      await fetch(`${s.origin}${(href ?? '').split('?')[0]}?choice=%22%3E%3Cscript%3E`, {
        headers: { cookie },
      })
    ).text()
    expect(bad).not.toContain('checked')
    expect(bad).not.toContain('<script>')
    // 같은 사이트의 다른 포트 페이지가 보낸 선택은 미리 고르지 않는다(보안 감사 15차 낮음 5)
    const cross = await (
      await fetch(`${s.origin}${href}`, { headers: { cookie, 'sec-fetch-site': 'same-site' } })
    ).text()
    expect(cross).not.toContain('checked')
  })

  test('시작 승인 게이트(HANDOFF 없음)도 인박스에서 결정 화면으로 이어진다', async () => {
    const id = newTask(root, { title: '배포 스크립트', gate: 'before' })
    gateCheck({ root }, home, taskOf(id))
    const s = serve()
    const cookie = await login(s)
    const inbox = await (await fetch(`${s.origin}/`, { headers: { cookie } })).text()
    expect(inbox).toContain('href="/G-001"')
  })

  test('응답 헤더가 프레임, 캐시, 리퍼러를 막고 폼은 같은 출처로만 보낸다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const r = await fetch(`${s.origin}/G-001`, { headers: { cookie } })
    const csp = r.headers.get('content-security-policy') ?? ''
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('script-src')
    expect(r.headers.get('x-frame-options')).toBe('DENY')
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(r.headers.get('referrer-policy')).toBe('same-origin')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
  })

  test('악성 HANDOFF가 든 결정 화면에도 스크립트와 이벤트 속성이 없다', async () => {
    const id = await decisionProject()
    const h = handoffFile(root, id)
    writeFileSync(
      h,
      readFileSync(h, 'utf8').replace(
        '캐시 만료를 얼마로 할까요?',
        '캐시 만료를 얼마로 할까요? <script>alert(1)</script><img src=x onerror=alert(1)>',
      ),
    )
    const s = serve()
    const cookie = await login(s)
    for (const path of ['/', `/${id}`]) {
      const html = await (await fetch(`${s.origin}${path}`, { headers: { cookie } })).text()
      let scripts = 0
      let handlers = 0
      new HTMLRewriter()
        .on('script', { element: () => void scripts++ })
        .on('*', {
          element: (el) => {
            for (const [name] of el.attributes) if (name.startsWith('on')) handlers++
          },
        })
        .transform(new Response(html))
      expect({ path, scripts, handlers }).toEqual({ path, scripts: 0, handlers: 0 })
    }
  })
})

describe('결정 뒤 자동 실행 (Validation 6)', () => {
  test('autonomy L1이면 결정 뒤 사람 손 없이 다음 run을 시작한다', async () => {
    const id = newTask(root, {
      title: '설치 줄',
      gate: 'before',
      autonomy: 'L1',
      verify: 'grep -q 설치 README.md',
    })
    gateCheck({ root }, home, taskOf(id))
    const started: string[] = []
    const s = serve({
      autoRun: async (taskId) => {
        started.push(taskId)
        await runFake(root, home, taskId, 'readme-ok')
      },
    })
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    const r = await submit(s, cookie, 'G-001', { choice: '진행', csrf: f.csrf, view: f.view })
    expect(await r.text()).toContain(`${id} 실행을 시작했어요`)
    await Promise.all(s.runs)
    expect(started).toEqual([id])
    expect(taskOf(id).status).toBe('done')
  })

  test('autonomy L0이면 결정만 기록하고 run을 시작하지 않는다', async () => {
    const id = newTask(root, { title: '설치 줄', gate: 'before' })
    gateCheck({ root }, home, taskOf(id))
    const started: string[] = []
    const s = serve({ autoRun: (taskId) => void started.push(taskId) })
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    const r = await submit(s, cookie, 'G-001', { choice: '진행', csrf: f.csrf, view: f.view })
    expect(r.status).toBe(200)
    expect(started).toEqual([])
  })

  test('막는 결정이 남아 있으면 L1이어도 시작하지 않고, 모두 닫히면 시작한다', async () => {
    const id = newTask(root, {
      title: '캐시 설정',
      autonomy: 'L1',
      verify: 'grep -q 설치 README.md',
    })
    await runFake(root, home, id, 'needs-decision')
    const started: string[] = []
    const s = serve({ autoRun: (taskId) => void started.push(taskId) })
    const cookie = await login(s)
    const f1 = await formOf(s, cookie, 'G-001')
    await submit(s, cookie, 'G-001', { choice: '5분', csrf: f1.csrf, view: f1.view })
    expect(started).toEqual([])
    const f2 = await formOf(s, cookie, 'G-002')
    await submit(s, cookie, 'G-002', { choice: '넣기', csrf: f2.csrf, view: f2.view })
    expect(started).toEqual([id])
  })

  test('결과를 승인해 done으로 남은 작업은 L1이어도 다시 시작하지 않는다', async () => {
    const id = newTask(root, {
      title: '설치 줄',
      gate: 'after',
      autonomy: 'L1',
      verify: 'grep -q 설치 README.md',
    })
    await runFake(root, home, id, 'readme-ok')
    const started: string[] = []
    const s = serve({ autoRun: (taskId) => void started.push(taskId) })
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    expect(
      (await submit(s, cookie, 'G-001', { choice: '승인', csrf: f.csrf, view: f.view })).status,
    ).toBe(200)
    expect(taskOf(id).status).toBe('done')
    expect(started).toEqual([])
  })

  test('중단을 고르면 L1이어도 시작하지 않는다', async () => {
    const id = newTask(root, { title: '설치 줄', gate: 'before', autonomy: 'L1' })
    gateCheck({ root }, home, taskOf(id))
    const started: string[] = []
    const s = serve({ autoRun: (taskId) => void started.push(taskId) })
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    await submit(s, cookie, 'G-001', { choice: '중단', csrf: f.csrf, view: f.view })
    expect(started).toEqual([])
  })
})

describe('보안 감사 8차', () => {
  test('중간 1: Referrer-Policy는 same-origin이다 (no-referrer면 브라우저가 Origin: null을 보낸다)', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const r = await fetch(`${s.origin}/G-001`, { headers: { cookie } })
    expect(r.headers.get('referrer-policy')).toBe('same-origin')
    expect(await r.text()).toContain('<meta name="referrer" content="same-origin"/>')
  })

  test('중간 2: 같은 게이트에 동시에 두 번 제출하면 하나만 결정하고 잠금은 남지 않는다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    writeFileSync(`${ownerBlob(home)}.delay`, '400')
    const both = await Promise.all([
      submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view }),
      Bun.sleep(50).then(() =>
        submit(s, cookie, 'G-001', { choice: '1분', csrf: f.csrf, view: f.view }),
      ),
    ])
    expect(both.map((r) => r.status).sort()).toEqual([200, 409])
    expect(fm(gateFile(root, 'G-001')).resolution).toBe('5분')
    expect(existsSync(`${gateFile(root, 'G-001')}.lock`)).toBe(false)
  })

  test('중간 5: 결정 화면의 확인 코드가 Touch ID 창 문구에도 들어가고, 작업 번호도 보인다', async () => {
    const id = await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    const code = f.html.match(/확인 코드 <strong>([0-9A-F]{4})<\/strong>/)?.[1]
    expect(code).toBeTruthy()
    expect(
      (await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })).status,
    ).toBe(200)
    expect(readFileSync(`${ownerBlob(home)}.reasons`, 'utf8')).toBe(
      `gotechy G-001 ${id}: 5분 (확인 ${code})\n`,
    )
  })

  const collidingFixture = (options: string) => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-fx8-')))
    const h = readFileSync(join(FAKE, 'needs-decision', 'handoff.md'), 'utf8').replace(
      '선택지: 5분, 1분',
      `선택지: ${options}`,
    )
    writeFileSync(join(dir, 'handoff.md'), h)
    cpSync(join(FAKE, 'needs-decision', 'files'), join(dir, 'files'), { recursive: true })
    return dir
  }

  test('중간 5: 보이지 않는 글자(형식 문자)가 든 HANDOFF는 lint가 거부하고 게이트를 열지 않는다', async () => {
    const id = newTask(root, { title: '캐시 설정', verify: 'grep -q 설치 README.md' })
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: collidingFixture('5분, 5분\u200b'),
      home,
    })
    expect(out.status).toBe('failed')
    expect(out.messages.join('\n')).toContain('U+200B')
    expect(existsSync(gateFile(root, 'G-001'))).toBe(false)
  })

  test('중간 5: 호환 글자만 다른 선택지(전각 숫자)로는 게이트를 열지 않는다', async () => {
    const id = newTask(root, { title: '캐시 설정', verify: 'grep -q 설치 README.md' })
    const out = await runTask({ root }, id, {
      adapter: 'fake',
      fixtureDir: collidingFixture('5분, ５분'),
      home,
    }).catch((e: Error) => ({ status: 'threw', messages: [e.message] }))
    const note = existsSync(handoffFile(root, id))
      ? String(fm(handoffFile(root, id)).lead_note ?? '')
      : ''
    expect(`${out.messages.join('\n')}${note}`).toContain('구분되지 않아요')
    expect(existsSync(gateFile(root, 'G-001'))).toBe(false)
  })

  test('낮음 1: 기록한 뒤 단계에서 오류가 나면 "기록하지 않았어요"라고 하지 않는다', async () => {
    const id = newTask(root, { gate: 'after', verify: 'grep -q 설치 README.md' })
    await runFake(root, home, id, 'readme-ok')
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    chmodSync(taskFile(root, id), 0o444)
    try {
      const r = await submit(s, cookie, 'G-001', { choice: '다시', csrf: f.csrf, view: f.view })
      const text = await r.text()
      expect(r.status).toBe(500)
      expect(text).toContain('결정은 기록했어요')
      expect(text).not.toContain('아무것도 기록하지 않았어요')
      expect(fm(gateFile(root, 'G-001')).status).toBe('resolved')
    } finally {
      chmodSync(taskFile(root, id), 0o644)
    }
  })

  test('낮음 4: 검증에 실패하는 결정은 사유와 함께 다시 결정할 수 있고, 지난 판본은 기록으로만 보여 준다', async () => {
    const id = await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    expect(
      (await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })).status,
    ).toBe(200)
    rotateOwnerKey(home, LIB)
    await pinOwner({ root }, home, { confirm: async () => true })
    const again = await formOf(s, cookie, 'G-001')
    expect(again.html).toContain('검증에 실패해서 다시 결정해요')
    // 두 결정을 모두 닫고 다시 돌리면 HANDOFF 판본이 올라 G-001은 지난 판본이 된다
    expect(
      (await submit(s, cookie, 'G-001', { choice: '5분', csrf: again.csrf, view: again.view }))
        .status,
    ).toBe(200)
    const g2 = await formOf(s, cookie, 'G-002')
    expect(
      (await submit(s, cookie, 'G-002', { choice: '넣기', csrf: g2.csrf, view: g2.view })).status,
    ).toBe(200)
    await runFake(root, home, id, 'readme-ok')
    const old = await (await fetch(`${s.origin}/G-001`, { headers: { cookie } })).text()
    expect(old).toContain('지난 판본')
  })

  test('낮음 3: 같은 사이트의 다른 페이지가 먼저 불러도 화면 기준 시각과 확인 코드는 오너의 화면에서 정한다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const pre = await s.handle(
      new Request(`${s.origin}/G-001`, {
        headers: { cookie, host: s.origin.slice('http://'.length), 'sec-fetch-site': 'same-site' },
      }),
    )
    const preCode = (await pre.text()).match(/확인 코드 <strong>([0-9A-F]{4})/)?.[1]
    clock = new Date(clock.getTime() + 100_000)
    const f = await formOf(s, cookie, 'G-001')
    expect(f.html.match(/확인 코드 <strong>([0-9A-F]{4})/)?.[1]).not.toBe(preCode)
    clock = new Date(clock.getTime() + 42_000)
    expect(
      (await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })).status,
    ).toBe(200)
    expect(fm(gateFile(root, 'G-001')).active_seconds).toBe(42)
  })

  test('낮음 4: 결정 화면이 HANDOFF 판본, autonomy, 예산을 보여 준다', async () => {
    await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    expect(f.html).toContain('HANDOFF rev 1')
    expect(f.html).toContain('autonomy L0')
  })

  test('낮음 7: events.jsonl에 깨진 gate.shown 줄이 있어도 화면이 열린다', async () => {
    await decisionProject()
    appendFileSync(
      join(root, 'orchestration', 'private', 'events.jsonl'),
      '{"type":"gate.shown",\n',
    )
    const s = serve()
    const cookie = await login(s)
    expect((await fetch(`${s.origin}/`, { headers: { cookie } })).status).toBe(200)
    expect((await fetch(`${s.origin}/G-001`, { headers: { cookie } })).status).toBe(200)
  })

  test('보안 헤더는 200이 아닌 응답(303, 403, 404, 409)에도 붙는다', async () => {
    const id = await decisionProject()
    const s = serve()
    const auth = await fetch(`${s.origin}/auth?t=${s.token}`, { redirect: 'manual' })
    const cookie = (auth.headers.get('set-cookie') ?? '').split(';')[0] as string
    const f = await formOf(s, cookie, 'G-001')
    appendFileSync(handoffFile(root, id), '\n')
    const responses = [
      auth,
      await fetch(`${s.origin}/`),
      await fetch(`${s.origin}/nope`, { headers: { cookie } }),
      await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view }),
    ]
    expect(responses.map((r) => r.status)).toEqual([303, 403, 404, 409])
    for (const r of responses) {
      expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
      expect(r.headers.get('x-frame-options')).toBe('DENY')
      expect(r.headers.get('cache-control')).toBe('no-store')
    }
  })

  test('게이트 파일이나 작업 명세가 바뀌면 409, 작업 상태만 바뀌면 결정할 수 있다', async () => {
    const id = await decisionProject()
    const s = serve()
    const cookie = await login(s)
    const g = gateFile(root, 'G-001')
    let f = await formOf(s, cookie, 'G-001')
    writeFileSync(
      g,
      readFileSync(g, 'utf8').replace('캐시 만료를 얼마로 할까요?', '캐시 만료를 얼마로 할까요??'),
    )
    expect(
      (await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })).status,
    ).toBe(409)
    f = await formOf(s, cookie, 'G-001')
    const t = taskFile(root, id)
    writeFileSync(t, readFileSync(t, 'utf8').replace('title: 캐시 설정', 'title: 캐시 설정 바꿈'))
    expect(
      (await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })).status,
    ).toBe(409)
    f = await formOf(s, cookie, 'G-001')
    writeFileSync(t, readFileSync(t, 'utf8').replace('status: needs-decision', 'status: ready'))
    expect(
      (await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })).status,
    ).toBe(200)
  })

  test('악성 질문이 든 결정 화면과 오류 화면에도 스크립트가 없다', async () => {
    const id = await decisionProject()
    const g = gateFile(root, 'G-001')
    writeFileSync(
      g,
      readFileSync(g, 'utf8').replace(
        '캐시 만료를 얼마로 할까요?',
        '캐시 <script>alert(1)</script><img src=x onerror=alert(1)>',
      ),
    )
    const s = serve()
    const cookie = await login(s)
    const f = await formOf(s, cookie, 'G-001')
    appendFileSync(handoffFile(root, id), '\n')
    const err = await submit(s, cookie, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })
    for (const html of [f.html, await err.text()]) {
      let scripts = 0
      let handlers = 0
      new HTMLRewriter()
        .on('script', { element: () => void scripts++ })
        .on('*', {
          element: (el) => {
            for (const [name] of el.attributes) if (name.startsWith('on')) handlers++
          },
        })
        .transform(new Response(html))
      expect({ scripts, handlers }).toEqual({ scripts: 0, handlers: 0 })
    }
  })

  test('중간 4: serve는 대화형 터미널이 아니면 열지 않고 토큰도 출력하지 않는다', () => {
    const r = Bun.spawnSync({
      cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), 'serve'],
      cwd: root,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { PATH: process.env.PATH ?? '', HOME: home, GOTECHY_HOME: home },
      timeout: 10_000,
    })
    expect(r.exitCode).toBe(2)
    expect(`${r.stdout}${r.stderr}`).not.toContain('t=')
  })
})

describe('중간 3: 같은 작업은 한 번에 하나의 run만', () => {
  test('살아 있는 run이 잡은 작업은 거부하고, 죽은 run의 잠금은 회수한다', async () => {
    const id = newTask(root, { verify: 'grep -q 설치 README.md' })
    const lock = join(root, 'orchestration', 'private', `run-${id}.lock`)
    mkdirSync(lock, { recursive: true })
    writeFileSync(join(lock, 'pid'), String(process.pid))
    const busy = await runFake(root, home, id, 'readme-ok')
    expect(busy.status).toBe('refused')
    expect(busy.messages.join('\n')).toContain('다른 run')
    writeFileSync(join(lock, 'pid'), '999999')
    expect((await runFake(root, home, id, 'readme-ok')).status).toBe('done')
    expect(existsSync(lock)).toBe(false)
  })

  test('실행 중인 작업의 게이트를 다시 결정해도 두 번 시작하지 않는다', async () => {
    const id = newTask(root, { title: '설치 줄', gate: 'before', autonomy: 'L1' })
    gateCheck({ root }, home, taskOf(id))
    let release: () => void = () => {}
    const started: string[] = []
    const s = serve({
      autoRun: (taskId) => {
        started.push(taskId)
        return new Promise<void>((r) => {
          release = r
        })
      },
    })
    const cookie = await login(s)
    const f1 = await formOf(s, cookie, 'G-001')
    expect(
      (await submit(s, cookie, 'G-001', { choice: '진행', csrf: f1.csrf, view: f1.view })).status,
    ).toBe(200)
    // 키를 바꾸면 G-001이 검증에 실패해 다시 결정할 수 있다. 그동안 첫 run은 아직 돌고 있다
    rotateOwnerKey(home, LIB)
    await pinOwner({ root }, home, { confirm: async () => true })
    const f2 = await formOf(s, cookie, 'G-001')
    expect(
      (await submit(s, cookie, 'G-001', { choice: '진행', csrf: f2.csrf, view: f2.view })).status,
    ).toBe(200)
    expect(started).toEqual([id])
    release()
    await Promise.all(s.runs)
  })

  test('serve는 자동 실행 중인 작업을 다시 시작하지 않는다', async () => {
    const id = newTask(root, {
      title: '캐시 설정',
      autonomy: 'L1',
      verify: 'grep -q 설치 README.md',
    })
    await runFake(root, home, id, 'needs-decision')
    let release: () => void = () => {}
    const started: string[] = []
    const s = serve({
      autoRun: (taskId) => {
        started.push(taskId)
        return new Promise<void>((r) => {
          release = r
        })
      },
    })
    const cookie = await login(s)
    for (const [gate, choice] of [
      ['G-001', '5분'],
      ['G-002', '넣기'],
    ] as const) {
      const f = await formOf(s, cookie, gate)
      await submit(s, cookie, gate, { choice, csrf: f.csrf, view: f.view })
    }
    expect(started).toEqual([id])
    expect(s.running()).toEqual([id])
    release()
    await Promise.all(s.runs)
    expect(s.running()).toEqual([])
  })
})
