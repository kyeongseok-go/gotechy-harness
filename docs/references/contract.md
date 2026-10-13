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
  gates/G-001.md          결정 (gotechy decide만 작성, M2)
  private/                이벤트 로그, 이해 게이트 답 (.gitignore, 공개 금지)
    events.jsonl
  .seq                    번호 발급 상태 (잠금 파일 .seq.lock로 원자적 갱신)
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
       needs-decision → ready (결정 해소 후)
       failed → ready (리드가 원인 수정 후 재시도)
gate:  pending → resolved | rejected
```

- `run`은 `ready`이고 `deps`가 모두 `done`인 작업만 시작한다.
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
| `style-translationese` | "에 대해(서)", "를/을 통해·통하여", "에 있어(서)", "되어지/되어진", "에서의·에로의·으로의·으로부터의" |
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
    .gotechy/              .git/                  .claude/               .agents/
    AGENTS.md              CLAUDE.md              apm.yml   apm.lock.yaml
    mise.toml              mise.lock              policy/

`irreversible`을 자동으로 참으로 만드는 경로(되돌리기 어려운 결정, 이해 게이트 대상, M2): 파일명에 `schema`, `migration`, `auth`, `security`, `deploy`, `.github/workflows/`가 들어간 경로.

## 6. 게이트 `gates/G-###.md` (M2)

M2에서 확정한다: `id, task, class, status, options[], resolution, instruction, task_spec_sha256, handoff_sha256, key_id, nonce, opened_at, decided_at, active_seconds, sig`.

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
