# 파일 계약 (task, HANDOFF, gate) v1.1

> 하네스 v2의 진실의 원천. 리드, 워커, CLI, (1b) 결정 서버, mod가 모두 이 문서를 따른다. 코드의 스키마는 `src/core/schema.ts`이며 이 문서와 어긋나면 이 문서를 먼저 고치고 코드를 맞춘다.

## 0. 원칙

- 실행 도구(Claude Code, Codex, Orca)는 **실행만** 맡는다. 결정과 결과는 프로젝트 저장소의 `orchestration/` 파일이 원천이다.
- 워커는 **별도 git worktree**(브랜치 `gotechy/<task-id>`, 위치 `<프로젝트>/.gotechy/worktrees/<task-id>`)에서 일한다. 리드는 메인 체크아웃의 파일만 신뢰한다.
- 워커가 바꿀 수 있는 파일은 작업의 `ownership` + 자기 HANDOFF 파일뿐이다. 그 밖의 변경이 하나라도 있으면 실행은 `failed`.
- 워커의 주장(HANDOFF 본문)과 리드의 측정(`verified`, 토큰과 비용)은 분리해서 기록한다.

## 1. 파일 배치

```text
orchestration/
  tasks/T-001.md          작업 명세 (리드가 작성)
  handoffs/T-001.md       결과 보고 (워커가 작성, 리드가 측정값을 덧붙여 메인에 반영)
  gates/G-001.md          결정 (리드가 열고 gotechy decide만 닫음, 6절)
  private/                이벤트 로그, 결정 장부, 이해 게이트 답 (.gitignore, 공개 금지)
    events.jsonl
    decisions.jsonl       결정 장부(nonce 소비 기록, 6.3절)
    comprehension.jsonl   이해 문항의 답과 핵심어 적중(9.1절)
  terms.jsonl             프로젝트 용어 은행(9.5절)
  project.yaml            프로젝트 id, 결정 서명에 들어감(6.3절)
  .seq, .gate-seq         번호 발급 상태 (잠금 파일 .seq.lock, .gate-seq.lock로 원자적 갱신)
```

## 2. 작업 명세 `tasks/T-###.md`

frontmatter (YAML):

| 키 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | `T-` + 3자리 이상 숫자 | ✓ | 파일명과 같아야 한다 |
| `title` | 문자열 1~80자 | ✓ | |
| `status` | `draft`, `ready`, `running`, `done`, `failed`, `needs-decision` | ✓ | 상태 전이는 3절 |
| `packs` | 문자열 목록 | ✓ | 워커에게 줄 팩 |
| `tier` | `T0`~`T3` | ✓ | 라우팅 등급 (1b에서 모델 매핑) |
| `agent` | `claude`, `codex`, `fake` | | 없으면 `--adapter` 옵션 |
| `model`, `effort` | 문자열 | | 없으면 도구 기본값 |
| `deps` | 작업 id 목록 | ✓ | 모두 `done`이어야 시작 |
| `ownership` | 상대 경로 목록 (파일 또는 `/`로 끝나는 폴더) | ✓ | 워커가 바꿀 수 있는 범위. 보호 경로(5절), `..`, 절대 경로, 글롭 금지 |
| `data_class` | `public`, `internal`, `confidential` | ✓ | 1a는 `public`만 실행 |
| `autonomy` | `L0`~`L3` | ✓ | 무인 실행 등급 (1b) |
| `verify` | 셸 명령 문자열 | ✓ | 리드가 워커 worktree에서 실행, exit 0이면 통과 |
| `irreversible` | 불리언 | ✓ | 보호 경로 규칙(5절)에 걸리면 명세 값과 무관하게 참으로 본다 |
| `gate` | `none`, `before`, `after` | ✓ | `before`: 게이트 해소 전 실행 불가, `after`: HANDOFF 후 게이트 생성 (M2) |
| `budget_usd` | 숫자 | | 워커 비용 상한 (기본 1.0) |
| `timeout_min` | 정수 | | 워커 시간 상한 (기본 20) |

본문 절 (Orca task-spec 5요소): `## Target`, `## Change`, `## Constraints`, `## Ownership`, `## Observable acceptance`.

## 3. 상태 전이

```text
task:  draft → ready → running → done | failed | needs-decision
       done → accepted (gotechy accept가 메인에 병합한 뒤, M2c)
       needs-decision → ready (결정 해소 후)
       failed → ready (리드가 원인 수정 후 재시도)
gate:  pending → resolved (거절도 resolution 값의 하나다)
```

- `run`은 `ready`이고 `deps`가 모두 `accepted`인 작업만 시작한다. 선행 작업의 변경이 메인에 병합돼 있어야 뒤 작업이 그 결과 위에서 일하기 때문이다(M2c에서 `done`에서 바꿈).
- 같은 작업을 다시 `run`하면 기존 worktree와 마지막 HANDOFF 판본(`rev`)에서 이어 간다.

## 4. HANDOFF `handoffs/T-###.md`

frontmatter:

| 키 | 작성자 | 설명 |
|---|---|---|
| `task` | 워커 | 작업 id |
| `rev` | 리드 | 판본 번호, 반영할 때마다 +1 |
| `status` | 워커가 쓰고 리드가 확정 | `done`, `failed`, `needs-decision`. 리드의 `verify`가 실패하면 `failed`로 덮어쓴다 |
| `packs`, `skills_loaded` | 워커 | 받은 팩, 실제로 연 스킬 |
| `new_terms` | 워커 | 이번 HANDOFF에서 새로 쓴 용어 |
| `agent`, `model`, `effort` | 리드 | 실제 실행 값 |
| `usage` | 리드 | `{input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost_usd}` |
| `verified` | 리드 | `{command, exit_code, at}` |
| `changed_files` | 리드 | 워커가 바꾼 파일 목록 |
| `comprehension_keys` | 워커 | "말해 보기" 질문마다 좋은 답에 들어갈 핵심어 목록(목록의 목록). 이해 게이트 채점용이라 인박스와 화면에 보이지 않는다(9.1절) |

본문 절 (이 순서, 제목 그대로):

    ## 결정 필요
    ## 한 줄 요약
    ## 한 일
    ## 증거
    ## 건너뛴 것, 확인 못 한 것, 리스크
    ## 새 용어
    ## 말해 보기
    ## 다음 단계

(v1.1, 2026-10-14: 절 제목의 가운데점을 쉼표로 바꿨다. 7절 문체 규칙과 맞추기 위해서다.)

### 4.1 HANDOFF 규칙 (오류)

| 규칙 | 판정 |
|---|---|
| `handoff-summary` | "한 줄 요약"은 비어 있지 않은 한 줄, 60자 이하 |
| `handoff-decision-format` | "결정 필요"가 "없음"이 아니면, 결정마다 목록 항목 `- [막는] 질문` 또는 `- [기본값] 질문` 또는 `- [알림] 내용`. `[막는]`, `[기본값]` 결정은 하위 항목 `- 선택지: A, B`(2개 이상), `- 추천: A`(선택지 중 하나), `- 이유: …`를 가진다 |
| `handoff-blocking-limit` | `[막는]` 결정은 3개 이하. 넘으면 작업을 쪼개거나 결정 세션으로 올린다 |
| `handoff-blocking-status` | `[막는]` 결정이 있으면 `status: needs-decision` |
| `handoff-risk-limit` | "건너뛴 것, 확인 못 한 것, 리스크" 목록 항목은 3개 이하 |
| `handoff-evidence-format` | "증거" 목록 항목은 `` `명령`: 결과`` 형식 |
| `handoff-fact-tag` | "한 일"과 "건너뛴 것, 확인 못 한 것, 리스크"의 목록 항목은 `[확인]`, `[추론]`, `[추정]` 중 하나로 끝난다 |
| `handoff-emphasis` | 굵게(`**`)는 "결정 필요"와 리스크 절에서만 |
| `handoff-control-char` | HANDOFF 전체(frontmatter 포함)에 터미널 제어 문자(줄바꿈, 탭, CR 제외)나 양방향 제어 문자가 없다 |
| `handoff-style-ignore` | HANDOFF에는 문체 예외 표지(`<!-- style-ignore-start -->`, `<!-- style-ignore-end -->`)를 쓸 수 없다. 예외 구간은 규칙을 설명하는 문서용이고, HANDOFF에서 쓰면 문체 검사를 통째로 피할 수 있다 |

결정 예:

    ## 결정 필요
    - [막는] 캐시 만료를 얼마로 할까요?
      - 선택지: 5분, 1분
      - 추천: 5분
      - 이유: 조회 빈도에 비해 충분하고 부하가 적어요

## 7. 문체 규칙 (AI 티 제거)

> 모든 사람용 산출물(HANDOFF, 문서, 블로그)에 적용한다. 코드 블록, 인라인 코드, URL은 검사하지 않는다.
> 판정 패턴은 im-not-ai(epoko77-ai, MIT)의 quick-rules A~J 중 기계 판정이 가능한 것을 골랐다.
> **강도: 2026-10-20까지 경고, 2026-10-21부터 오류.** 그동안 오탐률을 보고 규칙을 조정한다.

<!-- style-ignore-start -->
| 규칙 | 판정 |
|---|---|
| `style-symbol` | 본문에 화살표(→ ← ⇒ ➡), em-dash(—), 가운데점(·) |
| `style-emoji` | 이모지 |
| `style-translationese` | "에 대해(서)", "를/을 통해·통하여", "에 있어서", "에 있어 "("~에 있어요"는 제외), "되어지/되어진", "에서의·에로의·으로의·으로부터의" |
| `style-cliche` | "시사하는 바가 크다", "주목할 만하다", "본질적으로", "핵심적으로", "인 것이다/한 것이다" 결말 |
| `style-pivot` | 결산 피벗("결론적으로, 따라서, 이를 통해, 그러므로, 요약하면, 정리하면")이 한 문서에 4회 이상 |
| `style-hype` | 과장 어휘("파격적, 압도적, 강력한, 획기적, 치명적, 혁신적")가 3회 이상 |
| `style-connective` | 문장 첫머리 접속사("또한, 따라서, 즉, 나아가, 아울러, 게다가, 더욱이")가 5회 이상 |
| `style-english-quote` | 영어 단어 6개 이상이 이어진 영어 문장 인용 |
| `style-term-unexplained` | (HANDOFF 전용) 용어 은행에 없는 영어 용어가 본문에 나왔는데 "새 용어"에 풀이가 없음. 현업 영어 용어는 그대로 쓰되 오너가 익히도록 풀이를 남긴다 |
<!-- style-ignore-end -->

용어 은행: 라이브러리 `knowledge/terms.jsonl`(공개 기술 용어) + 프로젝트 `orchestration/terms.jsonl`(누적). 한 번 풀이한 용어는 다시 요구하지 않는다.

## 5. 보호 경로

워커가 바꾸면 실행이 `failed`가 되고, 작업 `ownership`에 넣으면 `task lint`가 거부하는 경로:

    orchestration/gates/   orchestration/tasks/   orchestration/private/   orchestration/.seq
    orchestration/.gate-seq   orchestration/project.yaml
    .gotechy/              .git/                  .claude/               .agents/
    AGENTS.md              CLAUDE.md              apm.yml   apm.lock.yaml
    mise.toml              mise.lock              policy/

`irreversible`을 자동으로 참으로 만드는 경로(되돌리기 어려운 결정, 이해 게이트 대상, M2): 파일명에 `schema`, `migration`, `auth`, `security`, `deploy`, `.github/workflows/`가 들어간 경로.

## 6. 게이트 `gates/G-###.md` (M2c)

오너의 결정 하나가 게이트 파일 하나다. 리드가 열고(`pending`), 오너가 `gotechy decide`로 닫는다(`resolved`). 워커는 게이트를 읽거나 쓸 수 없다(5절 보호 경로).

### 6.1 게이트가 열리는 때

| class | 여는 때 | 선택지 |
|---|---|---|
| `approval-before` | `gate: before` 작업을 `run`하려는데 결정이 없을 때 | `진행`, `중단` |
| `decision` | HANDOFF가 `needs-decision`이면 `[막는]` 결정마다 하나 | HANDOFF의 선택지 그대로 |
| `approval-after` | `gate: after` 작업의 HANDOFF가 `done`일 때 | `승인`, `다시` |

필요한 게이트는 원천(작업 명세의 `gate`, 현재 HANDOFF의 `[막는]` 결정과 status)에서 계산한다. `run`, `accept`, `gate verify`의 강제는 이 계산을 따르고, 맞는 게이트 파일이 없으면 대기 상태로 다시 연다. 게이트 파일을 지우거나 판본을 고쳐 검사를 피할 수 없게 하기 위해서다. 같은 작업, 같은 판본, 같은 class, 같은 질문의 게이트는 두 번 열지 않는다.

번호는 `orchestration/.gate-seq`와 실제 파일 중 큰 번호 다음으로, 잠금 아래에서 발급한다. 새 게이트 파일은 같은 이름이 있으면 실패하게 만든다(덮어쓰지 않음).

### 6.2 frontmatter

| 키 | 쓰는 쪽 | 설명 |
|---|---|---|
| `id`, `task`, `class`, `question`, `options`, `recommended`, `handoff_rev`, `irreversible` | 리드 | 게이트를 열 때 쓴다. `handoff_rev`는 `approval-before`면 `null`. decide는 `irreversible`을 작업 명세와 경로 규칙으로 다시 계산해 둘 중 참을 쓴다 |
| `project_id`, `comprehension` | decide | 서명한 프로젝트 id, 이해 게이트 결과 요약(9.1절) |
| `status` | 리드, decide | `pending` 또는 `resolved` |
| `resolution`, `instruction` | decide | 고른 선택지, 다음 지시(없으면 `null`) |
| `task_spec_sha256`, `handoff_sha256` | decide | 결정 순간의 작업 명세 요약값과 HANDOFF 파일 해시 |
| `key_id`, `nonce`, `decided_at`, `sig` | decide | 서명 정보 |
| `opened_at`, `active_seconds` | decide | 측정값(서명 대상 아님). 처음 보여 준 시각, 확인 질문에 머문 초 |

`task_spec_sha256`은 작업 명세에서 `status`를 뺀 frontmatter(키 정렬 JSON)와 본문을 이어 붙여 해시한다. `run`이 상태를 바꿀 때마다 결정이 깨지지 않게 하기 위해서다.

### 6.3 서명

- 대상: 아래 키를 정렬한 JSON(공백 없음)의 HMAC-SHA256. `project_id, task_id, gate_id, class, question, options, handoff_rev, irreversible, task_spec_sha256, handoff_sha256, choice, instruction, key_id, nonce, decided_at`. 질문, 선택지, 판본, 되돌리기 어려움도 넣어서, 결정 뒤에 고치면 서명이 깨진다. `recommended`는 서명하지 않는다(결정의 뜻을 바꾸지 않는 표시값).
- `project_id`: `orchestration/project.yaml`의 `id`(UUID). `init`이 만들고, 없으면 처음 게이트를 열 때 만든다. 보호 경로다.
- 키: `$GOTECHY_HOME/keys/<key_id>.key`(기본 `~/.gotechy`), 32바이트 난수를 hex로. 폴더 0700, 파일 0600이고, 권한이 더 넓거나 키 파일이 심볼릭 링크면 서명과 검증을 거부한다. 현재 키는 `keys/active`에 적고, 그 값이 `k-YYYYMMDD-8자리hex` 형식이 아니면 쓰지 않는다.
- `gotechy keys init`: 키가 없을 때만 만든다. `gotechy keys rotate`: 새 키를 만들어 현재 키로 바꾸고 이전 키 파일을 지운다. 이전 키로 서명한 결정은 모두 다시 결정해야 한다.
- nonce: 결정마다 16바이트 난수. `orchestration/private/decisions.jsonl`에 `{gate, nonce, key_id, decided_at}`을 남긴다(소비 기록).
- 위협 모델(1a): 실수, 낡은 판본, 손으로 고친 결정 파일, 다른 프로젝트의 결정 재사용, 격리된 워커를 막는다. 오너와 같은 OS 사용자로 도는 악의적 프로세스의 자가 승인은 막지 못한다(1b에서 다룬다).
- 워커 코드 실행(verify): 워커가 쓴 테스트를 실행하므로 macOS에서는 `sandbox-exec`로 감싼다. 쓰기는 기본 거부이고 작업 폴더와 verify 전용 임시 폴더만 허용한다(작업 폴더의 `.git` 파일은 제외). 키 폴더, `orchestration/private/`, 홈의 비밀 폴더와 파일(.ssh, .aws, .gnupg, .netrc, .config/gh, .claude, .codex, .git-credentials, .npmrc, .pypirc, .config/gcloud, .kube, .docker)은 읽기도 막는다. 네트워크는 막는다. 샌드박스 밖 프로세스에 일을 시키는 경로(`osascript`, `launchctl`, `open`, `automator`, `shortcuts` 실행과 Apple Events, LaunchServices 서비스 접근)도 막는다. Secure Enclave와 인증 서비스(`com.apple.ctkd.token-client`, `com.apple.CoreAuthentication.daemon`, `com.apple.coreauthd`) 접근도 막아, 워커 코드가 오너 키로 인증 창을 띄우지 못하게 한다(1b N0 실험). 환경 변수는 허용 목록(PATH, 언어, 터미널, 사용자 이름)만 넘기고 HOME과 TMPDIR은 임시 폴더로 바꾼다. `accept`의 verify도 같다. 다른 OS에서는 막지 못하고 HANDOFF `lead_note`에 그렇게 적는다.
- git 연결과 설정 검사: 워커 실행 전에 worktree의 `.git` 파일, worktree 메타 파일(gitdir, commondir, config.worktree), 저장소 설정(`.git/config`)과 포함 파일까지 합친 설정 목록을 찍어 둔다. 워커가 끝나면 git을 한 번이라도 부르기 전에 비교해, 바뀌었으면 되돌리고 그 실행에서는 git을 더 부르지 않고 실패로 처리한다(verify도 돌리지 않음, `verified.exit_code` -1).
- 실행 순서: 워커가 끝나면 변경 범위를 검사하고, 워커 HANDOFF를 읽고, 워커 변경을 커밋한 뒤 verify를 돌린다. verify가 끝나면 커밋하지 않은 모든 것(무시 파일과 중첩 저장소 포함)을 지우고, 확정한 HANDOFF 하나만 커밋한다. verify가 만든 파일은 작업 브랜치에 들어가지 않는다.
- 변경 범위 검사: ownership 밖 파일, 보호 경로, 심볼릭 링크, 하드 링크, 현재 서명 키 값이 들어 있는 파일은 되돌리고 실행을 실패로 처리한다. 워커가 직접 커밋한 새 파일도 지운다. `accept`는 병합 전에 작업 브랜치 전체 변경(링크, 하위 저장소 포함)을 다시 검사한다.
- 리드의 git: 전역, 시스템 설정을 읽지 않고(`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`) 훅과 fsmonitor를 끈 채로 실행한다. 오너 셸의 다른 `GIT_*` 변수(`GIT_DIR`, `GIT_CONFIG_COUNT` 등)는 넘기지 않는다.
- 워커 환경 변수: 워커(claude, codex)에는 허용 목록만 넘긴다. PATH, HOME, 사용자 이름, 셸, 언어, 터미널, TMPDIR, 프록시와 인증서 변수, 그리고 어댑터별 로그인 변수(claude는 `ANTHROPIC_API_KEY`, `CLAUDE_CONFIG_DIR`, codex는 `OPENAI_API_KEY`, `CODEX_HOME`)다. 오너 셸의 다른 토큰은 넘기지 않는다. 셸이 있는 codex 워커가 받은 값을 파일에 써서 메인에 들여오지 못하게 하려는 것이다(보안 감사 5차 중간 1). claude와 codex의 로그인은 HOME 아래 설정과 키체인을 쓰므로 이것으로 충분하다(2026-10-14 `claude auth status`, `codex login status`로 확인).
- 리드는 HANDOFF를 읽고 쓸 때 링크를 따라가지 않는다(경로의 모든 요소 검사, `O_NOFOLLOW`).
- 알려진 한계(1b에서 다룬다):
  - Codex 워커의 샌드박스는 읽기를 막지 않아 키 파일을 읽을 수 있다. 키가 HANDOFF에 실려 공개 저장소로 새어 나갈 수 있으므로 gitleaks 검사(M3)가 필요하다.
  - `decide`의 TTY 검사는 실수를 막는 장치다. `script` 같은 명령으로 의도적으로 우회할 수 있다.
  - 결정 장부에는 서명이 없다. 같은 OS 사용자가 줄을 더하면 옛 결정 되살리기를 막지 못한다.
  - `project.yaml`이 커밋되므로 저장소를 통째로 복사해 만든 프로젝트는 id가 같다.
  - 무시 파일(.gitignore 대상)의 변경은 허용 범위 검사에 잡히지 않는다. verify를 샌드박스에 넣고 verify 뒤 무시 파일까지 지워 피해를 줄였다.
  - verify가 띄운 백그라운드 프로세스는 verify가 끝난 뒤에도 남을 수 있다. 샌드박스 안이라 작업 폴더 밖을 쓰거나 네트워크를 쓰지는 못한다.
  - Codex 워커가 저장소의 `.git` 폴더(설정 말고 훅, 정보 파일)를 쓸 수 있는지는 확인하지 않았다. 리드의 git은 훅을 끄고 돌며, 설정 변경은 검사한다.

### 6.4 `gotechy decide G-### <선택> ["다음 지시"]`

- 대화형 터미널(표준 입력과 출력이 모두 TTY)에서만 실행한다. 아니면 exit 2.
- 질문, 선택지, 추천, 작업 제목, 한 줄 요약을 보여 주고 `확정할까요? [y/N]`에 `y`를 받아야 기록한다.
- 선택은 선택지 중 하나와 정확히 같아야 한다. 아니면 exit 1과 선택지 목록.
- 게이트마다 잠금(`G-###.lock` 폴더)을 잡는다. 이미 잠겨 있으면 exit 1. 기록은 임시 파일에 쓴 뒤 이름을 바꿔 원자적으로 한다.
- 이미 `resolved`이고 검증을 통과하는 게이트는 다시 결정할 수 없다. 검증에 실패하는 게이트(이전 키, 결정 뒤 바뀐 작업 명세나 HANDOFF)는 다시 결정할 수 있다. 지난 판본(`superseded`)의 게이트는 기록으로만 남고 다시 결정할 수 없다.
- 확인 질문에 보여 주는 질문과 요약에서 제어 문자를 지운다. Ctrl-C로 멈추면 잠금을 풀고 아무것도 기록하지 않는다.
- 결정 뒤 작업 상태: 그 작업의 현재 판본 `decision` 게이트가 모두 닫히면 `ready`. `approval-after`에서 `다시`를 고르면 `ready`. 다음 `run`의 워커 지시문에 결정과 다음 지시를 넣는다.

### 6.5 `gotechy gate verify [G-###]`

게이트마다 다음 중 하나로 판정하고, `fail`이 하나라도 있으면 exit 1.

| 판정 | 조건 |
|---|---|
| `ok` | `resolved`, 선택이 선택지 안, 현재 키로 서명이 맞음, nonce가 그 게이트의 마지막 소비 기록이고 다른 게이트에 쓰이지 않음, 장부에 깨진 줄이 없음, 프로젝트 id 일치, 작업 명세 요약값 일치, (현재 판본이면) HANDOFF 해시 일치 |
| `pending` | 아직 결정 전 |
| `superseded` | `handoff_rev`가 현재 HANDOFF 판본보다 작다. 지난 판본의 기록이라 검증 대상이 아니다 |
| `fail` | 위 `ok` 조건 중 하나라도 어긋남, 또는 게이트 파일을 읽을 수 없음. 사유를 함께 출력한다 |

### 6.6 `run`의 강제

- 읽을 수 없는 게이트 파일이 하나라도 있으면 어떤 작업도 시작하지 않는다(fail-closed).
- 작업에 필요한 게이트(6.1절)가 모두 `ok`여야 시작한다. `approval-before`는 `진행`이어야 한다. 빠진 게이트는 다시 열고 멈춘다.
- 선행 작업(`deps`)은 `accepted`여야 하고, 선행 작업에 필요한 게이트도 모두 `ok`이며 승인 계열은 통과 선택(`진행`, `승인`)이어야 한다.
- 위 이유로 멈추면 exit 1이고, 어떤 게이트를 어떻게 하면 되는지 알려 준다.

## 8. 인박스와 읽기 전용 화면 (M2b)

오너가 HANDOFF를 3초 카드, 30초 요약, 3분 세부의 3단으로 읽게 한다. 원천은 메인 체크아웃의 `orchestration/handoffs/T-###.md`이고, 두 명령 모두 파일을 읽기만 한다(화면 파일 생성 제외).

### 8.1 `gotechy inbox`

- 묶음 순서: 결정 필요(`needs-decision`), 실패(`failed`와 읽을 수 없는 HANDOFF), 완료(`done`).
- 묶음 안에서는 `verified.at`이 오래된 것부터(오래 기다린 일이 위로). `verified.at`이 없으면 묶음 맨 뒤, 그다음은 작업 번호 순.
- 맨 위 줄은 묶음별 건수(`결정 필요 1건, 실패 1건, 완료 2건`), 0건인 묶음은 뺀다. HANDOFF가 하나도 없으면 `대기 중인 일 없음` 한 줄만.
- 카드 형식:

```text
[결정 필요] T-003 캐시 만료 설정
  막는 결정 1, 기본값 1, 검증 통과, 리스크 2, $0.09, 파일 3개
  캐시 만료를 5분으로 두고 조회 API에 적용했어요.
  결정: 캐시 만료를 얼마로 할까요? (추천 5분)
```

| 줄 | 내용 |
|---|---|
| 1 | `[묶음] 작업 번호 제목`. 제목은 작업 명세에서 읽고, 명세가 없으면 `(작업 명세 없음)` |
| 2 | 신호 줄. 막는 결정 수와 기본값 결정 수(0이면 생략), 계약 위반 수(`형식 오류 N건`, 4절과 4.1절 규칙만 세고 문체 규칙은 빼며 0이면 생략), 검증(`검증 통과`, `검증 실패 exit N`, `검증 기록 없음`), 리스크 수(`리스크 N`, 절이 "없음"이면 `리스크 없음`, 절 자체가 없으면 `리스크 기록 없음`), 비용(`$0.00`, 모르면 `비용 모름`), 바뀐 파일 수(`파일 N개`, HANDOFF 파일 자신은 세지 않음, 기록이 없으면 `파일 기록 없음`) |
| 3 | 한 줄 요약 |
| 4~ | 막는 결정마다 `결정: 질문 (추천 X)`, 최대 3줄. 넘치면 `결정 외 N건` |
| 실패 카드 | `리드: lead_note` 한 줄(80자에서 자름) |

- 읽을 수 없는 HANDOFF(frontmatter나 스키마 오류)는 `[읽기 실패]` 카드로 실패 묶음에 넣고, 둘째 줄에 첫 오류, 셋째 줄에 `gotechy handoff lint <경로>`를 쓴다. 한 파일이 깨져도 인박스 전체는 멈추지 않는다.
- 화면에 보여 주는 모든 문자열에서 터미널 제어 문자(ESC 등 C0, C1 제어 문자, 줄바꿈과 탭 제외)와 양방향 제어 문자(U+202A~U+202E, U+2066~U+2069)를 지운다. 악성 HANDOFF가 터미널 화면을 덮어쓰거나 글자 순서를 뒤바꿔 보이게 하는 것을 막는다. HTML 화면에도 같은 규칙을 적용한다.
- 종료코드는 항상 0이다(보기 명령). 병합한 작업을 인박스에서 빼는 규칙은 M2c의 `accept`에서 정한다.

### 8.2 `gotechy render [T-###]`

- `.gotechy/view/index.html`(인박스 카드)과 읽을 수 있는 HANDOFF마다 `.gotechy/view/T-###.html`을 다시 만든다(이전 화면 파일은 지운다). 읽기 실패 카드는 화면 없이 인박스에만 나온다. 없는 작업 번호를 주면 exit 1. 작업 번호를 주면 그 화면의, 안 주면 인박스 화면의 `file://` 주소를 출력한다. `.gotechy/`는 git에 올리지 않는다.
- 화면 구성(한 가지 배치, 시안 비교는 1b):
  - 3초: 인박스 카드와 같은 신호 줄.
  - 30초(펼침): 한 줄 요약, 결정 필요, 한 일, 건너뛴 것, 확인 못 한 것, 리스크.
  - 3분(접힘, `<details>`): 증거, 새 용어와 용어 은행 풀이, 말해 보기, 다음 단계, 리드 측정값(verify 명령과 결과, 모델, effort, 토큰, 비용, 바뀐 파일).
- 보안 규칙. HANDOFF, 작업 명세, 용어 은행은 모두 신뢰하지 않는 입력으로 다룬다.

| 규칙 | 내용 |
|---|---|
| 이스케이프 | 파일에서 읽은 모든 문자열은 HTML 이스케이프한다. 본문 Markdown은 원시 HTML을 허용하지 않는 설정(`html: false`)으로만 변환한다 |
| 스크립트 없음 | `<script>`, 이벤트 처리 속성(`on*`), `<form>`, `<iframe>`, `<object>`, `<embed>`, `<base>`, `<img>`를 만들지 않는다. 허용 요소 목록 밖의 요소가 나오면 테스트가 실패한다 |
| 링크 | Markdown 링크는 `http:`, `https:`만 링크로 만들고 나머지는 글자로 둔다. 링크마다 `rel="noopener noreferrer"`, `target="_blank"`. 화면끼리의 링크(`index.html`, `T-###.html`)는 렌더러가 직접 만든 것만 |
| CSP | `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">`와 `<meta name="referrer" content="no-referrer">` |
| 외부 요청 없음 | 글꼴, 이미지, 스타일시트를 밖에서 불러오지 않는다. 스타일은 문서 안 `<style>` 하나 |

## 9. 이해 게이트, 병합, 용어 누적 (M2c-2)

### 9.1 이해 게이트

- 대상: 게이트의 `irreversible`이 참인 결정. 작업 명세의 `irreversible`이 거짓이어도 `ownership`이나 HANDOFF `changed_files`(실제로 바뀐 파일)가 5절의 경로 규칙에 걸리면 참이 된다(경로 규칙이 이긴다).
- `decide`는 서명 전에 HANDOFF "말해 보기"의 질문마다 오너의 답을 받는다. `approval-before`처럼 HANDOFF가 없으면 "이 작업이 되돌리기 어려운 이유를 자기 말로 설명해 보세요" 한 문항을 묻는다. 답하는 단계를 건너뛰는 방법은 없지만, 빈 답도 받는다(핵심어 적중 0으로 기록).
- 채점: 질문 순서대로 HANDOFF `comprehension_keys`의 핵심어가 답에 들어 있는 수를 센다(대소문자 무시). 핵심어가 없으면 적중률을 계산하지 않는다.
- 기록: `orchestration/private/comprehension.jsonl`에 `{gate, question, answer, keys, hits, at}`. 답과 핵심어는 이 파일 밖(게이트 파일, HTML, 인박스, 이벤트 로그)에 남기지 않는다. 게이트 파일에는 문항 수와 적중 수만 `comprehension: {questions, hits, keys}`로 남긴다.

### 9.2 측정

- 인박스와 화면이 열린 게이트를 처음 보여 줄 때 `orchestration/private/events.jsonl`에 `gate.shown`을 남긴다. `decide`는 가장 이른 `gate.shown` 시각을 `opened_at`으로 쓴다(없으면 확인 질문을 보여 준 시각).
- `active_seconds`는 확인 질문(이해 문항 포함)을 보여 준 때부터 답할 때까지의 초다.

### 9.3 인박스의 게이트 표시

- 결정 필요 카드의 결정 줄은 열린 게이트가 있으면 번호를 붙인다: `결정 G-001: 질문 (추천 X)`. 마지막 줄에 `결정하려면: gotechy decide G-001 <선택>`.
- HANDOFF가 아직 없는 작업의 `approval-before` 게이트는 따로 카드를 만든다: `[결정 필요] T-### 제목`, `시작 승인 대기 G-###: gotechy decide G-### 진행|중단`.
- `approval-after` 게이트가 열린 `done` 작업은 결정 필요 묶음으로 올린다: `승인 대기 G-###: gotechy decide G-### 승인|다시`.
- `accepted` 작업의 HANDOFF는 인박스와 화면 목록에서 뺀다.
- 은행에 없는 `new_terms`가 있으면 카드에 `새 용어: a, b` 줄을 넣는다.

### 9.4 `gotechy accept T-###`

- 조건: 작업 `done`, HANDOFF `verified.exit_code` 0, 필요한 게이트(6.1절)가 모두 `ok`이고 승인 계열은 통과 선택, 읽을 수 없는 게이트 파일 없음. 하나라도 어기면 exit 1과 사유.
- 절차: 메인의 현재 커밋에서 임시 worktree를 만들고, 작업 브랜치 `gotechy/T-###`를 `--no-ff --no-commit`으로 병합한다. 병합 결과에서 `orchestration/` 아래 변경은 메인 커밋의 상태로 되돌린다. 작업 명세, HANDOFF, 게이트는 리드의 기록이라 메인 체크아웃에만 두고, 병합하는 것은 워커가 바꾼 파일뿐이다. 커밋한 뒤 그 자리에서 작업의 `verify`를 다시 실행한다.
- 충돌이나 verify 실패면 임시 worktree를 지우고 작업을 `needs-decision`으로 바꾸고 HANDOFF에 `lead_note`로 사유를 남긴 뒤 exit 1.
- 성공하면 메인 체크아웃을 그 병합 커밋으로 fast-forward한다. 메인의 커밋하지 않은 변경과 겹쳐 git이 거부하면 exit 1(메인은 그대로). 성공하면 작업을 `accepted`로 바꾸고 작업 worktree와 임시 worktree를 지운다. 작업 브랜치는 기록으로 남긴다.

### 9.5 프로젝트 용어 은행 누적

- `accept`가 성공하면 HANDOFF "새 용어" 절의 `- 용어: 풀이` 중 은행(라이브러리와 프로젝트)에 없는 것을 `orchestration/terms.jsonl`에 `{term, easy, src: "T-###"}`로 더한다. 오너가 승인한 작업의 풀이만 쌓인다.

## 10. 설치 계층 (M3)

### 10.1 `train.yaml`

저장소 루트의 `train.yaml`이 함께 검증된 도구 버전 묶음(train)이다. 도구마다 `version`, 버전을 읽는 명령 `check`, 고정 등급 `pin`을 적고, A등급(mise 자신 제외)은 mise 도구 이름 `mise`도 적는다. 라이브러리의 `mise.toml`에는 A등급 도구가 그 이름과 같은 버전으로 있고, `mise.lock`에는 4개 플랫폼(macos-arm64, macos-x64, linux-x64, linux-arm64)의 체크섬이 있다. 테스트(`tests/core/train-lock.test.ts`)가 셋을 대조한다.

| pin | 뜻 | doctor |
|---|---|---|
| `A` | 라이브러리의 `mise.toml`과 `mise.lock`(4개 플랫폼 체크섬)으로 완전 고정 | 버전이 다르면 실패 |
| `B` | 설치 시점 고정, 자동 업데이트는 정책으로 막음. train 2026.10.0에는 B등급 도구가 없다(2026-10-14에 claude, codex를 A로 올림) | 버전이 다르면 실패. 고치는 법은 다시 설치하거나 검증 뒤 train 올리기 |
| `C` | 고정할 수 없음(예: GUI 앱) | 기록만 하고 실패하지 않음 |

워커는 train 버전 그대로 돈다. claude 워커에는 `DISABLE_AUTOUPDATER=1` 환경 변수를, codex 워커에는 `-c check_for_update_on_startup=false`를 넘긴다. `bin/gotechy`로 실행하면 워커는 PATH 맨 앞의 mise 설치본을 쓴다.

`policy`는 `setup`이 전역 설정에 넣는 값이다. 전역 설정에 들어가므로 `env`는 허용한 키(`DISABLE_AUTOUPDATER`, `DISABLE_TELEMETRY`, `DISABLE_ERROR_REPORTING`)만, `deny`는 `Bash(...)`, `Read(...)`, `Edit(...)`, `Write(...)` 형식만 받는다. Claude Code(`~/.claude/settings.json`): `env.DISABLE_AUTOUPDATER = "1"`, `permissions.deny`에 `Bash(gotechy decide:*)`, `Bash(script:*)`, `Bash(expect:*)`(TD-008). Codex(`~/.codex/config.toml`): `check_for_update_on_startup = false`.

### 10.2 `gotechy doctor [--history]`

- 검사: 도구 버전이 train과 같은가, 정책이 전역 설정에 들어가 있는가, 라이브러리 스킬의 frontmatter(`name`, `description` 필수, description 400자 이하, 본문 150줄 이하, 스킬 수 15개 이하), 저장소 셸 스크립트(`bin/`, `scripts/`, `.claude/hooks/`, `.githooks/`, `templates/`)가 macOS에서 도는가. `#!/bin/sh` 스크립트는 POSIX 밖 문법(`[[`, `declare`, `mapfile`, `readarray`, `<<<`, `${x,,}`, `${x^^}`, `function f {`)을 금지하고, bash 스크립트는 macOS 기본 bash 3.2에 없는 문법(`declare -A`, `mapfile`, `readarray`, `${x,,}`, `${x^^}`, `&>>`, `|&`, `coproc`, `local -n`)만 금지한다. 둘 다 GNU 전용 명령(`sha256sum`, `date -d`)은 금지한다.
- 실패마다 고치는 명령을 출력한다. 하나라도 실패하면 exit 1, 모두 통과하면 exit 0.
- `GOTECHY_TRAIN`으로 다른 train 파일을 줄 수 있다(테스트에서 불일치를 주입할 때). train의 `check` 명령을 셸로 실행하므로 라이브러리 안의 파일만 받는다. 부트스트랩이 둔 `$GOTECHY_HOME/bin/mise`가 있으면 train 체크섬과 대조한다.
- `--history`: 라이브러리의 gitleaks 설정으로 저장소 전체 이력을 검사한다(저장소의 `.gitleaks.toml`은 쓰지 않는다). 찾으면 exit 1.

### 10.3 `gotechy setup [--dry-run] [--restore <시각>]`

- `--dry-run`: 바꿀 내용만 출력한다. 어떤 파일도, 백업 폴더도, `$GOTECHY_HOME`도 만들지 않는다. `setup`은 `GOTECHY_TRAIN`을 받지 않고 라이브러리의 `train.yaml`만 따른다.
- 적용: 바꾸기 전에 `$GOTECHY_HOME/backup/<시각>/`에 원본과 `manifest.json`(경로, 원래 있었는지, 바꾸기 전과 후의 sha256, 권한)을 남긴다. 기존 키, 주석, 권한은 지킨다. 심볼릭 링크면 실제 파일을 고친다. 계획을 세운 뒤 쓰기 직전에 파일이 바뀌었으면(다른 프로그램이 동시에 고침) 아무것도 쓰지 않고 멈춘다. 두 번째 파일을 쓰다 실패하면 이미 쓴 파일을 원래대로 되돌린다(부분 적용 없음). 대상이 없는 깨진 링크는 일반 파일로 바꾸지 않고 멈춘다. TOML은 줄 단위로 고친 뒤 TOML 파서로 다시 읽어, 원하는 값이 되고 다른 값은 그대로일 때만 쓴다. 아니면 손으로 넣을 줄을 알려 주고 멈춘다. 같은 시각의 백업 폴더가 이미 있으면 덮어쓰지 않고 멈춘다.
- `--restore <시각>`: manifest대로 원본 바이트와 권한을 되돌리고, 원래 없던 파일은 지운다. 이미 원래대로인 항목은 건너뛴다. 적용 뒤 사용자가 파일을 바꿨으면(현재 해시가 적용 직후 해시와 다름) 아무것도 바꾸지 않고 멈춘다. manifest의 경로는 두 설정 파일만, 백업 이름은 `숫자.orig`만 받고, 백업 바이트가 원본 해시와 같은지 확인한다.
- 1a의 `setup`은 정책만 다룬다. 도구 설치는 부트스트랩과 `mise install --locked`가 한다. mise가 설치한 도구는 복원 대상이 아니다.

### 10.4 gitleaks hook

- `gotechy init`은 hook(`pre-commit`, POSIX sh)과 gitleaks 설정(기본 규칙 + 주민등록번호 규칙)을 저장소 밖 `$GOTECHY_HOME/githooks/`에 두고, `git config core.hooksPath`를 그 절대 경로로 설정한다. 저장소 안 폴더를 hooksPath로 쓰면 그 저장소가 준비한 다른 hook(post-checkout 등)이 실행되고, 저장소의 `.gitleaks.toml`이 검사를 끌 수 있기 때문이다.
- 이미 다른 `core.hooksPath`가 있거나 `.git/hooks`에 쓰는 hook이 있으면 바꾸지 않고 알려 준다(기존 hook을 끄지 않는다).
- hook은 staged 변경을 hook 옆의 설정으로 검사하고, 찾으면 커밋을 막는다. gitleaks나 설정이 없으면 커밋을 막는다(fail-closed).
- `.gitignore`가 심볼릭 링크면 gotechy 항목을 넣지 않고 알려 준다.
- hook은 `--no-verify`로 우회할 수 있다. 최종 방어선은 CI의 전체 이력 검사다(2단계).

### 10.5 `bin/gotechy` 부트스트랩

- POSIX sh. 스크립트 위치로 라이브러리 폴더를 찾는다. `$GOTECHY_HOME/bin/mise`가 없으면 train의 mise 버전과 아키텍처별 sha256으로 내려받아 검증한다(`shasum -a 256`).
- 다운로드는 https만 쓴다(`curl --proto '=https'`).
- `--bootstrap-dry-run`이면 무엇을 내려받고 어디에 둘지만 출력하고, 어떤 다운로드나 폴더 생성도 하지 않는다.
- `$GOTECHY_HOME/bin`을 PATH 맨 앞에 두고 `MISE_LOCKED=1`로 넘긴다. mise는 `mise.lock`에 있는 URL과 체크섬으로만 도구를 설치하고 락 파일을 고치지 않는다.
- 라이브러리에 `node_modules`가 없으면(새 클론) `bun install --frozen-lockfile`을 먼저 돌린다. 설치 출력은 stderr로 보낸다.
- CLI는 시작할 때 `GOTECHY_CWD`를 읽어 그 폴더로 돌아간 뒤 환경 변수에서 지운다. CLI가 띄우는 자식 프로세스(테스트, hook, 다른 gotechy)는 이 값을 받지 않는다. 그래서 src의 `Bun.spawn`은 env를 항상 명시한다(생략하면 bun이 지운 값까지 넘긴다).
- 그다음 `mise exec -C <라이브러리> -- bun <라이브러리>/src/cli.ts "$@"`. `mise exec -C`는 작업 폴더를 라이브러리로 바꾸므로, 원래 작업 폴더를 `GOTECHY_CWD`로 넘기고 CLI가 시작할 때 그 폴더로 돌아간다.

### 10.6 `gotechy test`

- 라이브러리 폴더에서 `bun test --coverage`를 돌리고, lcov 결과로 커버리지 기준을 본다. 테스트가 하나라도 실패하면 기준을 보지 않고 exit 1.
- 기준: 전체 줄 커버리지 80% 이상, 핵심 모듈은 파일마다 95% 이상. 핵심 모듈 목록은 `src/core/coverage.ts`의 `CORE_MODULES`(lint, 결정, 검증, 반영, 어댑터)이고 `ARCHITECTURE.md`에도 적는다.
- 핵심 모듈이 측정에 없으면(테스트가 그 파일을 불러오지 않으면) 실패다. 측정에서 빠지는 것으로 기준을 피하지 못하게 한다.
- 기준은 macOS에서 잰다. 리눅스 CI에서는 verify 샌드박스 경로가 달라 `bun test --coverage`만 돌린다.
