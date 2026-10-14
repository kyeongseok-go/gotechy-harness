# 하네스 v2 1a단계 — 같은 파일 계약으로 일을 맡기고, HANDOFF를 이해하고 검증된 결정으로 반영한다

<!-- docs/PLANS.md의 헌법을 따른다. 살아있는 문서 — 진척마다 그 자리에서 개정한다. -->

## Purpose / Big Picture

지금 하네스(v1.5)는 프로젝트마다 통째로 복사하는 템플릿이고, 한 번도 실제 프로젝트에 쓰인 적이 없다. 1a단계가 끝나면 고텍이는 ①Claude Code나 Codex 워커에게 같은 형식의 작업 명세로 일을 맡기고, ②워커가 남긴 HANDOFF를 3초 카드·HTML 화면으로 이해하고, ③검증된 결정 파일로 다음 작업을 지시하고, ④격리된 새 환경에서도 명령 하나로 같은 버전의 도구 묶음을 설치할 수 있다. 이 상태가 되면 **바로 공문서 업무 AX 에이전트 프로젝트를 하네스로 시작**하고, 실사용 데이터는 그 프로젝트에서 모은다.

순서 원칙: 가장 얇은 관통 경로(이미 설치된 도구로 작업 1건 → HANDOFF)를 먼저 뚫고, 설치 계층은 그다음에 얹는다. 설치 가정 하나가 깨져도 관통 경로는 이미 동작하고 있어야 한다.

규모 추정(AI 실행 기준): M0 반나절, M1 1일, M2 1~2일, M3 2일. 일정은 게이트 통과 기준(D1)이며 추정을 크게 넘으면 그 자리에서 범위를 다시 자른다.

범위 밖:
- **1b단계 ExecPlan (필수, 1a 완료 게이트의 조건)**: 화면에서 바로 결정하는 로컬 서버(serve)와 오너 인증(키체인·생체 인증), 교차 검증 감사관, Orca 어댑터와 라우팅, 환경 프로필·배치, 작업 모드·무인 루프, 부작용 가드, Claude Code mod, Codex hook, HANDOFF 화면 시안 비교.
- **2단계 ExecPlan**: harness-bench 실측과 라우팅 보정, radar·train 자동 갱신 파이프라인, 기존 스킬 8개 이관과 문서 다이어트, 공개 전 점검.

## Progress

> 시각은 해당 커밋 시각(KST) 기준이다. 2026-10-14에 커밋 기록과 대조해 바로잡았다.

- [x] (2026-10-13 22:36) 결정 트리 확정(D3은 미결, D12는 방향 합의 — 나머지 확정), 스펙 초안 작성
- [x] (2026-10-13 22:36) spec-reviewer 검토(🔴6 🟡6 🟢2) 반영 — 1단계를 1a/1b로 분할
- [x] (2026-10-13 22:52) 구현 전 독립 교차 검토(Fable 5.1 🔴4 🟡7 🟢4, Codex GPT-6.1 Sol RED 7) 반영 — 순서 재배치, 결정 검증의 위협 모델 축소·정직화, Python 3.12 고정, 검증 항목 객관화
- [x] (2026-10-13 23:09) M0 전제 확인 — mise·apm·uv 락·Claude restricted·Codex 샌드박스 검증, 공통 worktree 격리로 설계 보강
- [x] (2026-10-13 23:45) 구현 스택 확정 — TypeScript + Bun (ADR 0001), 차선 Python 3.14 + uv
- [x] (2026-10-13 23:45) M1 관통 경로 — 계약 문서, CLI(init·task new/lint·run·handoff lint), worktree 격리, claude·codex·fake 어댑터. 테스트 49개 통과, 커버리지 91%, 실제 Claude·Codex 워커 각 1회 성공
- [x] (2026-10-14 00:24) M2a HANDOFF 규칙과 문체 검사: 계약 v1.1(4.1절 HANDOFF 규칙 8개, 7절 문체 규칙), `handoff lint` 내용 규칙, 문체 lint(2026-10-20까지 경고, 21일부터 오류), `text lint` 명령, 용어 은행 53개, 예외 구간 표지. 테스트 87개 통과
- [x] (2026-10-14 00:53) M2b 인박스와 읽기 전용 HTML: 계약 8절, `gotechy inbox`(3초 카드, golden test), `gotechy render`(hono/jsx, markdown-it `html: false`, CSP, 허용 요소 목록), HANDOFF 예외 표지 금지, 터미널과 HTML의 제어 문자 제거, 저장소 위생 테스트. 테스트 115개 통과
- [x] (2026-10-14 01:53) M2c 결정과 반영 (밤샘 루프, `docs/exec-plans/active/2026-10-14-overnight-loop.md`): 계약 6절(게이트, 서명, decide, verify, run의 강제)과 9절(이해 게이트, 측정, 인박스 게이트 표시, accept, 용어 누적). `keys init`, `keys rotate`, `decide`, `gate verify`, `accept`. 보안 감사 1차 지적(높음 3, 중간 3, 낮음 4) 수정. 보안 감사 2차 지적(높음 3, 중간 1, 낮음 2) 수정. 테스트 196개 통과
- [x] (2026-10-14 02:09) M3 설치 계층 중 격리 환경에서 검증할 수 있는 부분 (밤샘 루프): 계약 10절, `train.yaml`(train 2026.10.0), `gotechy doctor [--history]`, `gotechy setup [--dry-run] [--restore]`, gitleaks hook과 `.gitleaks.toml`(주민등록번호 규칙), `bin/gotechy` 부트스트랩. M3 보안 리뷰 수정 뒤 테스트 258개 통과
- [x] (2026-10-14 13:06) 이 맥에 실제 `setup` 적용과 복원 (Validation 14 실측, 오너 결정 T-006). 두 설정 파일의 바이트와 권한이 원본과 같아짐. 증거 `docs/references/evidence/2026-10-14-setup-real/`
- [x] (2026-10-14 13:23) train A등급 도구 6개의 mise 락(4개 플랫폼 29항목, 모두 체크섬). 부트스트랩이 mise를 PATH에 두고 락 그대로만 설치(`MISE_LOCKED=1`, `bun install --frozen-lockfile`)
- [x] (2026-10-14 18:14) claude, codex를 mise로 고정(A등급, 오너 외출 중 기본값으로 진행, 확인 필요). 새 클론과 빈 HOME에서 doctor 13개 모두 통과(Validation 12)
- [x] (2026-10-14 18:26) `gotechy test`와 커버리지 기준(Validation 17). 격리 셸에서 찾은 `GOTECHY_CWD` 누출 수정. 핵심 모듈 목록을 `ARCHITECTURE.md`에 채움
- [ ] M3 나머지: `init`의 apm 전환(작업 5) (오너와 함께)
- [x] (2026-10-14 01:53) ADR 작성: D5 배포(0002), D7 오케스트레이션(0003), D13 train(0004), 결정 서명(0005)
- [x] (2026-10-14 18:55) 보안 감사 5차(security-auditor): 3차 수정, M3 수정, 오늘 변경분. 높음 0, 중간 1, 낮음 3, 중간과 낮음 2건 수정
- [ ] 보안 리뷰 (/gotechy-security) — 워커 격리, 결정 검증, HTML 렌더링, 전역 설정 수정. M2 부분은 2026-10-14 밤 security-auditor 1차, 2차로 진행(결과는 `docs/references/evidence/2026-10-14-overnight/`). M3(전역 설정 수정) 뒤 전체 리뷰는 남음
- [ ] 1a 완료 게이트 (/gotechy-ship 기능 등급) → 공문서 프로젝트 착수
- [ ] **(필수, 사용자 지시 2026-10-13) 1b ExecPlan 작성·착수** (2026-10-14 밤 초안 작성: `2026-10-14-harness-v2-phase1b.md`, 2026-10-14 13:05 오너가 범위와 순서 승인, 착수 전) — 1a 완료 게이트는 1b ExecPlan 파일이 `active/`에 생겨야 통과한다

## Surprises & Discoveries

- (설계) Orca 오케스트레이션은 문서상 "Experimental 토글"이 필요하다고 되어 있었지만 1.4.209에서 토글 없이 동작했다. 증거: `orca orchestration run-list --json` → `"ok": true`.
- (설계) harness-bench(`<workspace>/harness-bench`)는 토큰을 시도마다 마지막 `output_tokens` 하나만 세고 있었다 → 2026-10-13 수정(`bench/usage.py`).
- (설계) 공문서 파서 분야에 오픈소스 kordoc(공공 GitLab)이 이미 HWP·HWPX 왕복 편집·MCP 서버를 제공 → 공문서 프로젝트 착수 전 차별점 결정 필요.
- (리뷰) 기존 `scripts/viewer/build_html.py`는 본문을 innerHTML로 넣고 `</script>` 소문자만 치환한다 → 렌더러는 새로 쓰고 모든 텍스트를 이스케이프한다.
- (교차 검토, 두 모델이 독립적으로 같은 지적) 워커는 오너와 같은 OS 사용자로 돌기 때문에, 대칭 키 HMAC은 워커의 자가 승인을 막지 못한다. 1a의 결정 검증은 "실수·낡은 판본·수기 편집 방지 + 워커 실행 격리"로 범위를 정직하게 줄이고, 진짜 오너 인증은 1b로 미룬다.
- (교차 검토) macOS 기본 Python 3.9에는 `tomllib`이 없고 apm의 pip 경로는 3.10 이상을 요구한다. bash 3.2에는 bash 4 문법이 없고 `sha256sum`이 없다(`shasum -a 256`).

**보안 감사 5차 (2026-10-14 18:20~18:55, 오너 외출)**
- 범위: 3차 수정(git 무결성), verify 샌드박스, M3 수정, 오늘 바꾼 부트스트랩과 mise 락, 워커 환경 변수, `gotechy test`. 높음 0, 중간 1, 낮음 3. [확인]
- 중간 1: 워커(claude, codex)가 오너 셸의 환경 변수를 모두 물려받았다. 셸이 있는 codex 워커는 `GITHUB_TOKEN` 같은 값을 파일에 써서 accept로 메인에 들여올 수 있었다(리드와 accept의 커밋은 hook을 끄고 돌아 gitleaks도 지나감). 이 세션에도 이름에 KEY, TOKEN, SECRET이 든 변수가 6개 있었다. 워커에는 허용 목록만 넘긴다. 허용 목록만으로도 `claude auth status`와 `codex login status`가 로그인 상태였다. [확인]
- 낮음 1: verify 샌드박스의 비밀 목록에 `.git-credentials`, `.npmrc`, `.pypirc`, `.config/gcloud`, `.kube`, `.docker`를 더했다. N0에서 찾은 Secure Enclave와 인증 서비스 차단도 이때 넣었다. [확인]
- 낮음 2: 리드의 git이 오너 셸의 `GIT_DIR`, `GIT_CONFIG_COUNT` 같은 변수를 따랐다. 넘기지 않는다. [확인]
- 낮음 3(accept 범위 검사에 키 값 검사 없음)은 N1에서 비밀 키 파일이 없어지므로 고치지 않았다. [확인]
- 재현 테스트 7개(`tests/e2e/audit5.test.ts`)를 먼저 쓰고 고쳤다. mutation 5종 모두 잡음. [확인]

**`bin/gotechy test`를 격리 셸에서 (2026-10-14 18:22~18:26, 오너 외출)**
- 보통 셸에서는 모두 통과하던 테스트 7개가 격리 셸의 `bin/gotechy test`에서 실패했다. 부트스트랩이 넘긴 `GOTECHY_CWD`가 CLI의 자식 프로세스(bun test, 그 안에서 띄운 CLI)까지 내려가, 테스트가 띄운 CLI가 엉뚱한 폴더로 이동했다. gotechy가 다른 gotechy를 부르는 실제 사용(hook 등)에서도 생길 버그다. CLI가 읽은 뒤 지우게 했다. [확인]
- 지워도 실패가 그대로였다. bun의 `Bun.spawn`은 env를 생략하면 시작 시점의 환경을 넘기고 `process.env`에서 지운 값을 반영하지 않는다(작은 스크립트로 확인: 생략하면 남고, `env: process.env`를 주면 사라짐). src의 모든 `Bun.spawn` 호출에 env를 명시하고, 저장소 위생 테스트로 고정했다. [확인]
- 고친 뒤 격리 셸에서 281 pass, 0 fail, 커버리지 기준 통과, exit 0. [확인]

**claude, codex를 mise로 고정 (2026-10-14 18:06~18:16, 오너 외출)**
- 오너에게 물은 결정(claude와 codex 고정 방식)에 답이 없어, 낮 루프 규칙대로 추천안을 기본값으로 진행했다. 커밋을 따로 나눠 되돌리기 쉽게 했다. [확인]
- aqua의 claude-code 2.1.296과 codex 0.162.1을 `mise.lock`에 4개 플랫폼 체크섬과 함께 고정했다(락 37항목). [확인]
- mise로 설치한 claude 2.1.296의 `claude auth status`가 기존 로그인(claude.ai)을 그대로 읽었다. 키체인 허용 창은 뜨지 않았고 `~/.claude/settings.json` 해시와 `~/.claude.json` 수정 시각은 그대로였다. [확인]
- claude와 codex가 들어가자 새 설치 시간이 52초에서 2분 31초로 늘었다(claude 바이너리가 가장 크다). [확인]

**M3 fresh install 실험 (2026-10-14 13:16~13:23, 오너와 함께)**
- 빈 HOME, 새 클론, claude와 codex와 orca만 보이는 PATH에서 `bin/gotechy`를 처음 돌렸다. 부트스트랩이 mise를 받고 `mise exec`가 도구 6개를 자동 설치했지만, `mise.lock`에 linux musl, baseline 같은 플랫폼 항목을 새로 써 넣었다. 실행만으로 라이브러리 저장소가 바뀐 것이다. `MISE_LOCKED=1`로 넘기면 락 그대로 설치하고 파일을 고치지 않는다. [확인]
- 새 클론에는 `node_modules`가 없는데 CLI가 돌았다. bun의 자동 설치가 `bun.lock` 없이 의존성을 받은 것이다. 부트스트랩이 `bun install --frozen-lockfile`을 먼저 돌리게 했다. [확인]
- 부트스트랩이 `$GOTECHY_HOME/bin`을 PATH에 넣지 않아 doctor가 `mise --version`을 찾지 못했다. [확인]
- 고친 뒤 새 환경에서 부트스트랩부터 doctor까지 52초(mise와 도구 6개, npm 패키지 20개). 실패는 claude 하나였다. 전역 claude가 13:12에 2.1.296에서 2.1.299로 자동 업데이트됐다(이 맥의 setup 실측 복원 6분 뒤). B등급 도구는 새 설치에서 train 버전을 만들 수 없고, doctor의 고치는 법(`mise install --locked`)도 B등급에는 맞지 않는다. [확인]

**M3 보안 리뷰와 M2c 3차 확인 (2026-10-14 밤, 오너 부재)**
- M3 보안 리뷰: 높음 1, 중간 4, 낮음 6. 가장 큰 것은 `init`이 `core.hooksPath`를 저장소 안 `.githooks/`로 잡아, 남이 만든 저장소에서 `init`하면 그 저장소의 다른 hook이 pull이나 checkout 때 실행되는 문제였다. hook과 gitleaks 설정을 `$GOTECHY_HOME/githooks/`로 옮기고 절대 경로로 연결했다. 재현 테스트 19개(`tests/e2e/m3-hardening.test.ts`)를 먼저 쓰고(18개 실패) 고쳤다. [확인]
  - 실험: `mise exec -C /tmp -- pwd`가 `/private/tmp`를 출력했다. 부트스트랩이 작업 폴더를 라이브러리로 바꿔 `init`이 라이브러리에 깔리는 문제가 실제였다. `GOTECHY_CWD`로 원래 폴더를 넘긴다. [확인]
  - 실험: `Bun.TOML.parse`는 중복 키를 오류로 거부하고 여러 줄 문자열, 따옴표 키, BOM을 읽는다. TOML 편집 결과를 이 파서로 다시 읽어 뜻이 바뀌지 않았을 때만 쓴다. [확인]
- M2c 3차 확인(2차 수정의 재검토): 2차 수정 중 파일 쓰기, 네트워크, 환경 변수, 산출물 커밋은 막혔고, 높음 1(확신도 중간)이 새로 나왔다. 워커가 worktree의 `.git` 파일이 가리키는 위치를 바꾸면 리드의 샌드박스 밖 git이 워커가 준비한 설정을 따를 수 있다. 워커 실행 전후로 git 연결 파일과 설정 목록(포함 파일까지)을 비교하고, 바뀌었으면 되돌린 뒤 그 실행에서 git을 더 부르지 않게 했다. 중간 1(osascript 같은 다른 프로세스 경로)도 샌드박스에서 막았다(실험: 실행 거부 126, bun test는 그대로). 재현 테스트 6개(`tests/e2e/hardening3.test.ts`). [확인]
- mutation check는 모두 53종이 됐다(M3 리뷰 수정 11, 3차 수정 5 추가). 한 번 살아남은 것(TOML 편집 결과의 뜻 검증)은 "파싱은 되지만 뜻이 바뀌는 편집" 테스트를 더해 잡았다. [확인]
- 감사 에이전트의 응답이 두 번 Anthropic 안전 분류기에 걸려 중간에 끊겼다. 에이전트는 공격 절차 없이 위험과 수정 방향만 다시 보고했다. [확인]

**M3 구현 중 발견 (2026-10-14 밤, 오너 부재)**
- `doctor`를 우리 라이브러리에 직접 돌리자 `owner-protocol` 스킬의 description이 429자로 계약 상한(400자)을 넘었다. 뜻을 유지하고 388자로 줄였다. [확인]
- 이 맥에 `doctor`를 읽기 전용으로 돌린 결과(9건 실패): mise, bun, apm, gitleaks가 전역 PATH에 없고 node(24.13.0), uv(0.8.15), gh(2.96.0)가 train보다 오래됐다. claude, codex, orca는 train과 같다. 정책 두 파일이 빠져 있다. 실제 설치와 setup은 오너와 함께 한다. [확인]
- 기존 v1.5 스크립트(`scripts/*.sh`, 가드 hook)는 bash를 명시하고 `[[`를 쓴다. 결정 기록의 원래 의도("bash 4 문법과 GNU 전용 명령 금지")에 맞춰, `#!/bin/sh`에는 POSIX 규칙을, bash 스크립트에는 bash 3.2에 없는 문법만 금지하도록 나눴다. 기존 스크립트에 bash 4 문법은 없었다. [확인]
- `init`이 gitleaks hook을 켜면, gitleaks가 없는 CI에서 테스트용 커밋이 모두 막힌다(hook이 fail-closed). 테스트 도우미는 hook 없이 프로젝트를 만들고, hook은 `tests/e2e/gitleaks.test.ts`가 따로 검사한다. [확인]
- 저장소의 가드 hook이 테스트 문자열 속 `.env`를 시크릿 파일 접근으로 보고 셸 명령을 막았다. 테스트 값을 다른 경로로 바꿨다. [확인]
- 새 HOME에서 Bun을 돌리면 Bun이 `~/Library/Caches`를 만든다. `setup --dry-run` 검사(Validation 13)는 두 설정 파일과 `~/.gotechy`만 본다. [확인]
- Codex 0.162.1 바이너리에 `check_for_update_on_startup` 설정 키가 있는 것을 확인했다(문자열 검사). 실제로 업데이트 확인을 끄는지는 실행으로 확인하지 않았다. [추론]
- `decide` 확인 질문에서 Ctrl-C를 누르는 경우를 가상 터미널(`script`)로 실험했다. exit 130, 잠금 해제, 게이트는 결정 전 그대로였다. readline의 SIGINT를 넘기는 줄을 빼도 잠금은 풀렸다(Bun 1.4.3의 readline은 질문을 거부해 `finally`가 돈다). 감사 2차의 걱정(잠금이 남음)은 이 환경에서 재현되지 않았고, 그 줄은 종료 코드를 130으로 맞춘다. 실험 스크립트는 scratch에만 있다. [확인]
- mutation check 7종(동시 변경 감지, 사용자 변경 뒤 복원 중단, 링크 대상 수정, 권한 보존, 버전 비교, 고정 등급 C, hook fail-closed)을 모두 테스트가 잡았다. [확인]

**M2c 구현 중 발견 (2026-10-14 밤, 오너 부재)**
- 보안 감사 1차가 높음 3건을 찾았다. 셋 다 실제로 재현했다(`tests/e2e/hardening.test.ts`, 처음 13개 모두 실패). [확인]
  - verify가 워커가 쓴 테스트 코드를 오너 권한으로 실행해서, 그 코드가 서명 키를 읽고 결정을 위조할 수 있었다. "격리된 워커를 막는다"는 계약이 거짓이었다. macOS `sandbox-exec`로 키 폴더와 private 읽기, 작업 폴더 밖 쓰기를 막아 해결했다. 실험으로 확인한 SBPL 동작: 뒤에 쓴 allow가 앞의 deny를 이긴다, 심볼릭 링크를 거친 읽기도 막힌다, bun은 샌드박스 안에서도 돈다.
  - 워커가 HANDOFF 자리에 심볼릭 링크를 두면 리드가 링크를 따라가 게이트 파일을 덮어썼다. 워커가 만든 링크는 모두 되돌리고 실패로 처리한다.
  - 필요한 게이트를 게이트 파일 목록에서 정해서, 파일을 지우거나 판본을 낮추면 검사를 피했다(fail-open). 작업 명세와 HANDOFF에서 계산하고 빠진 게이트는 다시 여는 방식으로 바꿨다.
- 보안 감사 2차(1차 수정의 재검토)가 1차 수정의 빈틈 높음 3건을 더 찾았다. 1차 샌드박스는 `(allow default)`에 프로젝트 쓰기만 막아서, verify가 홈의 git 설정 같은 파일을 고쳐 리드가 나중에 돌리는 git을 오염시킬 수 있었다. 변경 범위 검사가 verify보다 먼저 끝나 verify가 만든 보호 경로 파일이 브랜치에 커밋됐다. worktree의 `.git` 파일도 verify가 바꿀 수 있었다. 쓰기 기본 거부, 네트워크 차단, 환경 변수 허용 목록, `.git` 쓰기 금지, "커밋 뒤 verify, verify 뒤 부산물 삭제" 순서, 리드 git의 전역 설정과 훅 끄기, accept의 브랜치 범위 재검사로 고쳤다(`tests/e2e/hardening2.test.ts`, 처음 9개 모두 실패). [확인]
  - 실험: 쓰기를 기본 거부해도 HOME과 TMPDIR을 임시 폴더로 주면 bun test가 돈다. 키 파일에 대한 하드 링크와 `cp -c` 복제도 막힌다. [확인]
  - 하드 링크와 키 유출은 워커(특히 키를 읽을 수 있는 Codex) 쪽 문제라 샌드박스로는 못 막는다. 리드가 변경 파일의 하드 링크 여부와 현재 키 값 포함 여부를 검사해 되돌린다. [확인]
  - 실험 중에 Claude Code 안전 검사가 `sh -c` 안의 스크립트를 확인할 수 없다며 명령을 막았다(삭제 명령은 없었다). 우회하지 않고 실험 스크립트를 파일로 따로 써서 실행했다. [확인]
- mutation check는 모두 30종(1차 구현 11, 감사 1차 수정 10, 2차 수정 9)을 돌렸다. 두 번 살아남은 결함이 있었다. 하나는 아래의 nonce 검사, 다른 하나는 "verify 뒤 부산물 지우기"였다. 후자는 이번 실행의 커밋에는 영향이 없지만 다시 실행할 때 부산물이 워커 변경으로 잡힌다. worktree에 부산물이 남지 않는지 보는 단언을 더해 잡았다. [확인]
- 새 용어 풀이 규칙을 오늘 밤 HANDOFF에 직접 써 보니 오탐이 많았다. 마일스톤, 결정 번호(M1, M2b, D13)와 증거 절의 명령 출력(pass, fail)이 잡혔다. 둘 다 빼고 흔한 단어(HTML, OS, test)를 은행에 넣었다. 경고 기간에 모으려던 조정 사례다. 문체 규칙의 영어 문장 인용도 쉼표로 이은 도구 이름 목록을 잘못 잡았다(ADR 0004). [확인]
- mutation check에서 한 번 살아남은 결함이 있었다. "nonce가 그 게이트의 마지막 기록인가" 검사를 빼도 테스트가 통과했다. 되살린 옛 결정이 이전 키 검사에도 걸려서 이 검사가 따로 증명되지 않았던 것이다. 같은 키로 서명한 옛 결정을 되살리는 테스트를 더해 잡았다. [확인]
- `accept`를 설계하다 원래 규칙의 버그를 찾았다. 선행 작업이 done이기만 하면 뒤 작업이 시작했는데, 그 변경은 작업 브랜치에만 있어 뒤 작업이 선행 결과 없이 일하게 된다. 선행 조건을 `accepted`(메인에 병합됨)로 바꿨다. [확인]
- 리드가 메인 체크아웃에 작업 상태와 HANDOFF를 기록하기 때문에, 작업 브랜치를 그대로 병합하면 그 기록과 부딪힌다. 병합 결과에서 `orchestration/` 변경은 빼고 워커가 바꾼 파일만 가져온다. [확인]
- `decide` 테스트 30개가 처음 구현에서 한 번에 통과했다. 그래서 mutation check 11종을 돌려 테스트가 실제로 방어를 검사하는지 확인했다. [확인]
- 저장소의 가드 hook이 변수 경로의 `rm -rf`를 막아서, 실험 폴더는 지우지 않고 매번 새로 만들었다. [확인]
- M2c 커밋(8a71f2e)의 CI가 ExecPlan 위생 검사에서 실패했다. `active/`의 모든 계획에 `## Validation` 절이 있어야 하는데 밤샘 루프 설계 문서에 없었다. 행동으로 판정하는 수용 기준 절을 더해 고쳤다. lint, 타입 검사, 테스트는 Linux CI에서도 통과했다. [확인]
- 밤샘 HANDOFF를 손으로 쓰면서 `verified.at`에 실제보다 늦은 추정 시각(02:45)을 적었다가, 커밋 전에 검증을 다시 돌리고 실제 시각(01:54)으로 고쳤다. 실제 흐름에서는 리드(`run`)가 이 값을 기계로 찍는다. 측정값을 사람이나 모델이 손으로 쓰면 틀린다는 사례다. [확인]
- CLAUDE.md의 위키 경로(`~/Documents/Obsidian/Gotechy-Wiki/`)가 이 맥에 없다. 설명 문서의 frontmatter는 일반 형식으로 썼다. [확인]

**M2b 구현 중 발견 (2026-10-14)**
- RED, GREEN 순서를 지켰다. 계약 8절을 먼저 쓰고, 인박스 golden test(`tests/e2e/inbox-cli.test.ts`)와 렌더 보안 테스트(`tests/core/render.test.ts`)가 실패하는 것을 본 뒤 구현했다. 결함을 일부러 넣는 mutation check로 테스트가 실제로 잡는지도 봤다(제어 문자 제거를 빼면 2개, `html: true`면 3개, 링크 검사를 끄면 2개 실패). [확인]
- 악성 HANDOFF(스크립트, 이벤트 속성, `javascript:` 링크, form, iframe)가 구조 lint를 경고 1건으로 통과했다. lint는 보안 경계가 아니고, 막는 곳은 렌더러다. [확인]
- 실제 M1 HANDOFF 2건으로 dogfooding하자 카드가 "리스크 없음"으로 나왔는데 실제 리스크는 2건이었다. 계약 v1.1 이전 형식이라 리스크 절 제목이 달라 절을 못 찾은 것이다. 없는 절은 "리스크 기록 없음"으로, 계약 위반은 "형식 오류 N건"으로 보이게 고쳤다. [확인]
- Bun은 스크립트 옆이 아니라 실행 위치의 tsconfig로 JSX를 변환한다. 다른 프로젝트 폴더에서 CLI를 돌려도 되도록 `.tsx` 파일마다 `@jsxImportSource hono/jsx`를 적었다. [확인]
- Bun HTMLRewriter(lol-html)는 속성 값을 entity 디코딩 없이 돌려준다(`&#39;none&#39;`). 테스트는 브라우저가 보는 값으로 디코딩한 뒤 판정한다. [확인]
- 편집 도구를 거치며 명령 속 `\u202a` 같은 양방향 문자 escape가 실제 문자로 바뀌어 소스에 들어갔다. Python에서 raw 문자열의 길이가 1로 나와서 알았다. 처음에는 Biome 자동 수정을 의심했지만 작은 파일로 재현되지 않았다. 정규식은 `\p{Cc}`, `\p{Bidi_Control}`로, 테스트 문자열은 `String.fromCodePoint`로 바꾸고, 보이지 않는 문자를 막는 `tests/core/repo-hygiene.test.ts`를 더했다. [확인]
- 브라우저 확인: Chrome 확장이 `file://`을 열지 못해 scratch 폴더를 임시 `127.0.0.1` 서버로 띄워 봤다. 악성 내용은 모두 글자로 보였고, favicon 요청은 서버에 닿지 않았다(CSP 차단). 콘솔 예외 2건은 정상 화면에도 같이 나와 악성 내용과 무관하다. 확장의 스크립트가 CSP에 막힌 것으로 보인다. [추론]

**M2a 구현 중 발견 (2026-10-14)**
- 이번에는 순서를 지켰다. HANDOFF 규칙 테스트(`tests/core/handoff-rules.test.ts`)와 문체 테스트(`tests/core/style.test.ts`)를 먼저 쓰고 실패를 확인한 뒤 구현했다. 예외는 Validation 5를 채우려고 나중에 더한 3개(추천 줄 없음, 모든 오류에 고치는 법, HANDOFF 필수 키 누락)로, 이미 있던 동작을 고정한 것이라 처음부터 통과했다. [확인]
- 문체 lint를 계약 문서 자체에 돌리자 경고 73건이 나왔다. 대부분은 7절 규칙 표가 금지 패턴을 인용한 탓이었고, 나머지는 예전 본문의 진짜 가운데점이었다. 규칙을 설명하는 구간은 `<!-- style-ignore-start -->`와 `<!-- style-ignore-end -->`로 감싸 검사에서 빼고, 진짜 위반은 고쳐서 0건이 됐다. [확인]
- 마스킹은 펜스 코드 블록만 인식하고 들여쓰기 코드 블록은 인식하지 않는다. 목록의 하위 항목 들여쓰기와 구분하기 어려워서다. 계약 문서의 들여쓰기 블록 2개(파일 배치, 상태 전이)는 펜스 블록으로 바꿨다. [확인]
- 이 문서의 진행 시각 일부가 실제 커밋 시각과 달랐다(M1을 10-14 03:30으로 적었지만 커밋은 10-13 23:45). 커밋 기록에 맞춰 바로잡았다. [확인]

**M1 구현 중 발견 (2026-10-14)**
- 테스트를 코드보다 나중에 썼다(.claude/rules/testing.md의 RED→GREEN 위반). 대신 왕복 직렬화 테스트가 실제 버그(저장할 때마다 본문 앞에 빈 줄 추가)를 잡았다 → `serializeFrontmatter`가 본문을 손대지 않도록 수정. M2부터는 실패하는 테스트를 먼저 쓴다.
- `--restricted` 모드의 Claude 워커는 스킬을 로드하지 않았다(HANDOFF `skills_loaded: []`). 지시문에 계약을 직접 담은 설계(스킬 로딩에 기대지 않음)가 맞았다. 대신 명령 실행 도구가 없어 워커가 verify를 직접 못 돌리고, 그 사실을 HANDOFF에 정직하게 적었다 → 리드 verify가 필수인 이유. [확인]
- Codex 워커는 셸이 있어 verify를 스스로 실행하고 결과를 증거에 적었다. 같은 계약, 다른 능력 — HANDOFF의 `verified`(리드 측정)와 본문(워커 주장)을 분리한 설계가 이 차이를 흡수한다. [확인]
- 실제 실행 비용: Claude Opus 5.5 low effort $0.091(출력 1,543 토큰), Codex GPT-6.1 Sol low 입력 6,233 + 캐시 49,920 + 출력 413 토큰. 증거: `docs/references/evidence/2026-10-14-m1/`. [확인]
- zsh에서 명령을 변수에 넣으면 단어로 쪼개지지 않는다 → 문서·스크립트 예시는 래퍼 스크립트나 함수로.

**M0 전제 확인 결과 (2026-10-14, macOS arm64)**
- mise v2026.10.8: 릴리스 바이너리 sha256이 공식 `SHASUMS256.txt`와 일치(`dd77de9a…`, 목록 줄은 `./` 접두사). 레지스트리에 전부 있음 — python·node(core), uv·claude-code·codex·gh·gitleaks(aqua), apm(github:microsoft/apm). `mise lock --platform macos-arm64,macos-x64,linux-x64` → 24개 플랫폼 항목(URL·sha256, gh는 provenance=github-attestations). `mise install --locked`로 8개 도구가 격리 폴더에 79초에 설치: Python 3.12.15, uv 0.13.0, node 24.21.0, claude 2.1.296, codex 0.162.1, gh 2.102.0, apm 0.33.0, gitleaks 8.30.1. [확인]
- 격리 방법: `MISE_DATA_DIR`·`MISE_CONFIG_DIR`·`MISE_CACHE_DIR`·`MISE_STATE_DIR`를 지정하면 사용자 홈을 건드리지 않는다. GitHub API 한도를 피하려면 `MISE_GITHUB_TOKEN`. [확인]
- apm v0.33.0: 단독 바이너리(파이썬 비의존) sha256 일치. 로컬 스킬 패키지를 `--target claude,agent-skills`로 설치 → `.claude/skills`·`.agents/skills` 두 곳 + `apm.lock.yaml`(배포 파일별 sha256). 배포 파일을 변조하면 `apm audit --ci` exit 1, `apm install --frozen` 후 exit 0으로 복구. 주의: 로컬 경로 설치는 락에 절대 경로가 들어가 이식성이 없다 → 실제 배포는 git 원격(태그 고정)으로. `apm_modules/`에 원본 `.git`까지 복사되므로 `.gitignore` 필수(apm이 자동 추가). [확인]
- Claude Code `-p --restricted --permission-mode acceptEdits --settings '{"permissions":{"deny":["Read(./orchestration/gates/**)","Edit(...)","Write(...)"]}}'`: 작업 폴더 밖 파일 읽기 차단, 결정 폴더 읽기·쓰기 차단, README 편집만 성공. 명령 실행 도구 없음. 비용 약 $0.18/5턴(Opus 5.5 기본 effort, `--effort` 플래그로 조절 가능). `acceptEdits` 없이는 편집도 승인 대기로 거부됨. [확인]
- **Codex `exec -s workspace-write`: 작업 폴더 안의 결정 파일을 실제로 수정했다**(`pending → resolved`). 폴더 밖 비밀 파일은 모델이 스스로 거절했을 뿐 샌드박스 차단이 아니다. 또 표준 입력을 닫지 않으면 `Reading additional input from stdin...`에서 무한 대기한다(`< /dev/null` 필수). usage에 `cache_write_input_tokens`·`reasoning_output_tokens` 필드가 있다. [확인]
- 결론: 워커 격리를 "도구별 권한 설정"에만 기대면 백엔드마다 구멍이 다르다. → 모든 백엔드 공통으로 **워커는 별도 git worktree(작업 브랜치)에서 실행하고, 리드는 메인 체크아웃의 결정 파일만 읽으며, 워커 diff가 보호 경로(`orchestration/gates/`, 정책·설정 파일)를 건드리면 실행을 실패 처리**한다. 결정 키는 워커가 읽을 수 있는 파일에 두지 않는다(키 저장 방식은 구현 스택 리서치 후 확정).

## Decision Log

| 결정 | 근거 | 날짜 | ADR 승격 |
|---|---|---|---|
| D1~D14 (설계 문서 12절)을 전제로 한다. D3(채택 정책)은 미결이라 1a에서는 외부 스킬을 채택하지 않는다 | grill-me | 2026-10-13 | D5·D7·D13 ADR |
| 1단계를 1a·1b로 분할, 1b는 필수 | spec-reviewer R1, 사용자 지시 | 2026-10-13 | - |
| 순서: 관통 경로(M1) → 오너 코어(M2) → 설치 계층(M3) | Fable 🔴2: 설치 가정이 깨져도 HANDOFF가 먼저 나와야 한다 | 2026-10-14 | - |
| 1a 결정 검증 = 서명 + 워커 실행 격리, 위협 모델은 "실수·낡은 판본·수기 편집·격리된 워커" | Fable 🔴1, Codex RED 4·5: 같은 사용자 대칭 키는 자가 승인을 못 막음 | 2026-10-14 | ADR |
| ~~CLI는 Python 3.12 + uv~~ → **TypeScript 7 + Bun 1.4.3** (ADR 0001, 차선 Python 3.14 + uv 기록) | 스택 리서치: mod가 TS 전용이라 계약 한 벌 공유, 단일 실행 파일, 사용자 확정 | 2026-10-14 | ADR 0001 |
| 셸 스크립트는 POSIX sh, bash 4 문법·GNU 전용 명령 금지 (lint로 검사) | macOS bash 3.2 | 2026-10-14 | - |
| 1a의 작업은 공개 데이터·되돌릴 수 있는 로컬 작업만 | Codex RED 7: 경로 규칙으로는 외부 발행을 못 막음 | 2026-10-14 | - |
| 어댑터 표기 "Orca 1 + native 1(백엔드 claude·codex)", 1a는 native만 | D7 | 2026-10-13 | - |
| 테스트 방식 = SDD + 수용 테스트 먼저 (외부 경계는 실험 후 고정), `.claude/rules/testing.md` 개정 | 사용자 확정. M1은 테스트를 나중에 써서 규칙 위반 — M2부터 적용 | 2026-10-14 | - |
| M2에 `gotechy accept` 추가: 오너 승인 후 작업 브랜치를 메인에 병합, 충돌 시 needs-decision | 사용자의 "말해 보기" 답에서 발견된 누락(워커 결과 통합 단계 없음) | 2026-10-14 | - |
| 하네스 v2 대상 사용자 = 고텍이 1인, 2차 = 채용 담당자 | Y6 | 2026-10-13 | - |
| 계약 v1.1: 리스크 절 제목을 "건너뛴 것, 확인 못 한 것, 리스크"로, 증거 형식을 `` `명령`: 결과 ``로 바꾸고 HANDOFF 규칙 8개와 문체 규칙(7절)을 계약에 넣는다 | 사용자 지시(산출물과 대화 모두 AI 티 금지), 화살표 표기는 문체 규칙과 충돌 | 2026-10-14 | - |
| 문체 규칙은 2026-10-20까지 경고, 21일부터 오류. HANDOFF 내용 규칙은 처음부터 오류 | 기존 문서와 워커가 적응할 기간. 경고만으로는 고쳐지지 않으므로 날짜를 박아 둔다 | 2026-10-14 | - |
| 금지 패턴을 인용해야 하는 구간은 `style-ignore` 표지로 감싼다. 들여쓰기 코드 블록은 지원하지 않고 펜스로 쓴다 | 계약 문서 자체 dogfooding에서 오탐 다수 | 2026-10-14 | - |
| 선행 작업 조건을 `done`에서 `accepted`로 바꾸고, 작업 상태에 `accepted`를 더한다 | done만으로는 선행 변경이 메인에 없어 뒤 작업이 그 결과 없이 일한다 | 2026-10-14 | - |
| `accept`는 임시 worktree에서 병합과 verify를 끝낸 뒤 메인을 fast-forward만 한다. 병합 결과에서 `orchestration/` 변경은 뺀다 | 실패해도 메인이 그대로이고, 리드 기록과 워커 변경을 섞지 않는다 | 2026-10-14 | - |
| 필요한 게이트는 원천(작업 명세, HANDOFF)에서 계산하고, 읽을 수 없는 게이트 파일이 있으면 모든 실행을 멈춘다 | 보안 감사 높음 3(fail-open) | 2026-10-14 | 결정 서명 ADR |
| verify는 macOS `sandbox-exec` 안에서 돌리고, 다른 OS에서는 그 사실을 기록한다 | 보안 감사 높음 1. 워커가 쓴 테스트가 키를 읽고 결정을 위조할 수 있었다 | 2026-10-14 | 결정 서명 ADR |
| 이해 게이트는 답하는 단계를 건너뛸 수 없지만 빈 답도 받는다. 비대화 `--answer-file`은 만들지 않고 테스트는 함수로 답을 넣는다 | Validation 10 원문. `decide`가 TTY 전용이라 파일 입력은 우회로가 된다 | 2026-10-14 | - |
| hook과 gitleaks 설정은 저장소 밖 `$GOTECHY_HOME/githooks/`에 두고 절대 경로로 연결한다. 기존 hooksPath나 `.git/hooks`가 있으면 손대지 않는다 | M3 보안 리뷰 높음 1, 중간 5 | 2026-10-14 | - |
| 워커가 git 연결이나 설정을 바꾸면 그 실행에서는 git을 더 부르지 않고 실패로 끝낸다 | 감사 3차 높음. 리드의 git이 워커가 준비한 필터를 오너 권한으로 실행할 수 있다 | 2026-10-14 | 결정 서명 ADR |
| 1a의 `setup`은 전역 설정의 정책만 다루고 도구 설치는 부트스트랩과 `mise install --locked`에 맡긴다 | 전역 설정 변경을 작게 유지해야 백업과 복원을 확실히 증명할 수 있다 | 2026-10-14 | - |
| gitleaks hook은 gitleaks가 없으면 커밋을 막는다(fail-closed) | 없을 때 통과시키면 검사가 있는 척만 한다 | 2026-10-14 | - |
| 셸 규칙: `#!/bin/sh`는 POSIX, bash 스크립트는 bash 3.2에 없는 문법만 금지 | macOS 기본 bash 3.2와 기존 v1.5 스크립트 | 2026-10-14 | - |
| 렌더 의존성은 hono 4.13.13(의존성 없음)과 markdown-it 15.0.2를 정확한 버전으로 고정한다. 이미지는 만들지 않고 링크는 http(s)만 | HTML 자동 이스케이프와 1b 로컬 서버 재사용. 이미지는 추적 픽셀 같은 외부 요청이 된다 | 2026-10-14 | - |
| 인박스는 같은 묶음에서 오래 기다린 것부터. "형식 오류" 수에는 문체 규칙을 넣지 않는다 | 오래 막힌 결정이 먼저. 문체는 날짜에 따라 강도가 바뀌어 카드가 저절로 달라진다 | 2026-10-14 | - |
| HANDOFF에서는 문체 예외 표지를 금지하고(오류), 표지가 있어도 문체 검사를 한다 | 워커가 HANDOFF 전체를 감싸면 검사를 피할 수 있다(미탐) | 2026-10-14 | - |
| 인박스와 화면의 모든 문자열에서 제어 문자와 양방향 제어 문자를 지운다 | 악성 HANDOFF가 터미널 화면을 덮어쓰거나 글자 순서를 속일 수 있다 | 2026-10-14 | - |
| 새 영어 용어는 용어 은행(라이브러리 `knowledge/terms.jsonl`, 프로젝트 `orchestration/terms.jsonl`)에 없을 때만 "새 용어" 풀이를 요구한다 | 사용자가 용어를 익히려는 목적, 같은 풀이 반복은 소음 | 2026-10-14 | - |
| claude, codex를 B등급에서 A등급(mise 고정)으로 올린다. 워커에는 자동 업데이트 끄기를 넘긴다. 전역 정책의 자동 업데이트 끄기를 뺄지는 오너 결정으로 남긴다 | B등급은 새 설치에서 train 버전을 만들 수 없다(13:12에 전역 claude가 저절로 2.1.299가 됨). 오너 외출 중 추천안을 기본값으로 진행, 확인 필요 | 2026-10-14 | ADR 0004 갱신 |
| 밤샘 루프 결정 4건: 밤사이 푸시 유지(T-002), 선행 조건 accepted 유지(T-003), setup 실측은 바로(T-006), 1b 범위와 순서 승인(T-007) | 오너가 채팅으로 답함(13:05). 기본값 5건에는 이의 없음. 이 맥에 키가 아직 없어 `decide` 서명 기록은 아님 | 2026-10-14 | - |

## Outcomes & Retrospective

(완료 시 작성)

## Context and Orientation

먼저 읽을 것: `docs/design-docs/2026-10-13-expert-library-v0.md`(설계·결정), `docs/product-specs/harness-v2.md`(스펙), `docs/references/research/expert-library-research-2026-10.md`(근거).

용어:
- **팩(pack)**: 한 분야 전문가의 일하는 방법을 담은 스킬 묶음. 절차·체크리스트·예시·검증 기준이다.
- **스킬**: `SKILL.md`와 참조 파일 폴더(Agent Skills 표준). frontmatter는 표준 6필드만.
- **AGENTS.md 라우터**: 모든 도구가 읽는 AGENTS.md 안의 압축 색인. Claude용으로 `CLAUDE.md`에 `@AGENTS.md` 한 줄 브리지를 둔다.
- **train**: 함께 검증된 도구 버전 묶음. `train.yaml` + `mise.lock` + `apm.lock.yaml`.
- **파일 계약**: 작업 명세(task)·결과 보고(HANDOFF)·결정(gate)을 파일로 주고받는 약속. 실행 도구는 실행만, 결정과 결과는 파일이 원천.
- **워커 / 리드 / 오너**: 작업하는 에이전트 세션 / 메인 세션에서 작업을 나누고 게이트를 관리하는 에이전트 / 고텍이.
- **워커 실행 격리**: 워커 프로세스에 별도 `HOME`·`GOTECHY_HOME`을 주고, 허용 도구·권한·시간·예산을 명시해 실행한다. 워커는 오너의 결정 키와 `orchestration/gates/`를 볼 수도 쓸 수도 없다.
- **native 어댑터**: Orca 없이 `claude -p`·`codex exec`로 워커를 돌린다. 1a의 유일한 실행 경로.
- **fake 어댑터**: 녹화한 `{handoff.md, patch.diff}`를 적용·재생하는 테스트용 어댑터. LLM 호출 없이 결과를 재현한다.

저장소 배치 (이 저장소 = 정본 라이브러리):

    bin/gotechy                   POSIX sh 부트스트랩 (스크립트 위치로 라이브러리 절대 경로 계산)
    train.yaml                    도구별 버전·고정 등급·아키텍처별 체크섬·검증 결과
    mise.toml / mise.lock         python 3.12, uv, node, claude-code, codex, gh, apm, gitleaks
    policy/                       도구별 업데이트·텔레메트리 차단 조각
    apm.yml                       이 라이브러리를 apm 패키지로 노출
    skills/<pack>-<name>/         스킬 정본
    tools/gotechy/                CLI (Python 3.12, cli.py + cli.py.lock)
    tests/ (fixtures/ 포함)       CLI 테스트, 녹화 응답, 규칙 위반 샘플
    templates/project/            AGENTS.md 라우터, CLAUDE.md 브리지, orchestration/ 골격, .gitignore 조각
    adapters/native/              claude·codex 백엔드, fake
    knowledge/terms.jsonl         용어 은행 (공개 가능한 기술 용어만)
    examples/sandbox/             검증용 샘플 프로젝트 (공개 데이터만)

프로젝트 쪽 배치 (`gotechy init`이 만든다):

    AGENTS.md, CLAUDE.md(@AGENTS.md)
    .claude/skills/, .agents/skills/  apm 설치
    apm.yml / apm.lock.yaml
    orchestration/tasks/T-###.md      작업 명세 (리드가 작성, 번호는 잠금 파일로 발급)
    orchestration/handoffs/T-###.md   결과 보고 (워커가 작성)
    orchestration/gates/G-###.md      결정 (gotechy decide만 작성, 워커 접근 불가)
    orchestration/private/            이해 답변·이벤트 기록 (.gitignore)

개인·비공개: `~/.gotechy/`(결정 키 0600·백업·mise 바이너리), `~/.claude/gotechy-career.yaml`.

## Plan of Work

### M0: 전제 확인 (반나절)

- goal: 계획이 기대는 외부 가정을 실제 명령과 출력으로 확인하고, 깨진 가정은 대안을 정한다.
- work (결과를 Surprises에 명령·출력 요약으로 기록, 실패 시 Decision Log에 대안):
  1. mise: 버전 지정 설치와 아키텍처별(macOS arm64·x64, Linux x64) 체크섬, `mise lock`, `mise install --locked`, 레지스트리 백엔드(aqua·npm)에서 python·uv·node·claude-code·codex·gh·apm·gitleaks 존재.
  2. apm: 단독 바이너리(파이썬 비의존) 버전 고정 설치, `targets: [claude, agent-skills]` 동시 설치 경로, `apm install --frozen`, `apm audit --ci`.
  3. uv: `uv lock --script`와 locked 실행(`uv run --locked`), python 3.12 관리.
  4. Claude Code: `-p --output-format json` 결과 형식, 비대화 실행의 권한 지정(`--allowedTools`/`--permission-mode`)·타임아웃·`--max-budget-usd`, 업데이트·텔레메트리 차단 설정의 정확한 위치와 값, 격리된 `HOME`에서 인증 유지 방법.
  5. Codex: `exec --json` 이벤트 형식, `-s` 샌드박스, 업데이트·분석 차단 설정, 격리 `HOME`에서 인증(`CODEX_HOME`).
  6. gitleaks: staged 검사와 전체 이력 검사 명령, 사용자 정의 규칙(주민번호·전화번호 등 개인정보 패턴).
  7. (1b 대비 기록만) Orca `worker_done --report-path`, `claude agents --json`, mod API 문서, 폰 푸시 경로, macOS 키체인 접근 제어.
- result / proof: 항목마다 확인·실패·대안이 Surprises에 있다.

### M1: 관통 경로 — 계약 → 작업 1건 → HANDOFF → verify

- goal: 이미 설치된 claude·codex로 "작업 명세 → 격리된 워커 실행 → HANDOFF → verify 통과 → 구조 lint 통과"가 끝까지 돈다.
- work:
  1. 계약 스키마를 먼저 문서로 고정: `docs/references/contract.md`에 task·HANDOFF·gate의 frontmatter 키, 본문 절, 상태 전이(task: draft → ready → running → done|failed|needs-decision; gate: pending → resolved|rejected; `gate: before`면 해소 전 실행 불가, `after`면 HANDOFF 후 생성), 번호 발급(잠금 파일 `orchestration/.seq.lock`), 게이트 생성 주체(리드 또는 `run`이 needs-decision을 받았을 때).
  2. CLI 골격(시스템에 있는 uv로 임시 실행, M3에서 고정): `init`, `task new`, `task lint`, `run`, `handoff lint`(구조만).
  3. `skills/owner-protocol/` + `templates/project/`(AGENTS.md 라우터, CLAUDE.md 브리지, orchestration/ 골격, `.gitignore`에 `orchestration/private/`). 1a의 `init`은 apm 없이 복사로 설치하고 M3에서 apm으로 교체한다.
  4. native 어댑터(claude·codex 백엔드): 워커 실행 격리(별도 `HOME`·`GOTECHY_HOME`, 허용 도구 목록, 타임아웃, 예산 상한, 프로젝트 hooks·MCP 비활성), 권한 우회 플래그 사용 금지. 끝나면 작업의 `verify` 명령을 리드 쪽에서 실행해 HANDOFF `status`와 대조.
  5. fake 어댑터: fixture `{handoff.md, patch.diff}`를 적용하고 `verify`까지 실행.
- result: 같은 T-001을 fake·claude·codex로 돌려 모두 verify 통과 HANDOFF를 낸다.
- proof: Validation 1~4.

### M2: 오너 코어 — 이해하고 검증된 결정으로 반영한다

- goal: 오너가 HANDOFF를 3초 카드 → HTML 화면으로 이해하고, `gotechy decide`로 검증된 결정 파일을 남기며, `run`은 검증을 통과한 결정만 따른다.
- work:
  1. `handoff lint` 규칙 (규칙마다 통과·실패 fixture를 `tests/fixtures/handoff/`에):
     - 구조: 필수 frontmatter 키, 본문 절 순서(결정 필요, 한 줄 요약, 한 일, 증거, 건너뛴 것, 확인 못 한 것, 리스크, 새 용어, 말해 보기, 다음 단계), 중복 YAML 키 거부. 규칙 원문은 `contract.md` 4.1절.
     - 길이: 한 줄 요약 ≤60자, 리스크 항목 ≤3, 막는 결정 ≤3(초과 시 "작업을 쪼개거나 결정 세션으로" 교정 메시지).
     - 결정: `[막는]`·`[기본값]`·`[알림]` 표지, 결정마다 옵션 ≥2·추천 1·이유 1줄.
     - 증거: `` `명령`: 결과 `` 형식만 (계약 v1.1).
     - 사실 표시: "한 일"·"리스크" 절 목록 항목 끝에 `[확인]`·`[추론]`·`[추정]`(제목·코드 블록 제외).
     - 강조: 굵게는 "결정 필요"·"리스크" 절에서만.
     - 실패 메시지는 "무엇이 틀렸나, 어떻게 고치나, 예시" 순서.
     - 문체(`contract.md` 7절): 기호, 이모지, 번역투, 상투어, 과장, 대조 반전 등. `gotechy text lint`로 아무 md에나 쓸 수 있다. 새 영어 용어는 용어 은행에 없으면 "새 용어" 풀이를 요구한다.
  2. `gotechy inbox`: 결정 필요 → 실패 → 완료 순(동률은 시각 순) 3초 카드, 빈 인박스는 "대기 중인 일 없음".
  3. `gotechy render`: 읽기 전용 HTML 1안(시안 비교는 1b). 새 렌더러: HANDOFF·용어·속성·URL 전부 이스케이프, 스크립트 없음, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`, 링크는 `rel="noopener noreferrer"`이며 `http(s)`만.
  4. 결정 `gotechy decide G-### <선택> ["다음 지시"]`: 대화형 터미널(TTY)에서만 실행(비대화 호출 거부). 서명 대상은 canonical JSON `{project_id, task_id, gate_id, task_spec_sha256, handoff_sha256, choice, instruction, key_id, nonce, decided_at}`. 키는 `gotechy keys init`이 만든 `~/.gotechy/keys/<key_id>` (0600). 잠금 + 원자적 저장, 소비 기록(nonce)으로 재사용·동시 결정 차단.
  5. `gotechy gate verify` + `run`의 강제: `run`은 `gate: before` 작업을 시작하기 전, 다음 작업을 이어가기 전에 반드시 verify하고 실패 시 멈춘다. verify는 서명·nonce 미사용·현재 명세/HANDOFF 해시 일치를 본다.
  6. 이해 게이트: 작업의 `ownership`이 경로 규칙(스키마·인증·보안·배포 설정 파일 — `contract.md`에 목록)에 걸리거나 `irreversible: true`면 필수, 경로 규칙이 명세 값보다 우선. 문항 정답 핵심어는 frontmatter `comprehension_keys`에 두고 render·inbox에서 제외. 비대화 테스트용 `--answer-file`. 답·적중은 `orchestration/private/`에만 저장.
  7. 용어 은행: HANDOFF `new_terms` 중 은행에 없는 것만 카드로.
  8. 측정 필드: HANDOFF `skills_loaded`, 게이트 `opened_at`(render/inbox가 해당 게이트를 처음 보여 준 시각)·`decided_at`·`active_seconds`(decide 프롬프트 체류 시간).
  9. `gotechy accept T-###`: 작업이 `done`이고 (게이트가 있으면) 검증된 결정이 승인일 때만, 작업 브랜치를 메인에 병합한다. 병합 전 메인에서 verify를 다시 실행하고, 충돌이나 verify 실패면 병합을 취소하고 작업을 `needs-decision`으로 올린다. 병합 후 worktree를 정리한다.
- result: HANDOFF를 이해하고 검증된 결정을 남기며, 검증 실패 결정으로는 다음 작업이 진행되지 않는다.
- proof: Validation 5~11.

### M3: 설치 계층 — 어디서든 같은 버전으로

- goal: 격리된 깨끗한 환경에서 부트스트랩 → setup → init(apm) → doctor가 통과하고, 전역 설정 수정은 백업·복원된다.
- work:
  1. `bin/gotechy`(POSIX sh): 스크립트 위치로 라이브러리 경로를 구하고, `~/.gotechy/bin/mise`가 없으면 train의 버전·아키텍처별 체크섬(`shasum -a 256`)으로 받아 검증. `--dry-run`이면 어떤 다운로드·캐시 생성 전에 계획만 출력하고 끝낸다. 이후 `mise exec -C <라이브러리> -- uv run --locked tools/gotechy/cli.py`.
  2. `train.yaml`(train `2026.10.0`) + `mise.toml` + `mise.lock`(아키텍처별) + `cli.py.lock`.
  3. `setup`: 전역 설정(`~/.claude/settings.json`, `~/.codex/config.toml`) 수정 전 `~/.gotechy/backup/<시각>/`에 원본·manifest(원본/변경 후 해시·권한·부재 여부) 저장, 기존 키·주석·권한 보존, symlink는 실제 파일을 수정, 동시 변경 감지 시 중단. `setup --restore <시각>`: 원래 없던 파일은 삭제, 이후 사용자 변경이 있으면 덮어쓰지 않고 중단. mise가 설치한 도구는 복원 대상이 아님(문서화).
  4. `doctor`: 설치 버전 = train, 차단 설정 적용, `apm audit --ci`, 스킬 frontmatter 6필드·토큰 예산(description ≤400자, 본문 ≤150줄, 자동 트리거 ≤15), 셸 스크립트 POSIX 검사. 실패마다 교정 명령. 프로젝트 안에서는 그 프로젝트 기준, 라이브러리에서는 라이브러리 기준.
  5. `init`을 apm(`targets: [claude, agent-skills]`, 버전 고정)으로 교체.
  6. gitleaks: train에 포함, `init`이 `core.hooksPath`로 staged 검사 hook 설정, `doctor --history`가 전체 이력 검사, 개인정보 규칙 추가. hook은 우회 가능하므로 공개 전환 시 CI 전체 검사가 최종 방어선(2단계).
- result: 새 환경 재현과 전역 설정 원상복구가 증명된다.
- proof: Validation 12~16.

## Concrete Steps

M1 (예상 출력은 구현하며 실제 값으로 갱신):

    $ cd examples/sandbox && ../../bin/gotechy init --packs owner
    created: AGENTS.md, CLAUDE.md, orchestration/{tasks,handoffs,gates,private}/
    $ ../../bin/gotechy task new "README에 설치 방법 한 줄 추가" --tier T0 --verify "grep -q 설치 README.md"
    created orchestration/tasks/T-001.md
    $ ../../bin/gotechy run T-001 --adapter fake
    applied patch, verify ok -> handoffs/T-001.md (status done)
    $ ../../bin/gotechy run T-002 --adapter native --backend claude
    $ ../../bin/gotechy run T-003 --adapter native --backend codex
    $ ../../bin/gotechy handoff lint orchestration/handoffs/T-002.md
    ok

M3 (격리 환경 — 모든 명령을 같은 격리 셸에서):

    $ export HOME=$(mktemp -d) PATH=/usr/bin:/bin
    $ bin/gotechy setup --profile home --dry-run      # 다운로드 전에 계획만 출력
    $ bin/gotechy setup --profile home && bin/gotechy doctor
    versions ........ match train 2026.10.0
    exit 0

테스트: `bin/gotechy test` = `uv run --locked` 기반 pytest + coverage, 실패 임계값 전체 80%·핵심 모듈(lint·decide·verify·adapters) 95%. `package.json`의 `npm test`는 이 명령을 호출하도록 바꾼다.

## Validation and Acceptance

- [x] 1. T-001(fake)은 patch 적용 후 `verify` exit 0, HANDOFF status `done`. 테스트 스위트 안에서 반복 실행해도 같은 결과.
- [x] 2. T-002(claude)·T-003(codex)이 각각 실제 1회 실행되어 README가 바뀌고 `verify` exit 0, HANDOFF가 구조 lint를 통과(증거 로그를 Artifacts에).
- [x] 3. 워커 실행 중 `~/.gotechy/keys`와 `orchestration/gates/` 읽기·쓰기 시도가 실패한다(fixture 워커로 검사).
- [x] 4. `task lint`가 `ownership`의 `orchestration/gates/`, `..` 경로, 글롭·심볼릭 링크 우회를 모두 거부한다.
- [x] 5. lint 실패 fixture(필수 키 누락·절 순서·중복 키·요약 초과·막는 결정 4개·옵션 1개·추천 없음·리스크 초과·증거 형식·사실 표시 누락·강조 위반·결정 표지 누락)가 각각 교정 메시지와 함께 실패하고, 통과 fixture는 통과한다. (2026-10-14: `tests/core/handoff-rules.test.ts`, `tests/core/lint.test.ts`, 중복 키는 `tests/core/frontmatter.test.ts`)
- [x] 6. `inbox` 출력이 고정 fixture의 기대 출력과 일치(순서, 동률, 빈 상태). (2026-10-14: `tests/e2e/inbox-cli.test.ts`, `tests/core/inbox.test.ts`)
- [x] 7. `<script>`, `<SCRIPT>`, `onerror=`, `javascript:` URL이 든 HANDOFF와 용어를 render하면, 결과를 HTML 파서(Bun HTMLRewriter, 속성은 entity 디코딩 후)로 파싱했을 때 script 요소 0개, `on*` 속성 0개, `javascript:` href 0개이고 CSP meta가 있다. 브라우저 확인은 수동 1회 스크린샷. (2026-10-14: `tests/core/render.test.ts` 12개, 허용 요소 목록 밖 요소 0개까지 검사. 스크린샷 `docs/references/evidence/2026-10-14-m2b/`)
- [x] 8. (2026-10-14: `tests/e2e/decide.test.ts`, `tests/e2e/hardening.test.ts`) `decide`로 만든 결정은 verify 통과. 다음은 모두 거부: 수기 편집, 같은 rev의 HANDOFF 내용 교체(해시 불일치), 다른 프로젝트 결정 재사용, nonce 재사용, 동시 decide 두 번, 비대화 호출.
- [x] 9. `run`은 verify 실패 게이트가 걸린 작업을 시작하지 않고 exit 1.
- [x] 10. (2026-10-14: `tests/e2e/comprehension.test.ts`) 경로 규칙에 걸린 작업은 명세에 `irreversible: false`라도 이해 문항 답 없이 결정이 기록되지 않는다. 빈 답·오답은 핵심어 적중 0으로 기록되고, 답은 `orchestration/private/` 밖(HTML·inbox·로그)에 나타나지 않는다.
- [x] 11. `keys rotate` 후 이전 키 서명 결정은 거부되고 재결정이 요구된다.
- [x] 11b. (2026-10-14: `tests/e2e/accept.test.ts`) 서로 다른 파일을 바꾼 두 작업은 `accept`로 차례로 병합되고, 같은 줄을 바꾼 두 번째 작업은 충돌로 병합이 취소되며 `needs-decision`이 된다. 메인 verify가 실패하면 병합하지 않는다.
- [x] 12. (2026-10-14 13:23: claude 버전 1건만 실패. 18:14: claude, codex를 mise로 고정한 뒤 새 클론과 빈 HOME에서 부트스트랩부터 doctor까지 2분 31초, 13개 검사 모두 ok, exit 0. 증거 `docs/references/evidence/2026-10-14-fresh-install/`) 격리 셸에서 `setup` → `doctor` exit 0 (fresh-install 로그를 Artifacts에, 현재 맥 아키텍처 기준. 다른 아키텍처는 2단계 CI).
- [x] 13. (2026-10-14: 임시 HOME, `tests/e2e/doctor-setup.test.ts`) `setup --dry-run` 전후로 `~/.claude/settings.json`·`~/.codex/config.toml`의 sha256과 `~/.gotechy` 존재 여부가 같다.
- [x] 14. (2026-10-14: 백업, 복원, 사용자 변경 시 중단은 임시 HOME 테스트로 통과. 13:06 이 맥에 실제 적용과 복원, sha256, 권한, `cmp` 결과가 모두 원본과 같음. 증거 `docs/references/evidence/2026-10-14-setup-real/`. 사용자 변경 시 중단 경로는 실제 설정을 건드리지 않으려고 임시 HOME 테스트로만 확인) 실제 `setup` 후 `--restore` 하면 두 설정 파일의 바이트·권한이 원본과 같고, 원래 없던 파일은 삭제된다. 복원 전에 사용자가 파일을 바꿨으면 복원이 중단된다. 실제 이 맥에 1회 적용·복원한 증거를 Artifacts에.
- [x] 15. (2026-10-14: 가짜 도구와 `tests/fixtures/train/train-mismatch.yaml`) doctor에 `GOTECHY_TRAIN=tests/fixtures/train-mismatch.yaml`로 불일치를 주입하면 exit 1과 교정 명령, 교정 후 재실행은 exit 0.
- [x] 16. (2026-10-14: gitleaks 8.30.1, `tests/e2e/gitleaks.test.ts`. gitleaks가 없는 CI에서는 fail-closed 테스트만 돈다) 격리된 임시 Git 저장소에서 합성 토큰·합성 주민번호가 든 파일의 커밋을 hook이 막고, `doctor --history`가 이력 속 합성 토큰을 찾는다.
- [x] 17. (2026-10-14 18:26: 새 클론과 빈 HOME의 격리 셸에서 `bin/gotechy test` 281 pass, 0 fail, exit 0. `gotechy test` 추가, contract.md 10.6절. 전체 줄 96.22%, 핵심 모듈 19개 중 가장 낮은 것 keys.ts 95.45%. 처음 재 보니 codex 어댑터 64.71%, fake 어댑터 92.94%, sandbox 94.83%여서 테스트를 채움) `bin/gotechy test` 전체 통과, 커버리지 전체 ≥80%·핵심 모듈 ≥95%.

## Idempotence and Recovery

- `init`·`setup`·`doctor`는 다시 돌려도 결과가 같다. `setup`이 끊기면 다시 실행하고, 전역 설정은 `setup --restore <시각>`으로 되돌린다.
- 작업 상태는 `orchestration/` 파일이 원천이다. `run T-###`는 마지막 HANDOFF 판본부터 이어 간다.
- 키를 잃거나 유출이 의심되면 `gotechy keys rotate` 후 대기 중 게이트를 다시 결정한다.

## Artifacts and Notes

- M1: 실제 워커 HANDOFF 2건과 작업 명세 — `docs/references/evidence/2026-10-14-m1/` (Claude: verify exit 0, $0.091 / Codex: verify exit 0).
- M2b: 인박스, 결정 필요 화면, 악성 HANDOFF 화면 스크린샷은 `docs/references/evidence/2026-10-14-m2b/`에 있다. 악성 화면에서 스크립트 실행 없음, 모든 태그가 글자로 표시.
- M3: 이 맥의 실제 전역 설정에 `setup` 적용과 `--restore` 1회, 증거는 `docs/references/evidence/2026-10-14-setup-real/` (적용 1초 뒤 복원, 바이트와 권한이 원본과 같음).
(구현하며 채운다: fresh-install 로그. 2차 사용자용 데모: 작업 맡기기부터 결정까지 3분 녹화 1건)

## Interfaces and Dependencies

- CLI: `gotechy {init|task new|task lint|run|handoff lint|text lint|inbox|render|decide|gate verify|accept|keys init|keys rotate|setup [--dry-run|--restore]|doctor [--history]|test}` — 종료코드 0 성공, 1 검사 실패, 2 환경 문제.
- 계약 상세는 M1에서 `docs/references/contract.md`로 고정한다(작업 명세·HANDOFF·게이트 frontmatter, 상태 전이, 경로 규칙 목록, 서명 payload).
- 외부 의존(M0에서 확인): mise, uv, Python 3.12, apm(0.x 고정), Claude Code, Codex, gitleaks. 환경 변수: `GOTECHY_HOME`(기본 `~/.gotechy`), `GOTECHY_TRAIN`(테스트용).

## career_signals

```yaml
career_signals:
  hypothesis:
    capabilities:
      - 도구 독립 파일 계약 기반 에이전트 작업 위임 설계·구현
      - 사람의 이해·결정을 검증된 게이트로 강제하는 Human-in-the-loop 설계 (위협 모델을 정직하게 한정)
      - 버전 고정·격리 검증 기반 재현 가능한 에이전트 환경
    jd_keywords_matched: [AI 에이전트, Claude Code skill, Human-in-the-loop, 에이전트 하네스, 자동화 파이프라인, 컨텍스트 엔지니어링]
  evidence:
    links: []
    metrics: []
    story: ""
```
