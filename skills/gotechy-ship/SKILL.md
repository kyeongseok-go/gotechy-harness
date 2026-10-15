---
name: gotechy-ship
description: 완료 게이트이자 "출시 전에 점검"의 입구. 작업 크기에 맞는 등급(패치, 기능, 출시)으로 동작 증명, CI, 문서, 부채, 품질 점수, 법 요구, eval, 롤백 계획을 검사하고 "N개 중 M개 통과"로 보고한다. 필요하면 gotechy-security, gotechy-comply-kr, gotechy-launch를 부른다. 게이트 명령이 없으면 실패이고, CI가 빨강이면 완료가 아니다. "이제 끝났어?", "완료 처리해줘", "출시 전에 점검해줘"라고 할 때 쓴다. 구현 중이거나 출시 뒤 장애 대응에는 쓰지 않는다.
argument-hint: "[ExecPlan 경로 또는 --patch|--feature|--release]"
---

# gotechy-ship: "대충 끝"을 "증명된 완료"로 바꾼다

완료는 느낌이 아니라 증거다. 이 스킬은 50% 마무리 증후군(거의 다 했는데 끝나지 않는 상태)의 마지막 방어선이다. 최고 수준의 릴리스 엔지니어는 "내 컴퓨터에선 돼요"를 받아 주지 않는다. 지금 HEAD 커밋의 CI 결과, 실행한 명령의 출력, 되돌리는 방법이 있어야 "끝"이라고 말한다. 기준 전체는 `references/bar.md`에 있다.

## 대원칙 (어떤 등급에서도 바뀌지 않는다)

1. **명령이 없으면 실패다.** `npm test`가 "missing script"로 끝나거나 테스트 명령이 정의되지 않았으면 "해당 없음"이 아니라 실패로 보고한다.
2. **부분 점수를 정직하게 보고한다.** 항상 "N개 중 M개 통과, 남은 것 X" 형식이다. 실패를 빼고 통과만 늘어놓지 않는다.
3. **CI가 빨강이거나 아직 도는 중이면 완료가 아니다.** 지금 HEAD 커밋의 필수 체크가 전부 통과해야 한다. 예전 커밋의 초록은 증거가 아니다.
4. **증거 없는 통과는 없다.** 통과 표시마다 실행한 명령과 출력 핵심 줄이 붙는다.

## 언제 쓰나, 쓰지 않나

- 쓴다: 작업이 끝났다고 판단될 때, 머지나 배포 직전, 버전 태그 직전, ExecPlan을 `completed/`로 옮기기 전. "출시 전에 점검해줘"는 이 스킬이 먼저 받고, 필요한 리뷰를 다른 스킬에 맡긴다: 보안 리뷰가 없으면 `gotechy-security`, 법 요구사항 표가 필요하면 `gotechy-comply-kr`, 런치 산출물(카피, SEO, 채널)이 필요하면 `gotechy-launch`.
- 쓰지 않는다: 구현 중(`gotechy-build`), 품질 목표 수립(`gotechy-quality`), 보안 리뷰 자체(`gotechy-security`), 출시 뒤 SLO와 장애 대응(`gotechy-operate`), 홍보 글 자체(`gotechy-launch`).

## 작업 크기와 게이트 등급 (`gotechy-spec`, `gotechy-plan`, `gotechy-build`와 같은 표)

<!-- gotechy:size-table:start -->
| 크기 | 기준 | 스펙 | 계획 | 출시 게이트 |
|---|---|---|---|---|
| 패치 | 1시간 미만, 파일 1~2개, 동작 계약 불변 | 없음 | 없음 | 패치 등급 |
| 작은 기능 | 1일 미만 | 미니 스펙(수용 기준 목록) | 없음. 수용 기준 목록이 검증 목록을 대신한다 | 기능 등급(미니 스펙 경로) |
| 큰 기능 | 1일 이상, 또는 사용자 데이터, 인증, 결제, 외부 발행을 건드림 | 풀 스펙 | ExecPlan | 기능 등급 |
| 제품 | 화면 여러 개나 새 프로젝트 | 위저드 | ExecPlan | 기능 또는 출시 등급 |
<!-- gotechy:size-table:end -->

| 게이트 등급 | 고르는 때 | 검사 단계 |
|---|---|---|
| 패치 | 크기 표의 패치 | 1, 2(CI가 있으면), 3(gotechy 프로젝트면), 5 |
| 기능 | 작은 기능(미니 스펙 경로), 큰 기능, 제품 | 1~6, 8 |
| 출시 | 배포, 공개, 버전 태그, 패키지 발행 | 1~8 전부 |

**미니 스펙 경로(작은 기능의 기능 등급).** ExecPlan이 없다. 1단계의 Validation 실행은 미니 스펙(`docs/product-specs/<슬러그>.md`)의 수용 기준 목록이 대신한다. AC ID마다 판정하는 테스트나 명령과 출력 한 줄을 붙인다. ExecPlan을 전제로 하는 검사(Validation 항목, Artifacts and Notes, Outcomes, `completed/`로 옮기기)는 ExecPlan이 있을 때만 한다.

## 절차

0. **등급 판정.** 인자(`--patch`, `--feature`, `--release`)가 있으면 따르고, 없으면 위 크기 표로 정한다. 애매하면 높은 쪽이다. 산출물: "[등급: 기능] 이유: 큰 기능, 풀 스펙과 ExecPlan 있음" 한 줄을 먼저 알린다.
1. **동작 증명.** 게이트 명령(포맷, 린트, 타입, 테스트, 빌드)을 프로젝트 정의에서 찾아 실제로 실행한다. 찾는 법은 `references/gate-levels.md`를 연다. ExecPlan의 Validation and Acceptance 항목(미니 스펙 경로면 수용 기준 목록)도 하나씩 실행한다. 이번 diff에 새로 생긴 skip, only, xfail이 있으면 실패다(부채 ID가 붙은 것만 예외). 산출물: 명령, 종료 코드, 통과 수, 커버리지 수치.
2. **CI 확인.** `git rev-parse HEAD`와 같은 커밋의 필수 체크를 본다. PR이 있으면 `gh pr checks --required --json name,bucket,state`, 없으면 `gh run list --commit <sha> --json name,status,conclusion`. fail, pending, cancel이 하나라도 있으면 실패다. skipping인 필수 체크는 왜 건너뛰었는지 확인한다(GitHub는 skipped를 통과로 친다). 기능, 출시 등급에서 CI 자체가 없으면 실패이고, 고치는 법으로 `references/ci-template.md`의 틀을 제안한다. 산출물: sha와 체크별 결과.
3. **하네스 무결성.** `orchestration/tasks/`가 있는 gotechy 프로젝트면 `gotechy doctor`를 돌려 exit 0을 본다. 실패는 등급과 무관하게 보고한다. 산출물: 종료 코드와 실패 항목.
4. **문서 동기화.** 스펙과 실제 동작이 어긋나면 스펙을 고치고 변경 이력에 한 줄 남긴다(상태: 출시됨). 이번 작업의 스펙 경로(ExecPlan 머리의 `- 스펙:` 줄, 미니 스펙 경로면 그 스펙 파일)만 `grep -rn "NEEDS CLARIFICATION\|SYNC NEEDED" <스펙 경로>`로 보고 비어야 한다. 다른 기능의 스펙에 남은 표시는 이번 게이트와 무관하다. 생성 문서 명령이 있으면 돌린 뒤 `git status --porcelain <생성 폴더>`가 비어야 한다. 구조가 바뀌었으면 ARCHITECTURE와 ADR(`docs/decisions/`)을 확인한다. 산출물: 고친 문서 목록.
5. **부채 기록.** 남긴 부채를 `docs/exec-plans/tech-debt-tracker.md`(없으면 `references/evidence.md`의 틀로 만든다)에 ID, 심각도, 이자, 상환 계획과 함께 적는다. 패치 등급도 면제가 없다. 산출물: 새 부채 ID 목록 또는 "새 부채 없음, 근거: diff의 새 TODO 0건".
6. **품질 판정.** 품질 목표 문서(`docs/product-specs/<슬러그>/15-quality-goals.md` 또는 `docs/quality/goals-<슬러그>.md`)에 미판정, 불합격, `[NEEDS CLARIFICATION]`이 남아 있으면 실패다. 인증, API, DB, 개인정보를 건드렸으면 `docs/security/reviews/`에 이번 작업의 리뷰가 있고 미해결 높음이 0이어야 한다(없으면 `gotechy-security` 스킬로 넘긴다). `docs/compliance/<슬러그>.md`가 있으면 상태가 완료가 아닌 출시 차단 행이 0이어야 한다(없는데 법 의무가 걸리면 `gotechy-comply-kr`로 넘긴다). LLM 기능이면 `docs/evals/<기능>/`의 최근 결과가 합격선을 넘고, 결과의 "평가한 sha" 뒤로 프롬프트와 AI 코드 경로가 바뀌지 않았어야 한다(`git diff --quiet <sha> HEAD -- <경로>`, 바뀌었으면 `gotechy-ai-eval`로 다시 돌린다). 마지막으로 `docs/quality/score.md`(없으면 만든다)에서 **이번 작업이 건드린 영역만** 등급을 갱신한다. 등급 하락도 그대로 적는다. 산출물: 영역별 등급 변화.
7. **출시 준비(출시 등급).** `references/release.md`로 출시 준비 질문, 버전 번호, CHANGELOG, 환경 변수 대조, 비밀, 점진 출시 계획, provenance를 확인한다. `references/rollback.md`로 롤백 명령과 마이그레이션 안전(expand-contract)을 확인한다. 배포 명령은 실행하지 않는다. 산출물: 출시 점검표와 롤백 한 줄 명령.
8. **출력 변환과 마무리.** 블로그 소재와 커리어 증거는 ExecPlan의 Artifacts and Notes 절(콘텐츠 재료 줄, `career_signals`)에서 읽는다. 둘은 오너 설정(커리어 파일)이 있을 때만 검사하고, 없으면 검사 수에서 뺀다. 위키 적재 후보는 경로만 나열한다. 1~7단계가 모두 통과하고 Outcomes & Retrospective가 채워졌을 때만 ExecPlan을 `docs/exec-plans/completed/`로 옮긴다(미니 스펙 경로는 옮길 계획이 없다). 출시 2주 뒤 성공 기준을 재는 후속 항목을 부채 표에 넣는다. 자세한 기준은 `references/evidence.md`를 연다. 산출물: 이동한 파일 경로.
9. **보고.** 아래 형식으로 부분 점수를 보고하고, 미통과면 멈추지 말고 이어서 처리할지 묻는다. 위임받은 작업이면 `owner-protocol` 스킬의 HANDOFF 형식을 따르고, 게이트 결과를 "증거" 절에 `` `명령`: 결과`` 형식으로 넣는다.

```
[등급: 기능] 게이트 7개 중 6개 통과 (HEAD 3f2a91c)
[통과] 1 동작 증명: `npm test` 42 passed, 새 skip 0, 줄 커버리지 83%
[통과] 2 CI: `gh pr checks 12 --required` 필수 4개 pass, sha 일치
[통과] 3 하네스: `gotechy doctor` exit 0
[실패] 4 문서 동기화: 스펙 상태가 "작성 중" 그대로 (예상 10분)
[통과] 5 부채: TD-004 등록
[통과] 6 품질: 테스트 B 유지, 보안 리뷰 높음 0
[통과] 8 출력: Artifacts and Notes의 커리어 증거 PR #12 링크, 블로그 소재 1줄
남은 것 1개. 지금 이어서 처리할까요?
```

## 기준 요약 (전체와 등급 판정은 `references/bar.md`)

1. 게이트 명령은 전부 실제로 실행했고 종료 코드 0이다. 정의되지 않은 명령은 실패로 센다.
2. HEAD 커밋의 CI 필수 체크가 전부 pass다. pending, fail, cancel이 0이고 skipped는 사유가 확인됐다.
3. 이번 diff로 늘어난 skip, only, xfail, 지운 테스트가 0이다(부채 ID가 붙은 것 제외).
4. 보고는 "N개 중 M개 통과"이고, 통과 항목마다 명령과 출력이 붙는다.
5. 새 부채는 7칸(ID, 등록일, 내용, 위치, 심각도, 이자, 상환 계획)을 모두 채워 기록됐다.
6. 출시는 되돌릴 수 있다. 롤백 한 줄 명령이 런북에 있고, 파괴적 마이그레이션이 코드 변경과 같은 배포에 들어 있지 않다.
7. 버전 번호와 CHANGELOG가 SemVer 2.0.0과 Keep a Changelog 1.1.0을 따르고, 이미 발행한 버전을 다시 쓰지 않는다.
8. 커리어 증거(오너 설정이 있을 때)는 역량 이름이 아니라 제3자가 확인할 수 있는 링크나 수치다.

## 산출물과 저장 위치

| 산출물 | 위치 |
|---|---|
| 게이트 보고 | 대화 응답, 위임 작업이면 HANDOFF의 "증거" 절 |
| 품질 등급표 | `docs/quality/score.md` (없으면 `references/gate-levels.md`의 틀로 만든다) |
| 부채 | `docs/exec-plans/tech-debt-tracker.md` (없으면 만든다) |
| 완료한 계획 | `docs/exec-plans/completed/YYYY-MM-DD-<슬러그>.md` |
| 변경 기록(출시) | 저장소 루트 `CHANGELOG.md` (없으면 만든다) |
| 롤백 런북(출시) | `docs/operations/runbooks/rollback.md` (`gotechy-operate`와 같은 경로, 없으면 `references/rollback.md`의 틀로 만든다) |

## 완료 기준

- 등급에 해당하는 검사가 모두 통과했고, 각 통과에 명령과 출력이 붙어 있다.
- 실패가 남았다면 그 항목이 부채 표에 기록됐고, 보고에 "N개 중 M개"로 드러나 있다. 이 경우 "완료"가 아니라 "부분 통과"라고 쓴다.
- CI가 빨강이거나 pending이면 ExecPlan을 옮기지 않고, HANDOFF status를 done으로 쓰지 않는다.

## 하지 않는 것

- 명령이 없다는 이유로 검사를 건너뛰거나 "해당 없음"으로 바꾸지 않는다.
- 테스트를 지우거나 skip하거나 기대값을 바꿔 초록을 만들지 않는다.
- CI를 다시 돌려 운으로 초록을 얻고 끝내지 않는다. 같은 커밋이 실패와 통과를 오가면 flaky 테스트로 부채에 적는다.
- 배포, 버전 태그 push, 외부 발행, 위키 적재를 실행하지 않는다. 사용자가 명시적으로 지시했을 때만 한다.
- 품질 점수표의 모든 영역을 한꺼번에 다시 매기지 않는다. 건드린 영역만 갱신한다.

게이트 결과를 오너에게 설명할 때는 `references/lens.md`를 연다. 회고를 깊게 하려면 `gotechy-retro` 스킬로 이어 간다.
