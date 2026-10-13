# 0003. 오케스트레이션: 파일 계약이 원천, 어댑터는 Orca와 native 둘

- 상태: 승인됨
- 날짜: 2026-10-14 (결정 D7, 2026-10-13)
- 관련: [계약 문서](../references/contract.md), [설계 문서 12절 D7](../design-docs/2026-10-13-expert-library-v0.md), [1a ExecPlan M0, M1](../exec-plans/active/2026-10-13-harness-v2-phase1.md)

## 맥락

여러 에이전트(Claude Code, Codex)에게 일을 나눠 맡기고 결과를 사람이 결정하는 흐름이 필요하다. 실행 도구는 GUI(Orca), 원격, 터미널, CLI만 있는 환경까지 다양하고 자주 바뀐다. 도구를 바꿀 때마다 작업 기록과 결정이 사라지면 안 된다.

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| A. 파일 계약(task, HANDOFF, gate) + 어댑터 2개(Orca 주력, native 최저공통분모) (선택) | 도구가 바뀌어도 기록이 남는다. native만으로도 끝까지 돈다 | 계약을 직접 정의하고 검사해야 한다 |
| B. Orca 하나에 의존 | 기능이 많다(DAG, 게이트, SSH) | 잦은 릴리스, Orca가 없는 환경(회사 PC)에서 멈춘다 |
| C. herdr 같은 다른 오케스트레이터 추가 | 선택지가 늘어난다 | 어댑터 유지 비용. 반복 수요가 아직 없다 |

## 결정

A. 원천은 프로젝트 저장소의 `orchestration/` 파일이다. 실행 도구는 실행만 맡는다. 어댑터는 Orca 1개와 native 1개(백엔드 claude, codex)이고, 1a는 native만 구현한다. 병렬은 3개 이하. herdr는 반복 수요가 생길 때만 더한다.

## 결과 (Consequences)

- 쉬워지는 것: 워커 백엔드가 달라도 같은 HANDOFF 형식과 lint를 쓴다. 실제로 Claude(restricted, 명령 실행 없음)와 Codex(셸 있음)가 같은 계약으로 끝까지 돌았다(M1 증거).
- 어려워지는 것: 도구별 권한 설정만으로는 격리가 안 된다. M0에서 Codex 샌드박스가 결정 파일을 실제로 바꿨고, 2026-10-14 보안 감사에서 verify가 워커 코드를 오너 권한으로 실행하는 문제가 나왔다. 그래서 백엔드와 무관하게 worktree 격리, 보호 경로 되돌리기, 심볼릭 링크 거부, 샌드박스 verify를 리드가 강제한다.
- 새 제약: 계약이 바뀌면 `docs/references/contract.md`를 먼저 고치고 코드를 맞춘다.
