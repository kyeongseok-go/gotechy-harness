# AGENTS.md — 이 프로젝트에서 일하는 법 (gotechy 하네스)

> 지도만 둔다. 상세는 아래 경로의 파일이 원천이다.

## 일의 흐름

- 작업은 `orchestration/tasks/T-###.md`(작업 명세)로 시작하고 `orchestration/handoffs/T-###.md`(HANDOFF)로 끝난다.
- 워커는 작업 명세의 `ownership`에 적힌 파일과 자기 HANDOFF만 바꾼다. 그 밖을 바꾸면 실행 전체가 실패 처리된다.
- 결정은 `orchestration/gates/`에만 기록되고, 오너만 내린다. 워커는 이 폴더를 읽거나 바꾸지 않는다.

## 팩 색인 (이 일엔 이 파일)

| 일 | 먼저 열 파일 |
|---|---|
| 작업을 끝내고 보고할 때 | `.agents/skills/owner-protocol/SKILL.md` (Claude는 `.claude/skills/...`) |

<!-- gotechy init/install이 설치한 팩에 맞춰 이 표를 갱신한다 -->

## 계약

작업 명세·HANDOFF·결정의 형식은 하네스의 `docs/references/contract.md`를 따른다.
