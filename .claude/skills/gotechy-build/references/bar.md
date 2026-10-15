# gotechy-build bar: 구현의 최고 수준 기준

구현 결과를 판정하거나 등급을 매길 때 연다. 체크리스트와 등급표의 원본이다.

## 이 bar가 지키는 것

변경 하나하나가 코드의 건강을 떨어뜨리지 않고 올리는 것을 지킨다. 구체적으로는 네 가지다. 리뷰어가 한 번에 읽고 이해할 수 있다. 테스트가 동작을 먼저 정의하고 증명한다. 누가 언제 빌드해도 같은 의존성으로 같은 결과가 나온다. 문제가 생기면 그 변경만 되돌릴 수 있다. Google의 리뷰 기준처럼 완벽한 코드를 요구하지는 않지만, 건강을 떨어뜨리는 변경은 급해도 들이지 않는다.

## 기준의 원천 (모두 2026-10-16에 직접 열어 확인)

| 이름 | 판, 발행일 | URL |
|---|---|---|
| Google Engineering Practices, 코드 리뷰 기준 | 상시 갱신 문서. 코드 건강을 확실히 개선하면 승인, 선택 지적은 `Nit:` | https://google.github.io/eng-practices/review/reviewer/standard.html |
| Google Engineering Practices, Small CLs | 상시 갱신. 100줄은 대개 적당, 1000줄은 대개 너무 큼. 리팩터링은 따로, 테스트는 같은 변경에 | https://google.github.io/eng-practices/review/developer/small-cls.html |
| Google, 리뷰에서 볼 것과 리뷰 속도 | 상시 갱신. 응답은 최대 1영업일 | https://google.github.io/eng-practices/review/reviewer/looking-for.html , https://google.github.io/eng-practices/review/reviewer/speed.html |
| Test Driven Development 책 (Kent Beck) | Addison-Wesley, 2002-11-08 | https://www.informit.com/store/test-driven-development-by-example-9780321146533 |
| Canon TDD (Kent Beck) | 2023-12-11. 테스트 목록, 하나만 실행 가능하게, 통과, 정리, 반복 | https://newsletter.kentbeck.com/p/canon-tdd |
| Refactoring 2판 (Martin Fowler) | 2018 | https://martinfowler.com/books/refactoring.html |
| Parse, don't validate (Alexis King) | 2019-11-05 | https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/ |
| A Philosophy of Software Design 2판 (John Ousterhout) | 2021-07 | https://web.stanford.edu/~ouster/cgi-bin/book.php |
| The Twelve-Factor App | 본문 마지막 갱신 2017, 2024-11-12 오픈소스로 전환 | https://12factor.net/config |
| Semantic Versioning | 2.0.0 | https://semver.org/ |
| Conventional Commits | 1.0.0 | https://www.conventionalcommits.org/en/v1.0.0/ |
| OpenSSF Scorecard | v5.6.0 (2026-10-12). 검사 20개, 검사마다 0~10점 | https://github.com/ossf/scorecard |
| OpenSSF 오픈소스 평가 간결 가이드 | 2025-03-28 발행, 2025-04-23 개정 | https://best.openssf.org/Concise-Guide-for-Evaluating-Open-Source-Software |
| Reproducible Builds 정의 | 같은 소스, 환경, 명령이면 비트 단위로 같은 결과물 | https://reproducible-builds.org/docs/definition/ |
| SLSA | v1.2 (2025-11-24) | https://slsa.dev/spec/ |

스택별 원천(언어, DB, 프레임워크의 버전과 공식 문서)은 각 `stack-*.md`에 있다.

## 측정형 체크리스트

`[기계]`는 도구나 명령으로 판정하고 줄 끝에 `도구: <이름이나 명령>`을 적는다. `[사람]`은 리뷰로 판정한다.

### 1. 테스트 우선

- T1 [사람] 구현 전에 테스트 시나리오 목록이 있다. 수용 기준마다 시나리오 1개 이상.
- T2 [기계] 동작을 바꾼 변경에는 같은 변경 안에 테스트 파일 변경이 1개 이상 있다. 도구: `git diff --name-only`를 테스트 경로 패턴으로 센다.
- T3 [사람] RED 증거: 새 테스트가 구현 전에 실패한 출력 한 줄이 HANDOFF 증거에 있다. 실패 이유는 "기능이 아직 없음"이어야 하고, 문법 오류나 import 오류는 RED로 치지 않는다.
- T4 [기계] 버그 수정에는 재현 테스트가 있고, 수정 코드만 되돌리면 그 테스트가 실패한다. 도구: 테스트 러너.
- T5 [기계] 신규, 변경 코드의 줄 커버리지 80% 이상(Sonar way 기본값), 전체 커버리지는 직전 값 아래로 내려가지 않는다. 프로젝트가 핵심 모듈로 지정한 파일은 mutation 점수 60 이상, A등급은 80 이상(하네스 기본값). 값은 `gotechy-quality` 스킬과 같고, 프로젝트가 정한 값이 있으면 그 값이 이긴다. 러너의 기준 설정(threshold)이 미달이면 실패로 끝난다. 도구: Vitest, `bun test --coverage`, pytest 커버리지 플러그인, `go test -cover`, StrykerJS, mutmut
- T6 [기계] 새 테스트를 3번(하네스 기본값) 연속 돌려 결과가 같다(flaky 0건). 도구: 러너 반복 실행(예: `go test -count=3`).
- T7 [사람] 모킹은 경계(네트워크, 외부 프로세스, 시계, DB 어댑터)에서만 한다. 내부 모듈을 모킹한 곳 0건.
- T8 [사람] 테스트를 지우거나 기대값을 바꾼 곳이 있으면, 스펙 근거가 HANDOFF에 있다. 근거 없는 변경 0건.

### 2. 변경 크기와 범위

- S1 [기계] 변경 하나의 추가와 삭제 합이 400줄 이하(생성 코드, lockfile, 스냅샷 제외). 목표는 100줄 안팎. 400은 Google 지침(100 적당, 1000 과대) 사이에서 고른 상한이다(하네스 기본값). 도구: `git diff --shortstat`
- S2 [사람] 관심사 하나: 변경 설명 한 문장에 "그리고"가 필요 없다. 리팩터링(동작 불변)과 동작 변경은 서로 다른 커밋이나 PR이다.
- S3 [사람] 요청 범위 밖 수정 0건. 눈에 띈 문제는 부채 목록에 적는다.
- S4 [기계] 커밋 메시지가 프로젝트 규약을 따른다. 규약이 Conventional Commits 1.0.0이면 형식 검사 도구를 통과하고, 깨지는 변경은 `!`나 `BREAKING CHANGE:` 꼬리말로 표시한다. 도구: commitlint 같은 커밋 메시지 검사기

### 3. 경계와 타입

- B1 [사람] 외부 입력 진입점(HTTP 핸들러, 큐 소비자, CLI 인자, 환경변수, 파일, 외부 API 응답, LLM 출력)마다 파서가 정확히 한 곳에 있다.
- B2 [기계] 경계 안쪽 함수의 매개변수에 검증 안 된 타입이 0건이다: TS `any`, Python `Any`와 `dict[str, Any]`, Go `map[string]any`. 예외는 줄마다 사유 주석. 도구: `@typescript-eslint/no-explicit-any`, Ruff `ANN401`, grep
- B3 [기계] 엄격 설정의 타입 검사 오류 0건. 도구: `tsc` strict 묶음, mypy `--strict`나 Pyright strict, `go vet`
- B4 [기계] 린터 경고 0건. 검사 끄기 주석(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `biome-ignore`, `# noqa`, `# type: ignore`, `//nolint`) 가운데 사유가 없는 것 0건. 도구: grep
- B5 [사람] 불가능한 상태를 타입으로 표현할 수 없다(판별 유니온, 열거형, 값 객체).
- B6 [기계] 설정은 환경변수에서 시작할 때 한 번 파싱한다. 저장소의 비밀 0건. Twelve-Factor 판정: 지금 저장소를 공개해도 자격 증명이 새지 않는다. 도구: gitleaks

### 4. 에러와 관측

- E1 [기계] 빈 catch, `except: pass`, 무시된 Go 에러 0건. 도구: ESLint `no-empty`, Ruff `E722`와 `S110`, errcheck.
- E2 [사람] 위로 올리는 에러에 맥락(무엇을 하다가, 어떤 ID에서)이 붙어 있다. 사용자 응답에 스택, 쿼리, 내부 경로 0건.
- E3 [사람] 새로 생긴 실패 경로마다 구조화 로그 한 줄이나 메트릭이 있다. 로그에 비밀과 개인정보 원문 0건.

### 5. 의존성

- D1 [기계] 새 의존성은 정확한 버전이다. `^`, `~`, `*`, `>=`, `latest` 0건. 도구: diff에서 매니페스트 새 줄 grep.
- D2 [기계] lockfile이 같은 변경에 들어 있고, CI가 고정 설치로 통과한다. 도구: `npm ci`, `bun ci`, `pnpm install --frozen-lockfile`, `uv sync --locked`, `go mod verify`
- D3 [기계] 알려진 취약점 중대, 높음 0건. 도구: `npm audit --audit-level=high`, `govulncheck`, 언어별 감사 도구.
- D4 [사람] 진짜 프로젝트인지 확인했다: 레지스트리 이름, 소스 저장소, 최근 12개월 안 의미 있는 활동(OpenSSF 간결 가이드). 비슷한 이름(typosquatting)과 AI가 지어낸 이름을 걸러낸다.
- D5 [기계] OpenSSF Scorecard 종합 점수를 ADR에 적고, 5.0 미만(하네스 기본값)이면 대안 비교를 ADR에 쓴다. 도구: `scorecard` CLI 또는 OpenSSF Scorecard 결과 페이지
- D6 [사람] 라이선스가 프로젝트 허용 목록에 있다. 목록이 없으면 MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC를 허용하고, GPL 계열, AGPL, 라이선스 없음은 `[막는]` 결정으로 올린다.
- D7 [사람] 런타임 의존성 추가마다 ADR 1건. "표준 라이브러리나 기존 의존성으로 안 되는 이유"가 들어 있다.

### 6. 재현성

- R1 [기계] 깨끗한 체크아웃에서 README에 적힌 명령만으로 설치, 빌드, 테스트가 통과한다. 도구: CI의 새 러너.
- R2 [기계] 런타임과 도구 버전이 파일로 고정돼 있다(`packageManager` 필드, `.python-version`, `go.mod`의 `go` 줄, 버전 관리 도구 설정). 도구: 이 파일들의 존재를 보는 `ls`와 grep
- R3 [사람] 공개 패키지나 공개 API면 버전 올림이 SemVer 2.0.0을 따른다. 깨지는 변경은 MAJOR, 0.y.z는 초기 개발 단계.

### 7. 리뷰 가능성과 문서

- V1 [사람] `code-review.md` 자기 리뷰를 전부 통과했다.
- V2 [사람] 변경 설명에 무엇을, 왜, 어떻게 확인했는지가 있다.
- V3 [사람] 동작이 바뀌면 스펙, README, ADR이 같은 변경에서 갱신됐다.
- V4 [기계] 죽은 코드와 주석 처리한 코드 블록 0건. 도구: 린터의 미사용 규칙.
- V5 [사람] 인증, 인가, API, DB, 개인정보를 건드렸으면 `gotechy-security` 리뷰로 넘겼다.

## 등급 판정

- **A (최고 전문가)**: 체크리스트 전부 통과. 기계 항목(타입, 린트, 커버리지 기준, 고정 설치, 비밀 검사, 취약점 검사)이 CI에서 실패하면 병합을 막는다. 최근 4주 동안 이 영역 회귀 0건(되돌림 커밋, 핫픽스, 같은 버그 재발 0).
- **B (출시 가능)**: 전부 통과. 일부 기계 항목을 사람이 손으로 돌린다(예: 취약점 검사를 수동 실행).
- **C (부채 있음)**: 미달 항목이 있고, 모두 `docs/exec-plans/tech-debt-tracker.md`에 기한과 함께 기록돼 있다.
- **D (위험)**: 기록 없는 미달이 있거나, 다음 중 하나다. 비밀이 코드나 로그에 있다. 인가 확인 없는 쓰기 엔드포인트가 있다. 인증, 결제, 데이터 삭제 코드에 테스트가 없다. 버전 고정 없는 의존성이 운영에 나갔다. 중대 취약점이 방치됐다. 되돌릴 수 없는 마이그레이션에 백업 시점 기록이 없다.

## 최고 전문가가 더 하는 것

1. 코드보다 테스트 목록을 먼저 쓴다. 목록에서 하나만 실행 가능한 테스트로 옮기고, 통과시키고, 정리하고, 다음으로 간다(Canon TDD).
2. 구조 변경과 동작 변경을 다른 변경으로 낸다. 리팩터링만 담은 변경은 리뷰어가 "동작이 같은가"만 확인하면 된다(Google Small CLs, Fowler 2판의 통제된 기법).
3. 인터페이스는 작게, 구현은 깊게 만든다. 호출하는 쪽이 알아야 할 것을 줄이는 일이 클래스 수나 함수 길이보다 중요하다(Ousterhout의 깊은 모듈).
4. 검증 대신 파싱한다. 확인 결과를 타입에 담아 "이미 확인됨"을 컴파일러가 기억하게 한다(King).
5. 의존성을 부채로 센다. 새 의존성마다 공격 표면이 늘어난다는 전제로 "없이 되나"를 먼저 묻는다(OpenSSF 간결 가이드).
6. 같은 소스, 같은 환경, 같은 명령이면 같은 결과물이 나오게 lockfile과 도구 버전을 고정한다(Reproducible Builds).
7. 리뷰 요청에 1영업일 안에 응답하고, 자기 변경도 그 속도로 리뷰받을 수 있는 크기로 낸다(Google 리뷰 속도).
8. 변경 설명에 "어떻게 확인했나"를 명령 그대로 남겨 리뷰어가 재현할 수 있게 한다.

## 흔한 실패와 고치는 법 (AI가 특히 자주 한다)

1. 구현부터 쓰고 테스트를 나중에 써서, 테스트가 버그까지 베낀다. 고친다: RED 출력이 없으면 구현을 시작하지 않는다(T3).
2. 실패하는 테스트의 기대값을 현재 출력으로 바꿔 통과시킨다. 고친다: 스펙과 대조하고, 스펙이 틀렸으면 `[막는]` 결정으로 올린다(T8).
3. 버전 없이 설치하거나 `latest`, `^`로 추가하고 lockfile을 빠뜨린다. 고친다: 정확한 버전, lockfile, 고정 설치(D1, D2).
4. 없는 패키지나 비슷한 이름의 가짜 패키지를 설치한다. 고친다: 레지스트리, 소스 저장소, 활동을 확인한 뒤 추가한다(D4).
5. 기능, 포맷, 이름 바꾸기를 섞은 큰 diff. 고친다: 관심사별로 쪼개 순서대로 낸다(S1, S2).
6. 외부 값을 `as`나 캐스팅으로 믿고 쓰거나, 같은 검증을 곳곳에 반복한다. 고친다: 경계 파서 한 곳(B1, B2).
7. 에러를 삼키거나 실패를 성공처럼 보고한다. 고친다: E1, 그리고 HANDOFF에 실패를 그대로 적는다.
8. 린트, 타입 오류를 검사 끄기로 해결한다. 고친다: 원인을 고치고, 불가피하면 줄마다 사유(B4).
9. 요청하지 않은 추상화와 범위 밖 리팩터링. 고친다: 부채 목록에 적고 이번 변경에서 뺀다(S3).
10. 게이트 명령이 없다고 "해당 없음"으로 넘긴다. 고친다: 명령이 없으면 실패로 보고한다.
