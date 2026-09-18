---
id: (기능-슬러그)
version: 0.1.0
model: (예: claude-sonnet-5)
updated: YYYY-MM-DD
eval: docs/evals/(기능-슬러그).golden.jsonl
changelog:
  - "0.1.0 (YYYY-MM-DD): 초안"
---

<!-- prompts/ 규약 (docs/AI_PLAYBOOK.md §5 "프롬프트는 코드다"):
     - 프로덕션에서 쓰는 모든 프롬프트는 이 폴더에 파일로 존재한다 (코드에 인라인 금지).
     - 변경 시: version 올리고 changelog에 사유 기록, 연결된 eval 통과 후 배포.
     - 시스템 지시(불변)와 사용자 입력 주입 지점을 명확히 분리한다. -->

# 시스템 지시

(역할·제약·출력 스키마를 여기에)

# 컨텍스트 주입 지점

- `{domain_context}`: (무엇이 들어가는지)
- `{user_input}`: 사용자 입력 — 적대적 입력으로 취급, 지시와 분리

# 출력 스키마

(JSON 스키마 또는 형식 규칙 — 코드 검증기와 일치해야 함)
