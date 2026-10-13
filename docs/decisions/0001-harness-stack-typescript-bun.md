# 0001. 하네스 구현 스택: TypeScript + Bun

- 상태: 승인됨
- 날짜: 2026-10-14
- 관련: [1a ExecPlan](../exec-plans/active/2026-10-13-harness-v2-phase1.md) · [스택 리서치 근거](../references/research/expert-library-research-2026-10.md)

> 범위: **하네스 자체**를 만드는 스택이다. 하네스로 진행하는 프로젝트의 스택은 그 프로젝트의 기획·설계 단계에서 따로 정한다.

## 맥락

하네스 CLI는 작업 명세·HANDOFF·결정 파일(YAML frontmatter + Markdown)을 파싱·검증·렌더링하고, Claude Code·Codex 워커를 실행한다. 1b에서는 로컬 결정 서버와 Claude Code mod가 같은 계약을 읽어야 하는데, mod는 TypeScript만 지원한다(`import ... from 'claude-code'`). 배포는 어느 환경에서든 같은 버전이어야 한다(D13).

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| **A. TypeScript + Bun 1.4 (선택)** | 계약 스키마 한 벌을 CLI·서버·mod가 공유, `bun build --compile` 단일 실행 파일(6개 타깃), 테스트·spawn·serve 내장, Claude Code와 같은 런타임 | 커버리지가 줄·함수 단위(분기 없음), `Bun.secrets`·`Bun.markdown` 실험 단계 |
| B. Python 3.14 + uv (차선, 기억해 둘 것) | 익숙함, pydantic·pytest 성숙, 기존 계획 | mod 때문에 계약 파서가 TS·Python 두 벌 → 어긋남, 단일 실행 파일 불가 |
| C. Deno 2.9 | 분기 커버리지·권한 고정 단일 실행 파일 | 키체인 내장 없음, 생태계 호환 마찰 |
| D. Go / Rust | 단일 바이너리 | mod와 언어 분리, 새 언어 학습 |

## 결정

A. TypeScript 7(native) + Bun 1.4.3, 린트·포맷 Biome, CLI commander, 계약 스키마 zod 4, YAML은 `yaml`(frontmatter는 직접 분리 — `gray-matter`는 `---js` eval 경로가 있어 금지), Markdown은 markdown-it(`html:false`), HTML은 hono/jsx(자동 이스케이프, `raw` 금지), 테스트는 bun test + 경로별 커버리지 게이트. 워커는 1a에서 셸 명령(`claude -p --restricted`, `codex exec --json`)으로 부르고, 공식 SDK·ACP·Orca는 어댑터 인터페이스 뒤에 나중에 붙인다.

B(Python 3.14 + uv)를 차선으로 기록한다. A의 전제(mod 공유, Bun 안정성)가 깨지면 B로 전환을 검토한다.

## 결과 (Consequences)

- 쉬워지는 것: 계약 변경이 CLI·서버·mod에 한 번에 반영, 실행 파일 하나로 배포, mise `github:` 백엔드로 버전 고정.
- 어려워지는 것: 분기 커버리지 — `src/core/`는 Bun 전용 API를 쓰지 않는 순수 TS로 유지해 필요 시 Vitest로 측정(Bun 종속도 줄어듦). 실험 API는 인터페이스 뒤에 숨긴다.
- 새 제약: npm 공급망 위험 → `bun install --frozen-lockfile`, 의존성 수명 최소화, lifecycle script 비활성(Bun 기본). Claude Code `--bare`가 `-p` 기본값이 되면 구독 인증 워커가 깨질 수 있으므로 버전 고정과 실행 전 인증 검사.
