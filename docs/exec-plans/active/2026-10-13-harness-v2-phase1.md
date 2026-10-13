# 하네스 v2 1a단계 — 같은 파일 계약으로 일을 맡기고, HANDOFF를 이해하고 서명된 결정으로 반영한다

<!-- docs/PLANS.md의 헌법을 따른다. 살아있는 문서 — 진척마다 그 자리에서 개정한다. -->

## Purpose / Big Picture

지금 하네스(v1.5)는 프로젝트마다 통째로 복사하는 템플릿이고, 한 번도 실제 프로젝트에 쓰인 적이 없다. 1a단계가 끝나면 고텍이는 ①격리된 새 환경에서도 명령 하나로 같은 버전의 도구 묶음을 설치하고, ②프로젝트에 필요한 팩만 넣고, ③Claude Code나 Codex 워커에게 같은 형식의 작업 명세로 일을 맡기고, ④워커가 남긴 HANDOFF를 3초 카드·HTML 화면으로 이해한 뒤 서명된 결정으로 반영할 수 있다. 이 상태가 되면 **바로 공문서 업무 AX 에이전트 프로젝트를 하네스로 시작**하고, 실사용 데이터는 그 프로젝트에서 모은다.

규모 추정(AI 실행 기준): M0 반나절, M1 1~2일, M2 2~3일. 일정은 게이트 통과 기준(D1)이며, 이 추정을 크게 넘으면 그 자리에서 범위를 다시 자른다.

범위 밖:
- **1b단계 ExecPlan** (1a 완료 직후 작성): 화면에서 바로 결정하는 로컬 서버(serve), 교차 검증 감사관, Orca 어댑터와 라우팅, 환경 프로필·배치, 작업 모드·무인 루프, 부작용 가드, Claude Code mod, Codex hook 대응.
- **2단계 ExecPlan**: harness-bench 실측과 라우팅 보정, radar·train 자동 갱신 파이프라인, 기존 스킬 8개 이관과 문서 다이어트, 공개 전 점검.

## Progress

- [x] (2026-10-13 23:00) 결정 트리 D1~D14 확정, 스펙 초안 작성
- [x] (2026-10-13 23:40) spec-reviewer 검토(🔴6 🟡6 🟢2) 반영 — 1단계를 1a/1b로 분할
- [ ] M0 전제 확인 — 외부 도구·API 가정을 명령과 출력으로 검증
- [ ] M1 tracer bullet — 부트스트랩 → 설치 → 계약 → 작업 1건 → HANDOFF lint 통과
- [ ] M2 오너 코어 — lint·인박스·HTML 화면(읽기 전용)·서명된 결정·이해 게이트·용어 은행
- [ ] 보안 리뷰 (/gotechy-security) — 결정 서명·HTML 렌더링·전역 설정 수정
- [ ] 1a 완료 게이트 (/gotechy-ship 기능 등급) → 공문서 프로젝트 착수

## Surprises & Discoveries

- (설계 단계) Orca 오케스트레이션은 문서상 "Experimental 토글"이 필요하다고 되어 있었지만 1.4.209에서 토글 없이 동작했다. 증거: `orca orchestration run-list --json` → `"ok": true`.
- (설계 단계) harness-bench(`<workspace>/harness-bench`)는 토큰을 시도마다 마지막 `output_tokens` 하나만 세고 있었다 → 2026-10-13 수정(`bench/usage.py`).
- (설계 단계) 공문서 파서 분야에 오픈소스 kordoc(공공 GitLab)이 이미 HWP·HWPX 왕복 편집·MCP 서버를 제공 → 공문서 프로젝트 착수 전 차별점 결정 필요.
- (리뷰) 기존 `scripts/viewer/build_html.py`는 본문을 innerHTML로 넣고 `</script>` 소문자만 치환한다 → HANDOFF 렌더러에 그대로 재사용하면 XSS 경로가 된다. 렌더러는 새로 쓰고 모든 텍스트를 이스케이프한다.

## Decision Log

| 결정 | 근거 | 날짜 | ADR 승격 |
|---|---|---|---|
| D1~D14 (설계 문서 12절) 전부 이 계획의 전제 | grill-me로 사용자와 확정 | 2026-10-13 | D5·D7·D13은 ADR로 승격 |
| 1단계를 1a(코어)·1b(화면 결정·감사관·오케스트레이션·mod)로 분할, 공문서 프로젝트는 1a 직후 시작 | spec-reviewer R1: 1단계가 2주 초과, 메타 작업 함정 | 2026-10-13 | - |
| CLI는 Python + PEP 723 인라인 의존성(PyYAML, pytest, coverage)을 uv로 고정 | 계약이 YAML이고 표준 라이브러리에 YAML 파서가 없음(R4). uv는 train에 포함 | 2026-10-13 | - |
| `bin/gotechy`는 POSIX sh 부트스트랩: 체크섬 고정 mise를 받아 `mise exec -- uv run` | uv를 setup이 설치하는 순환 제거(R5) | 2026-10-13 | - |
| 결정 파일은 HMAC 서명, 워커는 `orchestration/gates/` 쓰기 금지 | 워커·인젝션의 자가 승인 차단(R2) | 2026-10-13 | ADR |
| 어댑터 표기는 "Orca 1 + native 1(백엔드 claude·codex)" | D7과 용어 통일(G1) | 2026-10-13 | - |
| 하네스 v2의 대상 사용자는 고텍이 1인, 2차 사용자는 채용 담당자(데모 산출물) | PRODUCT_SENSE 기본 대상(부모님+초심자)과 다름을 명시(Y6) | 2026-10-13 | - |

## Outcomes & Retrospective

(완료 시 작성)

## Context and Orientation

먼저 읽을 것: `docs/design-docs/2026-10-13-expert-library-v0.md`(설계와 결정 D1~D14), `docs/product-specs/harness-v2.md`(스펙), `docs/references/research/expert-library-research-2026-10.md`(근거).

용어:
- **팩(pack)**: 한 분야 전문가의 일하는 방법을 담은 스킬 묶음. 페르소나가 아니라 절차·체크리스트·예시·검증 기준이다.
- **스킬**: `SKILL.md` 하나와 참조 파일로 된 폴더. Agent Skills 표준이라 여러 에이전트 도구가 읽는다. frontmatter는 표준 6필드(name, description, license, compatibility, metadata, allowed-tools)만 쓴다.
- **AGENTS.md 라우터**: 모든 도구가 읽는 AGENTS.md 안의 압축 색인. "이 일엔 이 팩 파일을 연다"를 적어 스킬 미지원 도구에서도 동작하게 한다.
- **train**: 함께 검증된 도구 버전 묶음. `train.yaml` + `mise.lock` + `apm.lock.yaml`로 고정한다.
- **파일 계약**: 작업 명세(task)·결과 보고(HANDOFF)·결정(gate)을 저장소 파일로 주고받는 약속. 오케스트레이션 도구는 실행만 맡고, 결정과 결과는 파일이 원천이다.
- **워커 / 리드 / 오너**: 워커는 작업하는 에이전트 세션, 리드는 메인 세션에서 작업을 나누고 게이트를 관리하는 에이전트, 오너는 고텍이.
- **게이트**: 오너 결정이 있어야 다음 작업이 시작되는 지점. 1a에서는 `orchestration/gates/G-###.md`(서명 포함)만, Orca 게이트 연동은 1b.
- **native 어댑터**: Orca 없이 에이전트 CLI(`claude -p`, `codex exec`)로 워커를 돌리는 방식. 1a의 유일한 실행 경로.
- **fake 어댑터**: 녹화해 둔 응답을 재생하는 테스트용 어댑터. LLM 호출 없이 CI에서 결과를 재현한다.

v2 저장소 배치 (이 저장소 = 정본 라이브러리):

    bin/gotechy, bin/gotechy.cmd  부트스트랩 (POSIX sh / Windows는 1b)
    train.yaml                    도구별 버전·고정 등급·검증 결과
    mise.toml / mise.lock         CLI·런타임 버전 고정
    policy/                       도구별 업데이트·텔레메트리 차단 조각 (적용 전 원본 백업)
    apm.yml                       이 라이브러리를 apm 패키지로 노출
    skills/<pack>-<name>/         스킬 정본
    packs/<pack>.yaml             팩 정의
    tools/gotechy/                CLI (Python, PEP 723 의존성)
    tests/                        CLI 테스트 + fixtures/ (녹화 응답, 규칙 위반 샘플)
    templates/project/            프로젝트에 깔리는 AGENTS.md 라우터, orchestration/ 골격
    adapters/native/              claude·codex 백엔드, fake
    knowledge/terms.jsonl         용어 은행 (공개 가능한 기술 용어만)
    examples/sandbox/             검증용 샘플 프로젝트

프로젝트 쪽 배치 (`gotechy init`이 만든다):

    AGENTS.md                         라우터 (≤100줄)
    .claude/skills/, .agents/skills/  apm이 설치한 팩
    apm.yml / apm.lock.yaml
    orchestration/tasks/T-###.md      작업 명세
    orchestration/handoffs/T-###.md   결과 보고
    orchestration/gates/G-###.md      결정 (워커 쓰기 금지, 서명)
    orchestration/private/            이해 답변·이벤트 기록 (.gitignore)

개인·비공개 (저장소 밖): `~/.gotechy/`(서명 키·환경 프로필·mise 바이너리), `~/.claude/gotechy-career.yaml`.

## Plan of Work

### M0: 전제 확인 (반나절)

- goal: 계획이 기대는 외부 도구·API 가정을 실제 명령과 출력으로 확인하고, 실패한 가정은 대안을 정한다.
- work: 아래를 하나씩 실행해 결과를 Surprises에 적는다. 실패하면 대안을 Decision Log에 남긴다.
  1. mise: 설치 스크립트 버전 지정·체크섬, `mise lock`, `mise install --locked`, 레지스트리에 claude-code·codex·apm·uv·gh·node 존재 여부(백엔드 aqua/npm).
  2. apm: 버전 고정 설치, `targets: [claude, agent-skills]`로 두 경로 동시 설치, `apm audit --ci`, `apm install --frozen`.
  3. Claude Code: `DISABLE_UPDATES`·`DISABLE_TELEMETRY`의 정확한 설정 위치와 값, `claude -p --output-format json` 결과 형식(usage·total_cost_usd).
  4. Codex: `check_for_update_on_startup`·`analytics.enabled` 설정, `codex exec --json` 이벤트 형식, `gpt-6-luna` 사용 가능 여부(1b 감사관용).
  5. (1b 대비, 기록만) Orca `worker_done --report-path`, `claude agents --json`, Claude Code mod API 문서 범위, 폰 푸시 경로.
- result: 가정 목록마다 확인/실패/대안이 기록된다.
- proof: Surprises에 항목별 명령·출력 요약이 있다.

### M1: tracer bullet — 부트스트랩 → 설치 → 계약 → 작업 1건 → HANDOFF

- goal: 격리된 깨끗한 환경에서 "부트스트랩 → setup → init → 작업 1건 → lint 통과 HANDOFF"가 끝까지 돈다.
- work:
  1. `bin/gotechy`(POSIX sh): `~/.gotechy/bin/mise`가 없으면 train에 적힌 버전과 체크섬으로 받아 검증 후 설치, 이후 `mise exec -- uv run tools/gotechy/cli.py "$@"`.
  2. `train.yaml` 초판(train `2026.10.0`) + `mise.toml` + `mise.lock`. 대상: claude-code, codex, node, uv, gh, apm. Orca는 등급 B로 버전만 기록.
  3. `setup`: `--dry-run`(바꿀 것 목록만 출력), 전역 설정(`~/.claude/settings.json`, `~/.codex/config.toml`) 수정 전 `~/.gotechy/backup/<시각>/`에 백업, `setup --restore <시각>`.
  4. `doctor` 1차: mise·apm 존재, 설치 버전 = train, 차단 설정 적용, `apm audit --ci`, 스킬 frontmatter 6필드, 토큰 예산 린트(description ≤400자, SKILL.md 본문 ≤150줄, 자동 트리거 스킬 ≤15). 실패마다 교정 명령 출력.
  5. 첫 스킬 `skills/owner-protocol/` + `templates/project/AGENTS.md` 라우터.
  6. `init --packs owner`: `examples/sandbox/`에 apm 설치(`targets: [claude, agent-skills]`), `orchestration/` 골격, `.gitignore`에 `orchestration/private/`.
  7. native 어댑터 최소판(claude 백엔드) + fake 어댑터. `task new` → `run` → HANDOFF → `handoff lint`(1차: 필수 절·frontmatter만).
  8. 커밋 hook에 gitleaks(비밀·개인 데이터 패턴) — 공개 저장소 전환 전 상시 검사.
- result: 명령 몇 개로 설치부터 lint 통과 HANDOFF까지 재현된다.
- proof: Validation 1~5.

### M2: 오너 코어 — 이해하고 서명된 결정으로 반영한다

- goal: 오너가 HANDOFF를 3초 카드 → HTML 화면으로 이해하고, `gotechy decide`로 서명된 결정 파일을 남긴다. (화면에서 바로 제출하는 서버는 1b)
- work:
  1. `handoff lint` 규칙 (규칙마다 통과·실패 샘플을 `tests/fixtures/handoff/`에 둔다):
     - 구조: frontmatter 필수 키, 본문 절 순서(결정 필요 → 한 줄 요약 → 한 일 → 증거 → 건너뛴 것·확인 못 한 것·리스크 → 새 용어 → 말해 보기 → 다음 단계).
     - 길이: 한 줄 요약 ≤60자, 리스크 항목 ≤3, 막는 결정 ≤3(초과 시 "작업을 쪼개거나 결정 세션으로 올리라"는 교정 메시지).
     - 결정 항목: `[막는]`·`[기본값]`·`[알림]` 표지 필수, 각 결정에 옵션 2개 이상·추천 1개·이유 1줄.
     - 증거: `명령 → 결과` 형식의 목록 항목만 허용.
     - 사실 표시: "한 일"·"리스크" 절의 목록 항목 끝에 `[확인]`·`[추론]`·`[추정]` 중 하나(제목·코드 블록 제외).
     - 강조: 굵게(`**`)는 "결정 필요"·"리스크" 절에서만 허용.
     - 모든 실패 메시지는 "무엇이 틀렸나 → 어떻게 고치나 → 예시" 형식.
  2. `gotechy inbox`: 결정 필요 → 실패 → 완료 순 3초 카드(상태·막는 결정 수·테스트·리스크 수·비용·파일 수).
  3. `gotechy render`: HANDOFF + 용어 은행 → **읽기 전용** HTML. 새로 작성하는 렌더러로, 모든 HANDOFF 텍스트를 HTML 이스케이프하고 CSP(`default-src 'none'; style-src 'self' 'unsafe-inline'`)를 건다. 스크립트 없이 `<details>`로 접기. 레이아웃 시안 2~3안 → 오너 게이트로 하나 선택.
  4. 결정: `gotechy decide G-### <선택> ["다음 지시"]` → `gates/G-###.md`에 resolution·instruction·handoff_rev·decided_at·opened_at·active_seconds 기록, `~/.gotechy/keys/` HMAC 서명. `gotechy gate verify`가 서명·판본을 검증하고 위조·낡은 판본을 거부. 워커 작업 명세의 `ownership`에서 `orchestration/gates/` 쓰기는 금지(lint로 검사).
  5. 이해 게이트: 작업 명세 `irreversible: true`이거나 `ownership`이 경로 규칙(스키마·인증·보안·배포 설정 파일)에 걸리면 자동으로 필수. `decide`가 설명 1~2문항을 먼저 받고, 핵심어 적중과 답을 `orchestration/private/`에 저장(공개 저장소 제외).
  6. 용어 은행 `knowledge/terms.jsonl`: HANDOFF `new_terms` 중 은행에 없는 것만 카드로. 한 번 설명한 용어는 다시 풀지 않는다.
  7. 실사용 지표용 필드: HANDOFF `skills_loaded`, 게이트 `opened_at`·`active_seconds`.
- result: HANDOFF 한 건을 이해하고 서명된 결정 파일을 남기며, 위조·낡은 결정은 거부된다.
- proof: Validation 6~11.

## Concrete Steps

M1 (예상 출력은 구현하며 실제 값으로 갱신):

    $ HOME=$(mktemp -d) PATH=/usr/bin:/bin bin/gotechy setup --profile home --dry-run
    would install: mise 2026.x (sha256 ok), claude-code, codex, node, uv, gh, apm
    would edit: ~/.claude/settings.json (backup first), ~/.codex/config.toml (backup first)
    $ HOME=$(mktemp -d) PATH=/usr/bin:/bin bin/gotechy setup --profile home && bin/gotechy doctor
    versions ........ 6/6 match train 2026.10.0
    update-blocks ... 2/2 applied
    apm audit ....... ok
    skills .......... 1 valid, token budget ok
    exit 0
    $ cd examples/sandbox && ../../bin/gotechy init --packs owner
    installed: owner-protocol -> .claude/skills, .agents/skills
    $ ../../bin/gotechy task new "README에 설치 방법 한 줄 추가" --tier T0 --verify "grep -q 설치 README.md"
    $ ../../bin/gotechy run T-001 --adapter fake      (CI용 재현)
    $ ../../bin/gotechy run T-001 --adapter native    (증거 1회)
    $ ../../bin/gotechy handoff lint orchestration/handoffs/T-001.md
    ok

테스트: `bin/gotechy test` → `uv run --with pytest --with coverage` (PEP 723 고정), `package.json`의 `npm test`는 이 명령을 호출하도록 바꾼다.

## Validation and Acceptance

- [ ] 1. `HOME`·`PATH`를 격리한 셸(또는 새 macOS 사용자 계정)에서 `bin/gotechy setup --profile home` 후 `bin/gotechy doctor`가 exit 0.
- [ ] 2. `setup --dry-run`은 아무것도 바꾸지 않고, 실제 `setup`은 전역 설정을 백업한 뒤 수정하며 `setup --restore`로 원상복구된다.
- [ ] 3. doctor에 버전 불일치를 주입하면 exit 1과 교정 명령을 출력한다.
- [ ] 4. `init` 후 `.claude/skills/owner-protocol/SKILL.md`와 `.agents/skills/owner-protocol/SKILL.md`가 모두 있고 `apm audit --ci` 통과.
- [ ] 5. T-001이 fake 어댑터로 CI에서 재현되고, native(claude)로 1회 실행되어 lint 통과 HANDOFF가 생긴다.
- [ ] 6. 규칙 위반 샘플(요약 초과·막는 결정 4개·리스크 초과·증거 형식·사실 표시 누락·강조 위반·결정 표지 누락)이 각각 교정 메시지와 함께 lint 실패하고, 통과 샘플은 통과한다.
- [ ] 7. `gotechy inbox`가 결정 필요 → 실패 → 완료 순으로 출력하고, 빈 인박스면 "대기 중인 일 없음"을 출력한다.
- [ ] 8. `<script>`·`onerror=`·`</SCRIPT>`가 든 HANDOFF를 렌더하면 실행되지 않는 텍스트로 표시된다(정적 검사 + 헤드리스 브라우저 확인).
- [ ] 9. `decide`로 만든 결정은 `gate verify` 통과, 손으로 고친 결정(서명 불일치)과 낡은 판본 결정은 거부된다.
- [ ] 10. `ownership`에 `orchestration/gates/`가 든 작업 명세는 lint 실패한다.
- [ ] 11. `irreversible: true` 작업의 결정은 설명 문항 답 없이 기록되지 않고, 답은 `orchestration/private/`에만 저장된다.
- [ ] 12. gitleaks 커밋 hook이 샘플 토큰이 든 파일의 커밋을 막는다.
- [ ] 13. `bin/gotechy test` 전체 통과, 커버리지 리포트 출력.

## Idempotence and Recovery

- `setup`·`doctor`·`init`은 다시 돌려도 결과가 같다(이미 맞으면 건너뜀). `setup`이 끊기면 다시 실행한다. 전역 설정은 `setup --restore <시각>`으로 되돌린다.
- 작업은 파일이 원천이라 세션이 죽어도 `orchestration/`에서 상태를 복원한다. `run T-###`는 마지막 HANDOFF 판본부터 이어 간다.
- 서명 키를 잃으면 `gotechy keys rotate` 후 대기 중 게이트를 다시 결정한다(기존 서명은 무효).

## Artifacts and Notes

(구현하며 채운다: 파일·스크린샷·측정치·HANDOFF 예시. 2차 사용자(채용 담당자)용 데모: 설치부터 서명된 결정까지 3분 녹화 1건)

## Interfaces and Dependencies

- CLI: `gotechy {setup [--dry-run|--restore]|doctor|init|task new|run|handoff lint|inbox|render|decide|gate verify|keys rotate|test}` — 종료코드 0 성공, 1 검사 실패, 2 환경 문제.
- 작업 명세 frontmatter: `id, title, packs[], tier, agent?, model?, effort?, deps[], ownership[], data_class(public|internal|confidential), autonomy(L0~L3), verify, irreversible, gate(none|before|after)` + 본문 Target/Change/Constraints/Ownership/Observable acceptance.
- HANDOFF frontmatter: `task, rev, status(done|failed|needs-decision), packs[], skills_loaded[], agent, model, effort, tokens, cost_usd, evidence[], new_terms[]`.
- 게이트 frontmatter: `id, task, class(blocking|default), status(pending|resolved), options[], resolution, instruction, handoff_rev, opened_at, decided_at, active_seconds, sig`.
- 외부 의존(M0에서 확인): mise, apm(0.x 고정), uv, Claude Code, Codex, gitleaks. 환경 변수: `GOTECHY_HOME`(기본 `~/.gotechy`).

## career_signals

```yaml
career_signals:
  hypothesis:
    capabilities:
      - 도구 독립 파일 계약 기반 에이전트 작업 위임 설계·구현
      - 사람의 이해·결정을 서명된 게이트로 강제하는 Human-in-the-loop 설계
      - 버전 고정·격리 검증 기반 재현 가능한 에이전트 환경
    jd_keywords_matched: [AI 에이전트, Claude Code skill, Human-in-the-loop, 에이전트 하네스, 자동화 파이프라인, 컨텍스트 엔지니어링]
  evidence:
    links: []
    metrics: []
    story: ""
```
