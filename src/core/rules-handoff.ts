// HANDOFF 내용 규칙(contract.md 4.1절). 절 구조 검사는 lint-handoff.ts가, 여기서는 각 절 안의 형식을 본다.
import type { Issue } from './issues'
import type { Section } from './sections'

const FACT_TAG = /\[(확인|추론|추정)\]\s*$/
const RISK = '건너뛴 것, 확인 못 한 것, 리스크'
const isNone = (s: string) => s.trim() === '' || s.trim() === '없음'

type Ctx = { file: string; status: string; byTitle: Map<string, Section> }

/** 절 내용을 줄 단위로, 파일 기준 줄 번호와 함께. */
function lines(sec: Section): { text: string; line: number }[] {
  return sec.content.split('\n').map((text, i) => ({ text, line: sec.line + 1 + i }))
}
const topItems = (sec: Section) => lines(sec).filter((l) => /^[-*]\s+/.test(l.text))

export function handoffRuleIssues(ctx: Ctx): Issue[] {
  const out: Issue[] = []
  const add = (
    line: number | undefined,
    rule: string,
    message: string,
    fix: string,
    example?: string,
  ) => {
    const issue: Issue = { file: ctx.file, rule, message, fix }
    if (line) issue.line = line
    if (example) issue.example = example
    out.push(issue)
  }

  const summary = ctx.byTitle.get('한 줄 요약')
  if (summary) {
    const body = lines(summary).filter((l) => l.text.trim() !== '')
    const first = body[0]
    if (body.length !== 1 || !first || [...first.text.trim()].length > 60) {
      add(
        first?.line ?? summary.line,
        'handoff-summary',
        `한 줄 요약은 60자 이하 한 줄이어야 해요 (지금 ${body.length}줄, ${[...(first?.text.trim() ?? '')].length}자).`,
        '가장 중요한 결과 하나만 한 문장으로 쓰세요.',
        'README에 설치 줄을 추가했어요.',
      )
    }
  }

  const decision = ctx.byTitle.get('결정 필요')
  if (decision && !isNone(decision.content)) {
    let blocking = 0
    type D = { marker: string; line: number; options?: string[]; pick?: string; reason?: string }
    const ds: D[] = []
    for (const l of lines(decision)) {
      if (l.text.trim() === '') continue
      const top = /^[-*]\s+\[(막는|기본값|알림)\]\s*\S/.exec(l.text)
      const sub = /^\s+[-*]\s+(선택지|추천|이유):\s*(.*)$/.exec(l.text)
      const current = ds.at(-1)
      if (top?.[1]) {
        ds.push({ marker: top[1], line: l.line })
        if (top[1] === '막는') blocking++
      } else if (sub && current) {
        const [, key, value = ''] = sub
        if (key === '선택지')
          current.options = value
            .split(/,\s*/)
            .map((v) => v.trim())
            .filter(Boolean)
        if (key === '추천') current.pick = value.trim()
        if (key === '이유') current.reason = value.trim()
      } else {
        add(
          l.line,
          'handoff-decision-format',
          '결정은 `- [막는]`, `- [기본값]`, `- [알림]` 표지로 시작하는 목록 항목이어야 해요.',
          '결정마다 표지를 붙이고, 막는·기본값 결정에는 선택지·추천·이유 하위 항목을 다세요.',
          '- [막는] 캐시 만료를 얼마로 할까요?\n  - 선택지: 5분, 1분\n  - 추천: 5분\n  - 이유: 조회 빈도에 비해 충분해요',
        )
      }
    }
    for (const d of ds) {
      if (d.marker === '알림') continue
      const problems: string[] = []
      if ((d.options?.length ?? 0) < 2) problems.push('선택지가 2개 이상이어야 해요')
      if (!d.pick) problems.push('추천이 없어요')
      else if (d.options && !d.options.includes(d.pick))
        problems.push(`추천 "${d.pick}"이 선택지에 없어요`)
      if (!d.reason) problems.push('이유가 없어요')
      if (problems.length > 0) {
        add(
          d.line,
          'handoff-decision-format',
          `결정 형식: ${problems.join(', ')}.`,
          '하위 항목으로 `- 선택지: A, B`, `- 추천: A`, `- 이유: 한 줄`을 다세요.',
        )
      }
    }
    if (blocking > 3) {
      add(
        decision.line,
        'handoff-blocking-limit',
        `막는 결정이 ${blocking}개예요 (최대 3개).`,
        '작업을 더 작게 쪼개거나, 리드에게 "결정 세션"을 요청해 하나씩 정하도록 HANDOFF를 needs-decision으로 두세요.',
      )
    }
    if (blocking > 0 && ctx.status !== 'needs-decision') {
      add(
        decision.line,
        'handoff-blocking-status',
        '막는 결정이 있는데 status가 needs-decision이 아니에요.',
        'frontmatter의 status를 needs-decision으로 바꾸세요. 결정 없이는 다음 작업이 진행되지 않아요.',
      )
    }
  }

  const risk = ctx.byTitle.get(RISK)
  if (risk && !isNone(risk.content)) {
    const items = topItems(risk)
    if (items.length > 3) {
      add(
        items[3]?.line,
        'handoff-risk-limit',
        `리스크 항목이 ${items.length}개예요 (최대 3개).`,
        '가장 중요한 3개만 남기세요. 나머지는 작업 명세나 부채 목록으로 옮기세요.',
      )
    }
  }

  const evidence = ctx.byTitle.get('증거')
  if (evidence && !isNone(evidence.content)) {
    for (const l of lines(evidence)) {
      if (l.text.trim() === '') continue
      if (!/^[-*]\s+`[^`]+`\s*:\s*\S/.test(l.text)) {
        add(
          l.line,
          'handoff-evidence-format',
          '증거는 `` `명령`: 결과`` 형식의 목록 항목이어야 해요.',
          '실제로 실행한 명령을 백틱으로 감싸고, 콜론 뒤에 결과를 쓰세요. 실행하지 않았으면 리스크 절에 쓰세요.',
          '- `bun test`: 49 pass, 0 fail',
        )
      }
    }
  }

  for (const title of ['한 일', RISK]) {
    const sec = ctx.byTitle.get(title)
    if (!sec || isNone(sec.content)) continue
    for (const item of topItems(sec)) {
      if (!FACT_TAG.test(item.text)) {
        add(
          item.line,
          'handoff-fact-tag',
          `"${title}" 항목 끝에 사실 표시가 없어요.`,
          '[확인](직접 실행·확인), [추론](확인한 사실을 이어 판단), [추정](근거 없음) 중 하나를 붙이세요.',
          '- README.md에 설치 줄을 추가했어요. [확인]',
        )
      }
    }
  }

  for (const [title, sec] of ctx.byTitle) {
    if (title === '결정 필요' || title === RISK) continue
    const hit = lines(sec).find((l) => l.text.includes('**'))
    if (hit) {
      add(
        hit.line,
        'handoff-emphasis',
        `"${title}" 절에 굵게(**)가 있어요.`,
        '강조는 "결정 필요"와 리스크 절에서만 써요. 나머지는 평범한 글로 쓰세요.',
      )
    }
  }
  return out
}

/** "새 용어" 절에서 풀이한 용어 이름(소문자). `- 용어: 설명` 또는 `용어: 설명` 형식. */
export function explainedTerms(sec: Section | undefined): string[] {
  if (!sec) return []
  return lines(sec)
    .map((l) => /^[-*]?\s*([^:：]+?)\s*[:：]\s*\S/.exec(l.text)?.[1]?.trim().toLowerCase())
    .filter((t): t is string => Boolean(t))
}
