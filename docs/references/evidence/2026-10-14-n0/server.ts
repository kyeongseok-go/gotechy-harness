// N0 실험 3: 127.0.0.1 서버가 요청을 받으면 Swift 도구로 서명하고, 같은 프로세스에서 검증한다.
import { createPublicKey, verify } from 'node:crypto'
const dir = import.meta.dir
const pub = (await Bun.$`${dir}/ownerkey pub ${dir}/np.blob`.text()).trim()
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(req) {
    const msg = await req.text()
    const p = Bun.spawn([`${dir}/ownerkey`, 'sign', `${dir}/np.blob`], { stdin: new Blob([msg]), stdout: 'pipe', env: process.env })
    const sig = (await new Response(p.stdout).text()).trim()
    const key = createPublicKey({ key: Buffer.from(pub, 'base64'), format: 'der', type: 'spki' })
    const ok = verify('sha256', Buffer.from(msg), { key, dsaEncoding: 'der' }, Buffer.from(sig, 'base64'))
    return new Response(JSON.stringify({ exit: await p.exited, ok }))
  },
})
const r = await fetch(`http://127.0.0.1:${server.port}/decide`, { method: 'POST', body: '{"gate_id":"G-002"}' })
console.log(`포트 ${server.port}, 응답 ${await r.text()}`)
server.stop()
