# tech-debt-tracker.md — 기술 부채 추적

> 부채는 고금리 대출 — 매일 소액 상환. 숨긴 부채가 가장 비싸다.
> `/gotechy-ship`이 완료 게이트에서 신규 부채 기록을 요구한다. **🔴 또는 🟡 항목이 2주 이상 방치되면 ExecPlan으로 승격**한다.

## 활성 부채

| ID | 등록일 | 내용 | 위치 | 심각도 | 이자(방치 시 비용) | 상환 계획 |
|---|---|---|---|---|---|---|
| TD-001 | 2026-09-18 | ship 게이트의 기계 검증 항목을 `scripts/ship-gate.sh`로 추출해 CI와 스킬이 동일 스크립트를 호출하게 (Codex 검토 MED-5) | .github/workflows/ci.yml · skills/gotechy-ship | 🟡 | CI와 스킬 게이트가 따로 진화하며 어긋남 | 첫 도그푸딩 프로젝트에서 추출 |
| TD-002 | 2026-09-18 | `scripts/init.sh --fix` — 검사기를 부트스트래퍼로. 스택·러너·배포 타깃 3문항을 묻고 package.json·ARCHITECTURE 지도·AGENTS 설정·.env.example를 실제로 채우고 tsconfig+테스트 설정+레이어 폴더+통과하는 예제 테스트 1개 생성 | scripts/init.sh | 🔴 | 첫 경험이 "exit 1, 실패 6건"이라 온보딩에서 이탈. 1일차 게이트가 구조적으로 통과 불가 | 다음 새 프로젝트 시작 직전 |
| TD-003 | 2026-09-18 | 문서 다이어트 (2,700줄 → 900줄 목표): `docs/references/research/`·`gotekie-blog-writer`를 원본 저장소/사용자 레벨로 분리, DESIGN+FRONTEND·RELIABILITY+DEPLOYMENT 병합, AI_PLAYBOOK+evals를 옵션 팩화 | docs/ 전반 | 🟡 | core-beliefs #4("지도는 짧게")를 하네스 자신이 위반. 복사본마다 무관한 42% 동반 | TD-002와 함께 |
| TD-004 | 2026-09-18 | 커밋·브랜치·PR 규약 부재 — career evidence의 1차 원천이 PR/커밋 링크인데 그걸 만드는 규약이 없음 | AGENTS.md 또는 신설 | 🟢 | evidence 품질이 그때그때 달라짐 | 첫 PR 작성 시 |

심각도: 🔴 구조적(레이어 위반·보안) / 🟡 기능적(엣지케이스·성능) / 🟢 표면적(네이밍·중복)

## 상환 완료

| ID | 내용 | 상환일 | 상환 ExecPlan |
|---|---|---|---|

## 규칙

- 부채를 만들며 머지하는 것은 허용된다 — **기록 없이** 머지하는 것이 금지다.
- "이자" 칸을 반드시 채운다: 이 부채가 커지면 무엇이 비싸지는가.
- 보안 부채는 여기 넣지 않는다 — 즉시 처리 (docs/SECURITY.md).
