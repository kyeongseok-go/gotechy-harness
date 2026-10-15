// contract.md 13절 교차 검증 감사관의 순수 판정: 출력 읽기, 경로 검사, 프롬프트 경계, diff 자르기, 인박스 줄.
import { describe, expect, test } from 'bun:test'
import {
  attachAudit,
  buildAuditPrompt,
  cutDiff,
  defaultAuditor,
  parseAuditOutput,
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

test('감사 기록 폴더는 보호 경로다(워커가 감사 결과를 꾸미지 못하게)', () => {
  expect(isProtected('orchestration/audits/T-001.md')).toBe(true)
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
