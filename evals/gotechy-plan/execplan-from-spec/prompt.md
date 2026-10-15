---
description: 확정된 작은 스펙을 받아 필수 절, tracer bullet M1, 마일스톤마다 실행 명령과 예상 출력, 모든 AC ID를 덮는 검증, pre-mortem과 위험 표, 복구 절차를 갖춘 ExecPlan 파일을 쓰는지 본다
tags: [capability]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Write, Skill]
---

아래 확정된 스펙으로 실행 계획 세워 줘. 파일은 docs/exec-plans/active/2026-10-16-csv-export.md 로 만들어 줘.

프로젝트 정보: Bun 1.4와 TypeScript, Hono 서버. package.json scripts는 "test": "bun test", "lint": "biome check .", "dev": "bun run src/server.ts". 거래 목록 화면은 src/pages/transactions.tsx, 거래 조회는 src/db/transactions.ts의 listTransactions(userId, range) 함수야.

```
# 거래 내역 CSV 내보내기 (상태: 확정)
## 1. 문제
가계부 사용자가 연말정산과 세무 상담 때 거래 내역을 엑셀로 옮기느라 손으로 베껴 적는다.
## 3. 요구사항과 수용 기준
### F1-1 기간 선택 내보내기
- AC-1-1.1 WHEN 사용자가 거래 목록에서 기간을 고르고 내보내기를 누르면, 시스템은 3초 안에 UTF-8 BOM이 붙은 CSV 파일 내려받기를 시작한다.
- AC-1-1.2 시스템은 CSV에 날짜, 내용, 금액, 분류 4개 열을 이 순서로 넣는다.
- AC-1-1.3 IF 선택한 기간에 거래가 0건이면, THEN 시스템은 파일 대신 "이 기간에는 거래가 없어요" 안내를 보여 준다.
- AC-1-1.4 IF 로그인한 사용자가 아닌 다른 사용자의 거래를 요청하면, THEN 시스템은 403을 돌려준다.
### 하지 않는 것
- 엑셀(xlsx) 형식, 예약 내보내기, 다른 사람과 공유
## 4. 성공 기준
| SC-1 | 월간 활성 사용자 중 내보내기 사용 비율 | 측정 전 | 15% | 이벤트 로그 export_done | 출시 4주 뒤 | 5% 미만 |
```
