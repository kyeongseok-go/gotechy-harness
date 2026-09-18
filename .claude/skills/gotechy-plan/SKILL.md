---
name: gotechy-plan
description: |
  확정된 스펙을 ExecPlan(실행 계획)으로 변환하거나 기존 ExecPlan을 갱신한다.
  사용자가 "계획 세워줘", "ExecPlan", "실행 계획", "이거 어떻게 진행할지 정리해줘"라고 하거나,
  1시간 이상 걸릴 복잡한 작업을 시작할 때 사용한다. docs/PLANS.md 헌법을 따른다.
argument-hint: "[스펙 파일명 또는 작업 설명]"
---

# /gotechy-plan — 스펙 → ExecPlan

## 절차

1. **입력 확인** — 대상 스펙(`docs/product-specs/`)이나 작업 설명을 확인한다. 스펙이 없는 큰 작업이면 `/gotechy-spec` 먼저 할지 사용자에게 확인한다.
2. **분할 판정 (50% 증후군 방어)** — 예상 기간을 산정한다. **2주 초과면 반드시 분할을 제안**하고, 각 조각이 독립적으로 완료 가능(동작+검증)하게 나눈다.
3. **ExecPlan 작성** — `docs/exec-plans/_template-exec-plan.md`를 복사해 `docs/exec-plans/active/YYYY-MM-DD-<슬러그>.md` 생성.
   - Plan of Work의 첫 마일스톤은 tracer bullet (끝까지 가는 가장 얇은 경로).
   - Validation and Acceptance는 실행 가능한 명령과 예상 출력으로.
   - Context and Orientation에 관련 파일·문서를 실경로로 나열 (새 세션의 에이전트가 이것만 보고 시작 가능해야 함).
4. **리뷰** — spec-reviewer 에이전트에게 계획의 순서·누락·리스크를 리뷰받는다.
5. **작업 중 의무** — 이 계획으로 작업하는 모든 세션은:
   - 진척 시 Progress에 타임스탬프 체크
   - 예상과 다른 발견은 즉시 Surprises & Discoveries에 (블로그 재료가 된다)
   - 결정은 Decision Log에
6. **완료 시** — `/gotechy-ship`으로 완료 게이트를 통과시킨다.

## 완료 기준

- ExecPlan 파일 생성 + 리뷰 반영. 사용자에게 마일스톤 목록과 첫 실행 명령을 보고한다.
