---
name: owner-protocol
description: Report format and writing style for every delegated gotechy task. Use when finishing a task, writing a HANDOFF under orchestration/handoffs/, or summarizing work for the owner. Decisions first, one-line summary, verified facts separated from guesses, new industry terms explained, no machine-like phrasing, and always ends with what was skipped, unverified, or risky. Not for casual chat.
---

# owner-protocol: 오너에게 보고하는 법

오너는 HANDOFF만 보고 이해하고 결정한다. 그래서 보고는 결정, 요약, 근거, 리스크 순서로 짧고 정확해야 한다. 형식의 원천은 `docs/references/contract.md` 4절(형식)과 7절(문체)이다. `gotechy handoff lint`가 같은 규칙으로 검사한다.

## 반드시

1. 8개 절을 계약 순서 그대로 쓴다. 내용이 없으면 "없음".
2. "결정 필요"에는 오너가 골라야 할 것만 둔다. `- [막는]`, `- [기본값]`, `- [알림]` 표지를 붙이고, 막는 결정과 기본값 결정에는 하위 항목으로 선택지(2개 이상), 추천(선택지 중 하나), 이유(한 줄)를 단다. 막는 결정은 3개까지이고, 하나라도 있으면 status는 `needs-decision`이다. 더 많으면 작업을 쪼개 달라고 쓴다.
3. "한 줄 요약"은 60자 이내 한 문장.
4. "한 일"과 리스크 절의 각 항목 끝에 `[확인]`(직접 실행하고 확인), `[추론]`(확인한 사실을 이어 판단), `[추정]`(근거 없음) 중 하나를 붙인다.
5. "증거"는 실제로 실행한 것만 `` `명령`: 결과`` 형식으로 쓴다. 실행하지 못했으면 리스크 절에 그렇게 쓴다.
6. 리스크 절("건너뛴 것, 확인 못 한 것, 리스크")은 3개까지. 숨기지 않는다.
7. 처음 쓰는 현업 영어 용어는 그대로 쓰고 "새 용어"에 `- 용어: 쉬운 설명`으로 풀이를 남긴다. 오너가 익히는 데 쓴다.

## 문체

- 한국어 해요체로 쓴다. 문단은 결론부터 쓰고, 숫자와 사실로 구체적으로 쓴다.
- 화살표, em-dash, 가운데점, 이모지를 쓰지 않는다. 쉼표와 문장으로 이어 쓴다.
<!-- style-ignore-start -->
- 번역투("에 대해", "를 통해", "되어진")와 상투어("결론적으로", "주목할 만하다")를 피한다.
<!-- style-ignore-end -->

## 하지 않는다

- 범위를 넓히거나 요청하지 않은 기능과 추상화를 더하지 않는다.
- 확신 없는 결정을 임의로 내리지 않는다. 결정 필요로 올리고 status를 `needs-decision`으로 둔다.
- 결정 파일(`orchestration/gates/`)과 작업 명세(`orchestration/tasks/`)를 건드리지 않는다.
