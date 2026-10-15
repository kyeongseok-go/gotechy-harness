# 0007. Orca는 오너의 화면과 알림에만 쓰고, 워커 실행은 native로 둔다

- 상태: 승인됨
- 날짜: 2026-10-16
- 대체: [0003](0003-orchestration-file-contract-adapters.md)의 "어댑터는 Orca 주력과 native 둘" 중 Orca 워커 어댑터 부분. 파일 계약이 원천이라는 결정은 그대로다.
- 관련: [1b ExecPlan N5](../exec-plans/active/2026-10-14-harness-v2-phase1b.md), 오후 루프 보고 T-007(`docs/references/evidence/2026-10-15-afternoon/orchestration/handoffs/T-007.md`)

## 맥락

0003은 Orca를 주력 어댑터로 두고 1a에서는 native만 만들기로 했다. 1b N5를 앞두고 Orca 1.4.209의 도움말을 읽어 보니(2026-10-15 오후 루프, 워커 실행 없음), Orca 워커는 `orchestration worker-start --agent`로 띄우는 대화형 에이전트였다. gotechy가 워커에 거는 격리(claude `--restricted`와 거부 규칙, codex `workspace-write`, 허용 목록 환경 변수, 비용 상한)를 Orca 워커에는 그대로 걸 수 없다. worktree는 `path:`로 넘길 수 있어 보호 경로 검사와 verify 샌드박스는 쓸 수 있을 것으로 봤지만, 실제 실험은 유료라 하지 않았다.

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| A. Orca는 화면과 알림에만, 워커 실행은 native (선택) | 지금의 격리(보안 감사 1~14차로 다진 것)를 그대로 쓴다. Orca가 없는 환경에서도 같은 길로 돈다 | Orca의 DAG, 게이트, 원격 실행 기능을 워커 실행에 쓰지 않는다 |
| B. 격리를 낮추고 Orca 워커도 쓰기 | Orca 화면에서 워커를 보고 원격 실행을 쓴다 | 대화형 에이전트에 거부 규칙과 비용 상한을 걸 수 없다. 격리가 백엔드마다 달라진다 |

## 결정

A. 오너가 T-007의 추천안을 골랐다(2026-10-16). 워커는 native 어댑터(claude, codex)로만 띄운다. Orca는 오너가 일하는 화면(터미널, 내장 브라우저로 HANDOFF 화면 보기)과 알림 쪽에서만 쓴다. Orca의 게이트(`gate-create`, `gate-resolve`)에는 서명이 없으므로 결정의 원천은 계속 gotechy 게이트다.

## 결과 (Consequences)

- 쉬워지는 것: 격리 약속이 하나다. 1b N5의 범위가 "Orca 워커 어댑터"에서 "Orca 화면 연결"로 줄어든다.
- 어려워지는 것: 원격 기계에서 워커를 돌리려면 다른 길이 필요하다(지금은 수요 없음).
- 다시 볼 때: Orca가 워커에 비대화형 모드와 권한 거부 규칙을 넘기는 방법을 내면, 같은 격리 테스트(`tests/e2e/`의 보호 경로, 링크, 샌드박스)를 Orca 워커로 돌려 통과할 때 다시 검토한다.
