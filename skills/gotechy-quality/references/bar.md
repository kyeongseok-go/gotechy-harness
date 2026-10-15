# gotechy-quality bar: 품질 엔지니어링 최고 전문가의 기준

언제 여는 파일인가: 목표 문서와 테스트 전략을 판정할 때, 영역 등급(A~D)을 매길 때.

이 bar가 지키는 것: "품질이 좋다"는 말이 숫자와 명령으로 증명되는 상태. 목표는 조건, 대상, 지표, 목표값이 다 있고 근거가 붙어 있어야 하며, 테스트는 실행됐다는 사실(커버리지)이 아니라 틀린 코드를 잡는다는 사실(mutation, 속성 기반, 재발 방지 테스트)로 평가한다. flaky 테스트와 근거 없는 목표값은 둘 다 신호를 망가뜨리므로 기록과 기한으로 관리한다.

## 기준의 원천 (모두 2026-10-16에 직접 열어 확인)

| 원천 | 판, 상태 | 발행일 | URL |
|---|---|---|---|
| ISO/IEC 25010 제품 품질 모델 | 2023 (2판), 발행됨 | 2023-11 | https://committee.iso.org/standard/78176.html |
| ISO/IEC 25023 제품 품질 측정 | 2016 (1판), 2022 재확인, 개정 단계 90.92 | 2016-06 | https://committee.iso.org/standard/35747.html |
| ISO/IEC DIS 25000-23.2 (25023 후속) | 초안, 40.20 두 번째 DIS 투표(첫 투표 2026-03-16) | 2026-09-10 투표 시작 | https://committee.iso.org/standard/89069.html |
| ISO/IEC 25030 품질 요구사항 틀 | 2019 (2판), 2025 재확인 | 2019-08 | https://committee.iso.org/standard/72116.html |
| ISO/IEC 25019 사용 품질 모델 | 2023 (1판) | 2023-11 | https://committee.iso.org/standard/78177.html |
| ISO/IEC 25002 품질 모델 개요와 사용법 | 2024 (1판) | 2024-03 | https://committee.iso.org/standard/78175.html |
| ISO/IEC/IEEE 29119-1 소프트웨어 테스팅 일반 개념 | 2022 (2판) | 2022-01 | https://committee.iso.org/standard/81291.html |
| ISO/IEC/IEEE 29119-4 테스트 기법 | 2021 (2판) | 2021-10 | https://committee.iso.org/standard/79430.html |
| ISO/IEC/IEEE 29148 요구공학 | 2018 (2판), 개정 단계 90.92 | 2018-11 | https://committee.iso.org/standard/72089.html |
| 25010:2023 특성과 부특성 이름 정리 (iso25000.com) | 실무 정리 | 확인 못 함 | https://iso25000.com/index.php/en/iso-25000-standards/iso-25010 |
| Google Testing Blog, Test Sizes | 블로그 | 2010-12-13 | https://testing.googleblog.com/2010/12/test-sizes.html |
| Google Testing Blog, `Code Coverage Best Practices` | 블로그 | 2020-08-07 | https://testing.googleblog.com/2020/08/code-coverage-best-practices.html |
| Google Testing Blog, `Flaky Tests at Google` (John Micco) | 블로그 | 2016-05-27 | https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html |
| Martin Fowler, `Eradicating Non-Determinism in Tests` | 글 | 2011-04-14 | https://martinfowler.com/articles/nonDeterminism.html |
| Martin Fowler, TestPyramid | 글 | 2012-05-01 | https://martinfowler.com/bliki/TestPyramid.html |
| Kent C. Dodds, Testing Trophy | 글 | 확인 못 함 | https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications |
| Petrović 외, `Practical Mutation Testing at Scale` | arXiv 2102.11378 v2 | 2021-02-26 | https://arxiv.org/abs/2102.11378 |
| StrykerJS 설정 문서 (thresholds) | v10.0.0 릴리스 2026-08-14 | 상시 갱신 | https://stryker-mutator.io/docs/stryker-js/configuration/ |
| fast-check 문서 | v4.10.2 | 상시 갱신 | https://fast-check.dev/docs/introduction/ |
| Hypothesis 문서 | v6.169.4 | 상시 갱신 | https://hypothesis.readthedocs.io/en/latest/ |
| Pact 문서, can-i-deploy | pact-js v17.1.4 | 상시 갱신 | https://docs.pact.io/pact_broker/can_i_deploy |
| k6 thresholds 문서 | k6 v2.3.0 | 상시 갱신 | https://grafana.com/docs/k6/latest/using-k6/thresholds/ |
| axe-core README | v4.14.0 | 2026-10-05 릴리스 | https://github.com/dequelabs/axe-core |
| W3C WCAG 2.2 | W3C Recommendation | 2024-12-12 | https://www.w3.org/TR/WCAG22/ |
| web.dev Core Web Vitals | Google 공식 | 상시 갱신 | https://web.dev/articles/vitals |
| Lighthouse 성능 점수 | Chrome 공식 | 상시 갱신 | https://developer.chrome.com/docs/lighthouse/performance/performance-scoring |
| Google SRE book, 4장 SLO | 책 | 2016 | https://sre.google/sre-book/service-level-objectives/ |
| SonarQube Sonar way 품질 게이트 | 공식 문서 | 상시 갱신 | https://docs.sonarsource.com/sonarqube-server/latest/quality-standards-administration/managing-quality-gates/introduction-to-quality-gates/ |
| DORA 소프트웨어 전달 성과 지표 | 5개 지표 모델 | 2026-01-05 갱신 | https://dora.dev/guides/dora-metrics/ |
| NIST SP 500-235 복잡도 한도 (Microsoft Learn 인용) | 1996 원문의 인용 | 확인일 2026-10-16 | https://learn.microsoft.com/en-us/visualstudio/code-quality/code-metrics-cyclomatic-complexity |

"(하네스 기본값)"이라고 적은 숫자는 원천의 숫자가 아니라 하네스가 고른 값이다. 프로젝트가 근거를 적고 바꿀 수 있다. `[기계]` 줄은 끝에 `도구: <이름이나 명령>`을 적는다.

## 측정형 체크리스트

### A. 목표 명세

- [ ] [사람] 선정 특성이 3~5개이고, 각 특성에 목표가 1개 이상 있다. 미선정 특성은 "bar 기본 체크로 덮는다"고 적혀 있다.
- [ ] [기계] 목표 표의 모든 행에 조건, 대상, 지표, 목표값, 근거, 검증 명령 6칸이 차 있다. 빈 칸 0. 도구: `grep`과 `awk`로 목표 표의 빈 칸을 센다
- [ ] [기계] 목표 문서의 `[NEEDS CLARIFICATION]` 0개, `[SYNC NEEDED]` 0개. 도구: `grep -c "NEEDS CLARIFICATION\|SYNC NEEDED"`
- [ ] [사람] 지연 목표에 평균만 쓴 행 0개. API는 p95 또는 p99, 웹 field 데이터는 p75를 쓰고 측정 창(예: 5분 부하, 28일 field)을 적었다.
- [ ] [사람] 가용성 목표는 기간(월 등)과 허용 중단 시간(분)을 같이 적었다.
- [ ] [사람] 목표값마다 근거가 1개 이상이다: 공식 출처 URL 또는 기준선 측정값(측정 일시, 환경 포함). "업계 관행"만 적은 행 0개.
- [ ] [사람] 엄격, 보통, 느슨 3안 가운데 고른 안과 그 이유가 실패 비용 문장과 연결돼 있다.
- [ ] [사람] 설계에 큰 영향을 주는 목표가 아키텍처 드라이버로 표시되고 ADR 후보 또는 ExecPlan 위치가 적혀 있다.
- [ ] [사람] 사용자 승인 날짜가 확정 이력에 있다.

### B. 검증

- [ ] [기계] 목표마다 실행 가능한 명령이 프로젝트 스크립트 목록에 등록돼 있다. 명령 없는 목표 0개. 명령 부재는 미측정이 아니라 게이트 실패다. 도구: 목표 표의 검증 명령 칸과 `package.json` scripts나 `Makefile` 대조(grep)
- [ ] [기계] 목표마다 검증 기록이 1행 이상: 일시, 환경, 측정값 A, 목표 B, X = A/B, 판정. 도구: 6절 표에서 목표 ID별 행 수 세기(grep)
- [ ] [기계] 출시 등급이면 출시 후보 빌드에서 잰 기록이 있다(하네스 기본값). 도구: 6절 표의 환경 칸 grep
- [ ] [기계] 성능 목표는 thresholds로 코드화돼 기준을 넘으면 0이 아닌 종료 코드로 끝난다. 도구: k6 thresholds(또는 같은 기능의 도구)
- [ ] [기계] 웹 프론트가 있으면 field 데이터 p75 기준 LCP 2.5초 이하, INP 200ms 이하, CLS 0.1 이하. lab 측정은 Lighthouse Performance 90 이상. 도구: CrUX 또는 web-vitals 라이브러리, Lighthouse CI
- [ ] [기계] 불합격, 미측정 목표가 ExecPlan이나 `docs/exec-plans/tech-debt-tracker.md`에 담당자와 재측정 날짜와 함께 있다. 도구: 불합격 목표 ID로 두 파일 grep

### C. 테스트 포트폴리오

- [ ] [기계] 신규, 변경 코드 커버리지 80% 이상을 러너 thresholds로 강제한다(Sonar way 기본값). 전체 커버리지는 직전 값 아래로 내려가지 않는다. 도구: vitest, bun test, jest, coverage.py의 thresholds.
- [ ] [기계] 핵심 모듈(돈, 권한, 데이터 변환, 파서) 목록이 문서에 있고, 그 변경 파일에 PR마다 mutation testing을 돌려 score 60 미만이면 실패한다. 60은 Stryker 기본 low 구간 경계를 쓴 값이다(하네스 기본값). 도구: StrykerJS break, PIT mutationThreshold, mutmut 결과 검사
- [ ] [사람] 살아남은 mutant는 테스트 추가 또는 "동등 mutant" 사유 기록 중 하나로 처리됐다.
- [ ] [기계] 외부 입력 파서, 직렬화 왕복, 금액, 날짜 계산 함수마다 속성 기반 테스트 1개 이상(하네스 기본값). 도구: fast-check, Hypothesis 사용처 grep
- [ ] [기계] small 테스트는 네트워크, DB, 파일 시스템, sleep을 쓰지 않는다. 시간 한도 small 60초, medium 300초를 러너 timeout으로 강제한다(Google 테스트 크기). 도구: 러너 timeout 설정
- [ ] [기계] 막는 스위트의 flaky 테스트 0개. 도구: CI 재실행 이력에서 같은 커밋에 통과와 실패가 섞인 테스트 수(`gh run list --commit <sha>`)
- [ ] [기계] 격리 목록의 항목마다 담당자, 이슈 링크, 기한(등록 후 7일 이내, 하네스 기본값)이 있다. 기한 초과 0개, 목록 크기 8개 이하(Fowler 예시 값). 도구: 격리 목록 표의 빈 칸과 기한 날짜 비교(awk)
- [ ] [기계] 버그 수정 PR의 100%가 고치기 전에 실패하는 재발 방지 테스트를 포함한다. PR 템플릿 체크와 리뷰로도 본다. 도구: 수정 코드만 되돌린 뒤(`git revert --no-commit <수정 커밋>`) 테스트 러너가 실패하는지 확인
- [ ] [기계] 핵심 사용자 여정 E2E 1개 이상이 CI에서 돈다. 도구: CI 워크플로의 E2E 작업 결과(`gh run view`)
- [ ] [기계] 따로 배포되는 서비스가 2개 이상이면 Pact 계약 테스트와 배포 전 `can-i-deploy`가 있다. 아니면 "해당 없음"이 적혀 있다. 도구: Pact `can-i-deploy`
- [ ] [기계] 화면이 있으면 핵심 여정 화면의 axe 위반 0건. 도구: @axe-core/playwright 등
- [ ] [사람] 키보드만으로 핵심 여정 완주, 포커스 표시, 스크린리더 1회 확인을 했다. axe는 평균 57%만 자동으로 찾는다.
- [ ] [기계] 함수 순환 복잡도 10 초과는 사유 주석이 있거나 0개다(NIST SP 500-235의 출발점 10). ESLint `complexity` 규칙은 기본값이 20이라 10으로 설정한다. 도구: ESLint `complexity`, Python은 radon 등

### D. 결과

- [ ] [기계] 배포가 있는 프로젝트는 DORA 변경 실패율과 배포 재작업률을 월 1회(하네스 기본값) 기록한다. 도구: 배포 기록(`gh run list`, 배포 도구 로그)을 세는 스크립트
- [ ] [사람] 지난 4주 사이 운영에서 발견된 결함마다 재발 방지 테스트가 추가됐는지 확인했다.

## 등급 판정

| 등급 | 일반 정의 | 이 분야의 구체화 |
|---|---|---|
| A (최고 전문가) | 체크리스트 전부 통과, 기계 강제 장치 있음, 최근 4주 회귀 0 | 커버리지, mutation break, k6 thresholds, axe가 CI에서 막는다. 변경 코드 커버리지 90% 이상, 핵심 모듈 mutation 80 이상(하네스 기본값). 최근 4주 동안 합격이던 목표가 불합격으로 바뀐 적 0회, 재발 방지 테스트 없는 운영 결함 0건 |
| B (출시 가능) | 전부 통과, 일부 수동 | 모든 목표가 합격이지만 부하 테스트나 접근성 검사 일부를 출시 전에 사람이 손으로 돌린다 |
| C (부채 있음) | 미달 항목이 부채 목록에 기록됨 | 불합격, 미측정 목표나 기한 넘긴 격리 테스트가 있지만 전부 부채 목록에 담당자와 날짜와 함께 있다 |
| D (위험) | 미달이 기록조차 없거나 보안, 데이터, 법 관련 | 검증 명령 없이 "합격"이라고 적은 목표가 있다, 근거 없는 목표값이 확정됐다, 보안성이나 데이터 무결성 목표가 불합격인데 기록이 없다, flaky를 재실행으로 덮고 있다 |

## 최고 전문가가 더 하는 것

1. 목표값보다 기준선을 먼저 잰다. 지금 값을 모르면 목표가 가능한지, 설계 변경이 필요한지 판단할 수 없다(25030: 목표값은 표준이 아니라 우리 요구사항).
2. 평균 대신 백분위로 말한다. 꼬리 지연은 평균에 숨는다(Google SRE book 4장).
3. 커버리지를 하한으로만 쓰고, 테스트 효과는 변경 코드의 mutation으로 확인한다. 살아남은 mutant를 리뷰에서 본다(Google, `Practical Mutation Testing at Scale`).
4. flaky 테스트를 발견한 날 격리하고 담당자와 기한을 건다. 통과에서 실패로 바뀐 사례의 약 84%가 flaky와 관련됐다는 Google 데이터가 이유다(Micco 2016, Fowler 2011).
5. 불변식이 있는 코드에는 예시 대신 속성을 쓴다. 생성기와 shrink가 사람이 생각 못 한 경계값을 찾는다(fast-check, Hypothesis).
6. 테스트 크기를 자원 제약으로 정의하고 러너로 강제한다. "unit인데 DB를 쓰는" 테스트가 생기지 않는다(Google 테스트 크기).
7. 품질 활동의 효과를 결과 지표로 확인한다. 테스트 지표가 좋아져도 변경 실패율이 나빠지면 전략을 고친다(DORA).
8. 요구사항 단계에서 검증 방법까지 적는다. 검증할 수 없는 요구사항은 요구사항이 아니다(29148).

## 흔한 실패와 고치는 법

1. **형용사가 그대로 스펙에 남는다.** "빠르게"를 변환표로 특성과 측정 항목으로 바꾸고, 4요소 형식으로 다시 쓴다.
2. **평균 응답 시간 목표.** p95나 p99로 바꾸고 측정 창과 부하 조건을 붙인다.
3. **조건 없는 목표("p95 500ms").** 몇 VU, 어떤 데이터 크기, 어느 환경인지 적는다. 개발 노트북 수치는 운영 목표의 증거로 쓰지 않는다.
4. **표준이 숫자를 준다고 믿는다.** 25010, 25023은 특성과 측정 방법을 준다. 목표값은 기준선과 실패 비용으로 정하고, 공식 출처의 경계값(Core Web Vitals 등)은 근거로만 쓴다.
5. **커버리지 100%를 목표로 건다.** assertion 없는 테스트가 늘어난다. 변경 코드 80% 하한과 핵심 모듈 mutation으로 바꾼다.
6. **flaky를 retry로 덮는다.** 재실행 통과를 flaky로 기록하고 격리 목록에 담당자와 7일(하네스 기본값) 기한을 건다.
7. **9특성 전부에 목표를 건다.** 실패 비용 순으로 3~5개만 고르고 나머지는 bar 기본 체크로 덮는다고 적는다.
8. **axe 0건을 "접근성 완료"로 보고한다.** 자동 검사는 평균 57%만 찾는다. 키보드와 스크린리더 확인을 사람이 한다.
9. **검증 명령 없이 "확인함".** 명령을 만들어 스크립트 목록에 등록하거나 미측정으로 적고 부채에 올린다.
10. **불합격을 숨기거나 목표를 몰래 낮춘다.** 불합격 행을 그대로 두고 원인과 재측정 일정을 적는다. 목표를 바꾸려면 승인을 다시 받고 확정 이력에 남긴다.
