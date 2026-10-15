# AGENTS.md: 이 프로젝트에서 일하는 법 (gotechy 하네스)

> 지도만 둔다. 일하는 방법은 아래 팩 색인의 스킬이, 파일 형식은 `gotechy` 명령의 검사가 원천이다.
> 원칙: 사람(오너)은 방향을 정하고 결정한다. 에이전트는 실행하고 HANDOFF로 보고한다.

## 일의 흐름

1. 오너와 리드(메인 세션의 에이전트)가 할 일을 정한다. 크기를 먼저 판정해 알린다.
   - 1시간 미만, 파일 1~2개, 동작 계약 불변: 바로 구현(패치 등급).
   - 1일 미만의 작은 기능: 미니 스펙 뒤 구현.
   - 그 이상, 또는 사용자 데이터, 인증, 결제를 건드림: 풀 스펙과 실행 계획(ExecPlan).
   - 제품이나 사이트 단위(화면 여러 개, 새 프로젝트): 스펙 위저드부터.
2. 리드는 맡길 일을 작업 명세로 만든다: `gotechy task new "<제목>" --verify "<판정 명령>" --ownership "<바꿀 경로>" --agent claude`(Codex면 `--agent codex`).
3. 워커는 `gotechy run T-###`로 격리된 worktree에서 일하고, 끝나면 `orchestration/handoffs/T-###.md`(HANDOFF)를 남긴다.
4. 오너는 `gotechy inbox`나 HANDOFF 화면에서 이해하고 결정한다. 결정은 오너만 한다.
5. 리드는 결정을 읽고 다음 작업을 잇는다. 승인된 결과는 `gotechy accept T-###`로 메인에 합친다.

## 단계와 스킬 (위에서 아래로, 필요한 것만)

발견(`gotechy-discover`), 정의(`gotechy-spec`), 품질 목표(`gotechy-quality`), 디자인(`gotechy-design`), 계획(`gotechy-plan`), 구현(`gotechy-build`), 검증(`gotechy-quality`, `gotechy-security`, `gotechy-ai-eval`), 법 요구사항(`gotechy-comply-kr`), 출시(`gotechy-ship`), 운영(`gotechy-operate`), 알리기(`gotechy-launch`), 회고(`gotechy-retro`). 깔린 스킬만 쓸 수 있다. 아래 색인 표가 이 프로젝트에 깔린 것이다.

## 팩 색인 (이 일엔 이 파일)

<!-- gotechy:packs:start -->
Claude Code는 같은 파일을 `.claude/skills/`에서 읽는다. 표에 없는 일은 스킬 없이 이 파일의 규칙대로 한다.

| 일 | 먼저 열 파일 |
|---|---|
| 작업을 끝내고 오너에게 보고할 때(HANDOFF) | `.agents/skills/owner-protocol/SKILL.md` |
<!-- gotechy:packs:end -->

표시 사이의 표는 `gotechy init --packs <팩>`이 깔린 스킬에 맞춰 다시 쓴다. 손으로 고치지 않는다.

## 규칙

- 워커는 작업 명세의 `ownership`에 적힌 파일과 자기 HANDOFF만 바꾼다. 그 밖을 바꾸면 실행 전체가 실패 처리된다.
- 결정은 `orchestration/gates/`에만 기록되고, 오너만 내린다. 워커는 이 폴더를 읽거나 바꾸지 않는다.
- 에이전트는 부작용이 있는 일을 오너의 명시적 지시 없이 하지 않는다: 배포, 외부 발행, force push, 전역 설정 바꾸기(`gotechy setup`), 오너 키와 결정(`gotechy keys`, `decide`, `serve`), 무인 루프(`gotechy loop`).
- 완료는 "산출물 있음 + 검증 통과"다. 검증 명령이 없으면 실패이지 건너뛰기가 아니다.
- 테스트 실패와 미완료는 숨기지 않고 HANDOFF의 리스크 절에 쓴다.
- 보고와 문서는 한국어 해요체(HANDOFF)로, 화살표, em-dash, 가운데점, 이모지 없이 쓴다. `gotechy text lint <파일>`이 검사한다.

## 검사 명령

| 무엇 | 명령 |
|---|---|
| 작업 명세 형식 | `gotechy task lint <파일>` |
| HANDOFF 형식 | `gotechy handoff lint <파일>` |
| 문서 문체 | `gotechy text lint <파일>` |
| 환경과 팩 상태 | `gotechy doctor` |
| 결정 기록 검증 | `gotechy gate verify` |

## 계약

작업 명세, HANDOFF, 게이트의 형식 원문은 하네스 저장소의 파일 계약이다: https://github.com/kyeongseok-go/gotechy-harness/blob/harness-v2/docs/references/contract.md
