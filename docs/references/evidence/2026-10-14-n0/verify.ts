import { verify, createPublicKey } from 'node:crypto'
const [pubB64, sigB64, msg] = process.argv.slice(2) as [string, string, string]
const key = createPublicKey({ key: Buffer.from(pubB64, 'base64'), format: 'der', type: 'spki' })
const ok = verify('sha256', Buffer.from(msg), { key, dsaEncoding: 'der' }, Buffer.from(sigB64, 'base64'))
const bad = verify('sha256', Buffer.from(`${msg}x`), { key, dsaEncoding: 'der' }, Buffer.from(sigB64, 'base64'))
console.log(`곡선 ${key.asymmetricKeyDetails?.namedCurve}, 원문 검증 ${ok}, 바꾼 원문 검증 ${bad}`)
