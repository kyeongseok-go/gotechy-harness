# tech-debt-tracker.md — 기술 부채 추적

> 부채는 고금리 대출 — 매일 소액 상환. 숨긴 부채가 가장 비싸다.
> `/gotechy-ship`이 완료 게이트에서 신규 부채 기록을 요구한다. **🔴 또는 🟡 항목이 2주 이상 방치되면 ExecPlan으로 승격**한다.

## 활성 부채

| ID | 등록일 | 내용 | 위치 | 심각도 | 이자(방치 시 비용) | 상환 계획 |
|---|---|---|---|---|---|---|
| TD-001 | 2026-09-18 | ship 게이트의 기계 검증 항목을 `scripts/ship-gate.sh`로 추출해 CI와 스킬이 동일 스크립트를 호출하게 (Codex 검토 MED-5) | .github/workflows/ci.yml · skills/gotechy-ship | 🟡 | CI와 스킬 게이트가 따로 진화하며 어긋남 | 첫 도그푸딩 프로젝트에서 추출 |
| ~~TD-002~~ | 2026-09-18 | ~~`scripts/init.sh --fix` 부트스트래퍼~~ | scripts/bootstrap.sh | 🔴 | — | **✅ 상환 완료 (2026-09-18)** — 아래 상환 완료 표 참조 |
| TD-003 | 2026-09-18 | 문서 다이어트 (2,700줄 → 900줄 목표): `docs/references/research/`·`gotekie-blog-writer`를 원본 저장소/사용자 레벨로 분리, DESIGN+FRONTEND·RELIABILITY+DEPLOYMENT 병합, AI_PLAYBOOK+evals를 옵션 팩화 | docs/ 전반 | 🟡 | core-beliefs #4("지도는 짧게")를 하네스 자신이 위반. 복사본마다 무관한 42% 동반 | TD-002와 함께 |
| TD-004 | 2026-09-18 | 커밋·브랜치·PR 규약 부재 — career evidence의 1차 원천이 PR/커밋 링크인데 그걸 만드는 규약이 없음 | AGENTS.md 또는 신설 | 🟢 | evidence 품질이 그때그때 달라짐 | 첫 PR 작성 시 |
| TD-005 | 2026-10-14 | 문체 규칙(contract.md 7절) 이전에 쓴 문서에 경고가 약 1,700건 남아 있다. `gotechy text lint` 기준 docs 1,321건(research 제외), .claude 316건, AGENTS.md 71건, ARCHITECTURE.md 8건. 대부분 가운데점, 화살표, em-dash. 이 표의 심각도 칸에 쓰는 색 원 이모지도 걸리는데, 바꾸려면 `/gotechy-ship` 스킬과 이 문서의 규칙을 함께 고쳐야 한다 | docs/, .claude/, AGENTS.md | 🟡 | 에이전트가 기존 문서를 본보기로 삼아 같은 문체를 다시 만든다. 2026-10-21부터 문체 규칙이 오류가 되면 이 문서들을 고칠 때마다 검사가 막는다 | 손대는 문서부터 고친다. 에이전트가 가장 자주 읽는 AGENTS.md와 .claude 규칙, 스킬을 10-20 전에 먼저. 분량은 TD-003(문서 다이어트)으로 먼저 줄인다 |
| TD-006 | 2026-10-14 | `accept`가 충돌이나 병합 후 verify 실패로 멈춘 작업을 다시 진행할 길이 없다. 작업을 needs-decision으로 바꾸고 사유만 남기는데, 다시 실행하면 옛 기준 커밋의 worktree에서 이어 가서 같은 충돌이 난다 | src/runtime/accept.ts, src/runtime/run.ts | 🟡 | 오너가 손으로 브랜치를 고치거나 작업을 새로 만들어야 한다 | 1b: 작업 브랜치를 새 메인 위로 다시 만드는 `gotechy task rebase` 또는 재실행 옵션 |
| TD-007 | 2026-10-14 | 허용 범위 검사(`changedFiles`)가 무시 파일(.gitignore 대상)의 변경을 보지 않는다 | src/runtime/git.ts | 🟡 | 워커가 node_modules 같은 무시 경로에 코드를 심을 수 있다. verify 샌드박스로 피해는 작업 폴더 안에 갇힌다 | 1b: 기준 시점의 무시 파일 목록과 비교 |
| TD-008 | 2026-10-14 | 리드 에이전트 설정에 `gotechy decide`, `script`, `expect` 실행 금지 규칙이 없다. TTY 검사는 실수만 막는다 | templates/project/ | 🟡 | 무인 루프의 리드가 막혔을 때 결정을 대신 내리는 실수를 막지 못한다 | M3 setup이 프로젝트 .claude/settings.json에 deny를 넣는다 |
| TD-009 | 2026-10-14 | verify 샌드박스가 macOS 전용이다. 다른 OS에서는 기록만 남긴다 | src/runtime/sandbox.ts | 🟡 | 리눅스 CI나 2단계 다른 아키텍처에서 격리 약속이 깨진다 | 2단계: bubblewrap 등 리눅스 샌드박스 |
| TD-010 | 2026-10-14 | `src/runtime/run.ts` 줄 커버리지 90.7%, 2026-10-14 18:40에 92.1%(핵심 모듈 목록 밖. 타임아웃, 게이트 열기 실패, 샌드박스 없음 분기). 같은 밤에 `usage.ts`(100%)와 `pages.tsx`(95.0%)는 기준을 넘겼다 | src/runtime/run.ts | 🟢 | 드문 실패 경로가 깨져도 모른다 | 1a 완료 게이트 전 |
| TD-011 | 2026-10-14 | `gotechy init`이 아직 팩을 복사로 설치한다(apm 전환 전). (mise 락은 2026-10-14 13:23에 A등급 도구 6개로 넓힘) | src/runtime/init.ts, mise.toml | 🟡 | 설치 결과의 변조와 드리프트를 `apm audit`로 잡지 못한다 | M3 나머지(오너와 함께): apm 설치 |
| TD-012 | 2026-10-14 | `gotechy accept`가 병합하는 워커 변경에는 gitleaks 검사가 없다. 리드의 git은 hook을 끄고 돌아서, 워커가 넣은 비밀 값은 키 값 검사 말고는 막히지 않는다 | src/runtime/accept.ts | 🟡 | 워커가 만든 토큰 같은 값이 메인에 들어갈 수 있다 | accept에서 병합 diff에 gitleaks를 돌리기 |
| TD-013 | 2026-10-14 | 오너 공개 키의 지문을 프로젝트에 고정하지 않는다. 같은 OS 사용자 프로세스가 `$GOTECHY_HOME/owner`의 공개 키와 blob을 사람 확인 없는 자기 키로 바꾸면 그 뒤의 결정을 위조할 수 있다 | src/runtime/keys.ts, src/runtime/gates.ts | 🟡 | 키를 바꾼 사실이 검증에서 드러나지 않는다 | 1b: 프로젝트 `orchestration/owner.pub` 지문 고정과 키 교체 절차 |

심각도: 🔴 구조적(레이어 위반·보안) / 🟡 기능적(엣지케이스·성능) / 🟢 표면적(네이밍·중복)

## 상환 완료

| ID | 내용 | 상환일 | 증거 |
|---|---|---|---|
| TD-002 | `scripts/bootstrap.sh` 신설 + `init.sh --fix` 연결. 스택·테스트·배포를 묻고 src/ 레이어 골격·통과하는 예제 테스트·tsconfig·vitest(커버리지 임계값)·package.json 스크립트 전부·ARCHITECTURE/AGENTS/DEPLOYMENT 교체 자리를 실제로 채운다 | 2026-09-18 | 깨끗한 복사본에서 `--fix` → `init.sh` **첫 실행 통과**. `npm test` 1 passed, `lint`·`build`·`check:boundaries` 전부 exit 0. 레이어 위반 주입 시 `ui-no-repo` 에러로 **exit 1** 확인(제거 시 0 복귀), 커버리지 리포트 100% 동작 |

## 규칙

- 부채를 만들며 머지하는 것은 허용된다 — **기록 없이** 머지하는 것이 금지다.
- "이자" 칸을 반드시 채운다: 이 부채가 커지면 무엇이 비싸지는가.
- 보안 부채는 여기 넣지 않는다 — 즉시 처리 (docs/SECURITY.md).
