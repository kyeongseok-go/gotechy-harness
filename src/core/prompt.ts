// 워커에게 주는 지시문. 백엔드(claude, codex)와 무관하게 같은 문장을 쓴다. 스킬 로딩에 기대지 않고 계약을 직접 담는다
// (restricted 모드의 Claude 워커는 스킬을 로드하지 않았다, ExecPlan M1 Surprises).
import { handoffPathFor } from './paths'
import { HANDOFF_SECTIONS, type TaskFrontmatter } from './schema'

export type PromptDecision = {
  gate: string
  question: string
  choice: string
  instruction: string | null
}

export function buildWorkerPrompt(
  task: TaskFrontmatter,
  taskBody: string,
  decisions: PromptDecision[] = [],
): string {
  const handoff = handoffPathFor(task.id)
  const decided =
    decisions.length === 0
      ? []
      : [
          '## 오너 결정 (이번 실행에 반영하세요)',
          ...decisions.map(
            (d) =>
              `- ${d.gate} ${d.question} 결정: ${d.choice}${d.instruction ? `. 다음 지시: ${d.instruction}` : ''}`,
          ),
          '',
        ]
  return [
    `당신은 gotechy 하네스의 워커입니다. 작업 ${task.id} 하나만 수행하고, 결과를 HANDOFF 파일로 남기세요.`,
    '',
    '## 규칙',
    `- 바꿀 수 있는 파일: ${task.ownership.join(', ')} 그리고 ${handoff}. 그 밖의 파일을 바꾸면 실행 전체가 실패 처리됩니다.`,
    '- orchestration/gates/, orchestration/tasks/, .claude/, .agents/, AGENTS.md 는 읽거나 바꾸지 마세요.',
    '- 작업 범위를 넓히지 마세요. 요청하지 않은 기능, 추상화, 설정을 더하지 마세요.',
    `- 완료 판정은 리드가 다음 명령으로 직접 합니다: \`${task.verify}\``,
    '- 확신이 없는 결정이 필요하면 임의로 정하지 말고 HANDOFF의 "결정 필요"에 올리고 status를 needs-decision으로 두세요.',
    '',
    '## 문체 (사람이 쓴 글처럼)',
    '- 한국어 해요체로, 결론을 먼저, 숫자와 사실로 구체적으로 쓰세요.',
    '- 화살표, em-dash, 가운데점, 이모지를 쓰지 마세요. 쉼표와 문장으로 이어 쓰세요.',
    '- 현업 영어 용어(worktree, PR, API 같은 것)는 그대로 쓰고, 처음 쓰는 용어는 "새 용어"에 쉬운 풀이를 남기세요.',
    '',
    '## 작업 명세',
    taskBody.trim(),
    '',
    ...decided,
    `## HANDOFF 작성 (${handoff})`,
    '아래 형식 그대로 쓰세요. 절은 내용이 없어도 두고 "없음"이라고 쓰세요.',
    '',
    '---',
    `task: ${task.id}`,
    'status: done            # done | failed | needs-decision',
    `packs: [${task.packs.join(', ')}]`,
    'skills_loaded: []',
    'new_terms: []           # 이번에 처음 쓴 전문 용어 이름',
    'comprehension_keys: []  # "말해 보기" 질문마다 좋은 답에 들어갈 핵심어 목록. 예: [[해시, salt], [세션]]',
    '---',
    ...HANDOFF_SECTIONS.flatMap((s) => [`## ${s}`, sectionHint(s), '']),
  ].join('\n')
}

function sectionHint(section: (typeof HANDOFF_SECTIONS)[number]): string {
  switch (section) {
    case '결정 필요':
      return [
        '오너가 골라야 할 것만. 없으면 "없음". 결정마다 아래 형식, 막는 결정은 최대 3개이고 있으면 status는 needs-decision:',
        '- [막는] 질문 (또는 [기본값] 질문, [알림] 내용)',
        '  - 선택지: A, B',
        '  - 추천: A',
        '  - 이유: 한 줄',
      ].join('\n')
    case '한 줄 요약':
      return '60자 이내 한 문장.'
    case '한 일':
      return '목록으로. 각 항목 끝에 [확인](직접 확인), [추론](확인한 사실로 판단), [추정](근거 없음) 중 하나.'
    case '증거':
      return '실제로 실행한 것만, `명령`: 결과 형식의 목록. 예: - `bun test`: 49 pass, 0 fail'
    case '건너뛴 것, 확인 못 한 것, 리스크':
      return '최대 3개, 각 항목 끝에 [확인], [추론], [추정] 중 하나. 없으면 "없음".'
    case '새 용어':
      return '- 용어: 쉬운 설명 한 줄. 없으면 "없음".'
    case '말해 보기':
      return '오너가 자기 말로 답해 볼 질문 1~2개.'
    case '다음 단계':
      return '추천 다음 작업 1~2개.'
  }
}
