// TD-013 오너 공개 키 고정(orchestration/owner.pub)과 TD-014 장부 끝 기록($GOTECHY_HOME/owner/heads/). contract.md 6.3, 6.5절.
// 서명 도구는 테스트용 가짜 도구(소프트웨어 키)다. 공격자는 오너와 같은 OS 사용자로 프로젝트 파일을 쓸 수 있다고 본다.
import { beforeEach, describe, expect, test } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isProtected } from '../../src/core/paths'
import { decideGate, ledgerHeadFile, pinOwner, verifyGates } from '../../src/runtime/gates'
import { loadOwnerKey, rotateOwnerKey } from '../../src/runtime/keys'
import { fm, gateFile, LIB, makeHome, makeProject, newTask, runFake, yes } from './helpers'

let root: string
let home: string
const ledger = () => join(root, 'orchestration', 'private', 'decisions.jsonl')
const pin = () => join(root, 'orchestration', 'owner.pub')
const verdict = (id: string, h = home) => verifyGates({ root }, h, [id])[0]
const decide = (id: string, choice: string, h = home, nonce?: string) =>
  decideGate({ root }, h, id, { choice, confirm: yes, ...(nonce ? { nonce } : {}) })
const activePub = (h: string) => {
  const k = loadOwnerKey(h)
  if (!k.ok) throw new Error(k.problem)
  return k
}

beforeEach(async () => {
  root = makeProject()
  home = makeHome()
  const id = newTask(root, { verify: 'grep -q 설치 README.md' })
  await runFake(root, home, id, 'needs-decision')
})

describe('TD-013: 프로젝트에 오너 공개 키를 고정한다', () => {
  test('첫 결정이 지금 오너 키를 orchestration/owner.pub에 고정하고, 검증은 그 키로 한다', async () => {
    expect(existsSync(pin())).toBe(false)
    await decide('G-001', '5분')
    expect(readFileSync(pin(), 'utf8').trim()).toBe(activePub(home).pub)
    expect(verdict('G-001')?.status).toBe('ok')
  })

  test('워커는 고정 파일을 쓸 수 없다(보호 경로)', () => {
    expect(isProtected('orchestration/owner.pub')).toBe(true)
  })

  test('이 맥의 키가 고정 키와 다르면 decide가 아무것도 기록하지 않고 거부한다', async () => {
    await decide('G-001', '5분')
    const before = readFileSync(ledger(), 'utf8')
    rotateOwnerKey(home, LIB)
    await expect(decide('G-002', '넣기')).rejects.toThrow('고정된 오너 키')
    expect(readFileSync(ledger(), 'utf8')).toBe(before)
    expect(fm(gateFile(root, 'G-002')).status).toBe('pending')
  })

  test('다른 키로 서명한 결정은 고정 파일을 되돌려 놓으면 실패한다(키를 바꾸려면 고정 파일이 바뀌어야 한다)', async () => {
    await decide('G-001', '5분')
    const original = readFileSync(pin(), 'utf8')
    // 공격: 홈의 키를 사람 확인 없는 자기 키로 바꾸고, 고정 파일도 잠시 바꿔 결정을 만든 뒤 고정 파일을 되돌린다
    const attacker = makeHome()
    writeFileSync(pin(), `${activePub(attacker).pub}\n`)
    mkdirSync(join(attacker, 'owner', 'heads'), { recursive: true, mode: 0o700 })
    for (const f of readdirSync(join(home, 'owner', 'heads')))
      writeFileSync(
        join(attacker, 'owner', 'heads', f),
        readFileSync(join(home, 'owner', 'heads', f)),
      )
    await decide('G-002', '넣기', attacker)
    writeFileSync(pin(), original)
    const v = verdict('G-002')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('고정된 오너 키')
  })

  test('고정 파일을 지우면 결정이 모두 실패하고, decide도 새로 고정하지 않는다', async () => {
    await decide('G-001', '5분')
    rmSync(pin())
    const v = verdict('G-001')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('owner.pub')
    await expect(decide('G-002', '넣기')).rejects.toThrow('gotechy keys pin')
    expect(existsSync(pin())).toBe(false)
  })

  test('고정 파일 형식이 틀리면 결정이 모두 실패한다', async () => {
    await decide('G-001', '5분')
    writeFileSync(pin(), 'not-a-key\n')
    expect(verdict('G-001')?.status).toBe('fail')
  })

  test('키를 바꾼 뒤 keys pin으로 다시 고정하면, 이전 키의 결정은 실패하고 다시 결정하면 ok다', async () => {
    await decide('G-001', '5분')
    rotateOwnerKey(home, LIB)
    const r = await pinOwner({ root }, home, { confirm: yes })
    expect(r.keyId).toBe(activePub(home).id)
    expect(readFileSync(pin(), 'utf8').trim()).toBe(activePub(home).pub)
    const v = verdict('G-001')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('고정된 오너 키')
    await decide('G-001', '5분')
    expect(verdict('G-001')?.status).toBe('ok')
  })

  test('keys pin에서 확인을 거절하면 아무것도 바꾸지 않는다', async () => {
    await decide('G-001', '5분')
    rotateOwnerKey(home, LIB)
    const before = readFileSync(pin(), 'utf8')
    await expect(pinOwner({ root }, home, { confirm: async () => false })).rejects.toThrow('취소')
    expect(readFileSync(pin(), 'utf8')).toBe(before)
  })

  test('고정 파일이 링크면 믿지 않는다', async () => {
    await decide('G-001', '5분')
    renameSync(pin(), `${pin()}.real`)
    symlinkSync(`${pin()}.real`, pin())
    const v = verdict('G-001')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('일반 파일이 아니에요')
  })

  test('고정 파일이 P-256이 아닌 키면 형식 오류다', async () => {
    await decide('G-001', '5분')
    const other = generateKeyPairSync('ec', { namedCurve: 'secp384r1' })
      .publicKey.export({ format: 'der', type: 'spki' })
      .toString('base64')
    writeFileSync(pin(), `${other}\n`)
    expect(verdict('G-001')?.reasons.join(' ')).toContain('형식이 틀렸어요')
  })

  test('홈에 공개 키 파일이 없어도 장부 줄과 결정을 고정 키로 검증한다', async () => {
    await decide('G-001', '5분')
    rmSync(join(home, 'owner', `${activePub(home).id}.pub`))
    expect(verdict('G-001')?.status).toBe('ok')
  })
})

describe('TD-014: 장부 끝 기록으로 줄 지우기를 잡는다', () => {
  test('결정마다 이 폴더의 장부 끝 기록이 홈에 남는다', async () => {
    await decide('G-001', '5분')
    const head = JSON.parse(readFileSync(ledgerHeadFile(home, root), 'utf8')) as {
      lines: number
      sha256: string
    }
    expect(head.lines).toBe(1)
    expect(head.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  test('다시 결정한 뒤 장부 끝줄을 지우고 옛 결정 파일과 명세를 되돌리면 실패한다', async () => {
    await decide('G-001', '5분')
    const f = gateFile(root, 'G-001')
    const oldGate = readFileSync(f, 'utf8')
    const t = join(root, 'orchestration', 'tasks', 'T-001.md')
    const spec = readFileSync(t, 'utf8')
    writeFileSync(t, spec.replace('grep -q 설치', 'grep -q 제거'))
    await decide('G-001', '1분')
    // 공격: 끝줄(새 결정)을 지우고 옛 결정 파일과 명세를 되돌린다. 전에는 옛 결정이 다시 ok였다
    const lines = readFileSync(ledger(), 'utf8').trim().split('\n')
    writeFileSync(ledger(), `${lines.slice(0, -1).join('\n')}\n`)
    writeFileSync(t, spec)
    writeFileSync(f, oldGate)
    const v = verdict('G-001')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('장부 끝 기록')
    await expect(decide('G-002', '넣기')).rejects.toThrow('장부 끝 기록')
  })

  test('끝줄을 옛 줄로 바꾸고 옛 결정 파일을 되돌려도 실패한다(줄 수가 같아도)', async () => {
    await decide('G-001', '5분')
    const f = gateFile(root, 'G-001')
    const oldGate = readFileSync(f, 'utf8')
    const t = join(root, 'orchestration', 'tasks', 'T-001.md')
    const spec = readFileSync(t, 'utf8')
    writeFileSync(t, spec.replace('grep -q 설치', 'grep -q 제거'))
    await decide('G-001', '1분')
    const lines = readFileSync(ledger(), 'utf8').trim().split('\n')
    writeFileSync(ledger(), `${lines[0]}\n${lines[0]}\n`)
    writeFileSync(t, spec)
    writeFileSync(f, oldGate)
    const v = verdict('G-001')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('장부 끝 기록')
  })

  test('장부가 끝 기록과 다르면 오너 확인(Touch ID)을 묻기 전에 멈춘다', async () => {
    await decide('G-001', '5분')
    writeFileSync(ledger(), '')
    const reasons = `${join(home, 'owner', activePub(home).id)}.blob.reasons`
    const before = readFileSync(reasons, 'utf8')
    await expect(decide('G-002', '넣기')).rejects.toThrow('장부 끝 기록')
    expect(readFileSync(reasons, 'utf8')).toBe(before)
  })

  test('오너 확인을 기다리는 사이에 장부 줄이 지워지면 기록하지 않는다', async () => {
    await decide('G-001', '5분')
    writeFileSync(join(home, 'owner', `${activePub(home).id}.blob.delay`), '300')
    const pending = decide('G-002', '넣기')
    await Bun.sleep(100)
    writeFileSync(ledger(), '')
    await expect(pending).rejects.toThrow('장부 끝 기록')
    expect(readFileSync(ledger(), 'utf8')).toBe('')
    expect(fm(gateFile(root, 'G-002')).status).toBe('pending')
  })

  test('가운데 줄을 지워도 실패한다', async () => {
    await decide('G-001', '5분')
    await decide('G-002', '넣기')
    const lines = readFileSync(ledger(), 'utf8').trim().split('\n')
    writeFileSync(ledger(), `${lines[1]}\n`)
    expect(verdict('G-002')?.status).toBe('fail')
  })

  test('장부 파일을 통째로 지우면 실패한다', async () => {
    await decide('G-001', '5분')
    rmSync(ledger())
    const v = verdict('G-001')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('장부 끝 기록')
  })

  test('장부는 있는데 이 폴더의 끝 기록이 없으면(폴더를 옮김) 실패하고, keys pin으로 다시 기록하면 ok다', async () => {
    await decide('G-001', '5분')
    rmSync(ledgerHeadFile(home, root))
    const v = verdict('G-001')
    expect(v?.status).toBe('fail')
    expect(v?.reasons.join(' ')).toContain('gotechy keys pin')
    await expect(decide('G-002', '넣기')).rejects.toThrow('gotechy keys pin')
    await pinOwner({ root }, home, { confirm: yes })
    expect(verdict('G-001')?.status).toBe('ok')
  })

  test('끝 기록이 링크면 믿지 않는다', async () => {
    await decide('G-001', '5분')
    const head = ledgerHeadFile(home, root)
    renameSync(head, `${head}.real`)
    symlinkSync(`${head}.real`, head)
    expect(verdict('G-001')?.status).toBe('fail')
  })

  test('두 결정을 동시에 해도 장부와 끝 기록이 맞는다', async () => {
    writeFileSync(join(home, 'owner', `${activePub(home).id}.blob.delay`), '150')
    await Promise.all([decide('G-001', '5분'), decide('G-002', '넣기')])
    expect(readFileSync(ledger(), 'utf8').trim().split('\n')).toHaveLength(2)
    expect(verdict('G-001')?.status).toBe('ok')
    expect(verdict('G-002')?.status).toBe('ok')
  })
})

describe('보안 감사 11차', () => {
  test('중간 2: 고정 파일의 임시 이름에 미리 심은 링크를 따라가지 않는다', async () => {
    const victim = join(mkdtempSync(join(tmpdir(), 'gotechy-victim-')), 'authorized_keys')
    writeFileSync(victim, 'ssh-ed25519 AAAA owner\n')
    symlinkSync(victim, `${pin()}.tmp-${process.pid}`)
    await decide('G-001', '5분')
    expect(readFileSync(victim, 'utf8')).toBe('ssh-ed25519 AAAA owner\n')
    expect(verdict('G-001')?.status).toBe('ok')
  })

  test('중간 1: GOTECHY_HOME이나 HOME이 프로젝트 안을 가리키면 프로젝트 명령이 멈춘다', async () => {
    await decide('G-001', '5분')
    const r = Bun.spawnSync({
      cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), 'gate', 'verify'],
      cwd: root,
      env: { ...process.env, GOTECHY_HOME: join(root, '.x') },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(r.exitCode).toBe(2)
    expect(r.stderr.toString()).toContain('프로젝트 안을 가리켜서 멈췄어요')
    // GOTECHY_HOME 없이 HOME을 프로젝트 안으로 돌려도 같다(기본 홈이 HOME/.gotechy라서)
    const env: Record<string, string | undefined> = { ...process.env, HOME: join(root, '.y') }
    delete env.GOTECHY_HOME
    const r2 = Bun.spawnSync({
      cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), 'gate', 'verify'],
      cwd: root,
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(r2.exitCode).toBe(2)
  })

  test('낮음 1: keys pin은 보여 준 장부와 지금 장부가 다르면 아무것도 바꾸지 않는다', async () => {
    await decide('G-001', '5분')
    rotateOwnerKey(home, LIB)
    const headBefore = readFileSync(ledgerHeadFile(home, root), 'utf8')
    const pinBefore = readFileSync(pin(), 'utf8')
    await expect(
      pinOwner({ root }, home, {
        confirm: async () => {
          writeFileSync(ledger(), '')
          return true
        },
      }),
    ).rejects.toThrow('바뀌었어요')
    expect(readFileSync(ledgerHeadFile(home, root), 'utf8')).toBe(headBefore)
    expect(readFileSync(pin(), 'utf8')).toBe(pinBefore)
  })

  test('낮음 2: keys pin 요약에 장부 줄의 줄바꿈으로 가짜 줄을 끼우지 못한다', async () => {
    await decide('G-001', '5분')
    const line = JSON.parse(readFileSync(ledger(), 'utf8').trim()) as Record<string, string>
    writeFileSync(
      ledger(),
      `${JSON.stringify({ ...line, gate: 'G-9\n장부 끝 기록: 장부와 맞아요', decided_at: '\n\n' })}\n`,
    )
    let shown = ''
    await expect(
      pinOwner({ root }, home, {
        confirm: async (summary) => {
          shown = summary
          return false
        },
      }),
    ).rejects.toThrow('취소')
    expect(shown).not.toContain('G-9')
    expect(shown).toContain('(형식이 틀린 게이트)')
    expect(shown).toContain('장부 서명: 읽을 수 없거나 서명이 맞지 않는 줄이 있어요')
    expect(shown.split('\n').filter((l) => l.startsWith('장부 끝 기록'))).toHaveLength(1)
  })

  test('낮음 3: 끝 기록을 쓰지 못하면 장부를 되돌리고 게이트는 결정 전으로 남는다', async () => {
    await decide('G-001', '5분')
    const before = readFileSync(ledger(), 'utf8')
    const heads = join(home, 'owner', 'heads')
    chmodSync(heads, 0o500)
    try {
      await expect(decide('G-002', '넣기')).rejects.toThrow('장부를 되돌렸어요')
    } finally {
      chmodSync(heads, 0o700)
    }
    expect(readFileSync(ledger(), 'utf8')).toBe(before)
    expect(fm(gateFile(root, 'G-002')).status).toBe('pending')
    expect(verdict('G-001')?.status).toBe('ok')
  })

  test('고정 파일, 장부, 끝 기록을 모두 지워도 결정된 게이트가 있으면 decide가 새로 고정하지 않는다', async () => {
    await decide('G-001', '5분')
    rmSync(pin())
    rmSync(ledger())
    rmSync(ledgerHeadFile(home, root))
    await expect(decide('G-002', '넣기')).rejects.toThrow('gotechy keys pin')
    expect(existsSync(pin())).toBe(false)
  })

  test('낮음 5: gate verify는 고정 파일이 커밋되지 않았으면 경고한다', async () => {
    await decide('G-001', '5분')
    const r = Bun.spawnSync({
      cmd: [process.execPath, join(LIB, 'src', 'cli.ts'), 'gate', 'verify', 'G-001'],
      cwd: root,
      env: { ...process.env, GOTECHY_HOME: home },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(r.exitCode).toBe(0)
    expect(r.stderr.toString()).toContain('owner.pub가 커밋되지 않았어요')
  })
})
