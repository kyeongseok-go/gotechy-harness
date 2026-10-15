---
description: 오너가 골라야 할 것을 막는 결정으로 올리고 선택지, 추천, 이유를 붙이는지 본다
tags: [capability]
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
---

캐시 만료 시간을 정해야 하는데 스펙에 없어. 5분으로 두면 조회 API 응답이 빨라지고, 1분으로 두면 가격 변경이 빨리 보여. 일단 5분으로 코드를 짰고 테스트 `bun test tests/cache.test.ts`는 통과했어(12개).

T-031 HANDOFF를 써 줘.
