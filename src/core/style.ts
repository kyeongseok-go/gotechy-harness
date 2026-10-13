// 문체 규칙(contract.md 7절): 사람용 산출물에서 기계 판정이 가능한 "AI 티"를 잡는다.
// 패턴 출처: im-not-ai (epoko77-ai, MIT) quick-rules A~J 중 정규식으로 판정 가능한 것.
import type { Issue } from './issues'
import { lineAt, type MaskOptions, maskNonProse } from './prose'

/** 2026-10-21 00:00 KST부터 오류. 그 전까지는 경고로 오탐률을 본다. */
export const STYLE_ENFORCE_FROM = new Date('2026-10-20T15:00:00Z')

type Rule = {
  rule: string
  pattern: RegExp
  /** 이 횟수 이상일 때만 보고 (기본 1) */
  min?: number
  message: (hit: string, count: number) => string
  fix: string
}

const RULES: Rule[] = [
  {
    rule: 'style-symbol',
    pattern: /[→←⇒➡⟶—·]/g,
    message: (h) => `본문에 \`${h}\` 기호가 있어요.`,
    fix: '화살표는 "다음에", "그래서"처럼 말로, em-dash는 쉼표나 문장 분리로, 가운데점은 쉼표나 "와/과"로 바꾸세요.',
  },
  {
    rule: 'style-emoji',
    pattern: /\p{Extended_Pictographic}/gu,
    message: (h) => `이모지 \`${h}\`가 있어요.`,
    fix: '이모지를 지우고 필요한 뜻은 문장으로 쓰세요.',
  },
  {
    rule: 'style-translationese',
    pattern:
      /에 대해서?|[을를] 통(?:해|하여)|에 있어(?:서|(?=[\s,]))|되어(?:지|진)|(?:에서|에로|으로|으로부터)의/g,
    message: (h) => `번역투 "${h}"가 있어요.`,
    fix: '"X에 대해 설명" 대신 "X를 설명", "lint를 통해" 대신 "lint로", "되어진" 대신 "된", "실무에서의 사용" 대신 "실무에서 쓰는 법"처럼 바꾸세요.',
  },
  {
    rule: 'style-cliche',
    pattern: /시사하는 바가 크|주목할 만하|본질적으로|핵심적으로|[인한] 것이다/g,
    message: (h) => `상투어 "${h}"가 있어요.`,
    fix: '빼거나, 무엇이 왜 중요한지 구체적인 사실과 숫자로 쓰세요. "~인 것이다"는 "~다/~예요"로 끝내세요.',
  },
  {
    rule: 'style-pivot',
    pattern: /결론적으로|따라서|이를 통해|그러므로|요약하면|정리하면/g,
    min: 4,
    message: (_h, n) => `결산 표현(결론적으로, 따라서 등)이 ${n}번 나와요.`,
    fix: '한두 번만 남기고 나머지는 지우세요. 문장 자체가 흐름을 잡게 쓰세요.',
  },
  {
    rule: 'style-hype',
    pattern: /파격적|압도적|강력한|획기적|치명적|혁신적/g,
    min: 3,
    message: (_h, n) => `과장 어휘가 ${n}번 나와요.`,
    fix: '형용사 대신 수치나 비교로 쓰세요. 예: "획기적으로 빨라요" 대신 "820ms에서 140ms로 줄었어요".',
  },
  {
    rule: 'style-connective',
    pattern:
      /(?:^|[.!?]\s+|\n\s*(?:[-*]\s+)?)(?:또한|따라서|즉|나아가|아울러|게다가|더욱이)(?=[\s,])/g,
    min: 5,
    message: (_h, n) => `문장 첫머리 접속사가 ${n}번 나와요.`,
    fix: '대부분 지우세요. 앞뒤 문장의 내용만으로 이어지게 쓰세요.',
  },
  {
    rule: 'style-english-quote',
    pattern: /(?:[A-Za-z][A-Za-z'’-]*[\s,]+){5,}[A-Za-z][A-Za-z'’-]*/g,
    message: (h) => `영어 문장 인용 "${h.slice(0, 40)}"이 있어요.`,
    fix: '한국어로 옮겨 쓰세요. 현업 영어 용어는 단어 단위로 그대로 쓰고, 처음 나오면 "새 용어"에 풀이를 남기세요.',
  },
]

export function styleSeverity(now: Date): 'error' | 'warning' {
  return now >= STYLE_ENFORCE_FROM ? 'error' : 'warning'
}

export function lintStyle(
  body: string,
  file: string,
  bodyLine: number,
  now = new Date(),
  opts: MaskOptions = {},
): Issue[] {
  const text = maskNonProse(body, opts)
  const severity = styleSeverity(now)
  const issues: Issue[] = []
  for (const r of RULES) {
    const hits = [...text.matchAll(r.pattern)]
    if (hits.length === 0 || hits.length < (r.min ?? 1)) continue
    const report = r.min ? hits.slice(0, 1) : hits
    for (const h of report) {
      const at = (h.index ?? 0) + (h[0].length - h[0].trimStart().length)
      issues.push({
        file,
        line: lineAt(text, at, bodyLine),
        rule: r.rule,
        severity,
        message: r.message(h[0].trim(), hits.length),
        fix: r.fix,
      })
    }
  }
  return issues.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
}

/** 본문의 영어 용어(소문자, 중복 없음). 코드·URL·파일명·작업 번호는 제외한다. */
export function extractEnglishTerms(body: string, opts: MaskOptions = {}): string[] {
  const text = maskNonProse(body, opts)
  const out = new Set<string>()
  for (const m of text.matchAll(/\b[A-Za-z][A-Za-z0-9+#-]*\b/g)) {
    const t = m[0]
    // 작업, 게이트, 부채 번호(T-001, TD-005)와 마일스톤, 결정 번호(M1, M2b, D13)는 용어가 아니다
    if (t.length < 2 || /^[A-Z]{1,3}-\d+$/i.test(t) || /^[A-Z]{1,2}\d+[a-z]?$/i.test(t)) continue
    out.add(t.toLowerCase())
  }
  return [...out]
}
