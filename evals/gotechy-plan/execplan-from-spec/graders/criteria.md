---
type: llm
focus: { source: file, path: docs/exec-plans/active/2026-10-16-csv-export.md }
---

PASS if 계획 파일이 아래를 모두 만족한다.
- M1이 끝까지 가는 얇은 세로 조각이다. 예: 버튼을 누르면 최소한의 CSV가 내려받아진다. DB나 공통 기반 작업만으로 끝나는 M1이 아니다(bar 10번).
- 마일스톤마다 proof에 실제 실행할 명령(예: bun test 경로)과 예상 출력이 있다. "확인한다", "잘 동작한다"만 있는 마일스톤이 없다(bar 2, 13번).
- Validation and Acceptance가 AC-1-1.1, AC-1-1.2, AC-1-1.3, AC-1-1.4를 모두 ID로 다룬다(bar 8번).
- pre-mortem 실패 이유가 5개 이상이고, 위험 표가 3행 이상이며 행마다 관찰 가능한 조기 신호와 대응이 있다(bar 6, 7번). 한글 깨짐(BOM, 인코딩)이나 대용량 기간 같은 이 기능에 맞는 위험이 하나 이상 있다.
- Idempotence and Recovery에 중단 뒤 재개나 되돌리기 방법이 있다(bar 14번).
- 다른 사용자 데이터 접근(AC-1-1.4)을 다루므로 권한 테스트나 보안 리뷰 단계가 계획에 있다(bar 15번).
- Progress, Surprises & Discoveries, Decision Log, Outcomes & Retrospective 절이 있고, 체크리스트는 Progress에만 있다(bar 1, 4번).
- 프롬프트에 주어진 명령(bun test, biome check)과 경로(src/db/transactions.ts 등)를 쓰고, 근거 없는 다른 스크립트 이름을 지어내지 않는다.

FAIL if 아래 중 하나라도 해당한다.
- 증명 명령이 없는 마일스톤이 있다.
- AC ID 중 하나라도 검증 항목에 없다.
- 위험 표가 없거나 조기 신호가 "문제가 생기면" 같은 말뿐이다.
- 마일스톤 하나가 1주를 넘는 크기로 추정되어 있는데 분할하지 않았다.
