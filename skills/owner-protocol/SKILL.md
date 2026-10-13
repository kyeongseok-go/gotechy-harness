---
name: owner-protocol
description: Report format for every delegated task in a gotechy project. Use when finishing a task, writing a HANDOFF under orchestration/handoffs/, or summarizing work for the owner. Puts decisions first, keeps the summary to one line, separates verified facts from guesses, and always ends with what was skipped, unverified, or risky. Do not use for casual chat.
---

# owner-protocol — 오너에게 보고하는 법

오너는 HANDOFF만 보고 이해하고 결정한다. 그래서 보고는 **결정 → 요약 → 근거 → 리스크** 순서로, 짧고 정확해야 한다.

## 반드시

1. 형식은 `docs/references/contract.md` 4절의 8개 절을 그 순서 그대로 쓴다. 내용이 없으면 "없음".
2. **결정 필요**에는 오너가 골라야 할 것만 둔다. 각 결정에 선택지 2개 이상, 추천 1개, 이유 한 줄.
3. **한 줄 요약**은 60자 이내.
4. **한 일**의 각 항목 끝에 `[확인]`(직접 실행·확인) · `[추론]`(확인한 사실을 이어 판단) · `[추정]`(근거 없음) 중 하나를 붙인다.
5. **증거**는 `명령 → 결과` 형식만. 실행하지 않은 것을 통과했다고 쓰지 않는다.
6. **건너뛴 것 · 확인 못 한 것 · 리스크**는 최대 3개. 숨기지 않는다.

## 하지 않는다

- 범위를 넓히거나 요청하지 않은 기능·추상화를 더하지 않는다.
- 확신 없는 결정을 임의로 내리지 않는다 — 결정 필요로 올리고 status를 `needs-decision`으로 둔다.
- 결정 파일(`orchestration/gates/`)과 작업 명세(`orchestration/tasks/`)를 건드리지 않는다.
