# ExecPlan 규칙과 틀

언제 여는 파일인가: 계획 파일을 처음 쓸 때(절차 6단계), 그리고 기존 계획의 형식이 맞는지 볼 때.

## 1. 비타협 요구

1. **혼자 읽힌다.** 저장소와 도메인을 처음 보는 사람, 또는 기억이 없는 새 세션의 에이전트가 이 파일만 읽고 끝까지 구현할 수 있어야 한다. 다른 문서를 가리킬 때는 경로와 함께 필요한 내용을 한두 줄로 옮겨 적는다.
2. **살아 있다.** 진척, 발견, 결정이 생길 때마다 그 자리에서 고친다. 끝나고 몰아 쓰지 않는다. 고친 뒤에도 1번을 만족해야 한다.
3. **동작이 산출물이다.** "정의를 충족했다"가 아니라 "이 명령을 치면 이 출력이 나온다"로 끝을 증명한다.
4. **용어를 풀어 쓴다.** 처음 나오는 전문 용어는 한 줄로 설명하거나 쓰지 않는다.

## 2. 필수 절

| 절 | 내용 |
|---|---|
| Purpose / Big Picture | 왜 하는가, 끝나면 사용자가 무엇을 다르게 할 수 있나(2~4문장). 범위 밖도 적는다 |
| Progress | 타임스탬프 체크리스트. 체크리스트가 허용되는 유일한 절 |
| Surprises & Discoveries | 예상과 다른 것과 증거(짧은 출력, 수치) |
| Decision Log | 결정, 근거, 날짜, ADR 승격 여부. 바뀐 결정은 새 행, 옛 행에 "대체됨" |
| Outcomes & Retrospective | 끝날 때: 만든 것, 남은 것, 배운 것, 다음에 바꿀 것 |
| Context and Orientation | 관련 파일 경로, 선행 문서(스펙, ADR), 실행 환경, 용어 풀이, 확인한 명령 |
| Plan of Work | 마일스톤 서사(아래 3절 형식) |
| Pre-mortem and Risks | 실패 가정 이유 5개 이상과 위험 표(`references/risk.md`) |
| Concrete Steps | 정확한 명령, 실행 위치, 예상 출력. 4칸 들여쓰기 블록 |
| Validation and Acceptance | 스펙 AC ID마다 명령과 예상 출력 또는 관찰 행동. 결과 칸은 실행 뒤 채움 |
| Idempotence and Recovery | 중단 뒤 재개, 되돌리기, 데이터 백업과 복원 |
| Artifacts and Notes | 만든 파일, 문서, URL, 측정 결과의 원장 |
| Interfaces and Dependencies | 노출하거나 의존하는 계약: 함수 시그니처, API 경로, 환경 변수 이름, 외부 서비스와 버전 |

## 3. 마일스톤 형식

각 마일스톤은 혼자 검증되고 전체 목표를 한 걸음 진척시킨다. 서사이지 관료 문서가 아니다.

    ### M1: 내보내기 버튼 하나로 CSV 한 줄이 내려받아진다 (tracer bullet)

    - 크기: 2일
    - goal: 사용자가 거래 목록에서 내보내기를 누르면 CSV 파일이 내려받아진다
    - work: 버튼, 서버 라우트, 직렬화 함수 하나를 가장 단순하게 잇는다. 필터와 대용량은 뒤로 미룬다
    - result: 로컬 서버에서 버튼을 누르면 1행짜리 파일이 생긴다
    - proof: 실행: bun test tests/export.test.ts / 예상: 3 pass, 0 fail

규칙:

- `- proof:` 줄은 `실행: <명령> / 예상: <출력의 핵심 줄>` 형식이다. 화면 확인이 필요하면 "예상:"에 무엇을 누르면 무엇이 보이는지 쓴다.
- M1은 끝까지 가는 가장 얇은 세로 조각이다. 이름 끝에 `(tracer bullet)`을 붙인다.
- 게이트 명령(lint, 타입, 테스트)과 CI가 없으면 만든다. 이 일은 M1의 work에 기능 조각과 함께 넣고, M1의 proof는 그 게이트 명령으로 쓴다. CI 틀은 `gotechy-ship` 스킬에 있고, 워크플로 파일은 `.github/workflows/`에 둔다.
- 크기는 1주 이하. 넘으면 쪼갠다.
- 프로토타입 마일스톤은 이름 끝에 `(prototype)`을 붙이고 `- 채택 기준:`과 `- 폐기 기준:` 줄을 더한다. 기존 코드를 건드리지 않고 덧붙이는 방식으로 만든다.

## 4. 형식 규칙

- 산문이 먼저다. 체크리스트는 Progress에만 쓴다.
- 파일 안에 코드 펜스(백틱 세 개, 물결 세 개)를 쓰지 않는다. 명령, 출력, 코드 조각은 4칸 들여쓰기 블록으로 쓴다.
- Progress 줄은 `- [x] (YYYY-MM-DD HH:MM) 한 일` 형식이다. 아직 안 한 일은 `- [ ] (계획한 날짜 HH:MM) 할 일`.
- 위험 표의 ID는 `RK-<번호>`, 스펙 수용 기준은 스펙의 `AC-` ID를 그대로 인용한다.
- 명령은 실행할 폴더를 함께 쓴다(예: "저장소 루트에서").

## 5. 완료의 정의

아래를 모두 만족해야 `docs/exec-plans/completed/`로 옮긴다. 판정은 `gotechy-ship` 스킬이 한다.

1. Validation 항목을 모두 실제로 실행했고 결과(출력 핵심 줄)를 붙였다.
2. 새 테스트를 더했고 전체 테스트가 통과한다.
3. 남은 부채를 `docs/exec-plans/tech-debt-tracker.md`에 적었다.
4. Outcomes & Retrospective를 썼다.
5. ADR로 올릴 결정을 올렸고, 바뀐 구조가 있으면 프로젝트의 구조 문서(예: `ARCHITECTURE.md`)에 반영했다.
6. 콘텐츠 재료 한 줄(블로그나 회고에 쓸 발견)을 Artifacts and Notes에 남겼다. 오너 설정(커리어 파일)이 있을 때만 완료 조건이고, 없으면 권장이다. `gotechy-ship`은 이 절에서 블로그 소재와 커리어 증거를 읽는다.

## 6. 틀

`docs/exec-plans/active/YYYY-MM-DD-<슬러그>.md`에 아래 내용을 복사한다(바깥 펜스는 복사하지 않는다).

```markdown
# [행동으로 쓴 제목, 예: 거래 목록을 CSV로 내려받게 한다]

- 상태: 진행 중
- 스펙: docs/product-specs/<슬러그>.md
- 시작: YYYY-MM-DD
- 전체 크기 추정: (예: 6일, 마일스톤 3개)

## Purpose / Big Picture

(왜 하는가. 끝나면 사용자가 무엇을 다르게 할 수 있나. 범위 밖.)

## Progress

- [ ] (YYYY-MM-DD HH:MM) M1 시작

## Surprises & Discoveries

(날짜, 무엇이 예상과 달랐나, 증거)

## Decision Log

| 날짜 | 결정 | 근거 | 상태 | ADR |
|---|---|---|---|---|

## Outcomes & Retrospective

(끝날 때 작성)

## Context and Orientation

- 관련 파일:
- 선행 문서:
- 실행 환경과 버전:
- 확인한 명령(저장소에서 직접 확인):
    - 테스트:
    - 빌드:
    - 린트:
- 용어:

## Plan of Work

### M1: [사용자 행동 하나가 끝까지 가는 결과] (tracer bullet)

- 크기:
- goal:
- work: (게이트 명령과 CI가 없으면 여기서 만든다)
- result:
- proof: 실행: <명령> / 예상: <출력>

### M2:

- 크기:
- goal:
- work:
- result:
- proof: 실행: <명령> / 예상: <출력>

## Pre-mortem and Risks

가정: YYYY-MM-DD, 이 계획은 실패했다. 그럴듯한 이유:

1.
2.
3.
4.
5.

| ID | 위험 | 가능성 | 영향 | 조기 신호 | 대응 | 담당 |
|---|---|---|---|---|---|---|
| RK-1 | | | | | | |

## Concrete Steps

저장소 루트에서:

    <명령>
    # 예상 출력:
    <출력 핵심 줄>

## Validation and Acceptance

1. AC-?-?.? : 실행: <명령> / 예상: <출력>. 결과: (실행 뒤 붙임)

## Idempotence and Recovery

- 다시 실행:
- 중단 뒤 재개:
- 되돌리기:
- 데이터 백업과 복원:

## Artifacts and Notes

- 콘텐츠 재료 한 줄:

## Interfaces and Dependencies

## 검사 기록

## 리뷰 기록
```

career_signals(선택): 프로젝트나 사용자 홈에 커리어 파일이 있으면 Artifacts and Notes 아래에 "career_signals" 소절을 두고 가설(증명하려는 역량, 매칭 키워드)과 증거(링크, 수치) 칸을 들여쓰기 블록으로 적는다. 없으면 만들지 않는다.
