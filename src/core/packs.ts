// 팩 목록과 AGENTS.md 팩 색인(contract.md 10.8절). 팩은 단계별 스킬 묶음이고, 스킬 원본은 라이브러리의 skills/<스킬>/이다.

export type PackDef = { title: string; skills: string[] }

/** 단계 순서(발견부터 회고까지)로 둔다. 인박스와 색인 표도 이 순서를 따른다 */
export const PACKS: Record<string, PackDef> = {
  owner: { title: '오너 보고', skills: ['owner-protocol'] },
  discover: { title: '발견', skills: ['gotechy-discover'] },
  define: { title: '정의와 계획', skills: ['gotechy-spec', 'gotechy-plan'] },
  design: { title: '디자인', skills: ['gotechy-design'] },
  build: { title: '구현', skills: ['gotechy-build'] },
  verify: { title: '검증', skills: ['gotechy-quality', 'gotechy-security'] },
  ai: { title: 'AI 기능', skills: ['gotechy-ai-eval'] },
  'comply-kr': { title: '한국 법 요구사항', skills: ['gotechy-comply-kr'] },
  ship: { title: '출시', skills: ['gotechy-ship'] },
  operate: { title: '운영', skills: ['gotechy-operate'] },
  grow: { title: '알리기', skills: ['gotechy-launch', 'gotekie-blog-writer'] },
  learn: { title: '회고와 학습', skills: ['gotechy-retro'] },
}

/** AGENTS.md 팩 색인 표의 "일" 칸. 스킬 description의 짧은 판이다 */
export const SKILL_WHEN: Record<string, string> = {
  'owner-protocol': '작업을 끝내고 오너에게 보고할 때(HANDOFF)',
  'gotechy-discover': '문제와 사용자를 확인할 때(인터뷰, 가정, 작은 실험)',
  'gotechy-spec': '아이디어를 스펙으로 만들 때(미니, 풀, 위저드)',
  'gotechy-plan': '스펙을 실행 계획(ExecPlan)으로 옮길 때',
  'gotechy-design': '화면 구조, 와이어프레임, 스타일 가이드를 정할 때',
  'gotechy-build': '코드를 쓰거나 고칠 때(테스트 먼저, 작은 변경)',
  'gotechy-quality': '품질 목표와 테스트 전략을 세우고 검증할 때',
  'gotechy-security': '인증, API, 데이터, 에이전트 권한을 건드렸을 때 보안 리뷰',
  'gotechy-ai-eval': 'LLM 기능의 성공 기준, 골든셋, 채점을 만들 때',
  'gotechy-comply-kr': '개인정보, AI, 광고, 접근성 같은 한국 법 요구사항을 뽑을 때',
  'gotechy-ship': '완료 게이트를 판정하고 출시, 되돌리기를 준비할 때',
  'gotechy-operate': 'SLO, 알림, 장애 대응, 비용을 정할 때',
  'gotechy-launch': '출시를 알리고 검색(SEO, GEO)과 채널을 준비할 때',
  'gotekie-blog-writer': '고텍이 블로그 글을 쓸 때(부모님과 AI 초심자 독자)',
  'gotechy-retro': '마일스톤 회고, ADR, 부채, 커리어 증거를 남길 때',
}

/** `--packs all`은 모든 팩이다 */
export const ALL_PACKS = 'all'

export const ALL_SKILLS = Object.values(PACKS).flatMap((p) => p.skills)

/** 팩 이름 목록을 스킬 목록(중복 없음, 팩 순서)으로 편다. 모르는 팩은 unknown에 */
export function expandPacks(names: string[]): { skills: string[]; unknown: string[] } {
  const unknown: string[] = []
  const wanted = new Set<string>()
  for (const n of names) {
    if (n === ALL_PACKS) for (const s of ALL_SKILLS) wanted.add(s)
    else if (PACKS[n]) for (const s of PACKS[n].skills) wanted.add(s)
    else unknown.push(n)
  }
  return { skills: ALL_SKILLS.filter((s) => wanted.has(s)), unknown }
}

export const ROUTER_START = '<!-- gotechy:packs:start -->'
export const ROUTER_END = '<!-- gotechy:packs:end -->'

/** 깔린 스킬로 팩 색인 표를 만든다. 라이브러리 순서를 따르고 모르는 스킬은 뺀다 */
export function routerTable(installed: string[]): string {
  const rows = ALL_SKILLS.filter((s) => installed.includes(s)).map(
    (s) => `| ${SKILL_WHEN[s] ?? s} | \`.agents/skills/${s}/SKILL.md\` |`,
  )
  return [
    'Claude Code는 같은 파일을 `.claude/skills/`에서 읽는다. 표에 없는 일은 스킬 없이 이 파일의 규칙대로 한다.',
    '',
    '| 일 | 먼저 열 파일 |',
    '|---|---|',
    ...(rows.length > 0 ? rows : ['| (깔린 팩 없음) | `gotechy init --packs owner` |']),
  ].join('\n')
}

/**
 * AGENTS.md의 표시 사이를 표로 바꾼다. 표시가 없거나 순서가 틀리면 undefined(오너가 쓴 라우터는 건드리지 않는다).
 * 표시 밖의 글은 그대로 둔다.
 */
export function replaceRouter(text: string, table: string): string | undefined {
  const start = text.indexOf(ROUTER_START)
  const end = text.indexOf(ROUTER_END)
  if (start === -1 || end === -1 || end < start) return undefined
  if (text.indexOf(ROUTER_START, start + 1) !== -1 || text.indexOf(ROUTER_END, end + 1) !== -1)
    return undefined
  return `${text.slice(0, start + ROUTER_START.length)}\n${table}\n${text.slice(end)}`
}
