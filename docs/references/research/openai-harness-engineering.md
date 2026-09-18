# OpenAI "하네스 엔지니어링" 공식 가이드 리서치 보고서

(조사일: 2026-09-18)

## 1. 원본 출처

- **원문**: "Harness engineering: leveraging Codex in an agent-first world" — https://openai.com/index/harness-engineering/
- **저자**: Ryan Lopopolo (OpenAI MTS), 기여: Victor Zhu, Zach Brock. 게시일 2026-02-11.
- 실험: 2025년 8월 말 빈 git 저장소에서 시작, 5개월간 **수작업 코드 0줄** 제약으로 내부 베타 제품 구축. 최초 AGENTS.md도 Codex가 생성. 결과: 약 100만 줄, 약 1,500 PR, 1인당 하루 3.5 PR, 수작업 대비 약 1/10 시간.
- 핵심 철학: **"Humans steer. Agents execute."** / "What Codex can't see doesn't exist."

## 2. 공식 디렉터리 트리 (원문 그대로)

```
AGENTS.md
ARCHITECTURE.md
docs/
├── design-docs/
│   ├── index.md
│   ├── core-beliefs.md
│   └── ...
├── exec-plans/
│   ├── active/
│   ├── completed/
│   └── tech-debt-tracker.md
├── generated/
│   └── db-schema.md
├── product-specs/
│   ├── index.md
│   ├── new-user-onboarding.md
│   └── ...
├── references/
│   ├── design-system-reference-llms.txt
│   ├── nixpacks-llms.txt
│   ├── uv-llms.txt
│   └── ...
├── DESIGN.md
├── FRONTEND.md
├── PLANS.md
├── PRODUCT_SENSE.md
├── QUALITY_SCORE.md
├── RELIABILITY.md
└── SECURITY.md
```

### 각 파일/폴더의 정확한 용도

| 항목 | 용도 |
|---|---|
| `AGENTS.md` | **약 100줄의 "목차/지도"**. 백과사전이 아니라 더 깊은 진실의 원천으로 가는 포인터. "give Codex a map, not a 1,000-page instruction manual" |
| `ARCHITECTURE.md` | 도메인·패키지 레이어링의 최상위 지도 (matklad 관례: https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html) |
| `design-docs/index.md` | 설계 문서 카탈로그·색인 (**검증 상태** 포함) |
| `design-docs/core-beliefs.md` | 에이전트 우선 운영 원칙 문서 |
| `exec-plans/active/`, `completed/` | 진행/완료 실행 계획. 진행 로그·결정 로그 포함 **저장소에 체크인** |
| `exec-plans/tech-debt-tracker.md` | 기술 부채 추적 — 에이전트가 외부 컨텍스트 없이 작동하게 함 |
| `PLANS.md` | ExecPlan **작성 규칙 자체를 정의하는 메타 문서** |
| `generated/` | 코드/DB에서 자동 생성되는 문서 (사람이 아닌 도구가 재생성) |
| `product-specs/` | 기능 단위 제품 명세 — 저장소만으로 비즈니스 도메인 추론 가능하게 |
| `references/*-llms.txt` | 외부 라이브러리 문서를 **llms.txt 형식으로 저장소에 벤더링** |
| `DESIGN.md` / `FRONTEND.md` | 디자인 철학 / 프런트엔드 규범 |
| `PRODUCT_SENSE.md` | 제품 감각·도메인 컨텍스트 (에이전트 온보딩용) |
| `QUALITY_SCORE.md` | 도메인·레이어별 **품질 등급화** 및 격차 추적 |
| `RELIABILITY.md` / `SECURITY.md` | 신뢰성 요구사항 / 보안 규범·위협 모델 |

## 3. 문서 수명주기 (설계→계획→구현/생성→스펙/참고→품질/운영)

1. **진입**: 짧은 AGENTS.md → **점진적 공개**(progressive disclosure)
2. **설계**: Slack/Google Docs/머릿속 지식은 에이전트에게 안 보임 → 반드시 저장소 내 md로 인코딩
3. **계획**: 복잡한 작업은 PLANS.md 규칙에 따라 ExecPlan → active/ 체크인 → 살아있는 문서로 갱신 → 완료 시 completed/ 이동, 잔여 부채는 tech-debt-tracker에
4. **구현/생성**: 에이전트가 코드·테스트·CI 생성, 파생 문서는 generated/ 자동 재생성
5. **품질/운영(가비지 컬렉션)**: 전용 린터·CI가 문서 최신성 검증 + **doc-gardening 에이전트**가 낡은 문서를 스캔해 수정 PR 자동 생성 + 백그라운드 태스크가 골든 원칙 일탈 스캔·QUALITY_SCORE 갱신. "기술 부채는 고금리 대출 — 매일 소액 상환"

## 4. 아키텍처·취향 강제

- 도메인을 고정 레이어로 분할: **Types → Config → Repo → Service → Runtime → UI**, 횡단 관심사는 **Providers** 단일 인터페이스로만. 의존 방향은 커스텀 린터·구조 테스트로 기계 강제.
- "불변식을 강제하되 구현을 미시관리하지 않는다" (예: "parse, don't validate"는 요구하되 Zod는 지정 안 함)
- 커스텀 린트 **에러 메시지에 교정 지침을 넣어** 에이전트 컨텍스트로 주입
- "boring" 기술 선호. 차단형 머지 게이트 최소화 — "교정은 싸고, 대기는 비싸다"
- PR 완결 루프: 자체 리뷰 → 에이전트 리뷰 → 반영 반복 ("Ralph Wiggum Loop", 6시간+ 단일 실행도 정기 발생)

## 5. AGENTS.md 표준

- https://agents.md/ · https://github.com/openai/agents.md (MIT, 24k+ 스타)
- "a README for agents". **필수 필드 없는 순수 마크다운**. 6만+ 프로젝트 채택, 25개+ 도구 지원(Codex, Cursor, Copilot, Devin 등). Linux Foundation 산하 Agentic AI Foundation 거버넌스.
- 모노레포: 중첩 AGENTS.md 허용 — "편집 중인 파일에 가장 가까운 파일이 우선, 사용자 채팅 지시가 모든 것에 우선"
- Codex 탐색 규칙: 전역 `~/.codex/AGENTS.md` → 프로젝트 루트→cwd로 연결(가까운 파일 우선), 기본 32KiB 제한

## 6. ExecPlan 공식 템플릿 (Codex Cookbook)

출처: https://cookbook.openai.com/articles/codex_exec_plans (Aaron Friel, 2025-10-07). 단일 프롬프트 7시간+ 작동을 가능케 한 PLANS.md 전문 공개.

- **비타협 요구사항**: 완전 자기완결 / 살아있는 문서 / 저장소를 모르는 초보자도 끝까지 구현 가능 / "정의 충족"이 아닌 **실증 가능한 동작** / 전문용어 평이하게 정의
- **필수 유지 섹션**: `Progress`(타임스탬프 체크리스트), `Surprises & Discoveries`, `Decision Log`(Decision/Rationale/Date), `Outcomes & Retrospective`
- **스켈레톤**: 행동 지향 제목 → Purpose/Big Picture → Progress → Surprises → Decision Log → Outcomes → Context and Orientation → Plan of Work → Concrete Steps(정확한 명령+예상 출력) → Validation and Acceptance(행동으로 기술) → Idempotence and Recovery → Artifacts → Interfaces and Dependencies
- AGENTS.md 연결 문구: "When writing complex features or significant refactors, use an ExecPlan (as described in PLANS.md) from design to implementation."

## 7. llms.txt 관례

- 스펙: https://llmstxt.org/ (Jeremy Howard). 형식: H1 + blockquote 요약 + H2 섹션별 `[name](url): 설명` 링크 목록.
- 하네스 용법: 라이브러리 문서를 `docs/references/{lib}-llms.txt`로 벤더링 → 에이전트가 네트워크 없이 외부 의존성 추론.

## 8. 커뮤니티 재구현 (참고)

- https://github.com/mcqua007/agents-skeleton — 블로그 트리 재현 + 템플릿 + 멀티 툴 심링크
- https://github.com/Gizele1/harness-init — golden-principles/, 주간 gc 워크플로, 경계 테스트
- https://github.com/JacobLinCool/harness-engineering-skill — 하네스 구조를 스킬로 패키징 + 문서 드리프트 검증 스크립트
