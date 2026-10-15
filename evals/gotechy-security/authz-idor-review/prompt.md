---
description: 주문 조회 API의 객체 단위 인가 누락(IDOR)을 악용 시나리오, ASVS 수준, 리뷰 기록 형식으로 판정하는지 본다
tags: [capability]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Write, Skill]
---

쇼핑몰 주문 조회 API를 새로 만들었어요. 회원 이름, 주소, 전화번호가 들어 있어요. 출시 전에 보안 점검해 주세요. 지금 바꾼 파일은 아래 하나예요.

```ts
// src/api/orders.ts
import { Hono } from 'hono'
import { db } from '../db'
import { requireLogin } from '../auth'

export const orders = new Hono()

orders.get('/api/orders/:id', requireLogin, async (c) => {
  const id = c.req.param('id')
  const order = await db.query('SELECT * FROM orders WHERE id = $1', [id])
  if (!order) return c.json({ error: 'not found' }, 404)
  return c.json(order)
})

orders.patch('/api/orders/:id/address', requireLogin, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  await db.query('UPDATE orders SET address = $1 WHERE id = $2', [body.address, id])
  return c.json({ ok: true })
})
```

`requireLogin`은 세션 쿠키로 로그인만 확인해요. 결과는 나중에 다시 볼 수 있게 남겨 주세요.
