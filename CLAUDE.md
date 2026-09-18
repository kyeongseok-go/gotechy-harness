# CLAUDE.md

@AGENTS.md

## Claude Code 전용 규칙

- 복잡한 작업은 plan mode로 시작하고, 계획이 승인되면 ExecPlan(`docs/PLANS.md`)으로 옮겨 기록한다.
- 넓은 코드베이스 탐색은 Explore 서브에이전트로 위임한다 (메인 컨텍스트 보호).
- 파일 영역별 세부 규칙은 `.claude/rules/`가 자동 로드한다 — 여기 중복 기재하지 않는다.
- 부작용 있는 워크플로(배포·발행·ingest)는 해당 스킬을 사용자가 직접 호출했을 때만 실행한다.
- 매 세션 종료 전: 작업이 ExecPlan에 반영됐는지, 부채가 tech-debt-tracker에 기록됐는지 확인한다.

## 개인 컨텍스트 (고텍이)

- 커리어 방향 조언 시 "안정적 취업 우선" 제약을 먼저 고려한다 (창업·프리랜싱은 서브 트랙).
- 콘텐츠 산출물의 대상 독자: 부모님 + AI 초심자 (난도·톤 기준).
- 지식 파이프라인: 산출물은 Gotechy-Wiki(`~/Documents/Obsidian/Gotechy-Wiki/`)로 ingest 가능한 형태(frontmatter 포함 md)로 만든다.
