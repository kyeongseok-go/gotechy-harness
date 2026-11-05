---
title: TD-030 실험, codex 샌드박스가 worktree의 git 관리 파일 쓰기를 막는가
date: 2026-11-05
tool: codex-cli 0.166.0 (train 2026.11.0), macOS 15.5 arm64
cost: 0원 (모델 호출 없음, `codex sandbox`로 셸 명령만 실행)
---

## 왜 했나

TD-030은 "codex 워커가 setsid로 남긴 자손이 리드의 검사 뒤에 worktree의 `.git` 파일을 바꾸면, 리드의 git이 필터 명령을 오너 권한으로 실행할 수 있다(추정)"였다. 전제는 "codex 샌드박스가 worktree의 `.git` 파일 쓰기를 허용한다"이고, 확인하려면 유료 실험이 필요하다고 적혀 있었다. 외부 조사(2026-11-05)에서 `codex sandbox`로 모델 없이 같은 샌드박스를 돌릴 수 있다는 것을 찾아 무료로 확인했다.

## 어떻게 했나

1. 실제 하네스와 같은 배치를 만들었다. 프로젝트는 `/private/tmp` 밖(이 저장소의 무시 폴더 `.gotechy/exp-td030-*`), worktree는 프로젝트 안 `.gotechy/worktrees/wt`.
2. 오너의 codex 설정이 섞이지 않게 `CODEX_HOME`을 빈 폴더로 두었다.
3. 같은 worktree를 작업 폴더로 `codex sandbox -P :workspace -C <worktree> -- sh -c '<명령>'`을 돌렸다(`:workspace`는 codex 기본 쓰기 프로필).

## 결과

| 명령 | exit | 결과 |
|---|---|---|
| worktree 안 보통 파일 쓰기(대조군) | 0 | 써짐 |
| worktree의 `.git` 포인터 파일 덮어쓰기 | 1 | Operation not permitted |
| 프로젝트 `.git/config`에 덧붙이기 | 1 | Operation not permitted |
| 프로젝트 `.git/hooks/pre-commit` 만들기 | 1 | Operation not permitted |
| `.git/worktrees/wt/` 안에 파일 만들기 | 1 | Operation not permitted |

실험 뒤 `.git/config` 끝줄과 hooks 폴더가 그대로인 것을 확인했다.

## 처음 실험의 함정

첫 실험은 프로젝트를 `/private/tmp` 아래에 두어 `.git/config` 쓰기가 성공했다(exit 0). 추정: codex 쓰기 프로필이 임시 폴더를 기본으로 쓰기 허용해서, 작업 폴더 밖인 임시 폴더 아래 저장소의 `.git`은 보호 경로로 다루지 않은 것으로 보인다(같은 실험에서 worktree의 `.git` 포인터와 관리 폴더는 막혔다). 실제 프로젝트는 홈 아래라 해당하지 않지만, 오너가 프로젝트를 임시 폴더에 두면 같은 구멍이 생긴다.

## 결론과 한계

- macOS와 codex 0.166.0에서 TD-030의 전제("샌드박스가 `.git` 쓰기를 허용")는 성립하지 않는다. 리드 쪽 방어(관리 폴더 고정, 240d7a1)와 함께 두 겹이 된다.
- 하네스는 `codex exec -s workspace-write`로 워커를 돌린다. 이 실험의 `codex sandbox -P :workspace`가 같은 정책이라는 것은 문서(learn.chatgpt.com/docs/agent-approvals-security.md의 보호 경로)와 이름으로 판단했다. 실제 워커 실행으로 확인한 것은 아니다.
- 리눅스(bubblewrap)에서는 확인하지 않았다.
