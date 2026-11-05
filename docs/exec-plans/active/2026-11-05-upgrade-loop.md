---
title: 2026년 11월 업그레이드 루프 (오너 외출 중 자율 실행)
status: active
parent: docs/exec-plans/active/2026-10-16-harness-v2-phase2.md
mode: loop
branch: upgrade-2026-11
---

# 하네스를 2026년 11월 기준으로 올리는 업그레이드 루프

## Purpose / Big Picture

오너(고텍이)가 외출하며 맡겼다(2026-11-05 13:00 KST). 지시는 "2026년 11월 기준 최고의 기술과 방법으로 하네스를 업그레이드하는 방안을 제안하고, 루프로 자동 수행"이다.

이 계획이 끝나면 세 가지가 달라진다.

1. 하네스가 다시 자기 규칙을 지킨다. 10월 21일부터 문체 규칙이 오류로 바뀌면서 테스트 11개가 깨져 있었고, 에이전트가 가장 먼저 읽는 지도(AGENTS.md)도 문체 검사에서 오류 52건이었다. 이번에 고치고, 같은 일이 조용히 다시 생기지 않게 검사를 붙인다.
2. 2026년 7월에서 11월 사이에 나온 도구 기능(Claude Code hook의 `onFailure: "block"`, 작업 폴더 밖 쓰기 차단, Codex 토큰 상한과 표준 입력 프롬프트)으로 오래된 부채(TD-026, TD-015, TD-028, TD-024 일부)를 갚는다.
3. 고정한 도구 버전을 최신 안정판으로 올린다(claude-code 2.1.296에서 2.1.318, codex 0.162.1에서 0.166.0, apm 0.33.0에서 0.35.0, bun 1.4.3에서 1.4.4, node 24.21.0에서 24.22.2). 2.1.296에는 headless 실행에서 승인된 도구 호출이 두 번 실행될 수 있는 회귀가 있었다(2.1.299에서 고침). 하네스 워커는 headless로 돈다.

비판적으로 먼저 적는다. 2단계 계획(phase2)은 "실제로 써 봐야 무엇을 고칠지 안다"며 첫 실전 프로젝트(P1)를 먼저 하자고 했다. 이 루프는 그 순서를 바꾸지 않는다. 오너 결정이나 유료 실행 없이 할 수 있는 일, 그리고 첫 실전 프로젝트를 시작할 때 걸림돌이 될 일만 한다. 새 기능을 크게 늘리지 않는다(하네스 만들기가 일이 되는 함정, 설계 문서 11절).

## Progress

- [x] (2026-11-05 13:00) 시작 상태 기록: `~/.claude/settings.json` sha256 앞 8자리 `c5551143`, `~/.codex/config.toml` `62b7d579`, `~/.gotechy` 전체 해시 `ac4c41f4`(10-16과 같음). claude 실행 파일은 2.1.318
- [x] (2026-11-05 13:12, 커밋 시각) U0 기준선 복구. 시작 때 `bun run check`가 766 pass, 11 fail. 커밋 5d1491d로 778 pass, 커버리지 95.69%
- [x] (2026-11-05 13:14, 커밋 시각) U1 조사 두 건(외부 최신 기술, 내부 격차)과 radar 실행, 이 계획
- [x] (2026-11-05 13:27, 커밋 시각) U2 가드 hook을 시간 초과와 실패에도 막게(TD-026 상환). 막을 때 exit 2와 stderr, Claude Code hook에 `onFailure: "block"`. 780 pass. mutation(설정 키 빼기)을 테스트가 잡음
- [x] (2026-11-05 13:33, 커밋 시각) U3 자기 규칙 지키기: AGENTS.md, CLAUDE.md, ARCHITECTURE.md, README.md, `.claude/rules`, `.claude/agents`의 문체 오류 130건에서 0건. `tests/core/self-style.test.ts`(지금 시각과 2030년 시각 둘 다, 스킬과 템플릿 포함, mutation으로 확인). ARCHITECTURE 모듈 목록 동기화와 검사. TD-017 상환. 784 pass
- [x] (2026-11-05 13:44, 커밋 시각) U4 radar 지문 2판(본문만, 닫히지 않은 script 제거, 날짜 가림), 바뀐 페이지는 새 줄과 첫 줄을 보고서에, 옛 지문은 처음 기록으로 다시 잡음, 빈 피드 알림, ears 출처를 page로. 실측: 바로 다시 돌리면 바뀜 0, 못 읽음 1에서 0. 791 pass. mutation 2종 잡음(main 추출 테스트는 처음에 못 잡아 보강)
- [x] (2026-11-05 14:03, 커밋 시각) U5 train 2026.11.0: claude 2.1.316, codex 0.166.0, apm 0.35.0, bun 1.4.4, node 24.22.2, uv 0.13.6, gh 2.103.3(gitleaks 8.30.1은 그대로 최신). 발행 5일 이상 지난 판만 골랐다. 격리 폴더(MISE_DATA_DIR)에서 `mise lock`과 `mise install`(락 고정)으로 8개 도구가 10초에 깔리고 각 `--version`이 맞는 것을 확인. 새 툴체인으로 793 pass, 커버리지 기준 통과
- [x] (2026-11-05 14:13, 커밋 시각) U6 죽은 run 잠금의 회수를 회수 잠금 안에서 다시 확인하고 하게(TD-027 상환). 실제 프로세스 8개 경쟁 테스트: 고치기 전 6개가 동시에 잡음, 고친 뒤 1개. 경쟁 구간을 넓히는 테스트 전용 멈춤(`NODE_ENV=test`일 때만)
- [x] (2026-11-05 14:19, 커밋 시각) U7 허용 범위 검사가 무시 파일도 보기(TD-007 상환). 무시 경로(node_modules)에 심은 파일이 verify에 닿지 않고 failed로 남는 것을 테스트로 고정
- [x] (2026-11-05 14:26, 커밋 시각) U8 CI가 `bun src/cli.ts test`로 커버리지 기준까지 본다(리눅스는 macOS 전용 샌드박스 모듈만 뺌). 진행 중 ExecPlan의 필수 절 5개를 테스트로 검사(셸 grep 단계 대신). 끝난 10-16 밤샘 계획에 빠진 절을 채워 completed/로 옮김. `gotechy test`가 커버리지 임시 폴더를 지움. 800 pass
- [x] (2026-11-05 14:45, 커밋 시각) U9 워커 하드닝: codex 워커와 감사관은 프롬프트를 표준 입력으로(TD-028 일부), `--ignore-user-config`. claude 워커는 `blockWritesOutsideWorkingDirectories`, `blockReadsOutsideWorkingDirectories`(2.1.316 설정 스키마에서 permissions 아래 확인). TD-030 무료 실험: macOS codex 0.166 쓰기 샌드박스가 git 관리 파일 쓰기를 모두 막음. 토큰 상한(`features.rollout_budget`)은 개발 중 기능이고 확인에 유료 실행이 필요해 넣지 않고 U10 제안으로. 803 pass
- [x] (2026-11-05 U10) 오너 결정용 제안서 `docs/design-docs/2026-11-05-upgrade-proposals.md`: 결정 6가지(첫 프로젝트 먼저, 이 브랜치 병합, 팩 eval 5달러, srt 보류, Betterleaks 보류, codex 토큰 상한 조건부)와 결정이 필요 없는 작은 후보. ADR은 오너가 고른 뒤에 쓴다
- [ ] U11 최종 검토(보안 감사, 문서 대조), 오너 보고 HANDOFF, 메모리

## 작업 대기열과 완료 판정

위에서부터 한다. 건너뛰면 이유를 Decision Log에 적는다.

| 순서 | 일 | 완료 판정 |
|---|---|---|
| U2 | `gotechy init`이 까는 가드 hook 설정에 `onFailure: "block"`을 넣는다(Claude Code 2.1.295부터). 가드가 막을 때 JSON과 함께 stderr와 exit 2도 낸다(Codex hook은 exit 2로 막는다). 감싸개 문구 정리 | 설정 생성 테스트, deny가 exit 2인 e2e, mutation(설정 키를 빼면 테스트가 잡음) |
| U3 | AGENTS.md, CLAUDE.md, ARCHITECTURE.md, `.claude/rules/`, `.claude/agents/`, README.md의 문체 오류 0건. 이 파일들을 lint하는 테스트. `src/`에 날짜로 켜지는 규칙이 있으면 그 날짜 뒤를 흉내 낸 테스트가 있는지 보는 검사. ARCHITECTURE의 runtime 모듈 목록과 npm 표기를 실제와 맞춤 | `bun run dev -- text lint <파일들>` exit 0, 새 위생 테스트 |
| U4 | radar 페이지 지문에서 nav, header, footer, script, style과 날짜 모양 문자열을 빼고 정규화. ears 출처를 읽을 수 있는 주소나 방식으로 | 날짜만 다른 두 HTML의 지문이 같고 본문이 다르면 달라지는 테스트. 실제 `radar --all`의 "바뀜"이 45건에서 줄어든 수치 |
| U5 | train.yaml, mise.toml, mise lock, CI의 버전을 최신 안정판으로. 오너가 2026-10-13에 도구 업데이트를 위임함 | `tests/core/train-lock.test.ts` 통과, `bun run check` 통과, CI 성공 |
| U6 | 잠금 회수를 이름 바꾸기로 원자적으로 | 죽은 pid 잠금에 동시 회수 N번, 성공 정확히 1개 |
| U7 | run 시작 때 무시 파일 목록을 남기고 끝에 비교 | 녹화 워커가 무시 경로에 쓴 파일을 허용 밖으로 잡는 e2e |
| U8 | CI에 `gotechy test`의 커버리지 판정(리눅스는 샌드박스 모듈 제외), ExecPlan 필수 절 검사 | ci-hygiene 테스트, CI 성공 |
| U9 | 어댑터 인자 변경과 녹화 재생 테스트. `codex sandbox`로 TD-030 무료 실험(모델 호출 없음) | 어댑터 단위 테스트, 실험 기록 |
| U10 | `docs/decisions/` 초안 상태 ADR과 HANDOFF의 결정 카드 | 오너가 고를 선택지와 추천이 있음 |
| U11 | security-auditor로 이번 변경 전체 감사, doc-gardener 대조, HANDOFF T-009, 메모리 | 높음 0건, HANDOFF lint 통과 |

## 마일스톤마다 도는 루프

계약 먼저, 실패하는 테스트, 구현, `bun run check`, mutation check(핵심 로직), 기록(이 문서의 Progress와 Surprises), 검사가 통과할 때만 커밋(`&&`로 잇는다), `upgrade-2026-11` 브랜치 푸시, `gh run watch`로 CI 확인. CI가 빨강이면 다음 일 전에 고친다. 시각은 `date`와 `git log`로만 적는다.

## 멈춤 규칙

- 같은 문제로 3번 실패하면 그 일을 멈추고 이유를 적은 뒤 의존하지 않는 다음 일로 넘어간다.
- 오너만 정할 수 있는 결정은 되돌릴 수 있는 기본값으로 진행하고 보고의 결정 필요에 올린다.

## 하지 않는 것

- `~/.claude`, `~/.codex` 설정 수정, `gotechy setup` 실행
- 리드가 `gotechy keys`, `decide`, `serve`, `loop` 실행, 확인 창 띄우기, 실제 `~/.gotechy` 아래 수정
- force push, master나 harness-v2 브랜치 수정, 외부 발행, 위키 적재
- 유료 실행: 실제 Claude나 Codex 워커, 감사관, `claude plugin eval`
- 스킬 본문(`skills/*/SKILL.md`) 수정(스펙의 Non-goal), 파일 삭제(저장소 hook이 오너 확인을 요구)
- 공문서 프로젝트, 첫 실전 프로젝트 시작

## Surprises & Discoveries

- 날짜로 켜지는 규칙이 시한폭탄이 됐다. `src/core/style.ts:7`의 `STYLE_ENFORCE_FROM`(2026-10-21 00:00 KST)이 지나자 테스트 11개가 깨졌다. 마지막 CI(10-16)는 그 전이라 초록이었고, 그 뒤로 아무도 돌리지 않아 3주 동안 몰랐다. 원인 둘: (1) `src/core/prose.ts`의 파일 이름 가리기가 `\b`(ASCII 기준)로 시작해 `문서.md`를 못 가리고 `md`를 영어 용어로 뽑았다(진짜 버그, 한글 파일 이름을 쓰는 오너에게 바로 걸림). (2) 테스트 몇 개가 실제 run과 달리 용어 은행 없이 lint했다.
- radar `--all` 결과(2026-11-05): 출처 136개 중 새 판 6, 바뀜 45, 처음 기록 7, 같음 77, 못 읽음 1. 바뀜 45건은 대부분 페이지 장식 변화로 보인다(ISO 표준 페이지 등). 사람이 볼 수 없는 양이라 잡음을 줄여야 쓸모가 있다.

- `onFailure`의 위치가 문서마다 달라 보였다. 실행 파일 문자열에 SDK용 "hook matcher의 onFailure" 문구가 있어 헷갈렸지만, 2.1.318 설정 스키마에서 command hook 객체에 `timeout`, `onFailure`, `statusMessage`가 나란히 있는 것을 확인했다. 위치가 틀리면 설정 파일이 거부돼 가드가 통째로 꺼질 수 있어서 넣기 전에 확인했다.
- 연구 에이전트의 추정("감시 타이머가 필요 없어진다")은 Claude Code에만 맞다. Codex의 hook 시간 초과 동작은 문서에 없어 남겨 두었다.

- 문체 고치기 중 `git checkout AGENTS.md`로 mutation을 되돌리다 고친 내용까지 날렸다. 변환 스크립트로 다시 적용했다. mutation은 파일 복사본으로 되돌리는 편이 안전하다.
- README의 브랜드 슬로건(영어 문장)과 doc-gardener가 인용하는 색인 상태 표시(이모지)는 규칙을 설명하거나 원문을 지키는 자리라 `style-ignore` 표지로 감쌌다. 심각도 이모지는 높음, 중간, 낮음 말로 바꿨다.

- radar의 "바뀜 45건"은 대부분 순간 잡음이 아니었다. 35개 페이지를 1.5초 간격으로 두 번 받아 1판 지문을 비교하니 34개가 같았다. 매번 달라진 하나(anthropic-develop-tests)는 200만 글자 상한에서 잘리며 닫히지 않은 `<script>`가 남은 것이었다. 3주 동안 실제로 글이 바뀐 것을 보고서가 "무엇이 바뀌었는지" 말해 주지 못한 것이 진짜 문제라 본문 글을 남겨 차이를 보여 주게 했다.
- zsh는 따옴표 없는 변수를 낱말로 나누지 않는다. 실험 스크립트에 출처 35개가 한 인자로 넘어가 아무것도 안 돌았다(`${=ids}`로 해결).

- apm 0.35부터 `apm install --frozen`이 손댄 팩 파일을 "Kept user-edited file"로 남기고 exit 0으로 끝난다. doctor가 권하던 고치는 법이 더는 고치지 못했다. `--force`는 "치명적 보안 경고가 있어도 깐다"는 뜻이 함께 있어 권하지 않고, 바뀐 파일을 지운 뒤 `--frozen`으로 다시 까도록 안내를 바꿨다(실험으로 확인). 감지(`apm audit --ci`)는 그대로 잡는다.
- Bun 1.4.4는 커버리지 줄을 더 엄격하게 센다(`if (...)` 다음 줄의 `return`을 따로 셈). 같은 테스트로 전체 95.69%에서 94.42%, `accept.ts`가 96.84%에서 94.59%로 내려갔다. 기준을 내리지 않고, 그 줄들이 가리키는 실제로 테스트하지 않던 거부 경로(번호 형식, HANDOFF 없음, verify 기록, 브랜치 없음, 메인의 커밋하지 않은 변경과 겹침)에 테스트를 더했다.
- **사고(13:55~14:06)**: mise.toml을 새 버전으로 바꾼 뒤 이 폴더에서 `bun`을 부르자, mise shim이 없는 판(bun 1.4.4)을 오너의 실제 mise 폴더에 자동으로 깔고 shim 14개(`bun`, `node`, `npm`, `gh`, `uv`, `gitleaks`, `apm`, `claude`, `codex` 등)를 다시 만들었다. 이때 mise(2026.10.8)가 자기 위치를 shim 경로로 잘못 잡아 모든 shim이 `shims/bun`을 가리키는 고리가 됐고, mise로 깐 도구가 셸에서 `too many levels of symbolic links` 오류로 모두 멈췄다. `mise reshim --force`로 고쳤지만, 이 폴더에서 다시 shim을 부르자 node 자동 설치가 같은 고장을 또 냈다. 마지막으로 shim이 아니라 mise 실행 파일을 직접 불러 train 판 8개를 락대로 깔고(`~/.gotechy/bin/mise install`, 부트스트랩과 같은 길) shim을 다시 만들어 끝냈다. 확인: 저장소 안에서 8개 shim이 모두 train 판을 내고, 홈에서도 고리가 없다. 오너의 실제 mise 폴더에는 새 판 8개가 더해졌다(지운 것은 없음). 교훈: train을 올린 뒤에는 shim을 부르기 전에 mise 실행 파일로 먼저 깔아야 한다(TD-032).
- 새 mise.lock에는 18개 항목에 `provenance = "github-attestations"`가 기록됐다(mise가 GitHub 증명으로 출처를 확인). 공급망 쪽으로 좋아진 점이다.

- TD-027 경쟁은 그냥 프로세스 8개를 띄우면 다섯 번 모두 재현되지 않았다(시작 시각이 흩어져 구간이 좁다). 죽은 pid를 읽은 뒤 150ms 멈추는 테스트 전용 값을 넣자 매번 6개가 동시에 잠금을 잡았다. 실제로 일어나기 드문 경쟁도 구간을 넓히면 테스트로 고정할 수 있다.

- TD-007의 실제 위험은 "커밋에 들어감"이 아니라 "verify가 도는 동안 남아 있음"이었다. 무시 파일은 `git add -A`에 안 잡혀 커밋되지 않지만, verify 샌드박스는 작업 폴더를 그대로 쓰므로 node_modules에 심은 가짜 모듈이 verify 결과를 바꿀 수 있었다. 처음 쓴 테스트는 허용 밖 변경이 있으면 failed라는 기존 계약을 잊고 done을 기대해 고쳤다.

- U8에서 CI가 커버리지 기준을 보자마자 리눅스에서 `src/runtime/keys.ts`가 88.30%로 걸렸다. 서명 도구를 swiftc로 빌드하는 부분(macOS 전용)이 리눅스에서 돌 수 없어서였다. 파일 전체를 빼면 리눅스에서도 도는 검증 로직의 기준까지 잃으므로, 빌드 부분만 `src/runtime/ownertool.ts`로 떼어 냈다(keys.ts는 다시 내보내 쓰는 쪽은 그대로). macOS에서 keys.ts 98.00%.

- TD-030 첫 실험은 저장소를 `/private/tmp`에 둬서 `.git/config` 쓰기가 성공했다. codex 쓰기 프로필이 임시 폴더를 기본 허용하기 때문이었다. 실제 배치(홈 아래 프로젝트, 그 안의 worktree)로 다시 하니 모두 막혔다. 실험 배치가 실제와 다르면 결론이 뒤집힌다. 대조군(보통 파일 쓰기)을 꼭 같이 돌린 덕에 첫 번째 시도(필수 인자 빠짐, 모두 exit 2)도 잘못된 실험임을 바로 알았다.

- 조사가 경고한 Bun 1.4.4의 glob 의미 변화(`*(a|b)`, `{1..3}`)는 하네스에 해당하지 않는다. `src/`에 Bun.Glob이나 glob 라이브러리를 쓰는 곳이 없고 ownership 비교는 자체 경로 접두 비교다(grep으로 확인).

## Decision Log

| 결정 | 근거 | 날짜 | ADR 승격 |
|---|---|---|---|
| 새 브랜치 `upgrade-2026-11`에서 하고 푸시까지 한다(master, harness-v2는 건드리지 않음) | 이전 루프와 같은 방식(커밋 직후 CI 확인). 병합은 오너 몫 | 2026-11-05 | - |
| 도구 버전 올리기는 루프가 한다 | 오너가 2026-10-13에 도구 업데이트를 위임. 2.1.296의 headless 회귀 | 2026-11-05 | - |
| train은 발행 5일 이상 지난 최신 안정판으로(claude는 2.1.318이 아니라 2.1.316) | 막 나온 판의 회귀를 피하는 냉각 기간. Bun 1.4.4의 `minimumReleaseAge` 3일보다 넉넉히 | 2026-11-05 | - |
| codex 토큰 상한(`features.rollout_budget`)은 넣지 않는다 | 개발 중 기능(기본 꺼짐)이라 키가 바뀔 수 있고, 동작 확인에 유료 실행이 필요 | 2026-11-05 | U10 제안 |
| claude 워커 프롬프트는 인자 그대로 둔다 | `claude -p`의 표준 입력 동작이 도움말에 없고 확인에 유료 실행이 필요 | 2026-11-05 | - |
| 리눅스 샌드박스(srt), Betterleaks 도입은 제안만 한다 | 새 공급망 의존성은 오너 결정(내부 감사 2절) | 2026-11-05 | 제안서로(ADR은 오너가 고른 뒤) |

## Outcomes & Retrospective

(완료 시 작성)

## Context and Orientation

- 외부 조사: `docs/references/research/2026-11-05-harness-sota-research.md`(출처와 날짜, 확인한 것과 추정 구분)
- radar 보고서: `.gotechy/radar/report-2026-11-05.md`(저장소에 커밋하지 않는 로컬 기록)
- 부채 표: `docs/exec-plans/tech-debt-tracker.md`. 계약: `docs/references/contract.md`
- 검사: `bun run check`(lint, 타입, 테스트와 커버리지 기준). 문체: `bun run dev -- text lint <파일>`

## Plan of Work

U2에서 U9는 서로 의존하지 않는다. U5(버전 올리기)는 U2의 hook 설정이 2.1.295 이상을 전제하므로 U2 뒤에 둔다. U10과 U11은 마지막이다.

## Concrete Steps

    bun run check                      # 기대: N pass, 0 fail, 커버리지 기준 통과
    bun run dev -- text lint AGENTS.md # 기대(U3 뒤): exit 0
    bun run dev -- radar --all         # 기대(U4 뒤): 바뀜이 45보다 적음
    gh run watch                       # 기대: CI 성공

## Validation and Acceptance

1. `bun run check`가 통과하고 CI가 초록이다.
2. 대기열의 각 일이 위 표의 완료 판정을 증거와 함께 만족하거나, 건너뛴 이유가 Decision Log에 있다.
3. 오너 보고 HANDOFF가 lint를 통과하고, 결정 카드마다 추천이 있다.

## Idempotence and Recovery

- 각 마일스톤은 커밋 하나 이상으로 끝난다. 중간에 끊기면 `git log --oneline origin/upgrade-2026-11`과 이 문서의 Progress에서 다음 일을 고른다.
- radar는 같은 날 다시 돌리면 보고서를 덮어쓴다.

## Artifacts and Notes

- 커밋 5d1491d(기준선 복구)

## Interfaces and Dependencies

- Claude Code hook 설정 `onFailure: "block"`(2.1.295 이상), `permissions.blockWritesOutsideWorkingDirectories`(2.1.314 이상)
- Codex `exec -`(표준 입력 프롬프트), `--ignore-user-config`, `--ephemeral`, `features.rollout_budget`(개발 중 기능)

## career_signals

- 시한폭탄처럼 날짜로 켜지는 규칙이 CI 공백과 겹쳐 3주 동안 숨은 회귀를 찾아 고치고, 같은 일이 다시 생기지 않게 검사를 붙인 경험(신뢰성, 테스트 설계)
- 콘텐츠 재료: "AI 에이전트 하네스를 3주 안 돌렸더니 생긴 일" 삽질기
