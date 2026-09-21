# Gotechy Harness v1.2

> **Go, Build the technology, more easier.**
> 고텍이(고경석)의 AI 하네스 엔지니어링 템플릿 — 아이디어에서 배포·콘텐츠·커리어 시그널까지, 에이전트가 최고 성능으로 일하게 만드는 저장소 구조.

## 이게 뭔가요?

OpenAI의 하네스 엔지니어링(Harness Engineering) 문서 구조 + Anthropic Claude Code 공식 베스트 프랙티스 + 기존 gotechy-dev 파이프라인을 통합한 **여러 프로젝트 공용 템플릿**입니다.

- **OpenAI에서 가져온 것**: AGENTS.md 지도 패턴, docs/ 문서 수명주기(design-docs → exec-plans → product-specs → references), ExecPlan 헌법(PLANS.md), 품질 문서군, llms.txt 벤더링, doc-gardening
- **Anthropic에서 가져온 것**: CLAUDE.md 200줄 원칙과 @import 브리지, .claude/rules(paths 스코프), 스킬 점진적 공개(3층), 서브에이전트 격리, "권고는 CLAUDE.md, 강제는 hook"
- **고텍이 고유의 것**: 3종 출력 변환(제품+커리어 시그널+콘텐츠), 완료 게이트(50% 증후군 방어), Gotechy-Wiki ingest 파이프라인, 고텍이 브랜드 스킬

## 새 프로젝트에 적용하기

```bash
# 1. 템플릿 복사 (원본 이력은 두고 온다)
cp -r ~/gotechy-harness/ ~/workspace/my-new-project/
cd ~/workspace/my-new-project && rm -rf .git docs/references/research

# 2. 부트스트랩 — 스택·테스트·배포를 묻고 실제로 채운다
npm run init:harness -- --fix        # 대화형. 비대화형은 --yes --stack=node --deploy=vercel
npm install                          # 방금 추가된 devDependencies

# 3. 게이트가 살아있는지 확인 (여기까지 green이면 1일차 세팅 끝)
npm test && npm run lint && npm run check:boundaries

# 4. 시작
claude   # AGENTS.md 표준이라 Codex도 진입 가능 — 단 스킬·rules는 Claude Code 전용
```

`--fix`가 채우는 것: `src/` 레이어 골격(types→config→repo→service→runtime→ui) · 통과하는 예제 테스트 1개 · tsconfig · vitest 설정(커버리지 임계값 포함) · package.json 스크립트 전부 · ARCHITECTURE/AGENTS/DEPLOYMENT의 교체 자리.
무엇이 바뀌는지 먼저 보려면 `bash scripts/bootstrap.sh --dry-run`.

> **왜 자동으로 채우나**: 복사 직후에는 모든 게이트 명령이 실패 스텁이라, 규칙을 정확히 지키는 에이전트는 1일차에 완료를 선언할 수 없다. 검사만 하고 고쳐주지 않는 검사기가 온보딩 이탈의 최대 원인이었다.

Claude Code는 `CLAUDE.md → @AGENTS.md` 브리지로, Codex·Cursor 등은 `AGENTS.md`를 직접 읽습니다.

## 구조 한눈에 보기

```
gotechy-harness/
├── AGENTS.md            # 지도 (120줄 이하, agents.md 표준)
├── CLAUDE.md            # @AGENTS.md + Claude 전용
├── ARCHITECTURE.md      # 레이어·경계 지도 (matklad 관례)
├── docs/
│   ├── PLANS.md             # ExecPlan 작성 헌법
│   ├── WIZARD.md            # 기획·디자인 위저드 헌법 (7단계·질문 엔진·승인 락)
│   ├── AI_PLAYBOOK.md       # AI 기능 개발 과정 (4대 역량·eval·가드레일)
│   ├── ROUTINES.md          # 개발·프롬프팅 루틴
│   ├── PRODUCT_SENSE.md     # 제품 감각·대상 사용자
│   ├── DESIGN.md            # 디자인 시스템 (토큰·수치·anti-slop)
│   ├── FRONTEND.md          # 프론트 규범
│   ├── QUALITY_BAR.md       # 품질 기준 + 점수표 + 하네스 자체 측정
│   ├── RELIABILITY.md       # 신뢰성·백업·인시던트 런북
│   ├── SECURITY.md          # 보안 규범 (웹 + OWASP LLM Top 10)
│   ├── DEPLOYMENT.md        # 배포·롤백·시크릿 수명주기
│   ├── BRAND.md             # 고텍이 브랜드·콘텐츠 규범
│   ├── career.example.yaml  # 커리어 시그널 구조 (실명은 ~/.claude/에)
│   ├── design-docs/         # 설계 문서 (index + core-beliefs)
│   ├── product-specs/       # PRD + 위저드 템플릿 7종 (Brief→…→스타일가이드)
│   ├── exec-plans/          # active/ completed/ + 부채 추적
│   ├── decisions/           # ADR
│   ├── evals/               # LLM 골든셋 + eval 규약
│   ├── generated/           # 자동 생성 문서 (수동 편집 금지)
│   └── references/          # llms.txt 벤더링 + 리서치 보고서
├── .claude/
│   ├── settings.json        # 권한 + PreToolUse 가드 hook (guard-bash.sh — 스모크 테스트 필수)
│   ├── hooks/guard-bash.sh  # force push·시크릿 접근·재귀 삭제 차단 (L3 최소 구현)
│   ├── rules/               # paths 스코프 규칙 (코드/테스트/보안)
│   ├── skills/              # /gotechy-spec(위저드)·design·plan·ship·security·launch + blog-writer v2
│   └── agents/              # spec-reviewer, security-auditor, doc-gardener
├── prompts/                 # 프로덕션 프롬프트 버전 관리
├── scripts/
│   ├── init.sh              # 온보딩 검사 (npm run init:harness)
│   └── bootstrap.sh         # --fix 시 실제로 채우는 부트스트래퍼
├── .github/workflows/ci.yml # 완료 게이트의 CI 미러 (격리된 채점자)
└── .dependency-cruiser.cjs  # 레이어 경계 기계 강제
```

## 작업 수명주기

`AGENTS.md`의 "작업 수명주기" 절이 단일 출처다 (스펙 → 설계 → 계획 → 구현 → 검증 게이트 → 완료 → 출력 변환).

## 기존 gotechy 도구와의 관계 (중요)

`~/.claude/skills/`에 이미 설치된 **gotechy-dev 계열 9개 스킬**과 이 하네스는 **레이어가 다르다**. 경쟁 관계가 아니라 실행 엔진과 런타임 환경의 관계다.

| | gotechy-dev (전역 스킬) | Gotechy Harness (이 템플릿) |
|---|---|---|
| 역할 | **세션 오케스트레이터** — 언제 무엇을 실행할지, 상태(state.json), 체크포인트·재개 | **저장소 기질** — 에이전트가 읽는 컨텍스트·규범·강제 장치 |
| 사는 곳 | `~/.claude/skills/` (전역, 모든 프로젝트) | 프로젝트 저장소 안 (프로젝트마다 진화) |
| 생명주기 | 세션 단위 | 프로젝트 영속 |

**역할 분담** — 겹치는 기능은 아래 담당을 따른다:

| 하는 일 | 담당 |
|---|---|
| 새 프로젝트 scaffold + GitHub repo | `/gotechy-start` (phase 0) — 단, **scaffold 내용물로 이 템플릿을 쓴다** |
| 스펙·계획 문서의 양식 | 하네스 (`_template-prd.md`, `_template-exec-plan.md`) |
| 세션 상태·재개·중단 | `/gotechy-status` · `/gotechy-resume` · `/gotechy-abort` |
| phase 완료 체크리스트 | `/gotechy-gate <phase>` |
| 프로젝트 완료 게이트 (테스트·품질·문서·부채·evidence) | 하네스 `/gotechy-ship` |
| 블로그·SNS·카드뉴스 생성 | `/gotechy-blog` (gotekie-blog-writer 사용) |
| Gotechy-Wiki 적재 | `/gotechy-ingest` |
| 런치 체크·SEO/GEO 감사 | 하네스 `/gotechy-launch` |

> gotechy-dev가 설치되지 않은 환경(예: 로컬 데스크톱)에서는 하네스의 스킬만으로 전 과정이 돌아간다 — 템플릿은 자립적이다.

### ⚠️ 알려진 충돌 2건

1. **CLAUDE.md 덮어쓰기** — `/gotechy-start`의 phase 0.5가 인터뷰 답변으로 `CLAUDE.md`를 렌더한다. 하네스가 이미 있는 저장소에서 실행하면 `@AGENTS.md` 브리지가 사라지고 **하네스 문서 전체가 Claude Code에게 안 보이게 된다**. 조용한 치명적 실패라 `npm run init:harness`의 [5]번 검사가 이를 잡는다 — 걸리면 `CLAUDE.md` 첫 줄에 `@AGENTS.md`를 복구한다.
2. **`gotekie-blog-writer` 이름 충돌** — 전역 v1과 이 템플릿의 v2가 같은 이름이다. 프로젝트 스코프가 우선하지만 어느 쪽이 로드됐는지 헷갈린다. 전역을 v2로 교체해 단일화할 것을 권한다.

## 하네스가 실제로 효과 있는지 측정하기

주장이 아니라 숫자로 말한다 — `~/workspace/harness-bench`가 같은 과제를 하네스 켠 상태와 끈 상태로 풀려 통과율·재시도·토큰을 비교한다. 자세한 연결 방법은 `docs/QUALITY_BAR.md`의 "하네스 자체의 측정" 절.

## 함께 쓰면 좋은 외부 스킬 (조사 기반 추천)

상세: `docs/references/research/github-skills-ecosystem.md`

| 용도 | 추천 |
|---|---|
| 개발 방법론 뼈대 | obra/superpowers (이미 gotechy-dev가 래핑 중) |
| UI 품질 | anthropics/skills `frontend-design` + Leonxlnx/taste-skill |
| E2E 테스트 | anthropics/skills `webapp-testing` |
| 보안 감사 | trailofbits/skills, anthropics/claude-code-security-review |
| 마케팅 | coreyhaines31/marketingskills, AgriciDaniel/claude-seo |

## 리서치 원문 · 심사 기록

- `docs/references/research/openai-harness-engineering.md` — OpenAI 하네스 원문 분석
- `docs/references/research/anthropic-claude-code-harness.md` — Anthropic 공식 가이드 분석
- `docs/references/research/github-skills-ecosystem.md` — GitHub 스킬 생태계 조사
- `docs/references/research/ai-best-practices-2026.md` — AI 활용법 2025–26 (핵심 원칙 10·eval 구축법)
- `docs/references/research/expert-panel-review-v1.md` — 6인 전문가 심사 + Codex 교차 검토 + 최종 검증 원장

> 이 폴더는 **하네스 자신의 이력**이다. 새 프로젝트로 복사할 때는 제거하고 원본 저장소(`~/workspace/gotechy-harness`)에만 남기는 것을 권한다.
