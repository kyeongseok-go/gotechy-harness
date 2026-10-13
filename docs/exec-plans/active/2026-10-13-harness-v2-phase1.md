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

- [x] (2026-10-13 23:00) 결정 트리 확정(D3은 미결, D12는 방향 합의 — 나머지 확정), 스펙 초안 작성
- [x] (2026-10-13 23:40) spec-reviewer 검토(🔴6 🟡6 🟢2) 반영 — 1단계를 1a/1b로 분할
- [x] (2026-10-14 00:30) 구현 전 독립 교차 검토(Fable 5.1 🔴4 🟡7 🟢4, Codex GPT-6.1 Sol RED 7) 반영 — 순서 재배치, 결정 검증의 위협 모델 축소·정직화, Python 3.12 고정, 검증 항목 객관화
- [x] (2026-10-14 01:30) M0 전제 확인 — mise·apm·uv 락·Claude restricted·Codex 샌드박스 검증, 공통 worktree 격리로 설계 보강
- [ ] 구현 스택 확정 (사용자 요청: 최신 기준 리서치 후 결정)
- [ ] M1 관통 경로 — 계약 → 작업 1건 → HANDOFF → verify (이미 설치된 claude·codex 사용)
- [ ] M2 오너 코어 — lint·인박스·읽기 전용 HTML·결정·이해 게이트·용어 은행
- [ ] M3 설치 계층 — 부트스트랩·train·setup·doctor·restore·gitleaks
- [ ] ADR 작성: D5(배포)·D7(오케스트레이션)·D13(train)·결정 검증 방식
- [ ] 보안 리뷰 (/gotechy-security) — 워커 격리, 결정 검증, HTML 렌더링, 전역 설정 수정
- [ ] 1a 완료 게이트 (/gotechy-ship 기능 등급) → 공문서 프로젝트 착수
- [ ] **(필수, 사용자 지시 2026-10-13) 1b ExecPlan 작성·착수** — 1a 완료 게이트는 1b ExecPlan 파일이 `active/`에 생겨야 통과한다

## Surprises & Discoveries

- (설계) Orca 오케스트레이션은 문서상 "Experimental 토글"이 필요하다고 되어 있었지만 1.4.209에서 토글 없이 동작했다. 증거: `orca orchestration run-list --json` → `"ok": true`.
- (설계) harness-bench(`<workspace>/harness-bench`)는 토큰을 시도마다 마지막 `output_tokens` 하나만 세고 있었다 → 2026-10-13 수정(`bench/usage.py`).
- (설계) 공문서 파서 분야에 오픈소스 kordoc(공공 GitLab)이 이미 HWP·HWPX 왕복 편집·MCP 서버를 제공 → 공문서 프로젝트 착수 전 차별점 결정 필요.
- (리뷰) 기존 `scripts/viewer/build_html.py`는 본문을 innerHTML로 넣고 `</script>` 소문자만 치환한다 → 렌더러는 새로 쓰고 모든 텍스트를 이스케이프한다.
- (교차 검토, 두 모델이 독립적으로 같은 지적) 워커는 오너와 같은 OS 사용자로 돌기 때문에, 대칭 키 HMAC은 워커의 자가 승인을 막지 못한다. 1a의 결정 검증은 "실수·낡은 판본·수기 편집 방지 + 워커 실행 격리"로 범위를 정직하게 줄이고, 진짜 오너 인증은 1b로 미룬다.
- (교차 검토) macOS 기본 Python 3.9에는 `tomllib`이 없고 apm의 pip 경로는 3.10 이상을 요구한다. bash 3.2에는 bash 4 문법이 없고 `sha256sum`이 없다(`shasum -a 256`).

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
| CLI는 Python 3.12(mise·uv가 관리, 시스템 Python 미사용) + PEP 723 의존성 + `uv lock --script`로 잠근 lock 파일 커밋 | 3.9에 tomllib 없음, PEP 723만으로는 전이 의존성 미고정 | 2026-10-14 | - |
| 셸 스크립트는 POSIX sh, bash 4 문법·GNU 전용 명령 금지 (lint로 검사) | macOS bash 3.2 | 2026-10-14 | - |
| 1a의 작업은 공개 데이터·되돌릴 수 있는 로컬 작업만 | Codex RED 7: 경로 규칙으로는 외부 발행을 못 막음 | 2026-10-14 | - |
| 어댑터 표기 "Orca 1 + native 1(백엔드 claude·codex)", 1a는 native만 | D7 | 2026-10-13 | - |
| 하네스 v2 대상 사용자 = 고텍이 1인, 2차 = 채용 담당자 | Y6 | 2026-10-13 | - |

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
     - 구조: 필수 frontmatter 키, 본문 절 순서(결정 필요 → 한 줄 요약 → 한 일 → 증거 → 건너뛴 것·확인 못 한 것·리스크 → 새 용어 → 말해 보기 → 다음 단계), 중복 YAML 키 거부.
     - 길이: 한 줄 요약 ≤60자, 리스크 항목 ≤3, 막는 결정 ≤3(초과 시 "작업을 쪼개거나 결정 세션으로" 교정 메시지).
     - 결정: `[막는]`·`[기본값]`·`[알림]` 표지, 결정마다 옵션 ≥2·추천 1·이유 1줄.
     - 증거: `명령 → 결과` 형식만.
     - 사실 표시: "한 일"·"리스크" 절 목록 항목 끝에 `[확인]`·`[추론]`·`[추정]`(제목·코드 블록 제외).
     - 강조: 굵게는 "결정 필요"·"리스크" 절에서만.
     - 실패 메시지는 "무엇이 틀렸나 → 어떻게 고치나 → 예시".
  2. `gotechy inbox`: 결정 필요 → 실패 → 완료 순(동률은 시각 순) 3초 카드, 빈 인박스는 "대기 중인 일 없음".
  3. `gotechy render`: 읽기 전용 HTML 1안(시안 비교는 1b). 새 렌더러: HANDOFF·용어·속성·URL 전부 이스케이프, 스크립트 없음, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`, 링크는 `rel="noopener noreferrer"`이며 `http(s)`만.
  4. 결정 `gotechy decide G-### <선택> ["다음 지시"]`: 대화형 터미널(TTY)에서만 실행(비대화 호출 거부). 서명 대상은 canonical JSON `{project_id, task_id, gate_id, task_spec_sha256, handoff_sha256, choice, instruction, key_id, nonce, decided_at}`. 키는 `gotechy keys init`이 만든 `~/.gotechy/keys/<key_id>` (0600). 잠금 + 원자적 저장, 소비 기록(nonce)으로 재사용·동시 결정 차단.
  5. `gotechy gate verify` + `run`의 강제: `run`은 `gate: before` 작업을 시작하기 전, 다음 작업을 이어가기 전에 반드시 verify하고 실패 시 멈춘다. verify는 서명·nonce 미사용·현재 명세/HANDOFF 해시 일치를 본다.
  6. 이해 게이트: 작업의 `ownership`이 경로 규칙(스키마·인증·보안·배포 설정 파일 — `contract.md`에 목록)에 걸리거나 `irreversible: true`면 필수, 경로 규칙이 명세 값보다 우선. 문항 정답 핵심어는 frontmatter `comprehension_keys`에 두고 render·inbox에서 제외. 비대화 테스트용 `--answer-file`. 답·적중은 `orchestration/private/`에만 저장.
  7. 용어 은행: HANDOFF `new_terms` 중 은행에 없는 것만 카드로.
  8. 측정 필드: HANDOFF `skills_loaded`, 게이트 `opened_at`(render/inbox가 해당 게이트를 처음 보여 준 시각)·`decided_at`·`active_seconds`(decide 프롬프트 체류 시간).
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

- [ ] 1. T-001(fake)은 patch 적용 후 `verify` exit 0, HANDOFF status `done`. 테스트 스위트 안에서 반복 실행해도 같은 결과.
- [ ] 2. T-002(claude)·T-003(codex)이 각각 실제 1회 실행되어 README가 바뀌고 `verify` exit 0, HANDOFF가 구조 lint를 통과(증거 로그를 Artifacts에).
- [ ] 3. 워커 실행 중 `~/.gotechy/keys`와 `orchestration/gates/` 읽기·쓰기 시도가 실패한다(fixture 워커로 검사).
- [ ] 4. `task lint`가 `ownership`의 `orchestration/gates/`, `..` 경로, 글롭·심볼릭 링크 우회를 모두 거부한다.
- [ ] 5. lint 실패 fixture(필수 키 누락·절 순서·중복 키·요약 초과·막는 결정 4개·옵션 1개·추천 없음·리스크 초과·증거 형식·사실 표시 누락·강조 위반·결정 표지 누락)가 각각 교정 메시지와 함께 실패하고, 통과 fixture는 통과한다.
- [ ] 6. `inbox` 출력이 고정 fixture의 기대 출력과 일치(순서·동률·빈 상태).
- [ ] 7. `<script>`·`<SCRIPT>`·`onerror=`·`javascript:` URL이 든 HANDOFF·용어를 render하면, 결과를 `html.parser`로 파싱했을 때 script 요소 0개·`on*` 속성 0개·`javascript:` href 0개이고 CSP meta가 있다. 브라우저 확인은 수동 1회 스크린샷.
- [ ] 8. `decide`로 만든 결정은 verify 통과. 다음은 모두 거부: 수기 편집, 같은 rev의 HANDOFF 내용 교체(해시 불일치), 다른 프로젝트 결정 재사용, nonce 재사용, 동시 decide 두 번, 비대화 호출.
- [ ] 9. `run`은 verify 실패 게이트가 걸린 작업을 시작하지 않고 exit 1.
- [ ] 10. 경로 규칙에 걸린 작업은 명세에 `irreversible: false`라도 이해 문항 답 없이 결정이 기록되지 않는다. 빈 답·오답은 핵심어 적중 0으로 기록되고, 답은 `orchestration/private/` 밖(HTML·inbox·로그)에 나타나지 않는다.
- [ ] 11. `keys rotate` 후 이전 키 서명 결정은 거부되고 재결정이 요구된다.
- [ ] 12. 격리 셸에서 `setup` → `doctor` exit 0 (fresh-install 로그를 Artifacts에, 현재 맥 아키텍처 기준. 다른 아키텍처는 2단계 CI).
- [ ] 13. `setup --dry-run` 전후로 `~/.claude/settings.json`·`~/.codex/config.toml`의 sha256과 `~/.gotechy` 존재 여부가 같다.
- [ ] 14. 실제 `setup` 후 `--restore` 하면 두 설정 파일의 바이트·권한이 원본과 같고, 원래 없던 파일은 삭제된다. 복원 전에 사용자가 파일을 바꿨으면 복원이 중단된다. 실제 이 맥에 1회 적용·복원한 증거를 Artifacts에.
- [ ] 15. doctor에 `GOTECHY_TRAIN=tests/fixtures/train-mismatch.yaml`로 불일치를 주입하면 exit 1과 교정 명령, 교정 후 재실행은 exit 0.
- [ ] 16. 격리된 임시 Git 저장소에서 합성 토큰·합성 주민번호가 든 파일의 커밋을 hook이 막고, `doctor --history`가 이력 속 합성 토큰을 찾는다.
- [ ] 17. `bin/gotechy test` 전체 통과, 커버리지 전체 ≥80%·핵심 모듈 ≥95%.

## Idempotence and Recovery

- `init`·`setup`·`doctor`는 다시 돌려도 결과가 같다. `setup`이 끊기면 다시 실행하고, 전역 설정은 `setup --restore <시각>`으로 되돌린다.
- 작업 상태는 `orchestration/` 파일이 원천이다. `run T-###`는 마지막 HANDOFF 판본부터 이어 간다.
- 키를 잃거나 유출이 의심되면 `gotechy keys rotate` 후 대기 중 게이트를 다시 결정한다.

## Artifacts and Notes

(구현하며 채운다: HANDOFF 예시, 실제 실행 로그, fresh-install 로그, 설정 백업·복원 증거, render 스크린샷. 2차 사용자용 데모: 작업 맡기기부터 결정까지 3분 녹화 1건)

## Interfaces and Dependencies

- CLI: `gotechy {init|task new|task lint|run|handoff lint|inbox|render|decide|gate verify|keys init|keys rotate|setup [--dry-run|--restore]|doctor [--history]|test}` — 종료코드 0 성공, 1 검사 실패, 2 환경 문제.
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
