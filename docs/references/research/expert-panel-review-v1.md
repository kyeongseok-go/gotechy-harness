# 전문가 페르소나 심사 기록 — Harness v1.0 → v1.1 (2026-09-18)

> 6개 분야 최고 전문가 페르소나(기획 A·디자인 B·아키텍처 C·개발 D·테스트/보안 E·배포/운영 F)가 하네스를 적대적으로 심사했다.
> 원칙: 모든 지적은 수용 / 수정 수용 / 기각(사유) 중 하나로 종결한다. 총 48건 발견, 46건 수용, 2건 보류/기각.

## 심사단 공통 결론 (4명이 독립적으로 동일 진단)

**"강제 계층의 공동(空洞) / 검증 없는 검증 체계"** — 규범 문서는 상위 수준이나, hook 스키마 오류(존재하지 않는 `if` 필드)로 유일한 강제 장치가 고장 상태였고, 게이트가 참조하는 명령(`npm test` 등)이 전부 가공이었으며, "게이트가 산출물의 존재를 검사하지 참을 검사하지 않는" 구조였다.

## 반영 내역 (v1.1 변경)

### 강제 계층 신설 (C1/C2/D1/D2/E1/E2/E4/F1/F2)
- `.claude/hooks/guard-bash.sh` — stdin JSON 파싱 방식의 정상 hook (force push·시크릿 Bash 접근·재귀 삭제 차단). **스모크 테스트 7케이스 통과 확인.**
- settings.json 재작성 — 무효한 `if` 필드 제거, deny는 Read 계열만 유지(Bash 방어는 hook으로 이중화).
- `package.json` 스텁 — 미설정 명령은 **명시적 실패** ("명령 부재 = 게이트 실패, 스킵 아님").
- `.github/workflows/ci.yml` — ship 게이트의 CI 미러 (격리된 채점자): lint/build/test/경계/문서 드리프트/ExecPlan 위생/(교체) 마커.
- `.dependency-cruiser.cjs` — 레이어 경계 기계 강제 (교정 지침 포함 에러 메시지).
- `scripts/init.sh` — 온보딩 검사: (교체) 마커·시크릿 규약·hook 스모크 테스트.

### 기획 게이트의 "참" 검증 (A1~A8)
- PRD §3 성공 기준 → 측정 방법·시점·실패 판정선 표 강제.
- `docs/career.yaml` 신설 (댕글링 참조 해소, 진실의 원천 단일화) + career_signals를 hypothesis(스펙)/evidence(ship) 2단계로 분리 — evidence는 제3자 확인 가능 링크/수치 필수.
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
| 2 | HIGH | `git -C . push --force`, `rm -r -f`, `--recursive --force` 우회 | **수용** — 토큰 기반 매칭으로 재작성, 스모크 테스트 22케이스 전부 통과 |
| 3 | HIGH | lockfile 없는 템플릿에서 `cache: npm`이 CI를 설치 전에 실패시킴 | **수용** — cache 제거, lockfile 커밋 후 npm ci 전환 안내 주석 |
| 4 | MED | `npm ci \|\| npm install`이 lockfile 문제를 은폐 | **수용** — npm install 단일화 (초기 템플릿 전제 명시) |
| 5 | MED | CI가 ship 게이트의 완전한 미러가 아님에도 그렇게 주장 | **수정 수용** — "기계 검증 가능한 항목의 미러"로 주장 완화 + init.sh 단계 추가. 공통 ship-gate.sh 추출은 도그푸딩 후 검토(부채) |
| 6 | MED | init.sh가 스텁 교체 여부를 검사하지 않음 | **수용** — "미설정" 스텁 잔존 감지 추가 |
| 7 | MED | AGENTS.md의 `npm run dev`가 package.json에 없음 | **수용** — dev 스텁 추가 + init 검사 대상 포함 |
| 8 | LOW | README 버전 표기 v1.0 잔존 | **수용** — v1.1로 갱신 |
| 9 | LOW | 미생성 generated/ 파일을 현재 경로처럼 참조 | **수용** — "러너 연결 후 생성" 명시 |

Codex가 검증해준 것: settings.json strict JSON 유효, PreToolUse hook 구조가 공식 규약과 일치, guard-bash.sh·init.sh `bash -n` 통과, AGENTS.md 지도와 실제 구조 일치(87줄).

hook 스모크 테스트는 12케이스(우회 변형 포함)로 확장되어 init.sh와 CI에 상설화되었다.
