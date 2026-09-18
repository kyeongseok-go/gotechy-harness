# references/ — 외부 지식 벤더링

> **에이전트가 컨텍스트로 접근할 수 없는 것은 존재하지 않는 것이다.**
> 핵심 의존 라이브러리·도구의 문서를 llms.txt 형식으로 이 폴더에 벤더링해, 에이전트가 네트워크 없이 추론할 수 있게 한다.

## 규칙

- 파일명: `{라이브러리}-llms.txt` (예: `nextjs-llms.txt`, `tailwind-llms.txt`)
- 출처: 해당 프로젝트 공식 `llms.txt`(https://llmstxt.org/ 관례) 또는 공식 문서 요약. 파일 상단에 출처 URL과 수집 날짜를 기록한다.
- 새 핵심 의존성을 추가하면(ADR 기록과 함께) 여기에 llms.txt도 추가한다.
- doc-gardener 주기 실행(주 1회) 시 낡은 버전을 함께 점검한다.

## 현재 벤더링 목록

| 파일 | 대상 | 수집일 |
|---|---|---|
| (프로젝트별로 채움) | | |

## research/ — 하네스 리서치 원문

- [openai-harness-engineering.md](research/openai-harness-engineering.md) — OpenAI 하네스 엔지니어링 원문 분석
- [anthropic-claude-code-harness.md](research/anthropic-claude-code-harness.md) — Anthropic Claude Code 공식 가이드 분석
- [github-skills-ecosystem.md](research/github-skills-ecosystem.md) — GitHub 스킬 생태계 조사 (분야별 베스트 + 추천 툴킷 15)
