// contract.md 13절 교차 검증 감사관의 순수 판정: 출력 읽기, 경로 검사, 프롬프트 경계, diff 자르기, 인박스 줄.
import { describe, expect, test } from 'bun:test'
import {
  type AuditFinding,
  attachAudit,
  buildAuditPrompt,
  cutDiff,
  cutText,
  defaultAuditor,
  findLeaks,
  formatVerifyLog,
  parseAuditOutput,
  parseVerifyLog,
  renderAudit,
  safeRelPath,
} from '../../src/core/audit'
import { buildCard, formatInbox } from '../../src/core/inbox'
import { isProtected } from '../../src/core/paths'
import {
  claudeAuditorArgs,
  claudeResultText,
  codexAuditorArgs,
  lastCodexMessage,
} from '../../src/runtime/auditors'

const finding = (over: Record<string, unknown> = {}) => ({
  claim: '주장',
  actual: '실제',
  file: 'README.md',
  line: 2,
  severity: 'high',
  ...over,
})
const json = (findings: unknown[], summary = '요약') => JSON.stringify({ findings, summary })

describe('감사관 출력 읽기', () => {
  test('앞뒤 글과 코드 울타리가 있어도 첫 JSON 객체를 읽는다', () => {
    const r = parseAuditOutput(`대조했어요.\n\n\`\`\`json\n${json([finding()])}\n\`\`\`\n끝.`)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.findings).toHaveLength(1)
      expect(r.summary).toBe('요약')
    }
  })

  test('JSON이 없거나 형식이 틀리면 오류다', () => {
    expect(parseAuditOutput('문제 없어요').ok).toBe(false)
    expect(parseAuditOutput(json([finding({ severity: 'critical' })])).ok).toBe(false)
    expect(parseAuditOutput(json([finding({ line: 1.5 })])).ok).toBe(false)
    expect(parseAuditOutput(json([finding({ line: 0 })])).ok).toBe(false)
    expect(parseAuditOutput(json([finding({ extra: 1 })])).ok).toBe(false)
  })

  test('지적은 20개까지, 글은 칸마다 500자까지 받는다', () => {
    expect(parseAuditOutput(json(Array.from({ length: 20 }, () => finding()))).ok).toBe(true)
    expect(parseAuditOutput(json(Array.from({ length: 21 }, () => finding()))).ok).toBe(false)
    expect(parseAuditOutput(json([finding({ actual: 'a'.repeat(500) })])).ok).toBe(true)
    expect(parseAuditOutput(json([finding({ actual: 'a'.repeat(501) })])).ok).toBe(false)
  })

  test('지적이 없어도 형식이 맞으면 읽는다', () => {
    expect(parseAuditOutput(json([])).ok).toBe(true)
  })
})

describe('근거 경로 검사', () => {
  test('작업 폴더 안 상대 경로만 받는다', () => {
    expect(safeRelPath('src/a.ts')).toBe(true)
    expect(safeRelPath('README.md')).toBe(true)
    for (const bad of ['', '/etc/hosts', '../a', 'a/../../b', 'a/..', 'a\\b', 'C:/x', './a/../..'])
      expect({ bad, ok: safeRelPath(bad) }).toEqual({ bad, ok: false })
  })
})

describe('감사관 고르기', () => {
  test('작성 계열의 반대를 고르고, 모르는 계열은 정하지 않는다', () => {
    expect(defaultAuditor('claude')).toBe('codex')
    expect(defaultAuditor('codex')).toBe('claude')
    expect(defaultAuditor('fake')).toBeUndefined()
    expect(defaultAuditor(undefined)).toBeUndefined()
  })
})

describe('프롬프트 경계', () => {
  const template = '앞\n{{HANDOFF}}\n{{DIFF}}\n{{VERIFY_LOG}}\n경계 {{BOUNDARY}}'

  test('워커가 쓴 데이터는 무작위 경계 안에 들어가고, 데이터에 든 경계 후보는 쓰지 않는다', () => {
    const picks = ['aaaa', 'bbbb', 'cccc']
    const p = buildAuditPrompt(
      template,
      { handoff: '주장 GOTECHY-aaaa', diff: '변경', verifyLog: '로그 GOTECHY-bbbb' },
      () => picks.shift() as string,
    )
    expect(p).toContain('GOTECHY-cccc')
    expect(p).toContain('<<<GOTECHY-cccc HANDOFF\n주장 GOTECHY-aaaa\nGOTECHY-cccc>>>')
    expect(p).toContain('<<<GOTECHY-cccc VERIFY_LOG\n로그 GOTECHY-bbbb\nGOTECHY-cccc>>>')
    expect(p).not.toContain('{{')
  })
})

describe('diff 자르기', () => {
  test('200KB를 넘으면 자르고 잘렸다고 표시한다', () => {
    const small = cutDiff('a'.repeat(10))
    expect(small).toEqual({ text: 'a'.repeat(10), truncated: false })
    const big = cutDiff('가'.repeat(100_000))
    expect(big.truncated).toBe(true)
    expect(Buffer.byteLength(big.text)).toBeLessThanOrEqual(200_100)
    expect(big.text).toContain('(diff가 200KB를 넘어 잘렸어요)')
  })
})

describe('감사관 실행 인자는 읽기만 허용한다', () => {
  const req = { cwd: '/w', prompt: 'P', budgetUsd: 0.5, timeoutMs: 1000 }

  test('codex 감사관은 읽기 전용 샌드박스로 돈다', () => {
    const a = codexAuditorArgs(req)
    expect(a.slice(0, 2)).toEqual(['codex', 'exec'])
    expect(a[a.indexOf('-s') + 1]).toBe('read-only')
    expect(a).not.toContain('workspace-write')
    expect(a).not.toContain('danger-full-access')
    expect(a.at(-1)).toBe('P')
  })

  test('claude 감사관은 계획 모드와 쓰기 거부 규칙, 비용 상한으로 돈다', () => {
    const a = claudeAuditorArgs(req)
    expect(a[a.indexOf('--permission-mode') + 1]).toBe('plan')
    expect(a[a.indexOf('--max-budget-usd') + 1]).toBe('0.5')
    const settings = JSON.parse(a[a.indexOf('--settings') + 1] as string)
    expect(settings.permissions.deny).toEqual(expect.arrayContaining(['Edit(**)', 'Write(**)']))
    expect(a).toContain('--restricted')
  })

  test('마지막 답을 꺼낸다', () => {
    const events = [
      '{"type":"thread.started"}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"첫 답"}}',
      '{"type":"item.completed","item":{"type":"reasoning","text":"생각"}}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"마지막 답"}}',
      '{"type":"turn.completed","usage":{"input_tokens":1}}',
    ].join('\n')
    expect(lastCodexMessage(events)).toBe('마지막 답')
    expect(lastCodexMessage('깨진 줄\n')).toBe('')
    expect(claudeResultText('{"type":"result","result":"답"}')).toBe('답')
    expect(claudeResultText('깨짐')).toBe('')
  })
})

test('감사 기록 폴더(.gotechy/audits)는 보호 경로다(워커가 감사 결과를 꾸미지 못하게)', () => {
  expect(isProtected('.gotechy/audits/T-001.md')).toBe(true)
})

describe('인박스의 감사 줄', () => {
  const text = [
    '---',
    'task: T-001',
    'status: done',
    'packs: [owner]',
    'skills_loaded: [owner-protocol]',
    'new_terms: []',
    'rev: 2',
    '---',
    '## 결정 필요\n없음\n',
    '## 한 줄 요약\n요약이에요.\n',
  ].join('\n')
  const card = buildCard({ id: 'T-001', file: 'h.md', text })

  test('같은 판본의 감사 기록이면 근거 있는 지적 수를 보여 준다', () => {
    const out = formatInbox([attachAudit(card, { handoff_rev: 2, confirmed: 2 })])
    expect(out).toContain('감사: 근거 있는 지적 2건')
  })

  test('지난 판본의 감사 기록이면 그렇다고 알린다', () => {
    const out = formatInbox([attachAudit(card, { handoff_rev: 1, confirmed: 2 })])
    expect(out).toContain('감사: 지난 판본 기준')
    expect(out).not.toContain('근거 있는 지적')
  })
})

// 소스에 보이지 않는 글자를 두지 않으려고 코드 포인트로 만든다(서식 도구가 \u 이스케이프를 실제 글자로 바꾼 적이 있다)
const RLO = String.fromCodePoint(0x202e)

describe('보안 감사 12차 반영', () => {
  test('높음 1: 데이터에 자리 표시자 글이 있어도 리드가 경계를 데이터 안에 끼워 넣지 않는다', () => {
    const template = '{{HANDOFF}}\n{{DIFF}}\n{{VERIFY_LOG}}'
    const p = buildAuditPrompt(
      template,
      {
        handoff: '앞 {{DIFF}} 뒤 {{VERIFY_LOG}} {{BOUNDARY}}',
        diff: '변경 {{VERIFY_LOG}}',
        verifyLog: '로그',
      },
      () => 'cccc',
    )
    expect(p).toContain(
      '<<<GOTECHY-cccc HANDOFF\n앞 {{DIFF}} 뒤 {{VERIFY_LOG}} {{BOUNDARY}}\nGOTECHY-cccc>>>',
    )
    expect(p).toContain('<<<GOTECHY-cccc DIFF\n변경 {{VERIFY_LOG}}\nGOTECHY-cccc>>>')
    expect(p.match(/<<<GOTECHY-cccc /g)).toHaveLength(3)
  })

  test('중간 2: file 칸은 글자, 숫자, 경로 기호만 받는다(백틱, 제어 문자, 줄바꿈 거부)', () => {
    expect(parseAuditOutput(json([finding({ file: 'docs/한글 문서.md' })])).ok).toBe(true)
    for (const bad of ['a`b', 'a\u0000b', 'a\nb', 'a\u001b[2Jb', `a${RLO}b`])
      expect({ bad, ok: parseAuditOutput(json([finding({ file: bad })])).ok }).toEqual({
        bad,
        ok: false,
      })
  })

  test('중간 2와 낮음 6: 기록 글에서 제어 문자를 지우고, 본문 첫 줄에 데이터라는 표시를 둔다', () => {
    const text = renderAudit(
      {
        task: 'T-001',
        handoff_rev: 1,
        at: 'x',
        auditor: { adapter: 'fake', model: null },
        author: { agent: 'fake', model: null },
        cross_family: false,
        input: { diff_bytes: 1, diff_truncated: false, verify_log: true },
        prompt_sha256: 'p',
        findings: 1,
        confirmed: 0,
        cost_usd: null,
        items: [
          { ...(finding({ claim: 'a\u001b]52;c;eA==\u0007b' }) as AuditFinding), confirmed: false },
        ],
      },
      [{ ...(finding({ claim: 'a\u001b]52;c;eA==\u0007b' }) as AuditFinding), confirmed: false }],
      `요약${RLO}뒤집기`,
    )
    expect(text).not.toMatch(/(?![\n\t])[\p{Cc}\p{Cf}\p{Bidi_Control}]/u)
    // YAML이 제어 문자를 이스케이프 글자로 바꿔 숨기지 않게, 지적 목록도 지운 글로 남는다
    expect(text).not.toContain('\\e')
    expect(text).not.toContain('\\x07')
    expect(text).toContain('감사관(외부 모델)의 출력이에요')
  })

  test('높음 1: 기록 전에 키와 로그인 값 모양을 찾는다', () => {
    expect(findLeaks('정상 글', [])).toEqual([])
    expect(findLeaks('-----BEGIN OPENSSH PRIVATE KEY-----', [])).not.toEqual([])
    expect(findLeaks(`키 ${['sk', 'ant', 'api03', 'abcdefghijklmnop'].join('-')}`, [])).not.toEqual(
      [],
    )
    expect(findLeaks(['ghp', 'abcdefghijklmnopqrstuvwxyz0123'].join('_'), [])).not.toEqual([])
    // 키 모양 문자열은 조각을 이어 만든다. 그대로 쓰면 gitleaks가 저장소 검사에서 잡는다(2026-10-15 검사)
    expect(findLeaks(['AKIA', 'ABCDEFGHIJKLMNOP'].join(''), [])).not.toEqual([])
    expect(
      findLeaks('값은 my-very-long-secret-value-1234', ['my-very-long-secret-value-1234']),
    ).not.toEqual([])
  })

  test('중간 4: HANDOFF는 64KB에서 자른다', () => {
    const r = cutText('가'.repeat(30_000), 64_000, '(HANDOFF가 64KB를 넘어 잘렸어요)')
    expect(r.truncated).toBe(true)
    expect(Buffer.byteLength(r.text)).toBeLessThanOrEqual(64_100)
  })

  test('낮음 1: verify 기록은 판본과 묶이고 바이트 기준으로 끝을 남긴다', () => {
    const log = formatVerifyLog(3, 'a'.repeat(40), '출'.repeat(10_000), '')
    expect(Buffer.byteLength(log)).toBeLessThanOrEqual(20_200)
    expect(parseVerifyLog(log)?.rev).toBe(3)
    expect(parseVerifyLog('머리 없는 기록')).toBeUndefined()
  })

  test('중간 3: diff가 잘린 감사는 인박스에 그렇다고 보여 준다', () => {
    const text = [
      '---',
      'task: T-001',
      'status: done',
      'packs: [owner]',
      'skills_loaded: [owner-protocol]',
      'new_terms: []',
      'rev: 1',
      '---',
      '## 한 줄 요약\n요약이에요.\n',
    ].join('\n')
    const c = buildCard({ id: 'T-001', file: 'h.md', text })
    expect(
      formatInbox([attachAudit(c, { handoff_rev: 1, confirmed: 0, truncated: true })]),
    ).toContain('감사: 근거 있는 지적 0건 (diff 일부만 감사)')
  })

  test('중간 5: 어느 깊이의 지시 파일(CLAUDE.md, AGENTS.md 등)과 .codex/도 보호한다', () => {
    for (const p of [
      'src/CLAUDE.md',
      'a/b/AGENTS.md',
      'CLAUDE.local.md',
      'x/AGENTS.override.md',
      'src/claude.md',
      '.codex/config.toml',
    ])
      expect({ p, protected: isProtected(p) }).toEqual({ p, protected: true })
    expect(isProtected('src/CLAUDE.md.bak')).toBe(false)
    expect(isProtected('docs/agents-guide.md')).toBe(false)
  })
})
