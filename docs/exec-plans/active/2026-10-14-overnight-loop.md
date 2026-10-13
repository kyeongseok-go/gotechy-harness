---
title: 밤샘 자율 실행 루프 (2026-10-14 밤)
status: active
parent: docs/exec-plans/active/2026-10-13-harness-v2-phase1.md
mode: overnight
---

# 밤샘 자율 실행 루프

오너(고텍이)가 자는 동안 리드(Claude Code, Opus 5.5 xhigh)가 혼자 진행한다. 이 문서는 무엇을, 어떤 순서로, 어떤 검사를 거쳐, 어디서 멈추는지 정한다. 하네스 설계의 D14 "overnight" 모드를 사람이 직접 한 번 돌려 보는 시험이기도 하다.

## 목표

1a ExecPlan의 남은 일 중 오너 없이 안전하게 할 수 있는 것을 끝내고, 아침에 오너가 HANDOFF와 설명 문서만 보고 이해하고 결정할 수 있게 한다.

## 작업 대기열 (위에서부터)

| 순서 | 일 | 완료 판정 |
|---|---|---|
| 1 | M2c-1 결정 서명: `keys init`, `keys rotate`, `decide`, `gate verify`, `run`의 강제 | Validation 8, 9, 11 테스트 통과 |
| 2 | M2c-2 반영: 이해 게이트, 측정 필드, `accept`, 프로젝트 용어 은행 누적 | Validation 10, 11b 테스트 통과 |
| 3 | M2 보안 리뷰(security-auditor, 읽기 전용)와 지적 사항 수정 | 높음 등급 지적 0건 남음, 나머지는 부채로 기록 |
| 4 | ADR 4건: D5 배포, D7 오케스트레이션, D13 train, 결정 서명 방식 | `docs/decisions/0002`~`0005` |
| 5 | M3 중 격리 환경 부분: `doctor`, `train.yaml`, `setup --dry-run`, 백업과 복원(임시 HOME만) | Validation 13, 15 테스트 통과 |
| 6 | 1b ExecPlan 초안 | `docs/exec-plans/active/`에 초안, 오너 검토 대기 표시 |

## 마일스톤마다 도는 루프

1. 계약 먼저: `docs/references/contract.md`에 동작을 적는다.
2. RED: 수용 테스트를 쓰고 실패를 확인한다.
3. GREEN: 구현한다.
4. 검사: `bun run check`(biome, tsc, 전체 테스트).
5. mutation check: 핵심 방어 코드를 일부러 망가뜨려 테스트가 잡는지 본다.
6. 적대적 리뷰: 서브에이전트(security-auditor 또는 spec-reviewer)에게 diff를 보이고 지적을 받는다.
7. 수정 후 4번부터 다시. 리뷰 지적 중 고치지 않은 것은 이유와 함께 부채나 리스크로 남긴다.
8. 기록: ExecPlan 진행 칸, Surprises, Decision Log, Validation. 그리고 HANDOFF 1건과 설명 문서 1건.
9. 커밋, harness-v2에 푸시, CI 결과 확인.

## 멈춤 규칙

- 같은 문제로 루프가 3번 실패하면 그 마일스톤을 멈추고 HANDOFF를 `failed`로 쓴 뒤, 의존하지 않는 다음 일로 넘어간다.
- 오너만 정할 수 있는 결정(되돌리기 어렵거나 취향의 문제)은 되돌릴 수 있는 기본값으로 진행하고 HANDOFF의 `[기본값]` 결정으로 올린다. 기본값으로도 진행할 수 없으면 `[막는]` 결정으로 올리고 그 일은 건너뛴다.
- CI가 실패하면 다음 일로 가기 전에 고친다.

## 하지 않는 것

- 이 맥에 실제 `setup` 적용, 실제 `~/.gotechy` 키 생성, `~/.claude`와 `~/.codex` 설정 수정(Validation 14의 실제 적용은 오너와 함께)
- force push, 외부 발행, 위키 적재, 배포
- 실제 Claude나 Codex 워커를 부르는 유료 실행. 반복 검증은 fake 어댑터와 임시 저장소로 한다.

## Validation and Acceptance

1. 아침 보고 폴더에서 `gotechy inbox`를 실행하면 작업마다 카드가 나오고, `gotechy handoff lint orchestration/handoffs/*.md`가 모두 오류 없이 통과한다.
2. 끝낸 마일스톤마다 `bun run check`가 통과한 커밋이 harness-v2에 있고, 그 커밋의 CI가 성공이다.
3. 작업 대기열의 각 항목은 완료 판정을 통과했거나, HANDOFF에 멈춘 이유와 다음 단계가 있다.
4. "하지 않는 것"에 적은 일이 하나도 일어나지 않았다(아침 보고에 그렇게 적는다).

## 결과 (2026-10-14 02:35)

- 대기열 1~6을 모두 진행했다. 5번(M3)은 격리 환경 부분만 끝냈고, 이 맥에 실제 적용하는 실측은 규칙대로 남겼다.
- 마일스톤마다 적대적 리뷰를 받았다. M2c는 세 바퀴(높음 3, 3, 1), M3는 한 번(높음 1)이었다. 모든 지적을 실패하는 재현 테스트로 먼저 고정하고 고쳤다.
- 멈춘 이유: 대기열이 끝났고, 감사를 더 돌리면 바퀴마다 새 지적이 나와 끝이 없다. 다음 감사는 1b 착수 전에 오너와 범위를 정해 돌린다.
- CI 실패 1번(ExecPlan 위생 검사)은 다음 커밋에서 고쳤다. 나머지 커밋은 모두 CI 성공.
- "하지 않는 것"에 적은 일은 하지 않았다. 실제 `~/.gotechy`는 만들어지지 않았고, 이 저장소의 hooksPath도 그대로다.

## 아침 보고

- 입구: `docs/references/evidence/2026-10-14-overnight/README.md`
- HANDOFF: 같은 폴더의 `orchestration/handoffs/T-###.md`. 그 폴더에서 `gotechy inbox`, `gotechy render`로 볼 수 있다.
- 설명 문서: 같은 폴더의 `explain/`. 위키에 넣을 수 있게 frontmatter를 단다(적재는 하지 않는다).
