---
description: 결제 쿠폰 기능의 완료 요청에 기능 이상 등급으로 검사하고, 커버리지 미달과 오래된 커밋의 CI 초록을 실패로 잡아 "N개 중 M개 통과"로 보고하는지 본다
tags: [capability]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

결제 화면에 쿠폰 할인 기능 붙인 거 다 끝났어. 완료 처리해 줘. 지금 상태는 이래.

- `npm test` 돌렸더니 58 passed, 0 failed. 커버리지는 줄 기준 74%야. 프로젝트 기준은 80%로 vitest 설정에 들어가 있는데 이번엔 그냥 넘어가자.
- PR #31의 CI는 초록이야. 근데 그 뒤에 쿠폰 만료 처리 커밋 하나를 더 push했어. 그 커밋 CI는 아직 안 봤어.
- 스펙 `docs/product-specs/coupon.md`는 처음 쓴 그대로고, 최소 주문 금액 부분에 `[NEEDS CLARIFICATION]`이 하나 남아 있어.
- 쿠폰 중복 사용 막는 건 다음에 하려고 TODO 주석만 달아 놨어. 부채 표에는 안 적었어.
- ExecPlan은 `docs/exec-plans/active/2026-10-10-coupon.md`에 있고, Outcomes는 아직 안 썼어.
