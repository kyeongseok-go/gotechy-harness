# 전문가 페르소나 심사 기록 — Harness v1.0 → v1.1 (2026-09-18)

> 6개 분야 최고 전문가 페르소나(기획 A·디자인 B·아키텍처 C·개발 D·테스트/보안 E·배포/운영 F)가 하네스를 적대적으로 심사했다.
> 원칙: 모든 지적은 수용 / 수정 수용 / 기각(사유) 중 하나로 종결한다. 총 48건 발견, 46건 수용, 2건 보류/기각.

## 심사단 공통 결론 (4명이 독립적으로 동일 진단)

**"강제 계층의 공동(空洞) / 검증 없는 검증 체계"** — 규범 문서는 상위 수준이나, hook 스키마 오류(존재하지 않는 `if` 필드)로 유일한 강제 장치가 고장 상태였고, 게이트가 참조하는 명령(`npm test` 등)이 전부 가공이었으며, "게이트가 산출물의 존재를 검사하지 참을 검사하지 않는" 구조였다.

## 반영 내역 (v1.1 변경)

### 강제 계층 신설 (C1/C2/D1/D2/E1/E2/E4/F1/F2)
- `.claude/hooks/guard-bash.sh` — stdin JSON 파싱 방식의 정상 hook (force push·시크릿 Bash 접근·재귀 삭제 차단). **스모크 테스트 통과 확인** (당시 7케이스 → 현재 14케이스로 확장).
- settings.json 재작성 — 무효한 `if` 필드 제거, deny는 Read 계열만 유지(Bash 방어는 hook으로 이중화).
- `package.json` 스텁 — 미설정 명령은 **명시적 실패** ("명령 부재 = 게이트 실패, 스킵 아님").
- `.github/workflows/ci.yml` — ship 게이트의 CI 미러 (격리된 채점자): lint/build/test/경계/문서 드리프트/ExecPlan 위생/(교체) 마커.
- `.dependency-cruiser.cjs` — 레이어 경계 기계 강제 (교정 지침 포함 에러 메시지).
- `scripts/init.sh` — 온보딩 검사: (교체) 마커·시크릿 규약·hook 스모크 테스트.

### 기획 게이트의 "참" 검증 (A1~A8)
- PRD §3 성공 기준 → 측정 방법·시점·실패 판정선 표 강제.
- `~/.claude/gotechy-career.yaml` 신설 (댕글링 참조 해소, 진실의 원천 단일화) + career_signals를 hypothesis(스펙)/evidence(ship) 2단계로 분리 — evidence는 제3자 확인 가능 링크/수치 필수.
- 🔴 지적은 작성자가 기각 불가 (사용자에게만 기각 권한). 확정 조건 = 🔴 0건.
- 착수 판정(§0)·미니 스펙 트랙·우선순위 열·변경 이력(Non-goals 축소는 사용자 승인) 추가. 출시 2주 후 측정 환류.

### 디자인 시스템 실체화 (B1~B8)
- DESIGN.md 전면 재작성: 제품 UI 기본값 = 라이트 + 뉴트럴 (네온은 다크 전용, -700 라이트 대응쌍 + 대비 4.5:1 검증 규칙), 2층 토큰(원시→시맨틱), 수치 시스템(간격 4px 배수·radius 2단계·타이포 스케일), 상태 매트릭스(로딩 300ms/빈 2종/에러 구분/부분 실패), anti-slop 측정형 재작성.
- QUALITY_BAR에 접근성 게이트(axe 0건·focus-visible·키보드 완주) 추가. 3초 규칙 단일 출처화.

### 아키텍처 정합성 (C3~C8)
- ExecPlan 템플릿에 Cookbook 원본의 Artifacts / Interfaces and Dependencies 섹션 복원, novice-guiding 기준 복원.
- ship 7단계 신설: 회고 → 하네스 개선 라우팅 (수명주기 순환 복원). generated 검사 결정론화(`gen:docs` + `git diff`).
- AGENTS.md 헌법을 core-beliefs 요약으로 격하(단일 출처), 수명주기 AGENTS.md로 단일화, 스킬의 Claude Code 전용 명시 + Codex 수동 경로 안내.
- tracker 승격 척도 정합(🔴/🟡 2주), doc-gardener 주기 통일(주 1회 + ship마다 스코프 한정).

### 개발 실전성 (D4~D8)
- rules paths에 components/lib/hooks 추가, security 글로브 정밀화(오탐 제거).
- 콘텐츠 생성 진입점을 /gotechy-launch로 단일화, blog-writer 트리거에서 "정리해줘" 제거(오발동 방지).
- `prompts/_template-prompt.md`·`docs/evals/`(README+예시 골든셋) 실체화. QUALITY_SCORE "건드린 영역만 갱신" 완화 + A~D 판정 루브릭.

### 보안·운영 (E3/E5~E7, F3~F8)
- security-auditor에서 Bash 제거(진짜 읽기 전용) + 인젝션 경계 규칙 명시.
- SECURITY.md: CSRF·보안 헤더·업로드·탐지 + **OWASP LLM Top 10 섹션**(출력 처리·과도한 에이전시·프롬프트 유출·무제한 소비·민감정보) 신설.
- `docs/DEPLOYMENT.md` 신설(환경 매트릭스·롤백 5분·시크릿 수명주기·expand-contract), `.gitignore`/`.env.example` 신설.
- RELIABILITY에 백업 실행 절차(분기 복원 리허설)·인시던트 런북 추가. LLM 관측 최소 스택(JSONL→llm:report) 구체화.

## 보류/기각 (2건)

| 지적 | 판정 | 사유 |
|---|---|---|
| D3: `.claude/rules/` paths 스코프가 공식 기능인지 의심 (확신도 70%) → CLAUDE.md @import 안전망 | **기각** | Anthropic 공식 문서 리서치(anthropic-claude-code-harness.md §1-4)에서 path-scoped rules를 공식 기능으로 확인. @import 안전망은 컨텍스트 절약 목적을 훼손 |
| D6: `argument-hint`가 SKILL.md에서 유효한지 확인 필요 | **보류** | 공식 스킬 frontmatter 필드로 리서치에서 확인됨. 실동작 확인은 첫 도그푸딩 세션에서 수행 (무시되어도 무해) |

## 남긴 교훈 (하네스 운영 원칙으로 승격)

작성됨 ≠ 작동함. **하네스 자체에 대한 스모크 테스트**(hook이 실제로 차단하는가, 게이트 명령이 실제로 실행되는가)가 init.sh와 CI에 상설화되었다.

---

# 부록: Codex 교차 검토 — v1.1 → v1.1.1 (2026-09-18)

> 격리된 심사자(L4) 실천: 하네스를 만든 Claude가 아닌 OpenAI Codex(gpt-5.6-sol, HomeServer)가 독립 검토했다. HIGH 3 · MED 4 · LOW 2 발견, 전부 종결.

| # | 심각도 | 지적 | 판정 |
|---|---|---|---|
| 1 | HIGH | guard-bash.sh가 `.env.local` 미차단 + `.env.example` 포함 시 전체 예외 | **수용** — 토큰 단위 검사로 재작성, `.env.*` 전부 차단·`.env.example` 토큰만 허용 |
| 2 | HIGH | `git -C . push --force`, `rm -r -f`, `--recursive --force` 우회 | **수용** — 토큰 기반 매칭으로 재작성, 스모크 테스트 전부 통과 (당시 22케이스 검증 → init.sh에 14케이스 상설화) |
| 3 | HIGH | lockfile 없는 템플릿에서 `cache: npm`이 CI를 설치 전에 실패시킴 | **수용** — cache 제거, lockfile 커밋 후 npm ci 전환 안내 주석 |
| 4 | MED | `npm ci \|\| npm install`이 lockfile 문제를 은폐 | **수용** — npm install 단일화 (초기 템플릿 전제 명시) |
| 5 | MED | CI가 ship 게이트의 완전한 미러가 아님에도 그렇게 주장 | **수정 수용** — "기계 검증 가능한 항목의 미러"로 주장 완화 + init.sh 단계 추가. 공통 ship-gate.sh 추출은 도그푸딩 후 검토(부채) |
| 6 | MED | init.sh가 스텁 교체 여부를 검사하지 않음 | **수용** — "미설정" 스텁 잔존 감지 추가 |
| 7 | MED | AGENTS.md의 `npm run dev`가 package.json에 없음 | **수용** — dev 스텁 추가 + init 검사 대상 포함 |
| 8 | LOW | README 버전 표기 v1.0 잔존 | **수용** — v1.1로 갱신 |
| 9 | LOW | 미생성 generated/ 파일을 현재 경로처럼 참조 | **수용** — "러너 연결 후 생성" 명시 |

Codex가 검증해준 것: settings.json strict JSON 유효, PreToolUse hook 구조가 공식 규약과 일치, guard-bash.sh·init.sh `bash -n` 통과, AGENTS.md 지도와 실제 구조 일치(87줄).

hook 스모크 테스트는 14케이스(우회 변형 포함)로 확장되어 init.sh와 CI에 상설화되었다.

---

# 부록 2: 최종 검증 라운드 — v1.1.1 → v1.2 (2026-09-18)

> 심사 이후 30여 건의 편집이 들어갔으므로, **수정된 상태를 처음 보는 눈으로** 다시 검증했다.
> 검증자 2인: ①정합성 검증(참조 무결성 + 주장 대조, 실제 명령 실행) ②첫날 사용 시뮬레이션(온보딩·인지 부하·3주차 이탈).

## 치명적 발견 2건 (둘 다 "우리가 만든 수정"이 만든 문제)

| 지적 | 판정 | 조치 |
|---|---|---|
| **guard-bash.sh가 jq 부재 시 fail-open** — jq가 없으면 원본 JSON이 그대로 들어가 어떤 패턴에도 안 걸린다. 실측: `cat .env`·`git push --force`·`rm -rf /` 전부 exit 0. macOS 기본에 jq가 없고, SECURITY.md·README는 "무조건 차단"이라 단언 중이었다 | **수용** | jq → python3 → sed 3단 폴백 + 파싱 실패 시 **fail-closed**. 폴백 단계별 실측 검증 완료 |
| **템플릿의 `docs/career.yaml`에 타겟 회사 10곳 실명** — 템플릿이 클라이언트·공개 저장소로 복사되면 "이직하려는 회사 목록"이 따라간다. 마찰이 아니라 사고 | **수용** | 개인 파일 `~/.claude/gotechy-career.yaml`로 이전(양 머신 배치), 템플릿에는 회사명 없는 `career.example.yaml`만. 전 참조 경로 갱신 |

## 그 외 수용 (12건)

- **ExecPlan career_signals가 평면 구조라 ship이 검사할 `evidence` 칸이 없었음** → PRD와 동일한 hypothesis/evidence 2단계로 통일 (게이트가 구조적으로 검사 가능해짐)
- **ship 게이트가 "전부 아니면 무"** → **패치/기능/릴리스 3등급** + 부분 점수 보고("5개 중 4개 통과, 남은 것 1개"). 오타 수정에 evidence를 요구하던 문제 해소. 3주차 이탈 원인 1위 제거
- **`rm -rf` 전면 차단으로 `rm -rf node_modules`까지 막힘** → 빌드 산출물 화이트리스트(node_modules·dist·.next·coverage·/tmp 등). 일상 마찰로 hook을 통째로 끄게 만드는 경로 차단 + 예외 추가/비활성 방법을 파일 상단에 명시
- **`--force-with-lease` 과차단** (가장 안전한 형태인데) → 허용
- **보안 리뷰가 수명주기 다이어그램에 없었음** → 추가 + "인증·API·DB를 건드리면 크기와 무관하게 필수"
- **작업 크기 임계값이 문서마다 다르고, "사용자 데이터 건드리면 풀 스펙"이 Claude 전용 SKILL에만 있었음**(Codex 호환 주장과 모순) → AGENTS.md에 크기 판정 표로 통합
- **스킬 호출 트리거 규칙 부재** → AGENTS.md "에이전트 행동 규칙" 신설 (크기 판정 후 진행 / 부작용은 사용자 지시 시에만)
- **doc-gardener 주기가 고아 주장**("ship마다"인데 ship에 호출 없음) → ship 3단계에 스코프 한정 호출 추가
- **`generated/`(자동 생성 전용)에 수동 작성 파일** → `docs/references/`로 이동
- `HANDOFF.md` 댕글링 참조 → ExecPlan Context 섹션으로 통일
- launch의 "3초 규칙" 출처 오기(BRAND→DESIGN), `disable-model-invocation: true` 추가
- init.sh: hook 결과가 앞선 검사 실패에 가려지던 버그, **CLAUDE.md `@AGENTS.md` 브리지 소실 검사** 신설(외부 도구가 덮어쓰는 조용한 치명적 실패 감지)

## 부채로 이월 (4건 — TD-001~004)

첫날 시뮬레이션의 지적 중 구조 변경이 필요한 것들: `init.sh --fix` 부트스트래퍼(1일차 게이트가 구조적으로 통과 불가한 문제의 근본 해결), 스캐폴드 부재(레이어 규칙은 있는데 폴더가 없음), 문서 다이어트(2,700줄 중 42%가 프로젝트 무관), 커밋·PR 규약.

## 검증자가 확인해준 것

참조 무결성(링크 5건 + 실경로 전부 정상, 댕글링 없음), npm 스크립트 양방향 정합, settings.json·ci.yml·archify JSON 구문 유효, `bash -n` 통과, AGENTS.md 지도 24행 전부 실존, 심각도 척도(🔴🟡🟢 vs A/B/C/D)는 대상이 달라 모순 아님, 대상 사용자 정의 4곳 일치, 스킬 frontmatter 6/6 정상.

## 이번 라운드의 교훈

**수정이 새 결함을 만든다.** 심사에서 나온 hook 재작성이 fail-open을 낳았고, career.yaml 신설이 유출 경로를 만들었다. 고친 뒤 **처음 보는 눈으로 다시 보는 라운드**가 없었다면 둘 다 그대로 배포됐을 것이다 — 이것이 L4(격리된 심사자)를 한 번이 아니라 매 변경마다 도는 이유다.

---

# 부록 3: TD-002 상환 + 전역 스킬 통일 (2026-09-18)

## 부트스트래퍼 — "검사만 하고 고쳐주지 않는 검사기"의 해결

첫날 시뮬레이션이 지목한 **1순위 이탈 원인**(복사 직후 `exit 1`, 실패 6건, 게이트가 구조적으로 통과 불가)을 `scripts/bootstrap.sh`로 상환했다.

`npm run init:harness -- --fix`가 스택·테스트 러너·배포 타깃을 묻고(비대화형 플래그 지원, `--dry-run` 제공) 다음을 **실제로 생성·수정**한다:
- `src/` 레이어 골격 6개 (types→config→repo→service→runtime→ui)
- 통과하는 예제: `service/health.ts` + 테스트 + `runtime/index.ts` — 레이어 규칙의 살아있는 본보기
- `tsconfig.json`(strict), `vitest.config.ts` — **커버리지 임계값으로 QUALITY_BAR 기준을 기계 강제**
- `package.json` 스크립트 전부를 실제 명령으로 (해당 없는 것은 실패가 아니라 명시적 `exit 0`)
- ARCHITECTURE·AGENTS·DEPLOYMENT의 교체 자리 (앵커가 없으면 조용히 넘기지 않고 경고)

## 실측 증거 (작성됨 ≠ 작동함)

깨끗한 복사본에서 전 과정을 재현했다:

| 검증 | 결과 |
|---|---|
| `--fix` 후 `init.sh` | **첫 실행 통과** (이전: 실패 6건) |
| `npm test` | 1 passed |
| `npm run lint` / `build` / `check:boundaries` / `gen:docs` | 전부 exit 0 |
| **레이어 위반 주입** (`src/ui`가 `src/repo`를 직접 import) | `error ui-no-repo` + **exit 1** — CI가 막는다 |
| 위반 제거 후 | exit 0 복귀 |
| `test:coverage` | 리포트 출력, 임계값 설정 동작 |

레이어 규칙이 **실제 코드에 대해 위반을 잡는 것을 확인한 것은 이번이 처음**이다. 그전까지 `.dependency-cruiser.cjs`는 한 번도 실행된 적 없는 설정 파일이었다.

## 전역 스킬 이름 충돌 해소

전역 `~/.claude/skills/gotekie-blog-writer`(v1)를 v2로 교체했다. v1은 `~/.claude/skills-archive/gotekie-blog-writer-v1-backup-20260918`에 보존. 이로써 v1의 과잉 트리거("정리해줘" → 리팩터링 요청에도 발동)가 제거되고, 전역·프로젝트 어느 쪽이 로드돼도 동일한 v2가 된다.
