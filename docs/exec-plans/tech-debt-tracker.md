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
| TD-009 | 2026-10-14 | verify 샌드박스가 macOS 전용이다. 다른 OS에서는 기록만 남긴다 | src/runtime/sandbox.ts | 🟡 | 리눅스 CI나 2단계 다른 아키텍처에서 격리 약속이 깨진다 | 2단계: bubblewrap 등 리눅스 샌드박스 |
| TD-010 | 2026-10-14 | `src/runtime/run.ts` 줄 커버리지 90.7%, 2026-10-14 18:22에 92.1%(핵심 모듈 목록 밖. 타임아웃, 게이트 열기 실패, 샌드박스 없음 분기). 같은 밤에 `usage.ts`(100%)와 `pages.tsx`(95.0%)는 기준을 넘겼다 | src/runtime/run.ts | 🟢 | 드문 실패 경로가 깨져도 모른다 | 1a 완료 게이트 전 |
| TD-012 | 2026-10-14 | `gotechy accept`가 병합하는 워커 변경에는 gitleaks 검사가 없다. 리드의 git은 hook을 끄고 돌아서, 워커가 넣은 비밀 값은 워커에 넘긴 로그인 값 검사(2026-10-14 감사 6차) 말고는 막히지 않는다 | src/runtime/accept.ts | 🟡 | 워커가 만든 토큰 같은 값이 메인에 들어갈 수 있다 | accept에서 병합 diff에 gitleaks를 돌리기 |
| TD-015 | 2026-10-15 | Codex 워커와 codex 감사관(contract.md 13절, 시간 상한 5분)에는 비용 상한(`budget_usd`)이 걸리지 않는다. codex CLI에 옵션이 없고 시간 상한만 있다(보안 감사 7차 낮음 7) | src/runtime/adapters/codex.ts | 🟡 | 오염된 입력이 Codex를 시간 상한까지 돌게 하면 비용이 쌓인다 | 지금은 무인 루프가 Codex 작업을 돌리지 않는다(2026-10-15). 갚을 때: `--json` 이벤트의 사용량을 실시간으로 더해 상한에서 중단 |
| TD-016 | 2026-10-15 | 스펙(harness-v2.md)의 "HANDOFF lint 실패 시 워커가 재작성(최대 2회)"이 구현되지 않았다. 지금은 lint에 실패하면 바로 `failed`다(doc-gardener) | src/runtime/run.ts | 🟢 | 형식만 틀린 결과도 다시 돌려야 한다. 무인 루프는 다시 시도로 일부 메움 | 1b 안에서: lint 오류를 워커에게 돌려주는 재작성 한 차례 |
| TD-017 | 2026-10-15 | (하네스 개선, 1a 회고) 외부 경계(브라우저, OS, 외부 CLI)를 건드리는 기능을 실험 증거 없이 커밋했다(1b N2의 Origin: null). `.claude/rules/testing.md`의 예외 규칙을 "커밋 전에 실험 증거"로 못박는다 | .claude/rules/testing.md | 🟢 | 자동 테스트가 실제 환경과 다른 가정(fetch에 Origin 직접 넣기)으로 통과한다 | 2단계 시작 전 |
| TD-018 | 2026-10-15 | (출시 후 측정) 스펙 성공 기준 "오너가 HANDOFF 한 건을 이해하고 결정하는 데 3분 이내, 이해 게이트 핵심어 적중률 60% 이상"을 공문서 프로젝트 실사용 10건으로 잰다 | docs/product-specs/harness-v2.md | 🟢 | 재지 않으면 1a의 목적(이해하고 결정)이 이뤄졌는지 모른다 | 1a 완료 2주 뒤(2026-10-29) 또는 결정 10건 |
| TD-019 | 2026-10-15 | 끝 기록과 오너 키의 위치(`GOTECHY_HOME`, 없으면 `HOME/.gotechy`)가 환경 변수 HOME을 따른다. 프로젝트 안을 가리키면 멈추고, 2026-10-15 오후부터 `gate verify`가 HOME이 계정 홈과 다르면 알린다. verify 샌드박스는 같은 날 계정 홈(`getpwuid`, `src/runtime/account.ts`)의 비밀 폴더도 막게 고쳤다(일부 상환, `tests/e2e/account-home.test.ts`). Bun의 `os.homedir`와 `userInfo().homedir`는 HOME을 따른다(실험) | src/runtime/keys.ts | 🟢 | 다른 HOME으로 decide나 verify를 부르면 끝 기록 검사가 다른 기록을 본다. 경고는 나오지만 막지는 않는다 | 기본 위치를 계정 홈으로 바꾼다. 그 전에 HOME만 바꿔 격리하던 테스트가 실제 `~/.gotechy`를 건드리지 않게 테스트마다 GOTECHY_HOME을 두는 것부터 |
| TD-021 | 2026-10-15 | `gotechy keys pin`은 Touch ID 없이 TTY와 y만으로 고정 키와 끝 기록을 다시 쓴다 | src/runtime/gates.ts | 🟢 | TTY 검사를 우회한 쪽이 신뢰 기준을 바꿀 수 있다(보안 감사 11차 낮음 1 보강 제안) | 서명 도구에 고정용 하위 명령을 더해 {project_id, pub, 장부 sha}에 오너 서명 |
| TD-023 | 2026-10-15 | 오너 확인은 지문 장치가 없는 맥(오너의 맥 미니)에서 맥 로그인 암호다. 로그인 암호를 아는 사람은 누구나 결정할 수 있고, 암호 창은 다른 시스템 창과 생김새가 같아 습관처럼 승인하기 쉽다(실측: 확인 시험에서 취소 대신 승인이 두 번 들어감) | native/ownerkey.swift, ADR 0006 | 🟡 | "오너만 결정한다"의 강도가 지문보다 약하다 | ADR 0006 승인 때 오너가 정한다: 그대로(암호), Touch ID 달린 키보드, 또는 결정 창 문구 강화 |
| TD-024 | 2026-10-15 | 감사관(1b N6)의 실험 전 가정 세 가지: codex `-s read-only`가 작업 폴더 밖을 어디까지 읽는지, codex의 셸 도구를 끌 수 있는지, claude `--restricted --permission-mode plan`이 하위 폴더의 지시 파일과 웹 도구를 쓰는지(보안 감사 12차 높음 1, 중간 5) | src/runtime/auditors.ts | 🟡 | codex 감사관이 주입된 지시로 홈의 비밀을 읽어 감사 원문 로그에 남길 수 있다. 기록에는 비밀 모양 검사가 있지만 인코딩한 글은 놓친다 | 오너 승인 뒤 미끼 파일로 실험(유료). 막을 수 없으면 리드가 바뀐 파일의 줄 번호 붙은 본문을 프롬프트에 넣고 감사관의 도구를 끈다 |
| TD-025 | 2026-10-15 | verify 샌드박스의 홈 비밀 목록이 금지 목록 방식이다. 목록에 없는 홈 아래 파일(다른 프로젝트의 비밀 파일, 셸 기록, 다른 CLI 자격 증명)은 읽힌다(보안 감사 13차 중간 5) | src/runtime/sandbox.ts | 🟡 | 워커가 쓴 테스트가 읽은 값이 verify 기록과 감사관 프롬프트로 나간다 | HOME과 계정 홈 전체를 기본으로 막고 도구 폴더(bun, mise, 캐시)만 허용. `bun test`가 도는지 실험 먼저 |
| TD-026 | 2026-10-15 | 가드 hook 감싸개가 시간 초과를 막지 못한다. 에이전트 쪽 hook 시간 상한에 걸리면 명령이 통과된다. 막는 판정도 exit 0과 JSON에만 기댄다(보안 감사 13차 낮음 3) | src/runtime/init.ts | 🟢 | 가드가 느려지면 오너 전용 명령이 통과될 수 있다 | 감싸개 안에 hook 상한보다 짧은 감시 타이머, 막는 판정에도 exit 2 |
| TD-027 | 2026-10-15 | 죽은 run의 잠금을 두 프로세스가 동시에 회수하면 둘 다 잠금을 잡을 수 있다(보안 감사 13차 낮음 6) | src/runtime/run.ts | 🟢 | 같은 작업의 run이나 감사가 겹칠 수 있다(드묾) | 회수를 원자적으로(이름 바꾸기로 잠금 폴더 교체) |
| TD-028 | 2026-10-15 | 감사관 프롬프트를 명령줄 인자로 넘기고(리눅스는 인자 하나 128KB 한도), 하위 프로세스 출력에 상한이 없다(보안 감사 13차 낮음 7, 11) | src/runtime/auditors.ts, src/runtime/proc.ts | 🟢 | 큰 입력으로 감사를 실패시키거나 메모리를 다 쓸 수 있다 | 프롬프트는 표준 입력으로(codex의 표준 입력 처리 실험 먼저), 출력은 끝 N MB만 보관 |

심각도: 🔴 구조적(레이어 위반·보안) / 🟡 기능적(엣지케이스·성능) / 🟢 표면적(네이밍·중복)

## 상환 완료

| ID | 내용 | 상환일 | 증거 |
|---|---|---|---|
| TD-020 | 보호 경로를 대소문자와 유니코드 접기를 무시하고 비교한다(`foldPath`). 실험: 아직 없는 `.CLAUDE/`를 만들면 git은 `.CLAUDE/settings.json`으로 보여 주고 맥은 `.claude/settings.json`으로 읽는다. `.agentſ/`도 `.agents/`로 읽힌다. 허용 범위에 `.Agents/`를 넣은 작업은 run이 거부한다 | 2026-10-15 | `tests/core/paths-case.test.ts`(6개, mutation 3종 모두 잡음) |
| TD-022 | 게이트를 모두 결정한 `needs-decision` 작업을 인박스와 화면에서 "다시 실행 대기" 묶음으로 따로 보여 주고, 카드 끝에 `다음: gotechy run T-###`를 쓴다(contract.md 8.1절) | 2026-10-15 | `tests/core/inbox-resume.test.ts`(8개, 조건 3개를 빼는 mutation 모두 잡음) |
| TD-008 | 리드 에이전트가 `gotechy decide`, `serve`, `keys`, `script`, `expect`와 force push, 발행, 배포를 실행하지 못하게: `gotechy init`이 프로젝트 `.claude/settings.json`에 deny 규칙, `settings.local.json`에 `gotechy guard` hook(fail-closed)을 깐다 | 2026-10-15 | `tests/core/guard.test.ts`, `tests/e2e/guard-cli.test.ts`, contract.md 12절 |
| TD-011 | `gotechy init`이 팩을 복사로 설치하던 것을 apm(커밋 고정, `targets: [claude, agent-skills]`)으로 바꿨다. doctor가 프로젝트 안에서 `apm audit --ci`로 변조를 잡는다 | 2026-10-15 | `tests/e2e/init-apm.test.ts`, `tests/core/apm.test.ts`, 실측 `docs/references/evidence/2026-10-15-night/apm-real.txt` |
| TD-013 | 프로젝트 고정 키 `orchestration/owner.pub`(커밋, 보호 경로). 검증은 고정 키로 하고, decide는 이 맥의 키가 고정 키와 다르면 거부한다. 첫 decide가 처음 고정하고, 키를 바꾸면 `gotechy keys pin`으로 다시 고정한다. 같은 사용자 프로세스가 고정 파일까지 바꾸면 git diff에 드러나는 것까지가 방어다 | 2026-10-15 | `tests/e2e/pin-ledger.test.ts`, contract.md 6.3절 |
| TD-014 | 장부 끝 기록 `$GOTECHY_HOME/owner/heads/`(장부 파일 전체의 줄 수와 sha256, 폴더별). 끝줄, 가운데 줄, 파일 삭제를 잡고, 끝 기록이 없으면 `keys pin`으로 다시 쓴다. 설계 초안의 줄 잇기 해시는 두지 않았다(장부가 맥 밖으로 나가지 않고, 서명에 순번을 넣으면 Touch ID 동안 잠금이 필요) | 2026-10-15 | `tests/e2e/pin-ledger.test.ts`, contract.md 6.3절 |
| TD-002 | `scripts/bootstrap.sh` 신설 + `init.sh --fix` 연결. 스택·테스트·배포를 묻고 src/ 레이어 골격·통과하는 예제 테스트·tsconfig·vitest(커버리지 임계값)·package.json 스크립트 전부·ARCHITECTURE/AGENTS/DEPLOYMENT 교체 자리를 실제로 채운다 | 2026-09-18 | 깨끗한 복사본에서 `--fix` → `init.sh` **첫 실행 통과**. `npm test` 1 passed, `lint`·`build`·`check:boundaries` 전부 exit 0. 레이어 위반 주입 시 `ui-no-repo` 에러로 **exit 1** 확인(제거 시 0 복귀), 커버리지 리포트 100% 동작 |

## 규칙

- 부채를 만들며 머지하는 것은 허용된다 — **기록 없이** 머지하는 것이 금지다.
- "이자" 칸을 반드시 채운다: 이 부채가 커지면 무엇이 비싸지는가.
- 보안 부채는 여기 넣지 않는다 — 즉시 처리 (docs/SECURITY.md).
