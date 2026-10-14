// 테스트용 오너 키 도구. native/ownerkey.swift와 같은 명령, 출력, 종료 코드를 소프트웨어 키로 흉내 낸다(사람 확인 없음).
// 실제 도구와 달리 blob에 개인 키(PKCS8 PEM)를 그대로 둔다. 테스트 전용이고 src에서는 쓰지 않는다.
// 오너의 취소를 흉내 내려면 <blob>.cancel 파일을 둔다(exit 4). 받은 --reason은 <blob>.reasons에 줄마다 남긴다.
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const [cmd, blob, ...rest] = process.argv.slice(2)
const fail = (msg: string, code = 1): never => {
  process.stderr.write(`${msg}\n`)
  process.exit(code)
}
if (!cmd || !blob) fail('사용법: gotechy-ownerkey create|pub|sign <blob> [--reason 글]', 2)
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
} else if (cmd === 'sign') {
  const i = rest.indexOf('--reason')
  const reason = i >= 0 ? (rest[i + 1] ?? '') : ''
  const messages = JSON.parse(await Bun.stdin.text()) as unknown
  if (!Array.isArray(messages) || messages.length === 0)
    fail('표준 입력은 비어 있지 않은 JSON 문자열 배열이어야 해요', 2)
  if (existsSync(`${blob}.cancel`)) fail('오너 확인을 받지 못했어요: 취소', 4)
  appendFileSync(`${blob}.reasons`, `${reason}\n`)
  const key = createPrivateKey(readFileSync(blob as string, 'utf8'))
  console.log(
    JSON.stringify(
      (messages as string[]).map((m) =>
        sign('sha256', Buffer.from(m), { key, dsaEncoding: 'der' }).toString('base64'),
      ),
    ),
  )
} else fail(`모르는 명령이에요: ${cmd}`, 2)
