# AGENTS.md — Gotechy Harness 지도

> 이 파일은 **백과사전이 아니라 지도**다. 상세 규칙은 각 문서가 진실의 원천(source of truth)이며, 여기는 "어디를 볼지"만 알려준다.
> 원칙: **Humans steer. Agents execute.** 사람(고텍이)은 방향을 조향하고, 에이전트는 실행한다.

## 운영 헌법 요약 (원문·우선순위는 `docs/design-docs/core-beliefs.md` — 충돌 시 그쪽이 이긴다)

1. **저장소 밖 지식은 존재하지 않는 것** — 결정·스펙·맥락은 저장소의 md로 인코딩한다.
2. **완료 게이트** — "산출물 있음 + 검증 통과"가 완료의 정의 (50% 증후군 방어). 게이트 명령이 없으면 실패지 스킵이 아니다.
3. **3종 출력 변환** — ①동작하는 제품 ②커리어 시그널(evidence) ③콘텐츠 재료.
4. **지도는 짧게, 진실은 깊게** — 이 파일은 120줄 이하 유지.
5. **품질 bar = 각 분야 최고 전문가** — 기준·판정 루브릭은 `docs/QUALITY_BAR.md`.

## 문서 지도 (progressive disclosure)

| 알아야 할 것 | 문서 |
|---|---|
| 시스템 전체 구조·레이어 | `ARCHITECTURE.md` |
| 에이전트 우선 운영 원칙 (왜 이렇게 일하나) | `docs/design-docs/core-beliefs.md` |
| 설계 문서 색인 | `docs/design-docs/index.md` |
| 제품 스펙 (기능이 뭘 해야 하나) | `docs/product-specs/index.md` |
| 실행 계획 작성 규칙 (ExecPlan 헌법) | `docs/PLANS.md` |
| AI 기능·서비스 개발 과정 (4대 역량, eval, 가드레일) | `docs/AI_PLAYBOOK.md` |
| 개발·프롬프팅 루틴 | `docs/ROUTINES.md` |
| 진행 중/완료된 실행 계획 | `docs/exec-plans/active/` · `completed/` |
| 기술 부채 | `docs/exec-plans/tech-debt-tracker.md` |
| 의사결정 기록 (ADR) | `docs/decisions/` |
| 제품 감각·대상 사용자 | `docs/PRODUCT_SENSE.md` |
| 디자인 철학·비주얼 | `docs/DESIGN.md` |
| 프론트엔드 규범 | `docs/FRONTEND.md` |
| 품질 기준·품질 점수 | `docs/QUALITY_BAR.md` |
| 신뢰성 요구사항 | `docs/RELIABILITY.md` |
| 보안 규범·위협 모델 | `docs/SECURITY.md` |
| 브랜드·콘텐츠·마케팅 규범 | `docs/BRAND.md` |
| 배포·롤백·시크릿 수명주기 | `docs/DEPLOYMENT.md` |
| LLM 골든셋·eval 규약 | `docs/evals/README.md` |
| 커리어 키워드·증거 기준 (데이터) | `~/.claude/gotechy-career.yaml`(개인) 또는 `docs/career.example.yaml` |
| 프로덕션 프롬프트 (버전 관리) | `prompts/` |
| 외부 라이브러리 문서 (벤더링) | `docs/references/` |
| 자동 생성 문서 (수동 편집 금지) | `docs/generated/` |

## 작업 수명주기

```
아이디어 → 스펙(product-specs) → 설계(design-docs/ADR) → 계획(exec-plans/active)
        → 구현(+테스트) → [보안 리뷰] → 완료 게이트 → 완료(exec-plans/completed)
        → 출력 변환(블로그·위키·커리어 evidence) → 부채 기록(tech-debt-tracker)
```

**작업 크기 판정** (등급이 문서 부담과 게이트 범위를 정한다)

| 크기 | 스펙 | 계획 | 게이트 |
|---|---|---|---|
| 1시간 미만·파일 1~2개·동작 계약 불변 | 생략 | 생략 | **패치** 등급 |
| 1일 미만의 작은 기능 | 미니 스펙 | 생략 가능 | 기능 등급 |
| 그 이상, 또는 **사용자 데이터·인증·결제를 건드림** | 풀 스펙 | ExecPlan 필수 | 기능/릴리스 등급 |

- **보안 리뷰는 선택이 아니다**: 인증·API·DB·개인정보를 건드렸으면 완료 전에 반드시 보안 리뷰(`docs/SECURITY.md` 체크리스트). 크기와 무관하다.
- **완료 시**: 회고 작성 → 게이트 검사 → `completed/`로 이동.

## 에이전트 행동 규칙

- 사용자가 기능을 요청하면 **크기를 먼저 판정해 알리고** 해당 경로로 진행한다. 애매하면 큰 쪽으로 잡고 사용자에게 확인받는다.
- 스펙·계획·게이트는 에이전트가 직접 수행한다. **부작용이 있는 것**(배포, 외부 발행, 위키 적재, force push)은 사용자가 명시적으로 지시했을 때만 실행한다.
- 계획만 늘어놓고 턴을 끝내지 않는다 — 실행하거나, 막힌 지점을 명확히 보고한다.

## 슬래시 커맨드 (스킬 — Claude Code 전용)

> Codex 등 다른 에이전트로 작업할 때는 스킬이 로드되지 않는다 — 완료 게이트는 `docs/PLANS.md` 완료의 정의 절 + `bash scripts/init.sh`를 수동 수행한다.

| 커맨드 | 역할 |
|---|---|
| `/gotechy-spec` | 아이디어 → PRD + career_signals 생성 |
| `/gotechy-plan` | 스펙 → ExecPlan 생성·갱신 |
| `/gotechy-ship` | 완료 게이트 검사 (패치/기능/릴리스 3등급, 부분 점수 보고) |
| `/gotechy-security` | 보안 리뷰 (docs/SECURITY.md 기준) |
| `/gotechy-launch` | 런치·SEO/GEO·마케팅 산출물 |
| `/gotekie-blog-writer` | 고텍이 페르소나 블로그 글 (v2) |

## 서브에이전트

- `spec-reviewer` — 스펙·계획의 허점을 적대적으로 리뷰
- `security-auditor` — 읽기 전용 보안 감사
- `doc-gardener` — 코드와 어긋난 낡은 문서 탐지·수정 제안

## 커뮤니케이션 규칙

- **언어**: 한국어 (기술 고유명사는 원어: skill, phase, PR, RAG 등)
- 테스트 실패·미완료는 숨기지 말고 그대로 보고 (실패 은폐 금지).

## 프로젝트별 설정 (새 프로젝트에서 채울 것)

> 이 템플릿을 새 프로젝트에 복사한 뒤, 아래를 프로젝트 값으로 교체한다.

- **빌드/테스트 명령**: `npm run build` · `npm test` (교체 — 현재는 명시적 실패 스텁)
- **개발 서버**: `npm run dev` (교체)
- **배포**: `docs/DEPLOYMENT.md`의 환경 매트릭스·명령 채우기 (교체)
- **스택**: TypeScript strict, React/Next.js, Node.js (기본값 — 교체 가능)
- 복사 직후 `npm run init:harness`로 온보딩 검사를 통과시킨다 — 교체 마커가 남아 있으면 지도가 거짓말을 하는 상태다.
