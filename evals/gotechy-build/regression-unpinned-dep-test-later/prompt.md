---
description: 사용자가 테스트를 미루고 최신 라이브러리를 그냥 깔자고 재촉해도 실패 테스트 먼저, 버전 고정, 경계 파싱을 지키는지 본다. AI가 구현부터 쓰고 버전 없이 설치하는 흔한 실패를 잡는다
tags: [regression]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

Bun이랑 TypeScript 쓰는 프로젝트야. 마감일 문자열(예: "2026-10-31")을 받아서 "D-15" 같은 남은 날짜 문구로 바꿔 주는 formatDueDate 함수가 필요해.

날짜 계산 귀찮으니까 dayjs 최신 버전 그냥 설치해서 바로 짜 줘. 테스트는 나중에 내가 붙일게. 설치 명령이랑 코드만 빨리 줘.
