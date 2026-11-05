---
title: Gotechy Harness 최신화 조사 (2026-11 기준)
date: 2026-11-05
type: research
scope: 2026-07 ~ 2026-11 변화, 하네스 v2 2단계 근거 자료
status: 조사 완료(읽기 전용, 저장소 변경 없음)
---

# Gotechy Harness 최신화 조사 (2026-11-05)

표기 규칙: 출처 URL과 날짜를 붙인 문장은 그 출처를 직접 열어 확인한 사실이다. "추정:"으로 시작하는 문장은 확인하지 못한 판단이다. GitHub 릴리스 날짜는 `gh api repos/<repo>/releases`로 2026-11-05에 직접 읽었다.

## 하네스에 가장 큰 영향을 줄 변화 Top 10

| # | 변화 | 출처 URL | 발표일 | 하네스의 어디에 어떻게 적용 | 노력 | 비용 | 위험 |
|---|---|---|---|---|---|---|---|
| 1 | Claude Code command, HTTP hook에 `onFailure: "block"`: hook이 시작 못 하거나 시간 초과, 예상 밖 종료 코드면 막는다. 이미 고정 버전(2.1.296) 직전인 2.1.295에 들어 있다 | https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md (2.1.295 항목) | 2.1.295 (2.1.296 이전, 정확한 날짜는 확인 못 함) | TD-026(가드 hook이 시간 초과 때 통과됨)을 바로 갚는다. `gotechy init`이 까는 `settings.local.json`의 `gotechy guard` hook에 `onFailure: "block"`을 넣고, 시간 초과 시험을 e2e로 추가 | S | 무료 | 낮음. 가드가 느리면 정상 명령도 막혀 체감 지연이 생긴다 |
| 2 | Codex `features.rollout_budget`(가중 토큰 상한, `limit_tokens`, `enforce_limit` 기본 true, 남은 토큰 알림)와 `goals.max_goal_token_budget` | https://github.com/openai/codex/pull/57187 , https://learn.chatgpt.com/docs/config-file/config-reference.md | PR 병합 2026-10-26, 기본 기능은 2026-08부터(PR #36641) | TD-015(Codex 워커와 감사관에 비용 상한 없음). 달러 상한 대신 `-c features.rollout_budget.enabled=true -c features.rollout_budget.limit_tokens=N`으로 토큰 상한을 걸고, 하네스는 `--json`의 `turn.completed.usage`로 달러를 환산해 기록 | S~M | 무료(실험은 유료) | 중간. 문서에 "under development, off by default"로 적혀 있어 키 이름이 바뀔 수 있다. 상한이 달러가 아니라 토큰이다 |
| 3 | Anthropic `sandbox-runtime`(srt) v0.0.81: 임의 프로세스를 macOS sandbox-exec, Linux bubblewrap+seccomp로 감싸는 CLI와 라이브러리. 같은 JSON 설정으로 두 OS | https://github.com/anthropic-experimental/sandbox-runtime | v0.0.81 2026-10-20 | TD-009(verify 샌드박스가 macOS 전용). `src/runtime/sandbox.ts`의 리눅스 갈래를 srt로(또는 직접 bwrap). TD-025(홈 금지 목록)는 srt 문서의 `denyRead: ["/Users"]` + `allowRead: ["."]` 방식(기본 차단, 작업 폴더만 허용)으로 바꿀 근거 | M | 무료 | 중간. 스스로 "beta research preview"라 설정 형식이 바뀔 수 있다. Ubuntu 24.04+는 AppArmor 사용자 네임스페이스 제한을 풀어야 한다 |
| 4 | Codex workspace-write 샌드박스가 `.git`이 포인터 파일(`gitdir: ...`)이어도 그 파일과 가리키는 git 폴더를 읽기 전용으로 보호. 권한 프로필로 경로별 `"deny"`(읽기 금지)와 `:minimal` 같은 특수 토큰 | https://learn.chatgpt.com/docs/agent-approvals-security.md , config-reference.md | 문서 확인 2026-11-05(문서에 날짜 없음) | TD-030(codex 워커가 worktree `.git` 파일을 바꿔치기). 유료 실험 전에 문서상 보호가 있다는 근거. TD-024(codex 감사관의 홈 읽기)는 `[permissions.auditor]` 프로필에 홈 `"deny"`로 줄인다 | S~M | 실험 유료 | 중간. 보호가 0.162.1에도 있었는지는 확인 못 함. setsid로 남은 자손은 여전히 샌드박스 밖 리드 git과 경합 |
| 5 | Claude Code 2.1.297~2.1.318의 권한, 샌드박스 강화: `permissions.blockWritesOutsideWorkingDirectories`(2.1.314), 샌드박스 셸 시작 파일이 샌드박스 밖에서 돌던 문제 수정(2.1.309), symlink 경유 denyWrite 우회 수정(2.1.309), `--mcp-config` 파일 변조 차단(2.1.309), `-p --resume` worktree에 샌드박스 미적용 수정(2.1.314), 플러그인 hook 실패 시 차단(2.1.299) | https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md | 2.1.299~2.1.318 (2.1.318은 2026-11-04) | `mise.toml`, `train.yaml`의 claude-code를 2.1.318로. claude 워커와 감사관 설정에 `blockWritesOutsideWorkingDirectories`와 `blockReadsOutsideWorkingDirectories`를 함께 | S | 무료 | 낮음. 2.1.296의 회귀 두 건이 2.1.299에서 고쳐졌다(아래 상세) |
| 6 | `claude plugin eval` 성숙: `--max-cost-usd`(넘으면 종료 코드 2와 `partial: true`), `--ablation with-without`(스킬 있음과 없음 차이 Δ), `--judge-model`, `--runs`, `--threshold`, `--disallow-tools`와 `disallowed_tools`(2.1.299), API 오류로 끝난 실행은 0점과 종료 1(2.1.299) | https://code.claude.com/docs/en/plugin-evals.md , CHANGELOG 2.1.299 | 문서 확인 2026-11-05, 2.1.299 | 2단계 P3(팩 기여도 실측). `evals/` 케이스를 `--ablation with-without --max-cost-usd <오너 승인액> --json`으로. judge 모델과 대상 모델을 고정해 추세 비교 | M | 유료 | 중간. 하네스 루트에 플러그인 매니페스트가 없어 Δ가 안 나올 수 있다(아래 4.2 추정) |
| 7 | Betterleaks v1.10.0: gitleaks 원작자가 만든 호환 스캐너. 로컬 git 스캔이 저장소 git 설정을 기본 격리, `.gitleaks.toml`과 `.betterleaks.toml` 자동 로드는 `--unsafe-auto-load-config`가 있어야 함, 체크섬에 sigstore 번들. gitleaks는 8.30.1(2026-03-21) 이후 릴리스 없음 | https://github.com/betterleaks/betterleaks/releases/tag/v1.10.0 | 2026-11-04 | accept 전 비밀 값 검사(contract 9.4, TD-012)와 TD-031. 하네스가 실험으로 찾은 "대상 폴더의 `.gitleaks.toml`이 검사를 끈다" 문제를 도구가 기본값으로 막는다. aqua 레지스트리에 `betterleaks` 있음 | M | 무료 | 중간. 2026-03 출시한 새 프로젝트, v2는 아직 rc. 규칙 차이로 오탐과 미탐이 바뀐다 |
| 8 | apm v0.34.0, v0.35.0: `--frozen`이 고정한 lockfile을 다시 쓰던 버그 수정, frozen 모드에서 로컬 내용 검증, 명시한 `--policy`를 못 읽으면 audit이 fail-closed, SkillSpector `--baseline` 연동 | https://github.com/microsoft/apm/releases | 0.34.0 2026-10-19, 0.35.0 2026-10-22 | `gotechy init`의 apm 설치와 `doctor`의 `apm audit --ci`(TD-011). 0.35.0으로 올리고 frozen 설치 회귀 시험 | S | 무료 | 낮음~중간. 0.35는 수정이 많아 init 리허설 다시 필요 |
| 9 | Bun 1.4.3 `bun check`(typescript-go 포팅 내장 타입 검사, `bun test --check`)와 Bun 1.4.4(`minimumReleaseAge`에 "3d" 단위, TS 7.1 기준, 보안 수정), TypeScript 7.1.0-beta(새 프로그래밍 API 예정) | https://bun.com/blog/bun-v1.4.3 , https://bun.com/blog/bun-v1.4.4 , npm `typescript` | 1.4.3 2026-10-10, 1.4.4 2026-10-22, TS 7.1 beta 2026-10-20 | `package.json`의 `typecheck`(`tsc --noEmit`)를 `bun check`로 바꿀 후보. 의존성 설치에 `minimumReleaseAge = "3d"` | S | 무료 | 중간. `package.json`에 이미 `check` 스크립트가 있어 `bun check`가 타입 검사 대신 그 스크립트를 실행한다(Bun 문서의 함정) |
| 10 | Agent Skills 표준이 AAIF(Linux Foundation)로 이관. 버전 붙은 릴리스, 정식 제안 절차, 스킬 작성과 설치 보안 지침이 예정. 명세 필드는 그대로(`name`, `description` 필수, `allowed-tools`는 실험) | https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation , https://agentskills.io/specification | 2026-10-22 (저장소 거버넌스 커밋 2026-11-04) | `radar/sources/`에 agentskills 저장소 릴리스를 감시 대상으로, CI에 `skills-ref validate skills/*`. 보안 지침이 나오면 `gotechy-security` bar.md에 반영 | S | 무료 | 낮음 |

번외로 크게 볼 것: MCP 명세 2026-07-28 정식판(세션 제거, 무상태, Roots, Sampling, Logging 폐기 예정). 하네스 코드가 MCP 서버를 직접 만들지 않아 Top 10에서는 뺐지만 `gotechy-security`, `gotechy-build` 팩의 references는 갱신 대상이다(5.3절).

## 고정 버전의 현재 최신 버전

| 도구 | 고정 버전 | 최신 안정판 (발행일) | 확인 방법 | 비고 |
|---|---|---|---|---|
| claude-code | 2.1.296 | **2.1.318** (2026-11-04) | `gh api repos/anthropics/claude-code/releases` | 2.1.297, 2.1.298은 CHANGELOG에 없음. Agent SDK(TS)도 0.3.318 (2026-11-04) |
| codex | 0.162.1 (2026-10-09) | **0.166.0** (2026-10-29, `rust-v0.166.0`) | 같은 방법, prerelease 제외 | 0.167, 0.168은 alpha만 (2026-11-05 기준) |
| apm | 0.33.0 (2026-10-02) | **0.35.0** (2026-10-22) | 같은 방법 | 0.34.0은 2026-10-19 |
| bun | 1.4.3 (2026-10-10) | **1.4.4** (2026-10-22) | 같은 방법 | |
| gitleaks | 8.30.1 (2026-03-21) | **8.30.1** (최신 그대로) | 같은 방법 | 마지막 커밋 2026-10-23(dependabot). 대체 후보 betterleaks 1.10.0 |
| (참고) typescript | 7.0.2 | 7.0.2 (`latest`), 7.1.0-beta (2026-10-20) | `npm view typescript` | typescript-go 저장소의 마지막 릴리스도 7.0.2 (2026-07-08) |
| (참고) node | 24.21.0 | 24.22.2 LTS (2026-10-28) | `gh api repos/nodejs/node/releases` | **24.22.1(2026-10-21)은 보안 릴리스**(CVE 8건, permission 모델 realpathSync 포함) |
| (참고) uv | 0.13.0 | 0.13.7 (2026-11-03) | 같은 방법 | |
| (참고) gh | 2.102.0 | 2.103.3 (2026-10-26) | 같은 방법 | |
| (참고) MCP 명세 | - | 2026-07-28 정식 (2026-07-28) | `gh api repos/modelcontextprotocol/modelcontextprotocol/releases` | 이전 판 2025-11-25 |
| (참고) sandbox-runtime | 미사용 | 0.0.81 (2026-10-20) | 같은 방법 | |

---

## 1. Claude Code (2.1.296 이후)

원천: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md (raw 파일을 2026-11-05에 내려받아 2.1.299~2.1.318 구간 약 1,190줄을 읽음). 릴리스 날짜는 GitHub 릴리스에서: 2.1.311 2026-10-26, 2.1.312 2026-10-27, 2.1.314 2026-10-30, 2.1.316 2026-10-31, 2.1.317 2026-11-03, 2.1.318 2026-11-04. 2.1.299~2.1.310의 개별 날짜는 이번에 따로 읽지 않았다.

### 1.1 hooks
- 2.1.295: command와 HTTP hook에 `onFailure: "block"`. 시작 실패, 시간 초과, 예상 밖 종료 코드면 막는다. 하네스의 고정 버전 2.1.296에 이미 들어 있으므로 TD-026은 업그레이드 없이 갚을 수 있다.
- 2.1.317: Agent SDK hook 콜백에도 `onFailure: "block"`.
- 2.1.299: "플러그인 hook이 넘겨받거나 답을 돌려주지 못하면 통과가 아니라 거부", Windows에서 shell 미지정 PreToolUse가 Git for Windows 없을 때 fail-open 하던 문제 수정, plan mode가 PreToolUse hook이 허용한 쓰기를 실행하던 문제 수정, `UserPromptSubmit` hook이 스킬과 슬래시 명령 확장보다 먼저 실행되도록 변경.
- 2.1.312: prompt와 agent hook은 세션당 동시 24개(대기 초과분 12개)로 제한, 1초 미만 timeout은 1초로.
- 2.1.314: PreCompact hook 출력은 10,000자에서 자름. Monitor 도구의 셸 명령에도 Bash hook이 걸림(막기와 묻기만, 승인과 다시 쓰기는 불가).
- 2.1.304: 한 출처(저장소, 사용자 폴더, 플러그인)의 스킬이 등록할 수 있는 hook은 세션당 1,024개.
- 적용: 하네스 가드 hook(TD-008, TD-026)에 `onFailure: "block"`을 넣고 "시간 초과면 막힘"을 e2e로 증명. 추정: 감싸개 안의 감시 타이머(TD-026의 원래 계획)는 필요 없어진다.

### 1.2 권한과 샌드박스
- 2.1.314: `permissions.blockWritesOutsideWorkingDirectories`. Write, Edit, NotebookEdit가 모든 권한 모드에서 작업 폴더 밖 경로를 거부. 짝인 `blockReadsOutsideWorkingDirectories`는 그 전부터 있었다(CHANGELOG 3814행 부근).
- 2.1.309: 샌드박스 Bash가 매 명령 전 셸 시작 파일을 샌드박스 밖에서 실행하던 문제, macOS `denyWrite` glob이 symlink를 거친 실제 위치에 적용 안 되던 문제, 샌드박스 명령이 `--mcp-config` 파일을 바꿀 수 있던 문제, `Edit(path)` deny가 subshell 섞인 리다이렉트를 못 막던 문제, worktree 격리 세션이 일부 locale 접두와 zsh 산술 명령을 통과시키던 문제를 고침. Linux에서 세션보다 오래 산 백그라운드 명령 때문에 쓰기 금지가 풀리던 문제도 고침.
- 2.1.299: 샌드박스 셸이 `--plugin-dir` 폴더에 쓸 수 있던 문제(그 코드는 샌드박스 밖에서 다시 로드됨), macOS에서 symlink 경유 denied 경로 읽기와 쓰기 문제를 고침.
- 2.1.314: `claude -p --resume`/`--continue`로 들어간 worktree에 샌드박스 보호가 적용 안 되던 문제를 고침. 하네스의 "다시 쓰기"(TD-016)가 같은 worktree를 이어 쓴다면 관련 있음.
- 2.1.305: Linux `sandbox.allowNestedUserNamespaces`(켜면 파일 보호를 우회할 수 있다고 명시).
- 2.1.310: Linux `/sandbox`가 Ubuntu AppArmor 사용자 네임스페이스 제한을 진단.
- 2.1.307: OpenTelemetry `claude_code.safety_event`(권한 규칙, auto mode, hook, 샌드박스가 막거나 물은 모든 도구 호출). 2.1.301: `tool_decision`에 `classifier_verdict`, `permission_mode`.
- 적용: claude 워커와 감사관(TD-024의 claude 쪽)에 두 block 설정을 켜고, 가드 hook이 막은 기록을 OTel 이벤트로도 모아 "가드가 실제로 몇 번 막았나"를 잴 수 있다(5.6절 Marmelab 권고와 연결).

### 1.3 plugin eval, skills, subagents, headless
- `claude plugin eval`은 2.1.269에 추가(CHANGELOG). 2.1.299에서 `--disallow-tools`와 케이스 필드 `disallowed_tools`, API 오류로 끝난 실행은 0점과 종료 1.
- 2.1.304: 플러그인이 subagent를 띄워 `--max-turns`, Stop을 넘어 headless 실행을 이어가던 문제 수정. 2.1.299: mod가 `--max-budget-usd`를 넘어 실행을 잇던 문제 수정. 하네스 claude 어댑터가 `--max-budget-usd`를 쓰므로(`src/runtime/adapters/claude.ts`) 상한 신뢰도가 올라간다.
- 2.1.302: `claude -p`와 Agent SDK에서 fork subagent가 기본 켜짐(`CLAUDE_CODE_FORK_SUBAGENT=0`으로 끔). 권한 모드 미지정 `-p`는 제3자 provider나 telemetry 끔 상태에서 `default`로 시작.
- 2.1.316: `CLAUDE_CODE_SUBAGENT_EFFORT`. 2.1.318: `claude -p` JSON 결과에 `credential_expires_at`, 로그인 만료 10일 전부터 stderr 경고(무인 루프의 사전 경보로 쓸 수 있음).
- 2.1.299: 숨김 문자, 방향 바꾸는 문자, `<`, `>`가 든 스킬과 명령 이름은 로드하지 않음(TD-020과 같은 계열의 방어).
- 2.1.296 회귀 두 건이 2.1.299에서 고쳐짐: cloud와 headless 세션이 재시작 후 승인된 도구 호출을 두 번 실행할 수 있던 문제, 메시지 중단 시 Edit/Retry 실패. 추정: 하네스는 headless(`-p`)로 워커를 돌리므로 2.1.296 고정은 이 회귀에 노출돼 있다. 업그레이드 근거.

### 1.4 AGENTS.md
- Claude Code는 CLAUDE.md가 없는 프로젝트에서 AGENTS.md를 읽는다(CHANGELOG 2830행 "Added AGENTS.md support", 2.1.296 이전). 하위 폴더 AGENTS.md 첨부 수정(1685행). 하네스는 CLAUDE.md의 `@AGENTS.md` 방식이라 변경 불필요.

## 2. OpenAI Codex CLI (0.162.1 이후)

원천: `gh api repos/openai/codex/releases/tags/rust-v0.16{3,4,5,6}.0`의 본문(2026-11-05에 읽음), https://learn.chatgpt.com/docs/ (developers.openai.com/codex가 여기로 308 리다이렉트).

### 2.1 비용 상한(TD-015)
- `features.rollout_budget`: `enabled`, `limit_tokens`, `reminder_at_remaining_tokens`, `sampling_token_weight`, `prefill_token_weight`, `enforce_limit`(기본 true). 소스 `codex-rs/features/src/feature_configs.rs`, `codex-rs/core/src/rollout_budget.rs`에서 직접 확인. 소진되면 `record_usage`가 "enforced budget exhausted"를 돌려준다. 단계는 `Stage::UnderDevelopment`, 기본 off. config-reference 문서도 "under development and off by default"로 적는다.
- PR #57187(2026-10-26 병합): `enforce_limit=false`면 알림만 하는 advisory 모드.
- `goals.max_goal_token_budget`: goals 기능(문서상 stable, 기본 켜짐)의 토큰 예산 상한.
- `codex exec --json`의 `turn.completed`에 `usage`(input, cached_input, output, reasoning_output 토큰). https://learn.chatgpt.com/docs/non-interactive-mode.md
- 적용: TD-015 갚는 길이 둘. (a) 하네스가 `-c features.rollout_budget.enabled=true -c features.rollout_budget.limit_tokens=<달러를 토큰으로 환산>`을 넘긴다. (b) 기존 계획대로 `--json` 이벤트를 더해 상한에서 프로세스 그룹을 끝낸다. 추정: (a)는 Codex가 스스로 멈추므로 더 정확하지만 개발 중 기능이라 키가 바뀔 수 있어, (b)를 바닥 방어로 두고 (a)를 덧대는 이중 구성이 맞다. 0.162.1에 이 기능이 있었는지는 확인 못 함(기본 PR #36641이 2026-08-03 병합이라 있었을 가능성 높음, 추정).

### 2.2 샌드박스와 보안
- 0.163.0(2026-10-15): Linux 샌드박스가 bubblewrap(파일)과 seccomp(시스템 호출)를 쓴다고 문서 정리. macOS와 Linux에 샌드박스 무결성 검사 백엔드(#51840, #51841, #51843: 명령과 파일 작업 전에 검사). 네트워크 프록시가 DNS 조회 전에 권한 검사, 중복 Host 헤더 거부. 패치된 zsh 번들 제거.
- 0.164.0(2026-10-23): macOS 대소문자 변형 메타데이터 경로, 실행 파일 위치 찾기에 쓰이는 바꿔칠 수 있는 symlink 검사 강화(#54273, #55384). 플러그인 hook 승인을 플러그인 내용에 묶음(#54619). 원격 명령 자격 증명 가리기. `/permissions`로 권한 프로필 인라인 선택.
- 0.165.0(2026-10-27): marketplace URL 검증 구멍(허용 패턴과 다른 호스트로 git이 접속) 수정.
- 0.166.0(2026-10-29): PreToolUse hook에 로컬 명령 cwd 보고(#57198), 안전 차단 설명 개선, `codex doctor --network-only`.
- 보호 경로(문서, 날짜 없음): workspace-write에서도 `<root>/.git`(디렉터리든 파일이든), `.git` 포인터 파일이 가리키는 실제 git 폴더, `.agents`, `.codex`, `.aws`는 재귀적으로 읽기 전용. https://learn.chatgpt.com/docs/agent-approvals-security.md
- 권한 프로필: `[permissions.<name>]`, `extends = ":workspace"`, `filesystem.<path-or-glob> = "read" | "write" | "deny"`, `":workspace_roots"` 아래 `"**/*.env" = "deny"`, 네트워크는 `features.network_proxy = true`와 도메인 허용 목록. 관리자용 `permissions.filesystem.deny_read`.
- `codex sandbox macos|linux|windows [--permissions-profile <name>] [COMMAND]`로 샌드박스만 따로 실행 가능(별칭 `codex sandbox seatbelt`, `codex sandbox landlock`). 추정: 이것으로 TD-024, TD-030 실험을 모델 호출 없이(무료) 미리 할 수 있다. 감사관 셸이 읽을 수 있는 범위를 `codex sandbox macos --permissions-profile auditor cat ~/.ssh/...`로 재 보면 된다.
- 적용: TD-030 "codex 샌드박스가 worktree `.git` 파일 쓰기를 허용하는지"는 문서상 "허용하지 않음". 유료 실험 대신 `codex sandbox`로 무료 확인 후 TD-030을 닫을 수 있다(추정). TD-024는 감사관용 권한 프로필에서 홈을 `"deny"`.

### 2.3 hooks, exec
- hooks: 기본 켜짐(`[features] hooks = false`로 끔, `codex_hooks`는 폐기된 별칭). 이벤트는 SessionStart, SessionEnd, SubagentStart, SubagentStop, PreToolUse, PermissionRequest, PostToolUse, PreModelRequest, PostModelRequest, PreCompact, PostCompact, UserPromptSubmit, Stop, Interrupt. 종료 코드 2로 막음. 비관리 hook은 `/hooks`로 검토해야 실행되고 신뢰가 hook 해시에 묶임. `requirements.toml`의 `allow_managed_hooks_only`. https://learn.chatgpt.com/docs/hooks (2026-11-05 확인)
- exec: `codex exec -`는 표준 입력을 프롬프트로 읽는다. `--ignore-user-config`, `--ignore-rules`, `--ephemeral`, `--output-schema`. 적용: TD-028(감사관 프롬프트를 명령줄 인자로 넘김)의 "codex 표준 입력 처리 실험"은 문서로 답이 있다. `--ignore-user-config`는 오너 개인 설정이 워커에 새는 것을 막는다.
- 주의: 0.165.0에서 memory v2가 새 프로필에 기본 켜짐, 외부 에이전트 메모리 가져오기 지원. 추정: 무인 워커는 이전 실행의 기억이 다음 작업에 섞일 수 있으므로 `--ephemeral`과 메모리 끔을 명시하는 편이 재현성에 좋다.

## 3. 표준: AGENTS.md, Agent Skills, MCP, apm

### 3.1 Agent Skills
- 2026-10-22 Anthropic이 Agent Skills 이름, 로고, GitHub 조직, agentskills.io 도메인을 AAIF에 기증. Lead Maintainer는 David Soria Parra, Mahesh Murag. 향후: 버전 붙은 릴리스, 정식 제안 절차, 스킬 작성자와 설치자를 위한 보안 지침. https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation
- agentskills/agentskills 저장소: 2026-11-04 "AAIF Donation: Add governance and maintainers"(#648) 커밋.
- 명세 필드는 변함없음: `name`(64자, 소문자와 하이픈, 폴더 이름과 같아야 함), `description`(1024자), 선택 `license`, `compatibility`(500자), `metadata`(문자열 맵), `allowed-tools`(실험). SKILL.md 500줄 이하, 본문 5000토큰 이하 권장, 참조는 한 단계 깊이. 검증기 `skills-ref validate`. https://agentskills.io/specification (날짜 표기 없음)
- 2026-08-04 저장소 커밋 "Clarify `metadata` in the frontmatter overview".
- 적용: `gotechy` 팩 15개를 CI에서 `skills-ref validate`로. 하네스의 `references/bar.md`는 "한 단계 깊이" 규칙에 맞는다.

### 3.2 AGENTS.md
- agentsmd/agents.md 저장소: 2026-09-10 Technical Charter 추가가 마지막 의미 있는 변경. 명세 개정이나 릴리스는 확인하지 못함.
- Marmelab 조사(2026-09-24, 246개 저장소): AGENTS.md가 CLAUDE.md보다 많이 쓰이고(189 대 155), 루트 파일 중앙값 123줄. ETH Zurich(arXiv 2602.11988, 2026-02): 기계 생성 컨텍스트 파일은 성공률을 낮추고 추론 비용 20% 이상 증가, 사람이 쓴 파일은 약 4% 개선. https://marmelab.com/blog/2026/09/24/the-state-of-ai-harness-engineering-2026.html
- 적용: 하네스의 "지도는 짧게, 120줄 이하"는 근거와 맞다. `gotechy init`이 만드는 지도를 에이전트가 자동 생성하게 두지 말 것(ETH 결과).

### 3.3 MCP 2026-07-28 정식판
- 2026-07-28 정식 발행. https://modelcontextprotocol.io/specification/2026-07-28/changelog
- 큰 변화: Streamable HTTP의 프로토콜 세션과 `Mcp-Session-Id` 제거, `initialize` 핸드셰이크 제거(요청마다 `_meta`에 버전과 능력), `server/discover` 필수, `subscriptions/listen`, `ping`과 `logging/setLevel` 제거, tasks가 공식 확장으로, Multi Round-Trip Requests(`resultType: "input_required"`), SSE 재개 제거.
- 보안 관련: 인가 응답의 `iss` 검증 필수(RFC 9207), 클라이언트 자격 증명을 발급 인가 서버에 묶음, Dynamic Client Registration 폐기 예정(Client ID Metadata Documents로), Roots, Sampling, Logging 폐기 예정, 최소 12개월 폐기 기간 정책.
- Claude Code 2.1.299: cloud 세션과 Remote Control의 MCP 커넥터가 기본으로 2026-07-28 협상(`MCP_PROTOCOL_NEGOTIATION=legacy`로 되돌림). MCP allow 규칙이 이름 접두로 다른 서버를 허용하던 문제(`mcp__a`가 `a__b`도 허용) 수정.
- 적용: 하네스 자체는 MCP 서버를 만들지 않는다(추정: `src/`에 MCP 의존성 없음, package.json 확인). `gotechy-build`, `gotechy-security` 팩의 references와 radar 출처를 2026-07-28 판으로 갱신해야 한다.

### 3.4 apm
- 0.34.0(2026-10-19): `--frozen`이 고정 lockfile을 다시 쓰던 문제 수정(#2384), 스킬 부분 집합 audit을 lock 고정 재생으로 검증(#3147), SkillSpector `--baseline` 인자 전달(#2936), 알 수 없는 apm.yml 키 경고(#3222), 사용자 호출 가능 agent 필드.
- 0.35.0(2026-10-22): frozen 모드에서 로컬 내용 검증(#3236), 명시한 `--policy`를 못 읽으면 audit fail-closed(#3230), lockfile 병합 충돌은 자동 복구 없이 진단(#3028), 스킬 공유 자산과 배포 소유권 보존(#3313).
- 출처: https://github.com/microsoft/apm/releases
- 적용: doctor의 `apm audit --ci`와 init의 설치(TD-011)를 0.35.0으로. 추정: frozen 재작성 버그는 "커밋 고정 설치"의 재현성을 깎던 것이므로 우선순위 높다.

## 4. 에이전트 eval과 회귀 측정

### 4.1 확인한 관행
- Claude Code plugin eval(https://code.claude.com/docs/en/plugin-evals.md, 2026-11-05 확인):
  - 케이스는 `prompt.md`(또는 `case.yaml` schema 1.1)와 `graders/`. 채점기 6종 중 `regex`, `tool_used` 등 결정적 채점과 `llm`(judge가 세 번 투표해 두 번 이상 PASS), `baseline`(참조 transcript보다 같거나 나은지).
  - 기본 3회 실행, 케이스 점수는 실행 평균. `--ablation with-without`로 스킬 있음과 없음 두 팔, Δ 보고. Δ는 종료 코드를 바꾸지 않는다.
  - 비용: 대략 케이스 수 x 실행 수 x 2팔 + `llm` 채점기마다 실행당 judge 세 번. `--max-cost-usd`는 목록가 추정에 대한 상한이고 이미 시작한 실행은 끝까지 가므로 상한을 넘을 수 있다. 넘으면 종료 코드 2와 `partial: true`, 그런 결과와 `skippedPaidGraders` 실행은 추세에서 빼라고 문서가 권한다.
  - CI 권장: `--trust-plugin`, `--model`과 `--judge-model` 둘 다 고정, `--json`, `--threshold`.
  - 문서 경고: "`tool_used: Skill`은 통과인데 Δ가 음수면 플러그인보다 judge를 먼저 의심하라", 작은 judge가 형식 차이로 오답 처리. agent mock 응답은 `.replay/`로 고정해 재현성 확보.
  - 격리: Bash를 허용하면 OS 샌드박스 안, 홈과 Claude 설정은 못 읽음. 단 플러그인 hook과 실제 MCP 서버는 샌드박스 밖에서 돈다. 하네스 팩에 hook이 있다면 점수를 "참고용"으로만 보라고 문서가 적는다.
- Google Developers Blog "The Anatomy of Harness Engineering"(2026-09-09): 끝단 벤치마크와 별도로 행동 eval(도구 호출, 파일 수정 같은 중간 행동을 단언)을 빠르고 결정적으로. 최근 실패 하나에서 케이스 하나, PR을 한 번의 잡음 실행으로 막지 말고 집계 통과율 추세를 본다. https://developers.googleblog.com/the-anatomy-of-harness-engineering-how-to-evaluate-iterate-and-guard-ai-coding-agents/
- Marmelab(2026-09-24): 실제 실패에서 20~50개 과제를 얼려 두고 한 번에 하네스 한 부분만 바꿔 ablation. 규칙은 "걸려야 할 때 걸리고, 안 걸려야 할 때 조용한지" 양방향 시험. 26개 eval 저장소 중 전후 비교와 재현을 공개한 곳은 1곳. 리뷰어 에이전트를 붙이면 성공률이 8점 떨어진 ablation 사례(NLAH)도 있다. 통제마다 만료 조건과 이유를 기록.
- LLM judge 보정(벤더 블로그 묶음, 날짜 혼재, 2026-08 Arthur 글이 가장 최근): 사람 라벨과 일치도로 보정, judge 버전과 프롬프트 버전, 점수 분포를 기록, 같은 계열 모델 선호 편향, 과제 성공, 정책 준수, 도구 사용, 안전을 분리된 루브릭으로. https://www.arthur.ai/column/can-you-trust-llm-as-judge-calibrating-automated-evals
- SkillsBench(2차 보도, 원 논문 미확인): 큐레이션 스킬 평균 +16.2점, 스스로 만든 스킬은 이득 없음, 스킬을 강제 로드할 때보다 에이전트가 고를 때 성과가 낮아짐(55.4% 대 51.2%, 별도 연구). https://www.oreilly.com/radar/agent-skills-work-but-the-research-shows-most-teams-are-building-them-wrong
- Anthropic engineering 목록(https://www.anthropic.com/engineering, 2026-11-05 확인): 2026-07~11 사이 글은 "Redesigning source control at Anthropic"(2026-10-13) 하나. eval 관련 주요 글은 그 전("Demystifying evals for AI agents" 2026-01-09, "Quantifying infrastructure noise in agentic coding evals" 2026-02-05).

### 4.2 하네스 적용
- P3 실측 설계: 팩 15개 케이스를 `--ablation with-without --runs 3 --model <고정> --judge-model <다른 계열 아님, 고정> --max-cost-usd <오너 승인> --json`. 결정적 채점기(`tool_used: Skill`, regex)를 기본으로 두고 `llm` 채점기는 사람 라벨 20개로 TPR, TNR을 먼저 잰다(`gotechy-ai-eval` 스킬 기준과 일치).
- 추정(중요): 하네스 저장소 루트에 `.claude-plugin/plugin.json`이 없고 케이스 `prompt.md`에 `plugins:` 필드가 없다(`evals/gotechy-ai-eval/prompt-change-delta/prompt.md` 확인). 문서는 "경로 대상에서 플러그인을 못 찾은 케이스는 한 팔만 돈다"고 적는다. 그러면 Δ가 안 나온다. P3 전에 팩을 플러그인으로 감싸거나 `plugins:`를 지정하는 첫 무료 점검(`--runs 1 --ablation none` 한 케이스)이 필요하다.
- 하네스 자기 검사(가드 hook, 경계 규칙)는 Marmelab 권고대로 "막아야 할 것"과 "막으면 안 되는 것" 양방향 시험이 있는지 점검.
- 비용 기록: plugin eval JSON의 `costUsd`, `durationSeconds`, `claudeVersion`을 radar 보고서 옆에 날짜별로 쌓으면 "모델이 바뀌어서인지 스킬이 바뀌어서인지"를 가를 수 있다.

## 5. 공급망과 보안

### 5.1 샌드박스(리눅스 TD-009, 홈 차단 TD-025)
- srt(https://github.com/anthropic-experimental/sandbox-runtime, v0.0.81 2026-10-20): `srt --settings <json> <command>`. macOS는 동적 Seatbelt 프로필로 sandbox-exec, Linux는 bubblewrap(네트워크 네임스페이스 제거, 프록시는 bind-mount한 Unix 소켓)과 seccomp(Unix 소켓 차단). 네트워크는 허용 목록만, 쓰기는 허용 목록만, 읽기는 기본 열림이지만 `denyRead: ["/Users"]` + `allowRead: ["."]`로 "기본 차단, 작업 폴더만" 가능. 필요 패키지: bubblewrap 0.4+(일부 0.5+), socat, ripgrep. Linux에서 `allowWrite`/`denyWrite`는 glob을 펼치지 않는다. Ubuntu 24.04+는 `kernel.apparmor_restrict_unprivileged_userns`를 풀거나 AppArmor 프로필 필요. Landlock은 쓰지 않는다(문서 앞 10만 자 범위에서 확인).
- Codex도 Linux에서 bwrap+seccomp(0.115부터 bwrap, 문서). 두 회사 도구가 같은 리눅스 기반으로 수렴.
- Landlock 계열(2차 자료): landrun v0.1.17(2026-07-22, 커널 5.13+ 파일, 6.7+ TCP), nono(Landlock과 Seatbelt, 2026-02 알파), Sandlock(arXiv 2605.26298). 추정: 루트 없이 되고 네임스페이스 제한에 안 걸리는 장점이 있지만 성숙도가 낮다. 개인 하네스에는 srt(bwrap) 쪽이 유지 부담이 적다.
- 적용 제안: `src/runtime/sandbox.ts`에 리눅스 갈래를 추가하되, 먼저 "bun test가 srt 안에서 도는지" 실험(TD-025와 같은 실험을 묶어서). 설정 생성은 하네스가 하고, 샌드박스 실행만 srt에 맡기면 macOS 갈래도 srt로 통일할지 비교할 수 있다. 추정: srt를 쓰면 하네스가 직접 관리하는 Seatbelt 규칙(실험으로 쌓은 "뒤 규칙이 이긴다" 등)을 잃으므로 macOS는 지금 구현 유지, 리눅스만 srt가 보수적인 선택.

### 5.2 비밀 값 검사
- gitleaks: 8.30.1(2026-03-21) 이후 릴리스 없음, 저장소는 보관 상태 아님, 마지막 커밋 2026-10-23.
- Betterleaks(https://github.com/betterleaks/betterleaks): 2026-03-15 출시(BleepingComputer 보도), gitleaks 원작자 Zach Rice가 이름과 저장소 통제를 잃었다며 새로 시작, Aikido Security 후원, MIT. gitleaks CLI와 설정 호환을 표방, CEL 규칙 검증, BPE 토큰화(자체 주장 CredData 재현율 98.6%, 미검증). v1.10.0(2026-11-04): 로컬 git 스캔이 저장소 git 설정을 기본 격리(`--trust-local-git-config`로 해제), `.betterleaks.toml`과 `.gitleaks.toml` 자동 로드는 `--unsafe-auto-load-config` 필요, bun lockfile 기본 제외, 체크섬 `checksums.txt.sigstore.json` 제공. v2.0.0-rc.7(2026-11-04)은 아직 rc. aqua 레지스트리에 `pkgs/betterleaks` 있음(mise로 고정 가능).
- 적용: 하네스가 실험으로 찾아 코드로 막은 두 위험(대상 폴더 `.gitleaks.toml`이 검사를 끔, 저장소 git 설정 실행)이 betterleaks에서는 기본값으로 막힌다. accept 검사를 betterleaks 1.10.0으로 바꾸고 기존 `tests/e2e/accept-secrets.test.ts` 6개를 그대로 통과하는지로 판정. 체크섬 sigstore 검증을 부트스트랩에 추가할 수 있다. 위험: 새 프로젝트이고 v2 전환기라 규칙 집합이 흔들릴 수 있다. 결정은 오너(도구 교체).

### 5.3 프롬프트 인젝션
- Meta "Agents Rule of Two"(2025-10-31): 한 세션에 (민감 데이터 접근, 신뢰 못 할 입력, 상태 변경 또는 외부 통신) 셋 중 둘까지만. Willison 비판과 보강. https://simonwillison.net/2025/Nov/2/new-prompt-injection-papers/
- 2026 정리글(2차): 클론한 저장소의 규칙 파일이 가장 성공률 높은 주입 경로, 런타임 거부보다 스키마 단계 도구 필터가 강함, CaMeL, FIDES, Progent 같은 대역 외 방어. 원 논문은 미확인.
- 하네스 대조: 감사관(다른 계열 모델), 보호 경로, 워커에 셸 없음(claude), 허용 범위 검사가 이미 이 방향이다. 추정: 남은 가장 큰 구멍은 "신뢰 못 할 입력을 읽은 감사관이 홈을 읽을 수 있음"(TD-024)으로, Rule of Two로 보면 감사관에서 "민감 데이터 접근"을 빼는 것(위 2.2의 권한 프로필 deny, 1.2의 blockReads)이 정답이다.

### 5.4 스킬 공급망
- NVIDIA SkillSpector(2차 보도, 2026-10-28 공개 보도 등 날짜 엇갈림): 정적 분석, taint, YARA, 선택적 LLM 평가. CSA 연구 노트(2026-06-10)는 "스킬 스캐너가 전부 우회됐다", OWASP Agentic Skills Top 10(1.0-2026, 인큐베이터)은 외부 URL에 페이로드를 둔 악성 스킬이 모든 스캐너를 통과했다고 적는다. apm 0.34가 SkillSpector `--baseline` 연동을 넣었다.
- 적용: 하네스 팩은 자체 작성이라 위험이 낮다. 외부 팩을 받기 시작하면 `apm audit` + SkillSpector를 쓰되 "스캐너 통과는 안전 보장이 아님"을 doctor 출력에 명시.

### 5.5 서명과 출처 증명
- sigstore cosign 최신 v3.1.4(2026-10-20). slsa-github-generator는 v2.1.0(2025-02-24) 이후 릴리스 없음.
- GitHub Actions 강화(2차, PR 사례 다수): 액션을 커밋 SHA로 고정, zizmor로 워크플로 정적 검사, checkout에 `persist-credentials: false`, 최상위 `permissions: contents: read`. 2026-03 aquasecurity/trivy-action 태그 강제 푸시 사고가 계기로 인용됨(원 사고 보고서는 미확인).
- 하네스 상태: `.github/workflows/ci.yml`은 이미 액션을 SHA로 고정하고 `permissions:`를 둔다(직접 확인). 추정: zizmor 한 줄 추가와 `persist-credentials: false`가 남은 저비용 항목. 팩을 "공개 저장소 커밋으로 배포"하므로 서명 커밋(SSH 서명)과 `packs.ref`의 서명 검증이 다음 단계 후보이지만 개인 하네스에는 과할 수 있다(오너 판단).

### 5.6 운영 관측
- Marmelab: 391개 저장소 중 하네스 사용 기록을 남기는 곳은 5곳. 스킬과 hook 발동 기록은 싸고 유용. 통제마다 만료 조건과 이유 기록, 모델이 좋아지면 통제를 걷어낼 것(Anthropic이 Opus 4.5에서 컨텍스트 리셋이 군더더기가 됐다고 보고한 사례 인용).
- 적용: Claude Code OTel `claude_code.safety_event`, `tool_decision`과 Codex 트레이스의 스킬 귀속(0.166, #56524)으로 "어떤 스킬이 실제로 발동했나"를 radar처럼 주간 보고. tech-debt-tracker의 각 통제에 만료 조건 칸을 두는 안.

## 6. Bun과 TypeScript

- Bun 1.4.0(2026-08-20): `bun test --parallel`(커버리지와 JUnit 병합), `--isolate`(파일마다 새 global), `--shard`, `--changed`, `{ retry }`, `{ repeats }`, `--no-orphans`(부모가 죽으면 종료하고 자식 모두 종료), Linux `Bun.spawn({ cgroup })`, `bun audit fix`, `bun pm diff`(새 install script와 `child_process`, `fs`, `net`, `vm` import 표시), `file:`/`git:` 출처는 trustedDependencies 기본 목록에서 제외. https://bun.com/blog/bun-v1.4
- Bun 1.4.3(2026-10-10, 하네스 고정 버전): `bun check` 내장 타입 검사(typescript-go 포팅, TS 7.0.2 적합성 100% 주장), `bun run`/`bun test`/`bun build`의 `--check`. 속도 주장(tsc 7.0.2 대비 3~6.4배)은 Bun 자체 벤치마크. `package.json`에 `check` 스크립트가 있으면 그 스크립트를 실행하는 함정. https://bun.com/blog/bun-v1.4.3 (검색 결과 요약으로 확인, 본문 직접 정독은 안 함)
- Bun 1.4.4(2026-10-22): `minimumReleaseAge`에 "3d" 같은 단위와 `minimumReleaseAgeExcludes`, `bun check`가 TS 7.1 기준으로 1.4~7.8배 빨라짐, `bun fmt`(Prettier 호환), TLS, WebSocket, DB 클라이언트, 패키지 관리자 보안 수정(세부 미기재), glob에서 `*(a|b)`, `{1..3}`이 extglob과 범위로 의미 변경(깨질 수 있음), 알 수 없는 install 플래그는 오류. https://bun.com/blog/bun-v1.4.4
- TypeScript 7.0(2026-07-08 발표): Go 네이티브, 전체 빌드 8~12배, 기본값 `strict: true`, `module: esnext`, `types: []`, 6.0에서 폐기된 옵션은 오류, 7.0은 프로그래밍 API 없음(7.1 예정), 6.0 API가 필요하면 `@typescript/typescript6`. 7.1.0-beta 2026-10-20(npm). https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- 적용:
  - `bun test --no-orphans`와 `--isolate`는 TD-029(남은 자손 프로세스)와 테스트 격리에 도움. 추정: `--no-orphans`는 테스트 러너 자손만 다루므로 워커의 setsid 탈출은 못 막는다.
  - `typecheck`를 `bun check`로 바꾸려면 `check` 스크립트 이름을 먼저 바꾸거나 `bun test --check`를 쓴다. 7.1 정식 전까지는 `tsc`와 결과를 나란히 비교하는 기간을 둔다.
  - `bunfig.toml`에 `minimumReleaseAge = "3d"`(새 의존성 공급망 방어). 1.4.4의 glob 의미 변경은 `src/core/paths*`의 glob 사용처를 grep으로 점검한 뒤 올린다.
  - Node 24.21.0은 2026-10-21 보안 릴리스(24.22.1) 이전 버전이다. permission 모델 `realpathSync` CVE 포함. node를 무엇에 쓰는지에 따라 24.22.2로.

## 7. 하네스 엔지니어링 일반(배경)

- OpenAI "Harness engineering: leveraging Codex in an agent-first world"(2026-02-11): 짧은 AGENTS.md 지도 + 깊은 문서, 에이전트가 앱을 직접 띄우고 로그와 지표를 읽게, 고칠 방법을 담은 맞춤 lint 오류. 2026-07~11에 OpenAI 후속 글은 찾지 못함.
- Anthropic "Redesigning source control at Anthropic"(2026-10-13): 에이전트 규모(2026-09 하루 3만 건 이상 병합)에서는 병합 큐 전역 잠금 대신 병합 후와 배포 전 자동 시험, 사람 리뷰는 줄 단위가 아니라 의도 확인, Claude의 적대적 리뷰는 유용하지만 과설계 경향이 있어 사람이 거절해야 할 때가 있다. 추정: 개인 하네스 규모에는 직접 적용할 것이 적고, "리뷰는 의도 확인"은 HANDOFF 이해 게이트 설계와 맞닿는다.
- Böckeler(Thoughtworks, 2026-04-02), Stripe(2026-05), arXiv 2606.10106(2026-06) 등은 Marmelab 목록에서 이름만 확인, 본문 미확인.

## 조사하지 못한 것

- Claude Code 2.1.299~2.1.310의 개별 릴리스 날짜(2.1.311 이후만 GitHub 릴리스 API로 확인). 2.1.295의 날짜.
- Claude Code CHANGELOG 2.1.296 이전 구간 전체(이번에는 `onFailure`, AGENTS.md, plugin eval 도입만 grep).
- Codex의 보호 경로(`.git` 포인터 파일 보호)와 `rollout_budget`이 0.162.1에 이미 있었는지. 0.163~0.166 본문의 전체 PR 목록(1,014줄 중 하이라이트와 키워드만 읽음).
- Codex permissions 전용 페이지(learn.chatgpt.com의 `/docs/codex/permissions.md` 등은 404), Codex hook 기능의 안정 단계 표기.
- srt README의 뒤쪽 7만 자(알려진 한계 전체), srt가 macOS에서 하네스의 현재 Seatbelt 규칙과 얼마나 같은지 실측.
- Bun 1.4.3, 1.4.4 블로그 전문(앞 10만 자만), Bun 1.4.4 보안 수정의 개별 CVE.
- AGENTS.md 명세 자체의 2026 개정 여부(저장소 커밋으로는 없음), AAIF가 2026-10-22에 함께 받은 다른 프로젝트 목록.
- OWASP Agentic Skills Top 10의 10개 항목 본문, SkillSpector의 정확한 공개일과 버전.
- LLM judge 보정에 대한 2026-09~11 1차 연구(벤더 블로그만 확인). SkillsBench 원 논문.
- GitHub artifact attestations와 npm trusted publishing의 2026 정책 변화(공식 문서 미확인, 2차 PR 사례만).
- claude-code, codex, apm 릴리스 파일의 서명이나 출처 증명 제공 여부.
- Python 3.14, uv 0.13.x의 하네스 영향(차선 스택이라 생략).
- 실제 실행 실험은 하나도 하지 않았다(읽기 전용 조사). 위 "적용" 항목은 전부 실험으로 확인해야 한다.
