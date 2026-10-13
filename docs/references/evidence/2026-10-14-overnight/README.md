---
title: 밤샘 자율 실행 보고 (2026-10-14 밤)
date: 2026-10-14
type: report
audience: 고텍이
tags: [gotechy-harness, overnight, handoff]
---

# 밤샘 자율 실행 보고 (2026-10-14 밤)

아침에 여기서 시작하세요. 루프 설계는 [`docs/exec-plans/active/2026-10-14-overnight-loop.md`](../../../exec-plans/active/2026-10-14-overnight-loop.md)에 있어요.

## 3초 요약

M2c(결정 서명, 이해 게이트, 병합), M3의 격리 환경 부분(train, doctor, setup, gitleaks hook, 부트스트랩), ADR 4건, 1b ExecPlan 초안을 끝냈어요. 보안 감사를 네 번(M2c 세 바퀴, M3 한 번) 돌려 높음 8건을 찾았고, 모두 공격 테스트로 재현한 뒤 고쳤어요. 결정이 필요한 것은 4건이에요.

## 보는 법

이 폴더에서 오늘 만든 인박스와 화면으로 볼 수 있어요.

```text
cd docs/references/evidence/2026-10-14-overnight
gotechy inbox
gotechy render        # 마지막 줄의 file:// 주소를 브라우저로 열기
```

`gotechy`가 PATH에 없으면 저장소 루트에서 `bun src/cli.ts inbox`처럼 실행하세요(이 폴더에서는 `bun ../../../../src/cli.ts inbox`).

## 결정이 필요한 것

| 작업 | 질문 | 추천 |
|---|---|---|
| T-002 | 밤사이 `harness-v2`에 푸시한 커밋을 그대로 둘까요? | 그대로 두기 |
| T-003 | 선행 작업 조건을 done에서 accepted(메인에 병합됨)로 바꾼 것을 받아들일까요? | accepted 유지 |
| T-006 | 이 맥에 실제로 `gotechy setup`을 적용하고 되돌려 보는 실측을 언제 할까요? | 오늘 오너와 함께 |
| T-007 | 1b ExecPlan의 범위와 순서를 승인할까요? | 승인 |

기본값으로 진행한 것(이의가 있으면 말해 주세요): 게이트 상태 rejected 없애기(T-002), 이해 게이트에서 빈 답 받기(T-003), ADR 0005 상태(T-005), setup이 Claude Code 전역 설정에 결정 명령 실행 금지를 넣기(T-006), 오너 인증 방식으로 Secure Enclave(T-007).

## 한 일 (작업별 HANDOFF)

| 작업 | 내용 | HANDOFF | 설명 문서 |
|---|---|---|---|
| T-001 | M2b 인박스와 읽기 전용 화면 (자기 전에 보고한 것) | `orchestration/handoffs/T-001.md` | `explain/m2b-inbox-and-render.md` |
| T-002 | M2c-1 결정 서명과 검증 | `orchestration/handoffs/T-002.md` | `explain/m2c-1-decision-signing.md` |
| T-003 | M2c-2 이해 게이트, 병합, 용어 누적 | `orchestration/handoffs/T-003.md` | `explain/m2c-2-comprehension-and-accept.md` |
| T-004 | M2 보안 리뷰 두 바퀴 | `orchestration/handoffs/T-004.md` | `explain/security-review-rounds.md` |
| T-005 | ADR 0002~0005 | `orchestration/handoffs/T-005.md` | ADR 본문 |
| T-006 | M3 설치 계층 중 격리 환경 부분 | `orchestration/handoffs/T-006.md` | `explain/m3-install-layer.md` |
| T-007 | 1b ExecPlan 초안 | `orchestration/handoffs/T-007.md` | ExecPlan 본문 |

## 숫자

- 테스트: 115개(밤 시작)에서 258개로. 전체 통과, 줄 커버리지 약 95%. gitleaks가 없는 CI에서는 그 5개를 건너뛰어요.
- 보안 감사: M2c 1차 높음 3, 중간 3, 낮음 4. 2차(1차 수정의 재검토) 높음 3, 중간 1, 낮음 2. 3차(2차 수정의 재검토) 높음 1, 중간 1, 낮음 4. M3 리뷰 높음 1, 중간 4, 낮음 6. 높음 8건과 중간은 모두 고침.
- mutation check: 방어 코드를 하나씩 뺀 53종(결정 서명 11, 감사 1차 수정 10, 2차 9, 3차 5, 설치 계층 7, M3 리뷰 수정 11) 모두 테스트가 잡음. 중간에 세 번 살아남아 테스트를 보강함.
- 용어 은행: 69개에서 88개로.
- 이 맥의 `doctor` 진단(읽기만 함): 실패 9건. mise, bun, apm, gitleaks가 전역 PATH에 없고, node, uv, gh가 train보다 오래됐고, 정책 두 파일이 빠져 있어요. claude, codex, orca는 train과 같아요.

## 못 한 것, 확인 못 한 것

- M3 중 이 맥에 실제 `setup` 적용과 복원(Validation 14 실측), 격리 셸 처음 설치(Validation 12), `init`의 apm 전환은 오너와 함께 할 일로 남겼어요.
- `decide`를 Ctrl-C로 멈추는 경우는 가상 터미널 실험으로 확인했어요(잠금 해제, 기록 없음). 실제 터미널 앱에서 손으로 누른 확인은 아직이에요.
- 3차와 M3 수정에 대한 다음 감사는 돌리지 않았어요.
- CLAUDE.md의 위키 경로가 이 맥에 없어서, 설명 문서는 frontmatter만 달고 위키에 넣지 않았어요.

## 밤사이 커밋 (harness-v2, 모두 CI 확인)

| 시각 | 커밋 | 내용 |
|---|---|---|
| 00:24 | 107b08d | M2a HANDOFF 규칙과 문체 검사 (자기 전) |
| 00:53 | 7d7e6e3 | M2b 인박스와 읽기 전용 화면 (자기 전) |
| 01:55 | 8a71f2e | M2c 결정 서명, 이해 게이트, accept, 보안 감사 두 바퀴 수정 |
| 01:56 | 3528bdf | 밤샘 루프 계획에 Validation 절 추가 (8a71f2e의 CI 실패 수정) |
| 02:12 | d57a70d | M3 격리 환경 부분 |
| 02:17 | 9feff20 | Ctrl-C 실험 기록, 커버리지 보강, M2b 설명 문서 |
| 02:32 | 7a66d0c | M3 보안 리뷰와 M2c 3차 확인 지적 수정 |

## 하지 않은 것 (규칙대로)

이 맥에 실제 `setup` 적용, 실제 `~/.gotechy` 키 생성, `~/.claude`와 `~/.codex` 설정 수정, force push, 외부 발행, 위키 적재, 유료 워커 실행은 하지 않았어요. 푸시는 지금까지처럼 `harness-v2` 브랜치에 마일스톤마다 했어요.
