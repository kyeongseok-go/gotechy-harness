# gotechy-ship 기준 (bar)

완료 판정과 출시 점검을 할 때, 등급을 매길 때 연다.

## 이 bar가 지키는 것

"끝났다"는 말이 지금 HEAD 커밋의 실행 증거로 뒷받침되고, 출시한 것은 5분(하네스 기본값) 안에 되돌릴 수 있고, 남긴 빚은 이자와 함께 기록된다. Google SRE 책은 장애의 약 70%가 운영 중인 시스템의 변경에서 온다고 쓴다. 그래서 이 bar는 변경을 내보내는 순간을 가장 엄격하게 본다. 측정 가능한 증거가 없는 항목은 통과로 세지 않는다.

## 기준의 원천

이번 세션(2026-10-16)에 원문을 직접 열어 확인한 것만 적었다.

| 원천 | 판 | 발행일, 시행일 | URL | 확인일 |
|---|---|---|---|---|
| Google SRE 책 8장 Release Engineering | 웹판 (O'Reilly, CC BY-NC-ND 4.0) | 웹판 저작권 2017 | https://sre.google/sre-book/release-engineering/ | 2026-10-16 |
| Google SRE 책, Reliable Product Launches at Scale (LCE, 점진 출시, 기능 플래그 1~10%) | 웹판 | 2017 | https://sre.google/sre-book/reliable-product-launches/ | 2026-10-16 |
| Google SRE 책 부록, Launch Coordination Checklist | 웹판 | 2017 | https://sre.google/sre-book/launch-checklist/ | 2026-10-16 |
| Google SRE 책, The Evolving SRE Engagement Model (Production Readiness Review) | 웹판 | 2017 | https://sre.google/sre-book/evolving-sre-engagement-model/ | 2026-10-16 |
| Google SRE 책, Introduction (변경 장애 약 70%, 점진 출시와 안전한 롤백) | 웹판 | 2017 | https://sre.google/sre-book/introduction/ | 2026-10-16 |
| The SRE Workbook 16장 Canarying Releases | 웹판 (O'Reilly, CC BY-NC-ND 4.0) | 2018 | https://sre.google/workbook/canarying-releases/ | 2026-10-16 |
| DORA metrics 가이드 (지표 5개: 처리량 3, 불안정성 2) | 최종 갱신판 | 2026-01-05 | https://dora.dev/guides/dora-metrics/ | 2026-10-16 |
| DORA 2025 보고서(State of AI-assisted Software Development) | 2025 보고서 (2026년판은 확인일 기준 없음) | 2025-09-23 (Google 블로그 발표) | https://dora.dev/research/2025/dora-report/ | 2026-10-16 |
| OpenFeature 명세 (평가 실패 시 기본값, 요구사항 1.4.10) | v0.9.0 | 2026-07-29 (GitHub 릴리스) | https://openfeature.dev/specification/sections/flag-evaluation | 2026-10-16 |
| Keep a Changelog | 1.1.0 | 2019-11-11 (GitHub 릴리스) | https://keepachangelog.com/en/1.1.0/ | 2026-10-16 |
| Semantic Versioning | 2.0.0 | (발행일 확인 못 함) | https://semver.org/ | 2026-10-16 |
| SLSA 명세 (Build 트랙 L1~L3, Source 트랙 추가) | v1.2 | 2025-11-24 | https://slsa.dev/spec/v1.2/build-track-basics | 2026-10-16 |
| GitHub artifact attestations (기본 SLSA v1.0 Build L2, 재사용 워크플로로 L3) | 현재 문서 | (확인 못 함) | https://docs.github.com/en/actions/concepts/security/artifact-attestations | 2026-10-16 |
| GitHub protected branches, 필수 상태 체크 (skipped, neutral도 성공으로 침) | 현재 문서 | (확인 못 함) | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches | 2026-10-16 |
| Parallel Change (expand, migrate, contract), Danilo Sato | 원문 | 2014-05-13 | https://martinfowler.com/bliki/ParallelChange.html | 2026-10-16 |
| OWASP Secrets Management Cheat Sheet (회전, 폐기, 유출 대응 순서) | 현재 문서 | (판 없음) | https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html | 2026-10-16 |

이 bar의 수치 중 원천에 없는 것은 이 하네스가 정한 기본값이고, 그 자리에 "(하네스 기본값)"이라고 적었다. 프로젝트가 `gotechy-quality` 스킬로 다른 값을 정했으면 그 값이 이긴다.

## 측정형 체크리스트

`[기계]`는 도구나 명령으로 판정하고 줄 끝에 `도구: <이름이나 명령>`을 적는다. `[사람]`은 리뷰로 판정한다. 괄호 안은 해당 등급이다. 미니 스펙 경로(작은 기능)에서는 ExecPlan을 전제로 하는 항목(4, 26, 27, 28)을 미니 스펙의 수용 기준 목록으로 대신하거나 뺀다.

### A. 증거 (전 등급)

1. [기계] 프로젝트에 정의된 게이트 명령(포맷, 린트, 타입, 테스트, 빌드)이 각각 종료 코드 0이다. 정의되지 않은 명령은 실패로 센다. 도구: 프로젝트 스크립트와 셸 종료 코드
2. [기계] 이번 diff가 늘린 skip, only, xfail, 지운 테스트가 0건이다(부채 ID 주석이 붙은 것만 예외). 도구: `git diff <기준>...HEAD`에 `\.skip\(|\.only\(|@pytest\.mark\.(skip|xfail)|t\.Skip\(|it\.todo` grep
3. [기계] 테스트 커버리지가 프로젝트 기준 이상이다. 기준이 없으면 `gotechy-quality` 스킬의 값을 쓴다: 신규 코드 줄 커버리지 80% 이상(Sonar way 기본값), 전체는 하락 금지, 핵심 모듈은 mutation 점수 60 이상, A등급은 80(하네스 기본값). 러너의 threshold 설정으로 강제되면 A등급 조건을 채운다. 도구: 테스트 러너의 커버리지 리포트와 mutation 도구(StrykerJS, PIT, mutmut)
4. [기계] ExecPlan의 Validation and Acceptance 항목마다 실행한 명령과 출력 한 줄이 있다. 항목 수와 증거 수가 같다. 미니 스펙 경로면 수용 기준(AC ID)마다 같다. 도구: grep으로 항목 수와 증거 줄 수를 센다
5. [기계] (기능, 출시, 그리고 CI가 있는 패치) `git rev-parse HEAD`와 같은 sha의 필수 체크가 전부 pass다. fail, pending, cancel 0건. bucket이 skipping인 필수 체크는 사유를 확인했다. 도구: `gh pr checks --required --json name,bucket,state`
6. [기계] gotechy 프로젝트(`orchestration/tasks/` 있음)면 `gotechy doctor` exit 0. 도구: `gotechy doctor`

### B. 문서와 부채

7. [기계] (기능 이상) 이번 작업의 스펙 경로(ExecPlan 머리의 `- 스펙:` 줄, 미니 스펙 경로면 그 스펙 파일)에 미결 표시가 0줄이다. 다른 기능의 스펙은 보지 않는다. 도구: `grep -rn "NEEDS CLARIFICATION\|SYNC NEEDED" <스펙 경로>`
8. [기계] (기능 이상) 생성 문서 명령이 있으면 실행 후 생성 폴더에 바뀐 파일이 없다. 도구: `git status --porcelain <생성 폴더>`
9. [사람] (기능 이상) 스펙의 상태와 변경 이력이 실제 동작과 맞다. 구조가 바뀌었으면 ADR이 있다.
10. [기계] (전 등급) 새 부채 행의 7칸(ID, 등록일, 내용, 위치, 심각도, 이자, 상환 계획)이 모두 채워져 있다. "부채 없음"이면 diff의 새 `TODO`, `FIXME`, `HACK`이 0건이다. 도구: awk로 빈 칸 세기, `git diff`에 grep

### C. 품질 판정 (기능, 출시)

11. [기계] 품질 목표 문서에 미판정 0, 불합격 0, `[NEEDS CLARIFICATION]` 0. 도구: grep
12. [기계] 인증, API, DB, 개인정보를 건드렸으면 `docs/security/reviews/`에 이번 작업 날짜의 리뷰가 있고 미해결 높음이 0건이다. 도구: `ls docs/security/reviews/`와 grep
13. [기계] LLM 기능이면 `docs/evals/<기능>/results/`의 최근 결과가 합격선을 넘고, 그 결과의 "평가한 sha" 뒤로 감시 경로(프롬프트와 AI 코드)에 바뀐 것이 없다. 바뀌었으면 `gotechy-ai-eval`로 다시 돌린다. 도구: `git diff --quiet <평가한 sha> HEAD -- <감시 경로>`
14. [기계] `docs/compliance/<슬러그>.md`가 있으면 출시 차단으로 표시한 행 중 상태가 완료가 아닌 행이 0개다. 법 의무가 걸리는데 표가 없으면 `gotechy-comply-kr`로 넘긴다. 도구: `grep -E '^\| R[0-9]+ ' docs/compliance/<슬러그>.md | grep '출시 차단' | grep -vc '| 완료'`
15. [사람] `docs/quality/score.md`에서 건드린 영역의 등급과 날짜가 갱신됐다. 내려간 등급도 그대로 적혔다.

### D. 출시 준비 (출시)

16. [기계] 새 버전 번호가 SemVer 2.0.0 규칙을 따른다. 1.0.0 이후 깨지는 변경은 MAJOR를 올린다. 새 버전 태그가 아직 없다(발행한 버전을 다시 쓰지 않는다, SemVer 규칙 3). 도구: `git tag -l <새 버전>`
17. [기계] `CHANGELOG.md`에 새 버전 절이 있고 날짜가 `YYYY-MM-DD`이며, 항목이 `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security` 중 하나로 분류됐고, 바로 위 Unreleased 절이 비었다. 도구: grep
18. [기계] `.env.example`의 키 목록과 배포 환경의 키 목록 차이가 0이다. 누락 키가 있으면 배포 중단. 도구: 두 키 목록을 정렬해 `diff`
19. [기계] 비밀 검사로 이번 변경 범위 검출 0건. 비밀마다 마지막 회전일이 기록돼 있고 90일 이내다(하네스 기본값, OWASP는 주기를 정하지 않고 "정기적으로"라고만 쓴다). 도구: gitleaks
20. [사람] DB 마이그레이션이 있으면 expand, migrate, contract 중 어느 단계인지 적혀 있고, 컬럼 삭제, 이름 바꾸기, NOT NULL 추가 같은 파괴적 변경이 그것을 쓰는 코드 변경과 같은 배포에 없다. [기계] Postgres면 마이그레이션 린터 경고 0건. 도구: squawk
21. [사람] 롤백 런북에 한 줄 롤백 명령이 있고, 마지막 롤백 리허설이 90일 이내이며, 걸린 시간이 5분 이하다(하네스 기본값).
22. [사람] 사용자 영향이 큰 변경은 점진 출시 계획이 있다: 처음 노출 1~10%(SRE 책의 기능 플래그 관행), 판정 지표(SLI에서 고른 12개 이하), 중단 조건 수치, 단계별 대기 시간.
23. [기계] 새 기능 플래그는 평가 실패 시 기본값을 돌려주고(OpenFeature 1.4.10), 기본값은 옛 동작이다. 플래그마다 제거 예정일이 부채 표에 있다. 도구: 플래그 평가 실패를 흉내 낸 테스트와 부채 표 grep
24. [기계] 남이 내려받는 산출물(패키지, 컨테이너 이미지, 바이너리)을 배포하면 SLSA Build L2 이상의 provenance가 있고 검증 명령이 통과한다. 도구: `gh attestation verify`
25. [사람] 출시 준비 질문 10개 영역(`references/release.md`)에 답이 있고, 답할 수 없는 영역은 부채로 기록됐다.

### E. 출력 변환과 마무리 (기능, 출시)

26. [사람] (오너 설정, 즉 커리어 파일이 있을 때만) ExecPlan의 Artifacts and Notes에 있는 커리어 증거가 제3자가 열어 볼 수 있는 링크(PR, 배포 URL, 측정 기록)나 수치 1개 이상이다.
27. [사람] (오너 설정이 있을 때만) ExecPlan의 Artifacts and Notes에 블로그 소재 1줄 이상이 있다.
28. [기계] ExecPlan이 `docs/exec-plans/completed/`에 있고 Outcomes & Retrospective 절이 비어 있지 않다. 출시 2주 뒤 측정 항목이 부채 표에 있다. 도구: `ls docs/exec-plans/completed/`와 awk로 절 내용 세기

### F. 흐름 측정 (A등급 조건)

29. [기계] 서비스마다 DORA 지표 5개를 기록한다: 배포 빈도, 변경 리드타임(커밋에서 프로덕션까지), 변경 실패율(즉시 조치가 필요했던 배포 비율), 실패한 배포 복구 시간, 배포 재작업률(사고 때문에 생긴 계획 밖 배포 비율). DORA는 이 지표를 목표로 쓰지 말라고 한다. 추세를 보는 데만 쓴다. 도구: 배포 기록(`gh run list`, 배포 도구 로그)을 세는 스크립트

## 등급 판정

이 영역의 등급은 `docs/quality/score.md`의 "출시와 변경 관리" 행에 적는다.

- **A (최고 전문가)**: 해당 등급 체크리스트 전부 통과 + 게이트 명령이 CI 필수 체크로 묶여 머지를 막고(branch protection이나 rulesets), 커버리지 기준이 러너 설정으로 강제되고, DORA 지표 5개를 기록 중 + 최근 4주 동안 변경 실패율 0(즉시 롤백이나 핫픽스가 필요했던 배포 0건).
- **B (출시 가능)**: 전부 통과했지만 일부가 수동이다(예: CI가 머지를 막지 않음, 롤백 리허설을 손으로 함).
- **C (부채 있음)**: 미달 항목이 있지만 모두 부채 표에 ID와 이자와 함께 기록됐고, 보고에 부분 점수로 드러났다.
- **D (위험)**: 미달이 기록조차 없거나, CI가 빨강인데 완료로 표시했거나, 비밀이 유출됐거나, 되돌릴 수 없는 마이그레이션을 롤백 계획 없이 출시했다.

## 최고 전문가가 더 하는 것

1. **"초록"을 sha로 말한다.** 어느 커밋의 CI인지 적지 않은 통과는 받지 않는다. GitHub의 엄격 모드(브랜치가 기준 브랜치와 최신이어야 머지)를 켠다. 근거: GitHub protected branches 문서.
2. **skipped를 의심한다.** GitHub는 skipped와 neutral을 성공으로 친다. 조건부로 건너뛴 필수 체크는 "검사 안 함"과 같다.
3. **배포와 출시를 나눈다.** 코드는 꺼진 플래그 뒤로 먼저 배포하고, 1~10%에게 켠 뒤 넓힌다. 근거: SRE 책 Reliable Product Launches.
4. **마이그레이션은 세 번 배포한다.** expand, migrate, contract를 따로 내보내고, contract를 날짜 박은 부채로 남긴다. contract를 건너뛰면 시작보다 나쁜 상태가 된다고 원문이 경고한다. 근거: Parallel Change.
5. **카나리 지표를 적게, 쪼개서 본다.** SLI에서 고른 12개 이하 지표를 카나리 집단과 대조 집단으로 나눠 보고, 지표 집계 간격을 카나리 기간 이하로 둔다. 5% 카나리의 오류 20%는 전체 지표에서 1%로 묻힌다. 근거: SRE Workbook Canarying Releases.
6. **체크리스트 항목마다 이유를 단다.** "이 질문은 어느 사고 때문에 있나"를 적고, 이유 없는 항목은 지운다. 근거: SRE 책 LCE 장("모든 질문의 중요성은 입증돼야 한다, 이상적으로는 이전 출시 사고로").
7. **흐름 지표를 목표로 삼지 않는다.** DORA 지표는 서비스 단위로 재고 여러 개를 함께 보며, 목표로 정하면 숫자를 꾸미게 된다(Goodhart의 법칙). 근거: DORA metrics 가이드.
8. **발행물은 불변이다.** 같은 버전 번호로 다시 올리지 않고, 산출물에 provenance를 붙여 "이 파일이 이 커밋에서 이 빌드로 나왔다"를 증명한다. 근거: SemVer 규칙 3, SLSA v1.2.

## 흔한 실패와 고치는 법

| 실패 | 고치는 법 |
|---|---|
| "테스트 스크립트가 없어서 해당 없음"으로 통과 처리 | 실패로 보고하고, 명령을 정의하는 일을 다음 단계 첫 줄에 둔다 |
| 로컬은 초록, CI는 빨강이나 pending인데 "완료" | HEAD sha의 필수 체크를 확인하기 전에는 완료라고 쓰지 않는다 |
| 실패하는 테스트를 skip하거나 지워서 초록 | diff에서 skip 증가를 grep하고, 있으면 실패로 센다. 정말 미룰 것이면 부채 ID를 붙인다 |
| "거의 다 됐어요"로 미통과를 흐림 | "N개 중 M개 통과, 남은 것 X(예상 시간)"로만 쓴다 |
| 컬럼 삭제와 코드 변경을 한 배포에 넣음 | expand-contract로 나누고, 롤백해도 옛 코드가 새 스키마에서 도는지 확인한다 |
| 장애 중에 롤백 명령을 처음 검색 | 런북에 한 줄 명령을 적고 분기마다 리허설한다 |
| CHANGELOG에 커밋 로그를 그대로 붓기 | 사람이 읽는 6개 분류로 쓰고, 사용자에게 보이는 변화만 남긴다 |
| 기능 플래그가 1년째 남음 | 플래그를 만들 때 제거 예정일을 부채 표에 함께 넣는다 |
| 비밀이 커밋된 뒤 이력만 지움 | 폐기(revoke), 새 비밀 발급, 노출 위치 삭제, 접근 기록 보존 순서로 한다(OWASP). 이력 정리는 마지막이다 |
| 품질 점수표 6개 영역을 매번 다 매기려다 결국 아무것도 안 함 | 이번 작업이 건드린 영역만 갱신한다 |
