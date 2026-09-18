# Anthropic 공식 Claude Code 하네스 가이드 리서치 보고서

(조사일: 2026-09-18. 출처: code.claude.com/docs, anthropic.com/engineering, github.com/anthropics/skills)

## 1. CLAUDE.md 베스트 프랙티스

출처: https://code.claude.com/docs/en/memory · https://code.claude.com/docs/en/best-practices

### 메모리 계층 (넓은 범위 → 좁은 범위 순 로드)
| 범위 | 위치 | 용도 |
|---|---|---|
| Managed(조직) | `/Library/Application Support/ClaudeCode/CLAUDE.md` | 회사 표준 (개인 제외 불가) |
| User | `~/.claude/CLAUDE.md` | 개인 스타일, 모든 프로젝트 |
| Project | `./CLAUDE.md` 또는 `./.claude/CLAUDE.md` | 아키텍처·팀 규약 (git 커밋) |
| Local | `./CLAUDE.local.md` (gitignore) | 개인 샌드박스 URL 등 |

- 파일들은 override가 아니라 **연결(concatenate)** — 가까운 것이 나중에 붙어 우선 효과.
- `@path` import (최대 4홉 재귀, 코드펜스 안은 무시). import도 시작 시 전부 로드되므로 **컨텍스트 절약 효과 없음** — 절약은 rules/skills로.
- `/init` 초기 생성, `/memory` 편집, `/context` 확인, `/doctor`가 불필요 내용 삭제 제안.

### 포함/제외 기준
- ✅ 추측 불가한 Bash 명령, 기본값과 다른 스타일 규칙, 테스트 지침, 저장소 에티켓, 아키텍처 결정, 필수 env var, 흔한 함정
- ❌ 코드 읽으면 아는 것, 표준 언어 관례, 상세 API 문서, 자주 바뀌는 정보, "clean code 쓰기" 같은 자명한 말
- **200줄 이하 목표** — "bloated CLAUDE.md는 실제 지시를 무시하게 만든다". 각 줄마다 "지우면 실수하는가?" 자문.
- CLAUDE.md는 user message로 전달되며 **강제력 없음** → 반드시 지킬 것은 **hook**으로.

### .claude/rules/ (모듈형 규칙)
```markdown
---
paths:
  - "src/api/**/*.ts"
---
# API Development Rules
```
- `paths` 있는 rule은 매칭 파일을 읽을 때만 로드 → **컨텍스트 절약**. 없는 rule은 시작 시 로드.

## 2. .claude/ 디렉터리 전체 구조

```
<repo>/
├── CLAUDE.md
├── CLAUDE.local.md            # 개인·비커밋
└── .claude/
    ├── settings.json          # 팀 공유 (permissions/hooks/env)
    ├── settings.local.json    # 개인 오버라이드
    ├── rules/*.md             # paths frontmatter로 스코프
    ├── skills/<name>/SKILL.md # = 슬래시 커맨드 (구 commands/ 통합)
    ├── agents/<name>.md       # 서브에이전트
    └── hooks/*.sh
```

### SKILL.md frontmatter 핵심 필드
```yaml
---
name: fix-issue
description: ...            # 자동 발동 판단 기준 — 가장 중요
argument-hint: "[issue]"
disable-model-invocation: true   # 부작용 작업: 사용자만 발동
user-invocable: false            # 백그라운드 지식: Claude만 발동
allowed-tools: Bash(git add *) Read
model: sonnet / effort: high
context: fork / agent: Explore   # 포크 서브에이전트 실행
paths: "*.py"                    # 자동 활성화 glob
---
```
- 치환: `$ARGUMENTS`, `$이름`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`, 동적 주입 `` !`git diff` ``
- **500줄 이하** + 큰 레퍼런스는 `references/` 분리. `/skill-doctor`로 진단.

### 서브에이전트 (.claude/agents/*.md)
```yaml
---
name: security-reviewer      # 필수
description: ...             # 필수: 언제 쓰는지
tools: Read, Grep, Glob      # 허용 목록
model: opus / memory: project / isolation: worktree
---
시스템 프롬프트 본문
```
- 내장: Explore(읽기 전용), Plan, general-purpose. 서브에이전트는 대화 이력을 받지 않음.

### Hooks (결정적 강제)
- 이벤트: PreToolUse/PostToolUse/Stop/SessionStart/UserPromptSubmit 등. 핸들러: command/http/mcp_tool/prompt/agent.
- 종료코드 2 = **차단**(stderr가 사유). **"매번 예외 없이 실행돼야 하는 것"은 CLAUDE.md(권고)가 아니라 hook(강제)**. Stop hook은 검증 통과까지 턴 종료를 막는 게이트.

### Plugins
- `.claude-plugin/plugin.json` manifest + skills/agents/hooks/.mcp.json 묶음. "`.claude/`에서 실험 → 공유 시점에 플러그인 변환" 권장.

## 3. 공식 skills 저장소 (github.com/anthropics/skills)

- 19개 스킬: docx/pdf/pptx/xlsx(프로덕션 사용), frontend-design, webapp-testing, mcp-builder, skill-creator, brand-guidelines, theme-factory 등.
- **skill-creator 작성 가이드**: 점진적 공개 3층 — ① name+description(항상 로드) ② SKILL.md 본문(<500줄, 발동 시) ③ 번들 리소스(필요 시). description은 "무엇을+언제+간접 사례까지 약간 적극적으로". 명령형, MUST 나열보다 이유 설명, 반복 작업은 스크립트 번들.

## 4. 에이전트 설계 엔지니어링 블로그

- **Building effective agents** (anthropic.com/engineering/building-effective-agents): 워크플로 vs 에이전트 구분. 5패턴 — prompt chaining / routing / parallelization / orchestrator-workers / evaluator-optimizer. 3원칙: 단순성, 투명성, ACI(도구 인터페이스) 설계.
- **Writing effective tools for agents**: API 래핑 대신 통합 도구, 의미 있는 컨텍스트 반환, 토큰 효율, 평가 기반 개선.
- **Effective context engineering**: 컨텍스트 = 유한한 attention budget (**context rot**). "최소한의 고신호 토큰 집합". Just-in-time 검색(경량 식별자 + 런타임 로드). 장기 작업: compaction + 구조화된 노트 + 서브에이전트 격리.
- **Multi-agent research system**: 리드는 서브에이전트에 목표·출력 포맷·경계 명시. 3-5 병렬로 최대 90% 시간 단축.

## 5. AGENTS.md와 Claude Code

- **Claude Code는 AGENTS.md를 직접 읽지 않고 CLAUDE.md만 읽음.** 공식 브리지:
```markdown
# CLAUDE.md
@AGENTS.md

## Claude Code 전용
...
```
- 또는 `ln -s AGENTS.md CLAUDE.md`. `/import`로 타 에이전트 설정 일괄 이관 가능.

## 6. 역할 분담 원칙 (하네스 설계 핵심)

| 니즈 | 도구 |
|---|---|
| 매 세션 필요한 사실 | CLAUDE.md (<200줄) |
| 특정 파일 영역 전용 규칙 | `.claude/rules/` + `paths` |
| 가끔 쓰는 절차·도메인 지식 | skills (온디맨드) |
| 반드시 강제할 것 | hooks |
| 컨텍스트 격리가 필요한 조사 | agents |
| 공유·배포 | plugin |

+ 검증 루프 내장(테스트/빌드/스크린샷을 Claude가 직접 돌리게), `/clear` 자주, 탐색은 서브에이전트로, 부작용 워크플로는 `disable-model-invocation: true`.
