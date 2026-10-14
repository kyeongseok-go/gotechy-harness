# ARCHITECTURE.md — 시스템 아키텍처 지도

> matklad의 ARCHITECTURE.md 관례를 따른다: **"코드가 어디에 있는지"가 아니라 "무엇이 어디에 사는지, 왜 그렇게 나뉘는지"의 지도.**
> 이 파일은 하네스 v2 라이브러리(이 저장소) 자신의 지도다. 새 프로젝트용 템플릿은 `templates/project/`에 있다. 큰 구조가 바뀔 때만 갱신한다.

## 한 줄 요약

하네스 v2는 TypeScript와 Bun으로 쓴 명령줄 도구 `gotechy`다. 순수 규칙(`src/core`)과 파일, 프로세스, 서버를 다루는 실행부(`src/runtime`), 명령 연결(`src/cli.ts`)로 나뉜다. 진실의 원천은 `docs/references/contract.md`이고, 설치는 `bin/gotechy` 부트스트랩과 `train.yaml`, 팩은 `skills/`에 산다.

## 하네스 v2 라이브러리의 레이어

```
src/core     규칙과 판정. 순수 함수만(파일, 프로세스, 네트워크 없음). 스키마, lint, 서명 대상과 판정, 화면 HTML
src/runtime  실행부. 파일 계약 읽기와 쓰기, git과 워커 실행, 샌드박스, 서명 도구 호출, 로컬 서버, 설치
src/cli.ts   명령 연결과 종료 코드. runtime과 core만 부른다
```

의존은 cli에서 runtime, runtime에서 core 한 방향이다. `npm run check:boundaries`(`tests/boundaries/`)가 강제한다. 아래 "레이어 규칙(기본 골격)"은 새 프로젝트용 템플릿의 규칙이다.

## 레이어 규칙 (기본 골격)

각 비즈니스 도메인은 아래 고정 레이어로 나눈다. **의존은 항상 아래→위 단방향**이며, 역방향 import는 금지다.

```
Types   → 순수 타입·스키마 (의존 없음)
Config  → 설정·상수
Repo    → 데이터 접근 (DB/외부 API 호출은 여기만)
Service → 비즈니스 로직 (프레임워크 무관, 테스트 최우선 대상)
Runtime → 서버 엔트리·라우팅·핸들러
UI      → 컴포넌트·페이지
```

- 횡단 관심사(인증, 텔레메트리, 피처 플래그, 외부 커넥터)는 **Providers** 단일 인터페이스를 통해서만 접근한다.
- 원칙: **불변식은 강제하되 구현은 미시관리하지 않는다.** 예: "경계에서 파싱하라(parse, don't validate)"는 규칙이고, 어떤 파싱 라이브러리를 쓸지는 자유다.

## 디렉터리 지도

| 경로 | 담당 |
|---|---|
| `src/core/` | 계약 스키마, HANDOFF와 작업 명세 lint, 문체 규칙, 게이트 서명 대상과 판정, 인박스 카드, 화면 HTML(`view/`), 커버리지 기준, apm 매니페스트와 락 판정 |
| `src/runtime/` | 프로젝트 파일 접근, 워커 실행과 격리(`run`, `sandbox`, `git`, `adapters/`), 결정(`gates`, `keys`), 병합(`accept`), 화면 서버(`serve`), 설치(`init`, `packs`, `setup`, `doctor`) |
| `src/cli.ts` | `gotechy` 명령과 종료 코드 |
| `native/ownerkey.swift` | Secure Enclave 서명 도구 원본(`keys init`이 빌드) |
| `bin/gotechy` | 부트스트랩(POSIX sh): train의 mise를 체크섬으로 받아 CLI로 넘김 |
| `skills/` | 팩의 스킬 원본(apm이 프로젝트에 깜) |
| `templates/project/` | 새 프로젝트에 까는 AGENTS.md, CLAUDE.md, gitleaks hook 원본 |
| `train.yaml`, `mise.toml`, `mise.lock` | 함께 검증한 도구 버전 묶음 |
| `tests/` | `core/` 단위, `e2e/` 명령과 흐름, `boundaries/` 레이어 규칙, `fixtures/` 녹화 워커와 가짜 서명 도구 |
| `docs/` | 계약, 설계, ADR, ExecPlan, 증거, 자동 생성 문서(`generated/`) |

## 경계 (Invariants)

<!-- 기계 강제 장치: 라이브러리는 `npm run check:boundaries`(bun test tests/boundaries). CI가 매 push마다 전체 테스트와 함께 돈다. -->

하네스 v2 라이브러리(`tests/boundaries/layers.test.ts`가 강제):

1. `src/core`는 runtime과 cli를 import하지 않고, 파일, 프로세스, 네트워크를 쓰지 않는다. 규칙은 입력만으로 판정해 테스트하기 쉽게 둔다.
2. `src/runtime`은 cli를 import하지 않는다.
3. 워커 로그인 값(API 키) 이름은 어댑터와 run의 로그인 값 검사에서만 다룬다.

새 프로젝트 템플릿(dependency-cruiser, `.dependency-cruiser.cjs`): UI는 Repo를 직접 import하지 않는다. 외부 API 키와 시크릿은 Config 레이어 밖에서 읽지 않는다.

## 핵심 모듈 (커버리지 95% 대상 — QUALITY_BAR 참조)

<!-- 프로젝트별로 채운다. 예: src/service/billing/**, src/service/auth/** -->

하네스 v2(2026-10-14): `src/core/coverage.ts`의 `CORE_MODULES`가 원본이고 `gotechy test`가 파일마다 95%를 강제한다.

- lint: `src/core/{frontmatter,lint-handoff,lint-task,rules-handoff,paths,schema,schema-issues,sections,style}.ts`
- 결정과 검증: `src/core/{gate,decisions}.ts`, `src/runtime/{gates,keys,sandbox,accept}.ts`
- 어댑터: `src/runtime/adapters/*.ts`

## 기술 선택 원칙

- **"boring" 기술 우선** — 조합 가능하고 API가 안정적이며 학습 데이터에 잘 나타나는 것.
- 작고 불투명한 외부 의존성보다, 관측 가능성이 통합된 자체 헬퍼를 선호한다.
- 새 의존성 추가는 ADR(`docs/decisions/`) 한 건으로 기록한다.
