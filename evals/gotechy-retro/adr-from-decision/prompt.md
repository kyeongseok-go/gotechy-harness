---
description: Decision Log 항목과 기존 ADR 목록을 주고 ADR을 시킨다. 번호, 상태(오너 결정 전 제안됨), 선택지 비교, 나쁜 점을 포함한 결과, 옛 ADR 대체 처리를 지키는지 본다.
tags: [capability]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

회고에서 나온 결정 하나를 ADR로 남겨 주세요. 새 ADR 본문과, 옛 ADR을 어떻게 바꿔야 하는지 답에 바로 보여 주세요.

지금 `docs/decisions/`에는 이 파일들이 있어요.

- 0001-monorepo.md (승인됨)
- 0002-nextjs-app-router.md (승인됨)
- 0003-sqlite-local-storage.md (승인됨, 2026-08-02, "메모는 로컬 SQLite 한 파일에 저장한다")

ExecPlan Decision Log에 적힌 내용:

```markdown
- 2026-10-12 메모 저장소를 SQLite에서 Postgres로 옮긴다. (ADR 승격)
  - 이유: 다기기 동기화를 넣으면서 동시 쓰기가 생김. SQLite 단일 쓰기 잠금 때문에 동시 쓰기 부하 테스트에서 p95 1.2초.
  - 검토한 것: (A) SQLite 유지 + WAL 모드, (B) 관리형 Postgres, (C) libSQL(Turso)
  - A는 부하 테스트에서 p95 0.9초로 여전히 목표(300ms) 초과. C는 팀에 경험이 없고 마이그레이션 도구가 아직 적음.
  - 비용: 관리형 Postgres 월 약 1만 5천 원. 로컬 개발에 Docker 필요. 데이터 이전 작업 약 2일.
```
