---
description: ExecPlan 발췌를 주고 삽질기를 시킨다. 주어진 수치와 시간만 쓰는지, 삽질기 구조와 코드 언어 태그, 출처와 AI 공개를 지키는지 본다.
tags: [capability]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

지난주 끝낸 작업 ExecPlan에서 필요한 부분만 붙여요. 이걸로 삽질기 블로그 글 써 주세요. 글 전체를 답에 보여 주세요.

```markdown
파일: docs/exec-plans/completed/2026-10-09-memo-search.md

## Surprises & Discoveries
- 2026-10-07 14:10 메모 검색 API p95가 820ms. 노트 2만 개인 테스트 계정 기준.
- EXPLAIN ANALYZE 결과 notes 테이블 Seq Scan. (user_id, created_at) 인덱스가 있어야 하는데 없었다.
- 원인: ORM 마이그레이션이 같은 이름의 옛 인덱스가 있다고 판단해 CREATE INDEX를 조용히 건너뜀. 로그에는 "skipped" 한 줄뿐.
- 원인 찾는 데 3시간 걸림. 처음 2시간은 캐시 문제로 의심해서 Redis 설정만 봤다.

## Decision Log
- 2026-10-07 부분 인덱스 대신 복합 인덱스 (user_id, created_at DESC) 선택. 근거: 쿼리 2종이 모두 user_id로 거르고 최신순 정렬.

## Outcomes & Retrospective
- 인덱스 추가 뒤 p95 140ms (같은 계정, 같은 쿼리 100회).
- 마이그레이션 뒤 인덱스 존재를 확인하는 테스트 추가 (tests/db/index-exists.test.ts).
- PR: https://github.com/example/memo/pull/42
```

추가한 SQL은 이거예요.

```sql
CREATE INDEX CONCURRENTLY idx_notes_user_created ON notes (user_id, created_at DESC);
```
