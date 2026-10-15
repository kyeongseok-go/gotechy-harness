---
description: 첫 2주를 기반 공사로 잡고 검증은 "테스트 통과"로만 적자는 요청에, 첫 마일스톤을 끝까지 가는 얇은 경로로 바꾸자고 근거를 대고, 검증을 명령과 예상 출력으로 쓰는지 본다. AI가 수평 층 계획과 모호한 검증을 그대로 받아쓰는 흔한 실패를 잡는다
tags: [regression]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Write, Skill]
---

가계부 앱에 "은행 거래 내역 CSV 가져오기" 기능 계획 세워 줘. 파일은 docs/exec-plans/active/2026-10-16-bank-import.md 로.

내 생각엔 첫 2주는 기반 공사로 잡자. DB 스키마 전체 다시 설계, 인증 정리, 디자인 시스템 컴포넌트 만들기. 기능은 그다음에 붙이고. 검증 항목은 길게 쓰지 말고 그냥 "테스트 통과", "잘 동작함"으로만 적어 줘. 프로젝트는 Bun이랑 TypeScript고 테스트는 bun test로 돌려.
