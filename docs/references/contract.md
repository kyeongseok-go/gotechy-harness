# 파일 계약 (task · HANDOFF · gate) — v1

> 하네스 v2의 진실의 원천. 리드·워커·CLI·(1b) 결정 서버·mod가 모두 이 문서를 따른다. 코드의 스키마는 `src/core/schema.ts`이며 이 문서와 어긋나면 이 문서를 먼저 고치고 코드를 맞춘다.

## 0. 원칙

- 실행 도구(Claude Code·Codex·Orca)는 **실행만** 맡는다. 결정과 결과는 프로젝트 저장소의 `orchestration/` 파일이 원천이다.
- 워커는 **별도 git worktree**(브랜치 `gotechy/<task-id>`, 위치 `<프로젝트>/.gotechy/worktrees/<task-id>`)에서 일한다. 리드는 메인 체크아웃의 파일만 신뢰한다.
- 워커가 바꿀 수 있는 파일은 작업의 `ownership` + 자기 HANDOFF 파일뿐이다. 그 밖의 변경이 하나라도 있으면 실행은 `failed`.
- 워커의 주장(HANDOFF 본문)과 리드의 측정(`verified`, 토큰·비용)은 분리해서 기록한다.

## 1. 파일 배치

    orchestration/
      tasks/T-001.md          작업 명세 (리드가 작성)
      handoffs/T-001.md       결과 보고 (워커가 작성, 리드가 측정값을 덧붙여 메인에 반영)
      gates/G-001.md          결정 (gotechy decide만 작성 — M2)
      private/                이벤트 로그·이해 게이트 답 (.gitignore, 공개 금지)
        events.jsonl
      .seq                    번호 발급 상태 (잠금 파일 .seq.lock로 원자적 갱신)

## 2. 작업 명세 `tasks/T-###.md`

frontmatter (YAML):

| 키 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | `T-` + 3자리 이상 숫자 | ✓ | 파일명과 같아야 한다 |
| `title` | 문자열 1~80자 | ✓ | |
| `status` | `draft`·`ready`·`running`·`done`·`failed`·`needs-decision` | ✓ | 상태 전이는 3절 |
| `packs` | 문자열 목록 | ✓ | 워커에게 줄 팩 |
| `tier` | `T0`~`T3` | ✓ | 라우팅 등급 (1b에서 모델 매핑) |
| `agent` | `claude`·`codex`·`fake` | | 없으면 `--adapter` 옵션 |
| `model`, `effort` | 문자열 | | 없으면 도구 기본값 |
| `deps` | 작업 id 목록 | ✓ | 모두 `done`이어야 시작 |
| `ownership` | 상대 경로 목록 (파일 또는 `/`로 끝나는 폴더) | ✓ | 워커가 바꿀 수 있는 범위. 보호 경로(5절)·`..`·절대 경로·글롭 금지 |
| `data_class` | `public`·`internal`·`confidential` | ✓ | 1a는 `public`만 실행 |
| `autonomy` | `L0`~`L3` | ✓ | 무인 실행 등급 (1b) |
| `verify` | 셸 명령 문자열 | ✓ | 리드가 워커 worktree에서 실행, exit 0이면 통과 |
| `irreversible` | 불리언 | ✓ | 보호 경로 규칙(5절)에 걸리면 명세 값과 무관하게 참으로 본다 |
| `gate` | `none`·`before`·`after` | ✓ | `before`: 게이트 해소 전 실행 불가, `after`: HANDOFF 후 게이트 생성 (M2) |
| `budget_usd` | 숫자 | | 워커 비용 상한 (기본 1.0) |
| `timeout_min` | 정수 | | 워커 시간 상한 (기본 20) |

본문 절 (Orca task-spec 5요소): `## Target` · `## Change` · `## Constraints` · `## Ownership` · `## Observable acceptance`.

## 3. 상태 전이

    task:  draft → ready → running → done | failed | needs-decision
           needs-decision → ready (결정 해소 후)
           failed → ready (리드가 원인 수정 후 재시도)
    gate:  pending → resolved | rejected

- `run`은 `ready`이고 `deps`가 모두 `done`인 작업만 시작한다.
- 같은 작업을 다시 `run`하면 기존 worktree와 마지막 HANDOFF 판본(`rev`)에서 이어 간다.

## 4. HANDOFF `handoffs/T-###.md`

frontmatter:

| 키 | 작성자 | 설명 |
|---|---|---|
| `task` | 워커 | 작업 id |
| `rev` | 리드 | 판본 번호, 반영할 때마다 +1 |
| `status` | 워커 → 리드가 확정 | `done`·`failed`·`needs-decision`. 리드의 `verify`가 실패하면 `failed`로 덮어쓴다 |
| `packs`, `skills_loaded` | 워커 | 받은 팩, 실제로 연 스킬 |
| `new_terms` | 워커 | 이번 HANDOFF에서 새로 쓴 용어 |
| `agent`, `model`, `effort` | 리드 | 실제 실행 값 |
| `usage` | 리드 | `{input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost_usd}` |
| `verified` | 리드 | `{command, exit_code, at}` |
| `changed_files` | 리드 | 워커가 바꾼 파일 목록 |

본문 절 (이 순서, 제목 그대로):

    ## 결정 필요
    ## 한 줄 요약
    ## 한 일
    ## 증거
    ## 건너뛴 것 · 확인 못 한 것 · 리스크
    ## 새 용어
    ## 말해 보기
    ## 다음 단계

M2에서 추가되는 규칙(길이·결정 표지·사실 표시·강조)은 `handoff lint` 문서(`gotechy handoff lint --rules`)가 원천이다.

## 5. 보호 경로

워커가 바꾸면 실행이 `failed`가 되고, 작업 `ownership`에 넣으면 `task lint`가 거부하는 경로:

    orchestration/gates/   orchestration/tasks/   orchestration/private/   orchestration/.seq
    .gotechy/              .git/                  .claude/               .agents/
    AGENTS.md              CLAUDE.md              apm.yml   apm.lock.yaml
    mise.toml              mise.lock              policy/

`irreversible`을 자동으로 참으로 만드는 경로(되돌리기 어려운 결정 — 이해 게이트 대상, M2): 파일명에 `schema`·`migration`·`auth`·`security`·`deploy`·`.github/workflows/`가 들어간 경로.

## 6. 게이트 `gates/G-###.md` (M2)

M2에서 확정한다: `id, task, class, status, options[], resolution, instruction, task_spec_sha256, handoff_sha256, key_id, nonce, opened_at, decided_at, active_seconds, sig`.
