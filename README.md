# Gotechy Harness v1.1

> **Go, Build the technology, more easier.**
> 고텍이(고경석)의 AI 하네스 엔지니어링 템플릿 — 아이디어에서 배포·콘텐츠·커리어 시그널까지, 에이전트가 최고 성능으로 일하게 만드는 저장소 구조.

## 이게 뭔가요?

OpenAI의 하네스 엔지니어링(Harness Engineering) 문서 구조 + Anthropic Claude Code 공식 베스트 프랙티스 + 기존 gotechy-dev 파이프라인을 통합한 **여러 프로젝트 공용 템플릿**입니다.

- **OpenAI에서 가져온 것**: AGENTS.md 지도 패턴, docs/ 문서 수명주기(design-docs → exec-plans → product-specs → references), ExecPlan 헌법(PLANS.md), 품질 문서군, llms.txt 벤더링, doc-gardening
- **Anthropic에서 가져온 것**: CLAUDE.md 200줄 원칙과 @import 브리지, .claude/rules(paths 스코프), 스킬 점진적 공개(3층), 서브에이전트 격리, "권고는 CLAUDE.md, 강제는 hook"
- **고텍이 고유의 것**: 3종 출력 변환(제품+커리어 시그널+콘텐츠), 완료 게이트(50% 증후군 방어), Gotechy-Wiki ingest 파이프라인, 고텍이 브랜드 스킬

## 새 프로젝트에 적용하기

```bash
# 1. 템플릿 복사
cp -r gotechy-harness/ ~/workspace/my-new-project/
cd ~/workspace/my-new-project

# 2. 온보딩 검사 — 교체 마커·시크릿 규약·hook 동작을 기계 검사
npm run init:harness

# 3. 프로젝트 값 채우기 (에이전트에게 시켜도 됨)
#    - AGENTS.md 하단 "프로젝트별 설정", ARCHITECTURE.md, package.json 스텁 스크립트
#    - docs/PRODUCT_SENSE.md 대상 사용자 확인 (이 README도 프로젝트 것으로 교체)

# 4. 시작
claude   # AGENTS.md 표준이라 Codex도 진입 가능 — 단 스킬·rules는 Claude Code 전용 (AGENTS.md 참조)
```

Claude Code는 `CLAUDE.md → @AGENTS.md` 브리지로, Codex·Cursor 등은 `AGENTS.md`를 직접 읽습니다.

## 구조 한눈에 보기

```
gotechy-harness/
├── AGENTS.md            # ~100줄 지도 (진입점, agents.md 표준)
├── CLAUDE.md            # @AGENTS.md + Claude 전용
├── ARCHITECTURE.md      # 레이어·경계 지도 (matklad 관례)
├── docs/
│   ├── PLANS.md             # ExecPlan 작성 헌법
│   ├── PRODUCT_SENSE.md     # 제품 감각·대상 사용자
│   ├── DESIGN.md            # 디자인 철학 (anti-slop)
│   ├── FRONTEND.md          # 프론트 규범
│   ├── QUALITY_BAR.md       # 품질 기준 + 품질 점수표
│   ├── RELIABILITY.md       # 신뢰성 요구사항
│   ├── SECURITY.md          # 보안 규범·위협 모델
│   ├── BRAND.md             # 고텍이 브랜드·콘텐츠 규범
│   ├── design-docs/         # 설계 문서 (index + core-beliefs)
│   ├── product-specs/       # PRD (템플릿 포함)
│   ├── exec-plans/          # active/ completed/ + 부채 추적
│   ├── decisions/           # ADR
│   ├── generated/           # 자동 생성 문서 (수동 편집 금지)
│   └── references/          # llms.txt 벤더링 + 리서치 보고서
├── .claude/
│   ├── settings.json        # 권한 + PreToolUse 가드 hook (guard-bash.sh — 스모크 테스트 필수)
│   ├── hooks/guard-bash.sh  # force push·시크릿 접근·재귀 삭제 차단 (L3 최소 구현)
│   ├── rules/               # paths 스코프 규칙 (코드/테스트/보안)
│   ├── skills/              # /gotechy-spec·plan·ship·security·launch + blog-writer v2
│   └── agents/              # spec-reviewer, security-auditor, doc-gardener
├── prompts/                 # 프로덕션 프롬프트 버전 관리
├── scripts/init.sh          # 온보딩 검사 (npm run init:harness)
├── .github/workflows/ci.yml # 완료 게이트의 CI 미러 (격리된 채점자)
└── .dependency-cruiser.cjs  # 레이어 경계 기계 강제
```

## 작업 수명주기

`AGENTS.md`의 "작업 수명주기" 절이 단일 출처다 (스펙 → 설계 → 계획 → 구현 → 검증 게이트 → 완료 → 출력 변환).

## 함께 쓰면 좋은 외부 스킬 (조사 기반 추천)

상세: `docs/references/research/github-skills-ecosystem.md`

| 용도 | 추천 |
|---|---|
| 개발 방법론 뼈대 | obra/superpowers (이미 gotechy-dev가 래핑 중) |
| UI 품질 | anthropics/skills `frontend-design` + Leonxlnx/taste-skill |
| E2E 테스트 | anthropics/skills `webapp-testing` |
| 보안 감사 | trailofbits/skills, anthropics/claude-code-security-review |
| 마케팅 | coreyhaines31/marketingskills, AgriciDaniel/claude-seo |

## 리서치 원문

- `docs/references/research/openai-harness-engineering.md` — OpenAI 하네스 원문 분석
- `docs/references/research/anthropic-claude-code-harness.md` — Anthropic 공식 가이드 분석
- `docs/references/research/github-skills-ecosystem.md` — GitHub 스킬 생태계 조사
