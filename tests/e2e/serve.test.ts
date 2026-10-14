// contract.md 8.3절: gotechy serve. 화면에서 결정하는 로컬 서버(1b N2, Validation 4~6).
// 서명은 테스트용 가짜 서명 도구(소프트웨어 키)가 한다. 실제 Touch ID는 오너가 scripts/owner-touchid-check.sh로 확인한다.
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskFrontmatter } from '../../src/core/schema'
import { gateCheck, verifyGates } from '../../src/runtime/gates'
import { type ServeHandle, startServe } from '../../src/runtime/serve'
import {
  fm,
  gateFile,
  handoffFile,
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

  test('다른 세션의 CSRF 값으로는 결정하지 못한다', async () => {
    await decisionProject()
    const s = serve()
    const a = await login(s)
    const b = await login(s)
    const f = await formOf(s, a, 'G-001')
    expect(
      (await submit(s, b, 'G-001', { choice: '5분', csrf: f.csrf, view: f.view })).status,
    ).toBe(403)
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
    expect(readFileSync(`${ownerBlob(home)}.reasons`, 'utf8')).toBe('gotechy G-001: 5분\n')
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
    expect(r.headers.get('referrer-policy')).toBe('no-referrer')
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
    expect(await r.text()).toContain(`${id}을 다시 시작했어요`)
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
