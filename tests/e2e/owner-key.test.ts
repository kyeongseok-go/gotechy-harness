// 1b N1 오너 인증(contract.md 6.3, 6.4절, 1b Validation 1~3). 서명 도구는 경계라 테스트용 가짜 도구(소프트웨어 키)로 바꿔 끼운다.
import { beforeEach, describe, expect, test } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decideGate, verifyGates } from '../../src/runtime/gates'
import {
  ensureOwnerTool,
  initOwnerKey,
  loadOwnerKey,
  OwnerCancelled,
  ownerToolPath,
} from '../../src/runtime/keys'
import {
  fm,
  gateFile,
  LIB,
  makeHome,
  makeProject,
  newTask,
  ownerBlob,
  runFake,
  yes,
} from './helpers'

let root: string
let home: string
const ledger = () => join(root, 'orchestration', 'private', 'decisions.jsonl')
const verdict = (id: string) => verifyGates({ root }, home, [id])[0]

beforeEach(async () => {
  root = makeProject()
  home = makeHome()
  const id = newTask(root, { verify: 'grep -q 설치 README.md' })
  await runFake(root, home, id, 'needs-decision')
})

describe('Validation 1: 오너가 확인을 취소하면 아무것도 기록하지 않는다', () => {
  test('취소하면 OwnerCancelled이고 게이트, 장부, 이벤트가 그대로다', async () => {
    writeFileSync(`${ownerBlob(home)}.cancel`, '')
    const before = readFileSync(gateFile(root, 'G-001'), 'utf8')
    await expect(
      decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes }),
    ).rejects.toBeInstanceOf(OwnerCancelled)
    expect(readFileSync(gateFile(root, 'G-001'), 'utf8')).toBe(before)
    expect(existsSync(ledger())).toBe(false)
    expect(fm(gateFile(root, 'G-001')).status).toBe('pending')
  })

  test('확인 창의 문구에 게이트 번호와 선택이 보인다', async () => {
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    expect(readFileSync(`${ownerBlob(home)}.reasons`, 'utf8')).toBe('gotechy G-001: 5분\n')
  })

  test('게이트 서명과 장부 줄 서명을 한 번의 확인으로 받는다', async () => {
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    expect(
      readFileSync(`${ownerBlob(home)}.reasons`, 'utf8')
        .trim()
        .split('\n'),
    ).toHaveLength(1)
    const line = JSON.parse(readFileSync(ledger(), 'utf8').trim()) as Record<string, string>
    expect(line.sig).toBeTruthy()
    expect(line.payload_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(verdict('G-001')?.status).toBe('ok')
  })

  test('서명 도구가 맞지 않는 서명을 돌려주면 기록하지 않는다', async () => {
    writeFileSync(ownerToolPath(home), `#!/bin/sh\necho '["AAAA","AAAA"]'\n`)
    chmodSync(ownerToolPath(home), 0o755)
    await expect(
      decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes }),
    ).rejects.toThrow('검증되지 않아요')
    expect(existsSync(ledger())).toBe(false)
  })
})

describe('Validation 3: 결정 장부의 줄을 손으로 더하거나 바꾸면 검증이 실패한다', () => {
  beforeEach(async () => {
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
  })

  test('서명된 줄의 값을 바꾸면 실패한다', () => {
    const text = readFileSync(ledger(), 'utf8')
    const line = JSON.parse(text.trim()) as Record<string, string>
    writeFileSync(
      ledger(),
      `${JSON.stringify({ ...line, decided_at: '2030-01-01T00:00:00.000Z' })}\n`,
    )
    const v = verdict('G-001')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('장부')
  })

  test('서명 없는 줄을 더하면 다른 게이트까지 모두 실패한다(fail-closed)', () => {
    const line = JSON.parse(readFileSync(ledger(), 'utf8').trim()) as Record<string, string>
    writeFileSync(ledger(), `${JSON.stringify({ ...line, gate: 'G-009', sig: undefined })}\n`, {
      flag: 'a',
    })
    expect(verdict('G-001')?.status).toBe('fail')
  })

  test('같은 nonce로 다시 결정한 뒤 옛 결정 파일을 되살리면 장부 줄의 payload가 달라 실패한다', async () => {
    // nonce 검사만으로는 못 잡는 경우: 마지막 장부 줄의 nonce가 옛 결정과 같다. 줄의 payload_sha256이 옛 결정을 가려낸다
    const f = gateFile(root, 'G-001')
    const oldGate = readFileSync(f, 'utf8')
    const nonce = String(fm(f).nonce)
    const t = join(root, 'orchestration', 'tasks', 'T-001.md')
    const spec = readFileSync(t, 'utf8')
    writeFileSync(t, spec.replace('grep -q 설치', 'grep -q 제거'))
    await decideGate({ root }, home, 'G-001', { choice: '1분', confirm: yes, nonce })
    writeFileSync(t, spec)
    writeFileSync(f, oldGate)
    const v = verdict('G-001')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('장부의 기록이 이 결정과 맞지 않아요')
  })
})

describe('오너 키 파일', () => {
  test('1a의 HMAC 키로 서명한 결정은 다시 결정하라고 알려 준다', async () => {
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    const f = gateFile(root, 'G-001')
    writeFileSync(
      f,
      readFileSync(f, 'utf8').replace(/key_id: o-[0-9a-f]+/, 'key_id: k-20261014-0123abcd'),
    )
    expect(verdict('G-001')?.reasons.join(' ')).toContain('HMAC')
  })

  test('공개 키 파일을 다른 키로 바꾸면 키 id와 맞지 않아 쓰지 않는다', () => {
    const id = readFileSync(join(home, 'owner', 'active'), 'utf8').trim()
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
      .publicKey.export({ format: 'der', type: 'spki' })
      .toString('base64')
    writeFileSync(join(home, 'owner', `${id}.pub`), `${other}\n`)
    const k = loadOwnerKey(home)
    expect(k.ok).toBe(false)
    expect(k.ok ? '' : k.problem).toContain('맞지 않아요')
  })

  test('개인 키 파일이 없어도 검증은 공개 키만으로 된다', async () => {
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    writeFileSync(ownerBlob(home), '')
    expect(verdict('G-001')?.status).toBe('ok')
  })
})

describe('오너 키 만들기의 실패 경로', () => {
  const freshHome = (toolScript?: string) => {
    const h = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-ok-')))
    if (toolScript !== undefined) {
      mkdirSync(join(h, 'bin'), { recursive: true })
      writeFileSync(ownerToolPath(h), toolScript)
      chmodSync(ownerToolPath(h), 0o755)
    }
    return h
  }

  test('Secure Enclave가 없으면(도구 exit 3) 그 이유로 멈추고 임시 blob을 남기지 않는다', () => {
    const h = freshHome('#!/bin/sh\necho "없음" >&2\nexit 3\n')
    expect(() => initOwnerKey(h, LIB)).toThrow('Secure Enclave를 쓸 수 없어요')
    expect(readdirSync(join(h, 'owner'))).toEqual([])
  })

  test('그 밖의 실패(화면 잠김 등)는 풀고 다시 하라고 알려 준다', () => {
    const h = freshHome('#!/bin/sh\necho "-25308" >&2\nexit 1\n')
    expect(() => initOwnerKey(h, LIB)).toThrow('화면이 잠겨')
  })

  test('swiftc가 없으면 설치 방법을 알려 준다 (macOS가 아니면 macOS 전용이라고)', () => {
    const before = process.env.PATH
    process.env.PATH = '/nonexistent-gotechy-path'
    try {
      expect(() => ensureOwnerTool(freshHome(), LIB)).toThrow(
        process.platform === 'darwin' ? 'xcode-select --install' : 'macOS',
      )
    } finally {
      process.env.PATH = before
    }
  })

  test('현재 키의 공개 키 파일이 없으면 쓰지 않는다', () => {
    const id = readFileSync(join(home, 'owner', 'active'), 'utf8').trim()
    rmSync(join(home, 'owner', `${id}.pub`))
    const k = loadOwnerKey(home)
    expect(k.ok ? '' : k.problem).toContain('공개 키 파일이 없어요')
  })

  test('서명 도구의 출력이 서명 배열이 아니면 기록하지 않는다', async () => {
    writeFileSync(ownerToolPath(home), `#!/bin/sh\necho '["하나뿐"]'\n`)
    chmodSync(ownerToolPath(home), 0o755)
    await expect(
      decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes }),
    ).rejects.toThrow('서명 배열이 아니에요')
    expect(existsSync(ledger())).toBe(false)
  })
})

describe('보안 감사 6차', () => {
  test('낮음 3: 만든 키가 사람 확인 없이 서명되면(probe exit 5) 쓰지 않는다', () => {
    const h = realpathSync(mkdtempSync(join(tmpdir(), 'gotechy-probe-')))
    mkdirSync(join(h, 'bin'), { recursive: true })
    const pub = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
      .publicKey.export({ format: 'der', type: 'spki' })
      .toString('base64')
    writeFileSync(
      ownerToolPath(h),
      `#!/bin/sh\ncase "$1" in create) : > "$2"; echo '${pub}' ;; probe) exit 5 ;; esac\n`,
    )
    chmodSync(ownerToolPath(h), 0o755)
    expect(() => initOwnerKey(h, LIB)).toThrow('사람 확인 없이')
    expect(loadOwnerKey(h).ok).toBe(false)
  })

  test('낮음 4: 장부에 객체가 아닌 줄이 있으면 예외 없이 장부 사유로 실패한다', async () => {
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    writeFileSync(ledger(), 'null\n', { flag: 'a' })
    const v = verdict('G-001')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('장부')
  })

  test('중간 1: 서명 도구에는 결정 하나와 그 장부 줄만 넘긴다', async () => {
    // 가짜 도구도 실제 도구처럼 두 메시지가 서로 맞지 않으면 exit 2로 거부한다
    await decideGate({ root }, home, 'G-001', { choice: '5분', confirm: yes })
    expect(readFileSync(`${ownerBlob(home)}.reasons`, 'utf8')).toBe('gotechy G-001: 5분\n')
  })
})
