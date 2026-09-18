# Claude Code 스킬/플러그인/에이전트 GitHub 생태계 조사 보고서

(조사일: 2026-09-18, 스타 수는 GitHub API 실시간 조회 기준)

---

## 1. 생태계 허브 (필수 북마크 저장소)

| 저장소 | 스타 | 설명 |
|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | 약 288k | 생태계 최다 스타. 스킬 프레임워크 + 개발 방법론 (TDD, 계획, 서브에이전트 오케스트레이션) |
| [anthropics/skills](https://github.com/anthropics/skills) | 약 177k | Anthropic 공식 스킬 저장소. docx/pdf/pptx/xlsx 문서 스킬 + frontend-design, webapp-testing, mcp-builder, skill-creator 등 19종 |
| [anthropics/claude-code](https://github.com/anthropics/claude-code) | 약 146k | Claude Code 본체. `/security-review` 등 내장 커맨드 포함 |
| [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | 약 75k | 스킬 큐레이션 목록 |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 약 54k | 가장 오래된 대표 큐레이션 목록 (스킬/에이전트/플러그인/후크/도구) |
| [wshobson/agents](https://github.com/wshobson/agents) | 약 40k | 94개 플러그인 = 202 에이전트 + 183 스킬 + 105 커맨드. 도메인 커버리지가 가장 넓은 멀티하네스 마켓플레이스 |
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 약 36k | Anthropic 공식 플러그인 디렉터리 (`/plugin install X@claude-plugins-official`) |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 약 35k | 1,000+ 스킬 큐레이션 (Claude Code/Codex/Cursor 호환) |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 약 25k | 10개 카테고리 161+ 프로덕션급 서브에이전트 |

설치 방식 요약:
- **플러그인 마켓플레이스**: `/plugin marketplace add <owner>/<repo>` → `/plugin install <name>` (anthropics/skills, wshobson/agents, superpowers 등)
- **npx 도구**: `npx skills add <owner>/<repo>` 또는 `gh skill install` (marketingskills, superdesign 등)
- **수동 복사**: `~/.claude/skills/` 또는 `.claude/agents/`에 파일 복사 (VoltAgent 등은 `./install-agents.sh` 스크립트 제공)

---

## 2. 도메인별 상세

### (1) 프론트엔드 / 디자인(UI·UX)

| 스킬/에이전트 | 출처 | 내용 · 트리거 | 인기 |
|---|---|---|---|
| **frontend-design** | [anthropics/skills](https://github.com/anthropics/skills) | 공식 스킬. "AI 냄새 나는" 획일적 UI를 피하고 프로덕션급 심미적 프론트엔드 생성. UI 생성 요청 시 트리거 | 저장소 177k |
| **taste-skill** | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | "AI에게 좋은 취향을" — 보라색 그라데이션·기본 shadcn 같은 슬롭 디자인 방지 | 약 88k |
| **superdesign-skill** | [superdesigndev/superdesign-skill](https://github.com/superdesigndev/superdesign-skill) | 디자인 시스템 기반의 출시 가능한 UI 생성. `npx skills add superdesigndev/superdesign-skill` | 573 |
| **react-specialist / vue-expert / ui-designer** | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 프레임워크별 프론트엔드 전문 서브에이전트 | 25k |
| **Frontend Design Toolkit** | [wilwaldon/Claude-Code-Frontend-Design-Toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit) | 프론트엔드 품질을 높이는 스킬/플러그인/MCP/CLAUDE.md 트릭 모음집 | 1.1k |

### (2) 백엔드

| 스킬/에이전트 | 출처 | 내용 | 인기 |
|---|---|---|---|
| **python-pro, django-pro, fastapi-pro** | [wshobson/agents](https://github.com/wshobson/agents) | 언어·프레임워크별 백엔드 전문 에이전트. `/plugin install python-development` | 40k |
| **backend-developer, api-designer, database 계열** | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | API 설계, 인증, DB 최적화 등 코어 백엔드 에이전트 | 25k |
| **pg-aiguide** | [timescale/pg-aiguide](https://github.com/timescale/pg-aiguide) | PostgreSQL 전문 스킬+MCP. 더 나은 SQL/스키마 코드 생성 | 1.8k |
| **mcp-builder** | [anthropics/skills](https://github.com/anthropics/skills) | 공식. MCP 서버 구축 스킬 (외부 서비스 연동 백엔드에 유용) | 177k |
| **0xfurai/claude-code-subagents** | [0xfurai/claude-code-subagents](https://github.com/0xfurai/claude-code-subagents) | 100+ 언어/스택별 프로덕션 서브에이전트 | 1.0k |

### (3) 풀스택 / 워크플로우 프레임워크

| 항목 | 출처 | 내용 | 인기 |
|---|---|---|---|
| **superpowers** | [obra/superpowers](https://github.com/obra/superpowers) | brainstorming → writing-plans → git worktree 격리 → subagent-driven-development → TDD(RED-GREEN-REFACTOR) → code-review → merge의 7단계 방법론. `/plugin install superpowers@claude-plugins-official` | 288k |
| **cc-sdd** | [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) | 승인된 스펙을 장기 자율 구현으로 전환하는 스펙 주도 개발(SDD) 하네스 | 3.7k |
| **lst97/claude-code-sub-agents** | [lst97/claude-code-sub-agents](https://github.com/lst97/claude-code-sub-agents) | 풀스택 개발용 서브에이전트 컬렉션 | 1.7k |
| **ECC** | [affaan-m/ECC](https://github.com/affaan-m/ECC) | 스킬+메모리+시큐리티+리서치 우선 개발을 묶은 하네스 최적화 시스템 | 261k (스타 인플레 의심) |

### (4) 제품 기획 / PM

| 항목 | 출처 | 내용 | 인기 |
|---|---|---|---|
| **BMAD-METHOD** | [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | Analyst/PM/Architect/SM 에이전트가 PRD·아키텍처 문서를 만들고 스토리 단위로 구현하는 애자일 AI 개발 방법론 | 53k |
| **ccpm** | [automazeio/ccpm](https://github.com/automazeio/ccpm) | GitHub Issues + git worktree 기반 프로젝트 관리 스킬. PRD → 에픽 → 이슈 → 병렬 에이전트 실행 | 8.4k |
| **claude-code-spec-workflow** | [Pimzino/claude-code-spec-workflow](https://github.com/Pimzino/claude-code-spec-workflow) | Requirements → Design → Tasks → Implementation 자동 워크플로우 | 3.9k |
| **product-manager, business-analyst, ux-researcher** | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | PM 문서·시장분석·UX 리서치 에이전트 | 25k |
| **specweave** | [anton-abyzov/specweave](https://github.com/anton-abyzov/specweave) | 기능 설명 → 스펙+계획+태스크 생성, GitHub/JIRA 동기화 | 162 |

### (5) 보안

| 항목 | 출처 | 내용 | 인기 |
|---|---|---|---|
| **trailofbits/skills** | [trailofbits/skills](https://github.com/trailofbits/skills) | 보안 감사 전문업체의 실전 스킬 40여 종: `differential-review`, `static-analysis`(Semgrep/CodeQL), `insecure-defaults`, `supply-chain-risk-auditor`, `variant-analysis`, `sharp-edges` 등 | 7.1k |
| **claude-code-security-review** | [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review) | 공식. PR 변경분을 취약점 분석하는 GitHub Action + Claude Code 내장 `/security-review` 커맨드 | 6.2k |
| **Anthropic-Cybersecurity-Skills** | [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | MITRE ATT&CK/NIST CSF 등 6개 프레임워크에 매핑된 817개 구조화 보안 스킬 | 33k |
| **pentest-ai-agents** | [0xSteph/pentest-ai-agents](https://github.com/0xSteph/pentest-ai-agents) | 인가된 침투 테스트용 서브에이전트 (정찰 분석, 익스플로잇 리서치, 리포트) | 2.2k |
| **security-auditor** | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 일상용 보안 감사 서브에이전트 | 25k |

### (6) 마케팅 / 그로스

| 항목 | 출처 | 내용 | 인기 |
|---|---|---|---|
| **marketingskills** | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | 70+ 스킬: `cro`, `copywriting`, `seo-audit`, `ai-seo`, `programmatic-seo`, `ab-testing`, `pricing`, `launch`, `onboarding` 등. `npx skills add coreyhaines31/marketingskills` | 51k |
| **claude-seo** | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) | 25개 서브스킬+18개 서브에이전트의 종합 SEO (기술 SEO, 스키마, GEO/AEO, 로컬 SEO, PDF 리포트) | 17k |
| **geo-seo-claude** | [zubair-trabzada/geo-seo-claude](https://github.com/zubair-trabzada/geo-seo-claude) | AI 검색 최적화(GEO) 특화 — 인용가능성 스코어링, AI 크롤러 분석 | 11k |
| **ai-marketing-claude** | [zubair-trabzada/ai-marketing-claude](https://github.com/zubair-trabzada/ai-marketing-claude) | 15개 마케팅 스킬 병렬 서브에이전트 (사이트 감사, 카피, 이메일 시퀀스, 광고 캠페인) | 2.7k |
| **kostja94/marketing-skills** | [kostja94/marketing-skills](https://github.com/kostja94/marketing-skills) | SEO/소셜/인플루언서 등 160+ 오픈소스 마케팅 스킬 | 977 |

### (7) 테스팅 / QA

| 항목 | 출처 | 내용 | 인기 |
|---|---|---|---|
| **webapp-testing** | [anthropics/skills](https://github.com/anthropics/skills) | 공식. Playwright 기반 웹앱 E2E 상호작용 테스트 스킬 | 177k |
| **test-driven-development** | [obra/superpowers](https://github.com/obra/superpowers) | RED-GREEN-REFACTOR TDD 강제 스킬 + verification-before-completion | 288k |
| **qa-expert, test-automator, accessibility-tester** | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 테스트 자동화·접근성 검사 서브에이전트 | 25k |
| **mutation-testing / property-based-testing** | [trailofbits/skills](https://github.com/trailofbits/skills) | 테스트 스위트의 실질 검증력을 높이는 고급 테스트 스킬 | 7.1k |
| **PluginEval** | [wshobson/agents](https://github.com/wshobson/agents) | 에이전트/스킬 품질 평가 도구 포함 | 40k |

### (8) DevOps

| 항목 | 출처 | 내용 | 인기 |
|---|---|---|---|
| **deployment/infra 플러그인군** | [wshobson/agents](https://github.com/wshobson/agents) | Kubernetes, Terraform, 클라우드 인프라 도메인 플러그인 | 40k |
| **devops-engineer, kubernetes-specialist, terraform-engineer** | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | Docker/K8s/Terraform/AWS·Azure·GCP 인프라 카테고리 | 25k |
| **devcontainer-setup** | [trailofbits/skills](https://github.com/trailofbits/skills), [trailofbits/claude-code-devcontainer](https://github.com/trailofbits/claude-code-devcontainer) | 샌드박스 devcontainer에서 안전하게 bypass 모드 실행 | 942 |
| **gh-cli 스킬** | [trailofbits/skills](https://github.com/trailofbits/skills) | GitHub CLI 운영 워크플로우 | 7.1k |

### (9) 문서화

| 항목 | 출처 | 내용 | 인기 |
|---|---|---|---|
| **docx / pdf / pptx / xlsx** | [anthropics/skills](https://github.com/anthropics/skills) | 공식 프로덕션급 문서 생성 스킬. `/plugin install document-skills@anthropic-agent-skills` | 177k |
| **documentation-engineer, api-documenter, technical-writer** | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | API 문서·기술 문서 전담 에이전트 | 25k |
| **C4 documentation pipeline** | [wshobson/agents](https://github.com/wshobson/agents) | C4 모델 아키텍처 문서 자동 생성 | 40k |
| **agent-toolkit** | [softaworks/agent-toolkit](https://github.com/softaworks/agent-toolkit) | 개발·문서화·기획용 큐레이션 스킬 모음 | 2.5k |
| **project-multilevel-index** | [Claudate/project-multilevel-index](https://github.com/Claudate/project-multilevel-index) | 코드 인덱스·파일 헤더·의존성 그래프 자동 유지 문서 시스템 | 139 |

---

## 3. 솔로 개발자용 "베스트 15" 툴킷 추천

기획 → 설계 → 프론트 → 백엔드 → 보안 → 마케팅 전 주기를 커버하는 조합. 원칙: **공식 스킬을 기본으로, 방법론 1개(superpowers), 도메인 대형 컬렉션 2개(wshobson, VoltAgent), 전문 단품으로 보강.**

**기반 방법론 (2)**
1. **superpowers** (obra/superpowers) — 계획→TDD→리뷰→머지 전체 개발 루프. 워크플로우의 뼈대
2. **ccpm** (automazeio/ccpm) — PRD→에픽→GitHub Issues→병렬 실행. 솔로에게는 무거운 BMAD보다 실용적

**기획/PM (2)**
3. **claude-code-spec-workflow** (Pimzino) — 기능 단위 Requirements→Design→Tasks 스펙 주도 개발
4. **product-manager + ux-researcher** (VoltAgent subagents) — PRD 작성·유저 리서치 보조

**디자인/프론트엔드 (3)**
5. **frontend-design** (anthropics/skills, 공식) — 프로덕션급 UI 기본기
6. **taste-skill** (Leonxlnx) — AI 슬롭 디자인 방지 레이어
7. **react-specialist** 또는 자기 스택의 프레임워크 에이전트 (VoltAgent 또는 wshobson)

**백엔드/풀스택 (2)**
8. **wshobson/agents**의 자기 언어 플러그인 (예: TypeScript/Node 계열)
9. **mcp-builder** (anthropics/skills, 공식) — 외부 서비스 연동 시

**테스팅/QA (2)**
10. **webapp-testing** (anthropics/skills, 공식) — Playwright E2E
11. **test-driven-development** (superpowers 내장) — 단위 테스트 규율

**보안 (2)**
12. **claude-code-security-review** (anthropics) — PR마다 자동 취약점 스캔 (GitHub Action)
13. **trailofbits/skills** — 출시 전 `static-analysis`, `insecure-defaults`, `supply-chain-risk-auditor` 감사

**마케팅/문서 (2)**
14. **marketingskills** (coreyhaines31) — 카피·CRO·랜딩·프라이싱·런치까지 원스톱. 솔로 창업자에게 사실상 필수
15. **claude-seo** (AgriciDaniel) — 기술 SEO + GEO/AEO (AI 검색 노출)

---

## 4. 주의사항

- 최근 스타 수 인플레이션이 심해(캠페인성 스타 의심 저장소 다수) 스타 수만으로 품질을 판단하기 어렵다.
- 신뢰 기준: (1) Anthropic 공식(anthropics/*), (2) 실명 전문가·전문업체(obra=Jesse Vincent, wshobson, Trail of Bits, Corey Haines), (3) 커뮤니티 검증 큐레이션([trailofbits/skills-curated](https://github.com/trailofbits/skills-curated)).
- 서드파티 스킬은 설치 전 SKILL.md와 스크립트를 직접 검토할 것 (플러그인은 임의 코드 실행 가능).
