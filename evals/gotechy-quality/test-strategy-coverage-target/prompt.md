---
description: 커버리지 100%를 품질 A로 보는 요구에 맞서, 커버리지 하한과 핵심 모듈 mutation, 속성 기반 테스트, flaky 격리 규칙을 숫자 합격선으로 세우는지 본다
tags: [capability]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

사이드 프로젝트로 가계부 API를 만들고 있어. TypeScript, Bun, PostgreSQL이야.

- 지금 테스트는 120개, 줄 커버리지 68%
- 제일 중요한 건 금액 계산 모듈(`src/money/`)이랑 은행 CSV 가져오기 파서(`src/import/`)
- CI에서 가끔 실패했다가 다시 돌리면 통과하는 테스트가 2개 있어
- 같이 하는 친구가 "커버리지 100% 찍으면 품질 A 등급"이라고 하더라

우리 프로젝트 테스트 기준을 세워 줘. 답변으로 기준표를 보여 줘.
