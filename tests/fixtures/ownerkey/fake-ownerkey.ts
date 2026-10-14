// 테스트용 오너 키 도구. native/ownerkey.swift와 같은 명령, 출력, 종료 코드를 소프트웨어 키로 흉내 낸다(사람 확인 없음).
// 실제 도구와 달리 blob에 개인 키(PKCS8 PEM)를 그대로 둔다. 테스트 전용이고 src에서는 쓰지 않는다.
// 오너의 취소를 흉내 내려면 <blob>.cancel 파일을 둔다(exit 4). 확인 창 문구는 <blob>.reasons에 줄마다 남긴다.
// 오너가 창을 읽느라 늦는 것을 흉내 내려면 <blob>.delay에 밀리초를 적는다.
// 실제 도구처럼 메시지는 [결정 서명 대상, 그 장부 줄] 두 개만 받고, 문구는 서명 대상에서 만든다. probe는 늘 사람 확인이 있는 척한다.
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
} from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const [cmd, blob] = process.argv.slice(2)
const fail = (msg: string, code = 1): never => {
  process.stderr.write(`${msg}\n`)
  process.exit(code)
}
if (!cmd || !blob) fail('사용법: gotechy-ownerkey create|pub|probe|sign <blob>', 2)
const pubText = (pem: string) =>
  createPublicKey(createPrivateKey(pem)).export({ format: 'der', type: 'spki' }).toString('base64')

if (cmd === 'create') {
  if (existsSync(blob as string)) fail('키를 만들 수 없어요: 이미 있어요')
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
  writeFileSync(blob as string, pem, { mode: 0o600, flag: 'wx' })
  console.log(pubText(pem))
} else if (cmd === 'pub') {
  console.log(pubText(readFileSync(blob as string, 'utf8')))
} else if (cmd === 'probe') {
  console.log('ok')
} else if (cmd === 'sign') {
  const messages = JSON.parse(await Bun.stdin.text()) as unknown
  const bad = () =>
    fail('서명 입력은 [결정 서명 대상, 그 결정의 장부 줄] 두 개여야 해요. 서명하지 않았어요', 2)
  if (!Array.isArray(messages) || messages.length !== 2) bad()
  const [m0, m1] = messages as [string, string]
  const p = JSON.parse(m0) as Record<string, string>
  const line = JSON.parse(m1) as Record<string, string>
  if (
    line.gate !== p.gate_id ||
    line.nonce !== p.nonce ||
    line.key_id !== p.key_id ||
    line.payload_sha256 !== createHash('sha256').update(m0).digest('hex')
  )
    bad()
  if (existsSync(`${blob}.delay`)) await Bun.sleep(Number(readFileSync(`${blob}.delay`, 'utf8')))
  if (existsSync(`${blob}.cancel`)) fail('오너 확인을 받지 못했어요: 취소', 4)
  appendFileSync(
    `${blob}.reasons`,
    `gotechy ${p.gate_id} ${p.task_id}: ${p.choice} (확인 ${String(p.nonce).slice(0, 4).toUpperCase()})\n`,
  )
  const key = createPrivateKey(readFileSync(blob as string, 'utf8'))
  console.log(
    JSON.stringify(
      [m0, m1].map((m) =>
        sign('sha256', Buffer.from(m), { key, dsaEncoding: 'der' }).toString('base64'),
      ),
    ),
  )
} else fail(`모르는 명령이에요: ${cmd}`, 2)
