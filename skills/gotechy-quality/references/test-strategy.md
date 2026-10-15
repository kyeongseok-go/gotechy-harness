# 테스트 전략: 테스트가 결함을 잡는지 재는 법

언제 여는 파일인가: 절차 6단계(테스트 전략)와 8단계(검증 명령 연결)를 할 때, 또는 "테스트 기준 세워줘", "커버리지 몇 %면 돼?"라는 질문을 받았을 때.

원칙: 테스트의 목적은 숫자를 채우는 것이 아니라 결함을 배포 전에 잡는 것이다. 커버리지는 "실행은 됐다"까지만 말한다. "틀리면 잡는다"는 mutation testing과 속성 기반 테스트가 말한다. 결과가 실제로 좋아졌는지는 DORA 변경 실패율 같은 결과 지표가 말한다.

## 1. 테스트 크기 (Google 기준, 2010-12-13 글)

| 자원 | small | medium | large |
|---|---|---|---|
| 네트워크 | 없음 | localhost만 | 허용 |
| 데이터베이스 | 없음 | 허용 | 허용 |
| 파일 시스템 | 없음 | 허용 | 허용 |
| 외부 시스템 | 없음 | 권장하지 않음 | 허용 |
| 여러 스레드, sleep, 시스템 속성 | 없음 | 허용 | 허용 |
| 시간 한도(초) | 60 | 300 | 900 이상 |

출처: https://testing.googleblog.com/2010/12/test-sizes.html. 크기를 "unit, integration" 같은 이름 대신 쓰는 이유는 자원 제약이 기계로 판정되기 때문이다. 러너의 timeout 설정과 small 스위트의 네트워크 차단으로 강제한다. 테스트는 어떤 순서로 돌아도 통과해야 한다(같은 글).

## 2. 포트폴리오 모양: pyramid와 trophy

- Test Pyramid(Martin Fowler, 2012-05-01): GUI로 도는 넓은 테스트보다 낮은 수준의 unit 테스트가 훨씬 많아야 한다(https://martinfowler.com/bliki/TestPyramid.html).
- Testing Trophy(Kent C. Dodds): static 검사(타입, lint)를 바닥에 두고 integration 테스트에 가장 많이 투자하라는 JavaScript 앱 기준의 투자 대비 효과 그림(https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications, 글 발행일은 확인 못 함).
- 선택 기준: 둘은 경쟁이 아니라 "어디서 결함이 나오나"에 대한 가정이 다르다. 로직이 무거운 서버, 라이브러리는 pyramid, UI 조립이 대부분인 프론트는 trophy가 맞는 경우가 많다. 어느 쪽이든 아래 세 가지는 공통이다: static 검사는 공짜로 켠다, 핵심 사용자 여정 E2E는 최소 1개, 느리고 불안정한 테스트는 적게.

## 3. 커버리지: 하한이지 목표가 아니다

- Google 지침(2020-08-07): 60% 수용, 75% 칭찬, 90% 모범. 커밋 단위 커버리지 90%는 좋은 하한이고 99%도 합리적이다. 프로젝트 전체 90% 초과는 대개 들인 노력만큼 가치가 없다. 높은 커버리지가 테스트 품질을 보장하지 않는다. 낮은 커버리지는 넓은 영역이 자동 검사 없이 배포된다는 사실을 보장한다(https://testing.googleblog.com/2020/08/code-coverage-best-practices.html).
- 기본 합격선(하네스 기본값): 신규, 변경 코드 80% 이상(Sonar way 기본값과 같다)을 러너 thresholds로 강제한다. A 등급은 변경 코드 90% 이상. 전체 커버리지는 내려가지 않게만 막는다(ratchet).
- 자주 바뀌는 코드부터 덮는다. 커버리지를 채우려고 assertion 없는 테스트를 쓰는 것은 실패로 본다.

## 4. Mutation testing: 테스트가 틀린 코드를 잡는가

- 도구: StrykerJS(JS, TS), PIT(JVM), mutmut(Python). 2026-10-16 기준 최신 릴리스는 StrykerJS v10.0.0, PIT 1.30.1, mutmut 3.8.0.
- StrykerJS 기본 thresholds는 high 80, low 60, break 없음이다. break를 설정해야 점수가 낮을 때 CI가 실패한다(https://stryker-mutator.io/docs/stryker-js/configuration/).
- 업계 공통의 "필수 점수"는 없다. Google은 코드 리뷰 중 변경된 코드만 변이시키고, 살아남은 mutant를 리뷰어에게 보여 주는 방식으로 규모 문제를 풀었다(Petrović 외, `Practical Mutation Testing at Scale`, arXiv 2102.11378, 2021). 그래서 이 bar는 점수와 리뷰를 둘 다 쓴다.
- 기본 합격선(하네스 기본값): 핵심 모듈(돈, 권한, 데이터 변환, 파서)은 PR마다 변경 파일에 mutation을 돌리고 break 60. A 등급은 핵심 모듈 80 이상. 살아남은 mutant는 테스트를 추가해 죽이거나 "동등 mutant"로 사유를 적는다.
- 비용 조절: StrykerJS `--incremental`로 이전 결과를 재사용하고, `mutate` 범위를 변경 파일로 좁힌다.

## 5. 속성 기반 테스트

- fast-check(JS, TS, v4.10.2)와 Hypothesis(Python, v6.169.4)는 입력을 자동 생성해 수백 개 경우를 돌리고, 실패하면 가장 작은 실패 입력으로 줄여(shrink) 보여 준다(https://fast-check.dev/docs/introduction/, https://hypothesis.readthedocs.io/en/latest/).
- 기본 합격선(하네스 기본값): 외부 입력 파서, 직렬화와 역직렬화 왕복, 금액, 날짜 계산 함수마다 속성 1개 이상. 쓸 만한 속성: 왕복 불변(decode(encode(x)) == x), 불변식(합계는 항목 합과 같다), 기준 구현과 비교, 멱등(두 번 해도 같다).

## 6. Flaky 테스트 정책

- 근거: Google은 전체 테스트 실행의 약 1.5%가 flaky 결과를 내고, 테스트의 약 16%에 어느 정도 flaky가 있으며, 통과에서 실패로 바뀐 사례의 약 84%가 flaky 테스트와 관련됐다고 보고했다(John Micco, 2016-05-27, https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html). flaky를 방치하면 사람들이 진짜 실패도 무시하게 된다.
- Martin Fowler(2011-04-14): flaky 테스트는 건강한 스위트와 분리해 격리(quarantine)하되 빨리 고쳐야 한다. 격리 목록이 잊히지 않도록 개수 한도(예: 8개)나 기간 한도(예: 1주 이내)를 둔다(https://martinfowler.com/articles/nonDeterminism.html).
- 이 bar의 규칙:
  1. 막는 스위트에 flaky 0개. 재실행으로 통과한 테스트는 flaky로 기록한다.
  2. 발견 후 1 영업일(하네스 기본값) 안에 격리 목록(예: `docs/quality/quarantine.md` 또는 러너의 skip 태그와 이슈)에 올린다. 항목마다 담당자, 이슈 링크, 기한(7일 이내, 하네스 기본값)을 적는다.
  3. 격리 목록이 8개를 넘거나 기한을 넘긴 항목이 생기면 새 기능보다 정리를 먼저 한다.
  4. 자동 재실행은 flaky 탐지용으로만 쓴다. 재실행을 "고침"으로 보고하지 않는다.

## 7. 계약 테스트 (따로 배포되는 서비스가 2개 이상일 때)

- Pact는 소비자 테스트를 실행하면서 계약을 만들고 제공자가 그 계약을 검증하는 consumer-driven 계약 테스트 도구다. 배포 전에는 `pact-broker can-i-deploy`로 이미 배포된 상대 버전과 검증된 조합인지 확인한다(https://docs.pact.io/, https://docs.pact.io/pact_broker/can_i_deploy).
- 기본 합격선(하네스 기본값): 소비자가 쓰는 API마다 계약 1개 이상, 배포 파이프라인에 `can-i-deploy` 단계가 있고 실패하면 배포가 멈춘다. 서비스가 하나뿐이면 해당 없음으로 적는다.

## 8. 부하 테스트

- k6(v2.3.0) thresholds는 합격 조건을 코드로 쓴다. 하나라도 거짓이면 테스트 전체가 실패하고 0이 아닌 종료 코드로 끝난다. `abortOnFail`로 기준을 넘는 즉시 멈출 수 있다(https://grafana.com/docs/k6/latest/using-k6/thresholds/).
- 예: `thresholds: { http_req_failed: ['rate<0.001'], http_req_duration: ['p(95)<500'] }`.
- 기본 합격선(하네스 기본값): 성능 목표마다 k6(또는 같은 기능의 도구) 스크립트 1개, 조건(VU, 기간, 환경, 데이터 크기)을 스크립트 머리 주석과 목표 표에 같이 적는다. 평시 부하와 평시의 2~3배 부하 두 단계를 돌린다(확장성 목표가 있을 때).

## 9. 접근성 자동 검사

- axe-core(v4.14.0)는 WCAG 문제의 평균 57%를 자동으로 찾고, 확신할 수 없는 요소는 "incomplete"로 돌려 수동 확인을 요구한다(https://github.com/dequelabs/axe-core).
- 기본 합격선(하네스 기본값): 핵심 여정 화면마다 axe 위반 0(Playwright 등 E2E에서 실행). 자동 검사 통과를 "접근성 완료"로 보고하지 않는다. 키보드만으로 핵심 여정 완주, 포커스 표시, 스크린리더 1회 확인을 사람이 한다.

## 10. 결과 지표: 품질 활동이 효과가 있었나

- DORA는 2026-01-05 갱신 기준 5개 지표를 쓴다. 처리량: 변경 리드 타임, 배포 빈도, 실패 배포 복구 시간. 불안정성: 변경 실패율(배포 뒤 즉시 개입이 필요했던 배포 비율), 배포 재작업률(사고 때문에 계획에 없던 배포 비율). 속도와 안정성은 맞바꾸는 관계가 아니라는 것이 DORA 연구의 결론이다(https://dora.dev/guides/dora-metrics/).
- 기본 합격선(하네스 기본값): 배포가 있는 프로젝트는 변경 실패율과 배포 재작업률을 월 1회 기록한다. 테스트 지표(커버리지, mutation)가 좋아졌는데 변경 실패율이 나빠지면 테스트가 엉뚱한 곳을 지키고 있다는 신호로 본다.

## 11. 명령 연결 예 (프로젝트 스크립트 목록에 등록)

| 목표 종류 | 명령 예 | 실패 조건 |
|---|---|---|
| 커버리지 | `vitest run --coverage` 또는 `bun test --coverage` (thresholds 설정) | thresholds 미달 시 0이 아닌 종료 |
| mutation | `npx stryker run --incremental` (break 60) | 점수가 break 미만 |
| 부하 | `k6 run perf/q1-search.js` | thresholds 하나라도 실패 |
| 접근성 | `playwright test a11y/` (axe 위반 0 단언) | 위반 1건 이상 |
| 웹 성능 | Lighthouse CI assert (performance 0.9 이상) | assert 실패 |
| 계약 | `pact-broker can-i-deploy ...` | 검증되지 않은 조합 |

도구가 프로젝트 스택과 다르면 같은 판정이 되는 도구로 바꾸고, 바꾼 이유를 목표 표의 검증 칸에 적는다.
