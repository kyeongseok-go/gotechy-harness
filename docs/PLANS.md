# PLANS.md — ExecPlan 작성 헌법

> 복잡한 기능·리팩터링·다세션 작업은 반드시 ExecPlan으로 설계부터 구현까지 관리한다.
> 기반: OpenAI Codex Cookbook "Using PLANS.md for multi-hour problem solving" + gotechy-dev 완료 게이트.

## 언제 ExecPlan을 쓰는가

- **쓴다**: 예상 1시간 이상, 파일 5개 이상, 여러 세션에 걸침, 아키텍처에 영향, 되돌리기 어려움
- **안 쓴다**: 오타·소규모 버그픽스·단일 파일 변경 (단, 완료 기준은 동일하게 적용)
- 예상 기간이 **2주를 넘으면 반드시 분할을 제안**한다 (50% 증후군 방어 — 끝이 보이는 단위로 쪼갠다).

## 비타협 요구사항 (NON-NEGOTIABLE)

1. **완전 자기완결** — 이 저장소와 도메인의 **초보자**(또는 새 세션의 에이전트)가 ExecPlan만 읽고 끝까지 구현할 수 있어야 한다 (novice-guiding).
2. **살아있는 문서** — 진척·발견·결정이 생길 때마다 그 자리에서 개정한다. 완료 후 몰아 쓰지 않는다.
3. **실증 가능한 동작이 산출물** — "정의를 충족했다"가 아니라 "이 명령을 치면 이 출력이 나온다"로 완료를 증명한다.
4. **전문용어는 평이하게 정의** — 처음 등장하는 용어는 한 줄로 풀어 쓴다.

## 필수 섹션

`docs/exec-plans/_template-exec-plan.md`를 복사해 `active/YYYY-MM-DD-슬러그.md`로 시작한다.

| 섹션 | 내용 |
|---|---|
| Purpose / Big Picture | 왜 하는가, 완성되면 무엇이 달라지는가 (사용자가 체감할 변화로) |
| **Progress** | 타임스탬프 체크리스트 — 유일하게 체크리스트가 의무인 곳 |
| **Surprises & Discoveries** | 예상과 달랐던 것 + 증거(로그·코드 스니펫) |
| **Decision Log** | 결정 / 근거 / 날짜 — ADR로 승격할 것은 표시 |
| Outcomes & Retrospective | 완료 시 회고 — 무엇이 남았고 무엇을 배웠나 |
| Context and Orientation | 관련 파일·문서·선행 지식 |
| Plan of Work | 마일스톤 단위 서사 — 각각 "goal, work, result, proof"로 독립 검증 가능하게 |
| Concrete Steps | 정확한 명령어 + 예상 출력 |
| Validation and Acceptance | **행동으로 기술** — 예: "서버 시작 후 `GET /health`가 200 OK" |
| Idempotence and Recovery | 중단 후 재개 방법 |
| Artifacts and Notes | 산출물 원장 (파일·문서·URL·측정치) — 3종 출력의 근거 |
| Interfaces and Dependencies | 노출·의존 계약 (타입/시그니처·API 경로·env 키) |
| career_signals | 이 작업이 만드는 커리어 시그널 (`~/.claude/gotechy-career.yaml`(개인) 또는 `docs/career.example.yaml` 매칭 — gotechy 고유) |

## 완료의 정의 (완료 게이트)

ExecPlan은 아래를 모두 만족해야 `completed/`로 이동할 수 있다. `/gotechy-ship`이 검사한다.

- [ ] Validation and Acceptance의 모든 항목이 실제로 통과 (출력 증거 포함)
- [ ] 테스트 추가·통과 (`docs/QUALITY_BAR.md` 기준)
- [ ] 남은 부채를 `tech-debt-tracker.md`에 기록
- [ ] Outcomes & Retrospective 작성
- [ ] 승격할 결정은 ADR로, 바뀐 구조는 ARCHITECTURE.md에 반영
- [ ] 3종 출력 체크: 콘텐츠 재료(블로그 소재 1줄)와 커리어 시그널이 기록되었는가

## 형식 규칙

- 산문 우선. 체크리스트는 Progress에서만 의무.
- 마일스톤은 프로토타입 우선 — 끝까지 가는 가장 얇은 경로(tracer bullet)를 먼저 뚫는다.
- 중첩 코드펜스 금지 (내부 예시는 들여쓰기 블록).
