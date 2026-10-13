---
title: 전문가 라이브러리 재설계 리서치 (2026-10)
date: 2026-10-13
tags: [harness, agent-skills, orchestration, context-engineering, career, comprehension-debt]
status: 조사 완료 (6개 영역 + 직접 확인)
---

# 전문가 라이브러리 재설계 리서치 (2026-10-13)

> 목적: gotechy-harness를 "프로젝트마다 복사하는 템플릿"에서 "어디서든 필요한 전문가만 불러 쓰는 멀티 LLM 라이브러리 + 오케스트레이션"으로 바꾸는 설계의 근거 모음.
> 표기: 수치는 출처의 자체 측정이면 (자체), 2차 출처면 (2차)라고 붙인다. 조사 에이전트 결과 + 직접 확인을 합쳤다.

## 1. 계기 영상 — 크래프톤 AI 역량평가 'Probe' 인터뷰

- 「크래프톤 AI 역량 평가에서 개발 경험 없는 매장 직원 출신이 상위권에 오른 이유」, 빌더 조쉬, 2026-10-13, 48:09. https://www.youtube.com/watch?v=CLpN3zl8noQ (한국어 자동자막으로 확인, 타임스탬프 ±30초)
- 평가 3축: **결과물 · AI 활용(의도) · 이해도(인지)** [22:16]. 근거는 Storey의 기술·의도·인지 부채 모델 (arXiv 2603.22106, 2026-03) [25:00].
- 오버엔지니어링은 "AI에 주도권을 뺏긴 신호"로 감점 [26:30~28:30].
- "코드를 사랑하는 사람은 뽑고 싶지 않다" [00:00], "처음부터 내가 다 만들어야지 하는 사람은 비생산적, 에고를 버려라" [31:00].
- 역할 확장 4단계: AI 네이티브 스택 엔지니어 → 풀스택 → 프로덕트 엔지니어 → FDE [38:36~40:10]. 40:46 부근: AI 네이티브 채용담당자가 직접 배포하고 QA까지 한다.
- "일하는 방식을 업데이트하는 루프를 스스로 돌려라" [45:30], "의도 부채 관리가 중요 — 의도를 너무 많이 넣으면 닫히지 않은 루프가 남는다" [47:00].
- 같은 날 Probe를 쓰는 100명+ 채용연계형 인턴 발표 (조선비즈 2026-10-13).

## 2. 목표 직무 (2025~2026, 국내+글로벌)

| 역할 | 핵심 | 채용 증거 |
|---|---|---|
| AI 네이티브 개발자 | 직무를 에이전트 위임+검증 루프로 재설계 (직함보다 채용 기준) | 실무형 AI 과제, 작업 기록, 질의응답 |
| AX 엔지니어 | SI형(고객 도메인→RAG·에이전트 구축·납품) / 사내형(현업 자동화) | 납품·검수 실적, 문서화 |
| FDE | 고객 현장에서 요구 파악→구축→운영 배포→정착, 패턴을 제품에 환류 | 모호한 요구→프로토타입 케이스 면접 |
| AI 풀스택/프로덕트 엔지니어 | 문제 정의→API·UI→LLM 기능→배포 | 실서비스 URL, 데모 |
| PO | 문제 발견→출시→지표 검증→계속/중단 결정 | PM/PO 경력 5년+ |

- 공통 코어: 문제 정의 질문력 · AI 위임 시 의도·비용 통제 · eval 설계 · 결과 설명력 · 배포와 실사용 정착 책임 · 도메인 소통.
- 시장: 잡코리아 2026 상반기 AI 직무 공고 +128%, 경력 +140% (비즈워치 2026-09-16). 기업이 가장 뽑으려는 연차 4~7년 49.7% (원티드랩, 2025-12-08). Anthropic, 파트너 엔지니어 1만 명 FDE형 양성에 1억 달러 (CNBC 2026-10-02). FDE 공고 Indeed 2026-04 기준 2025-01 대비 +5,230% (BI 2026-05-16).
- 국내 FDE 세 갈래: 고객사 투입 풀스택형(채널톡), 인프라형(마키나락스), 사내 AX PM형(크래프톤) (Candid 2026-06-10).
- 확인 못 함: 삼성SDS·SK AX의 FDE 직함 공고, 국내 FDE 연봉.

## 3. Claude Code 사실 (CLI 2.1.296 기준)

- **스킬 목록 예산**: 컨텍스트 창의 1% (대체 8,000자). 항목당 description+when_to_use 1,536자 상한. **넘치면 가장 덜 쓴 스킬부터 description이 빠진다**. `skillListingBudgetFraction`, `SLASH_COMMAND_TOOL_CHAR_BUDGET`. https://code.claude.com/docs/en/skills
- **이식 가능한 frontmatter**: claude.ai·Skills API는 `name, description, license, compatibility, metadata, allowed-tools`만 허용, 그 외 키는 하드 에러. Claude 전용 키(`paths`, `context: fork`, `model` 등)는 어댑터 쪽에 둔다.
- **플러그인**: `.claude-plugin/plugin.json` + `skills/ agents/ commands/ hooks/ .mcp.json bin/`. 개인 마켓플레이스 = GitHub 저장소의 `.claude-plugin/marketplace.json`, `#ref`로 고정. 개인 마켓은 자동 업데이트 기본 꺼짐, 버전 문자열이 바뀌어야 갱신. 프로젝트별로 `"name@market": false`로 끌 수 있다.
- **서브에이전트**: `skills:`로 최대 32개 스킬 전문을 미리 로드, 부모 대화·캐시를 공유하지 않음, 요약만 반환.
- **`claude plugin eval`**: `evals/<case>/prompt.md + graders/*.md`, grader는 regex·tool_used·tool_order·file_exists·llm·baseline. 종료코드 0/1/2로 CI 게이트 가능, `--max-cost-usd`. 주의: `--threshold`는 스킬 켠 쪽 점수만 본다, 기여도 Δ는 따로 게이트해야 한다. https://code.claude.com/docs/en/plugin-evals
- **`/skill-doctor`**: 스킬별 목록 비용, 한 번도 안 쓴 스킬·플러그인 보고 (v2.1.252+).
- **Routines**: research preview, 최소 1시간 간격, Anthropic 클라우드에서 돌고 `claude/` 브랜치·PR 생성. 대안은 GitHub Actions `anthropics/claude-code-action@v1` + cron.
- **AGENTS.md**: v2.1.277부터 네이티브로 읽지만 CLAUDE.md가 없을 때만. 이 저장소의 `@AGENTS.md` 브리지는 유효. `.agents/skills`는 문서상 읽지 않음(미검증) — 현재 PC는 `skills` CLI가 `~/.claude/skills`에 심링크로 해결 중.
- **캐시**: 스킬·커맨드·hook 호출은 대화 뒤에 붙어 캐시를 깨지 않는다. 모델 전환·도구 목록 변경은 캐시를 깬다.

## 4. 토큰·컨텍스트 근거

- 목표는 "가장 작은 고신호 토큰 집합". 입력이 길어지면 18개 모델 모두 성능 하락, 방해 문단 1개만 있어도 하락 (Anthropic 2025-09-29; Chroma context rot 2025-07-14).
- 스킬 3단 로딩: 메타(~100 tok, 항상) / 본문(<5k, 호출 시) / 참조(읽을 때만). 본문 500줄 이하 권장.
- **스킬 수와 선택 정확도**: ~20개까지 90%+, 30개 넘으면 하락, 200개에서 ~20%. 주원인은 개수보다 **비슷한 스킬끼리의 혼동**(경쟁 스킬 1~2개에 −7~−63%). 계층 라우팅으로 45%→83~85% 회복 (arXiv 2601.04748, 2026-01, GPT-4o 계열 측정 — Claude 공개 측정은 없음).
- Vercel 실험: 56% 케이스에서 스킬이 호출조차 안 됨. AGENTS.md 8KB 압축 인덱스가 100% (Vercel 2026-01-27, 자체).
- MCP: 도구 58개 ~55K 토큰, Tool Search로 85% 절감 (Anthropic 2025-11-24). Claude Code는 기본 defer.
- 출력 압축: caveman은 "be concise" 대비 중앙값 ~3%만 추가 절감, 규칙 자체 ~1,160 토큰 (README 자체). 출력은 청구 토큰의 0.6~2.5%뿐이라는 비판 (2차). RTK는 bash 출력 60~90% 축약 주장(자체)이나 정보를 의도적으로 버리고 서드파티 바이너리가 모든 명령에 끼어든다.
- 비용 우선순위: 캐시 적중 > 도구 출력 절제 > 출력 스타일.

## 5. 최신 지식 유지 (자동 업그레이드) 근거

- **자가 생성 스킬의 평균 효과 0**, 사람이 다듬은 스킬 +16.2pp, 84과제 중 16개는 오히려 악화. 집중형 2~3모듈 스킬이 포괄 문서보다 낫다 (SkillsBench, arXiv 2602.12670, 2026-02).
- **통째로 다시 쓰기 금지**: 컨텍스트 전체 재작성 시 18,282→122 토큰으로 붕괴, 정확도가 컨텍스트 없음보다 낮아짐. 대안은 delta 업데이트 (ACE, arXiv 2510.04618).
- 지시 500개면 최고 모델도 68%만 준수 (IFScale, 2025-07) → 쌓기만 하는 업데이트는 품질을 깎는다.
- 오염 위험: 마켓 스킬 31,132개 중 26.1% 취약, 스크립트 포함 시 2.12배 (arXiv 2601.10338). 프롬프트 인젝션으로 설정 파일 변경→RCE (CVE-2025-53773). Context7은 정확성·보안 비보장을 스스로 명시, ContextCrush 취약점(2026-02).
- 믿을 만한 런타임 출처: 공식 문서 MCP (Microsoft Learn MCP GA 2025-11, AWS Knowledge MCP GA 2025-10).
- OpenAI 하네스 엔지니어링: ~100줄 AGENTS.md를 지도로, 주기적 doc-gardening 에이전트가 수정 PR (2026-02-11).
- Anthropic eval 권장: 실제 실패 20~50건으로 시작, capability/regression 분리, pass^k, LLM judge를 사람 판정으로 보정 (2026-01-09).

## 6. 아키텍처 근거 — 역할형 멀티 에이전트 vs 단일 에이전트+스킬

- MAST: 7개 프레임워크 1,600+ 트레이스, 실패율 41~86.7% (arXiv 2503.13657).
- Anthropic 2026-01-23: 멀티 에이전트는 3~10배 토큰. planner/implementer/tester/reviewer 분할은 "실제 작업보다 조율에 토큰을 더 썼다". **역할이 아니라 컨텍스트 기준으로 나누라**, 검증자 서브에이전트는 효과적.
- Cognition 2026-04-22: "지능은 여럿이 보태되 쓰기는 한 스레드" 형태(리뷰 루프)는 통하고, 여럿이 병렬로 쓰는 swarm은 안 된다.
- Google 2026-01-28: 병렬화 가능한 과제 +80.9%, 순차 과제 −39~−70%.
- 멀티 에이전트를 단일 에이전트+스킬로 컴파일: 토큰 −53.7%, 지연 −49.5%, 정확도 유사 (예비, arXiv 2601.04748).
- **페르소나("You are an expert X")**: 162역할×2,410문항에서 개선 없음, 효과는 "대체로 무작위" (Zheng, EMNLP Findings 2024). GPQA·MMLU-Pro 이득 없음 (Wharton 2025-12). → 전문성은 페르소나가 아니라 절차·체크리스트·예시·검증으로 만든다.

## 7. 이해 부채 (오너가 AI 흐름에 먹히지 않으려면)

- Anthropic RCT (2026-01-29, arXiv 2601.20245): AI 사용군이 직후 이해도 퀴즈 **17% 낮음(50% vs 67%)**, 속도 이득은 유의하지 않음, 가장 큰 차이는 디버깅. **개념 질문·설명 요청·이해 확인용으로 쓴 사람은 점수 유지**, 통째 위임형은 40% 미만. https://www.anthropic.com/research/AI-assistance-coding-skills
- Comprehension debt (Addy Osmani 2026-03-14; Storey 2026-02-09 cognitive debt): 코드는 늘고 사람이 이해하는 비율은 줄어드는 격차. 테스트 통과 ≠ 이해. 대응: 쓰기 전에 의도를 명시, 검증을 구조적 제약으로, 시스템 수준 멘탈 모델 유지.
- Storey 3중 부채 (arXiv 2603.22106): 기술 부채 · 의도 부채 · 인지 부채 — 영상의 Probe 평가 3축과 같은 틀.

## 8. ponytail (DietrichGebert/ponytail, MIT, v5.2.0 2026-10-13, ★162k)

- 핵심 프롬프트 SKILL.md 3.5KB, 압축판 AGENTS.md 2.7KB. 20개 에이전트용 어댑터(.claude-plugin, .codex-plugin, .cursor/rules, .kiro/steering, .windsurf/rules 등)를 **한 프롬프트에서 생성** — 단일 원천→다중 어댑터의 실례.
- 규칙: ①최소 완전 변경 사다리(필요한가→코드베이스에 있나→표준 라이브러리·플랫폼→설치된 의존성→한 줄→최소 코드) ②절대 자르지 않는 것(신뢰 경계 검증·데이터 손실 방지·보안·접근성) ③**답변 끝 1~2줄: 건너뛴 것·확인 못 한 것·알아야 할 리스크** ④`shortcut:` 주석 + `/ponytail-debt` 원장 ⑤`/ponytail-review`(diff 바깥까지 읽는 리뷰), `/ponytail-audit`.
- 수치(자체, Claude Code·Opus 5.5·39과제×5회): 코드 −53%, 시간 −41%, 비용 −26%, 토큰 −45%, 위험 로직 테스트 동반 98%(없을 때 68%).
- 판단: caveman류(말투 압축)와 달리 **행동 규칙**이라 품질과 간결함을 함께 노린다. 영상의 "오버엔지니어링 = 주도권 상실" 기준과 일치. 단 수치는 저자 자체 측정, hook으로 매 세션 자동 활성화되므로 버전 고정·hook 검토 필요(저자도 가짜 사본 경고).

## 9. /explain-doc v9 비용 프로필 (직접 확인)

- SKILL.md 148줄 + template.html 541줄(43KB) + check.py 387줄 + critic/review/score 루프(독립 에이전트 비평·채점 최대 2회) + 헤드리스 Chrome 스크린샷.
- 결론: 문서 1건이 무겁다. **매 handoff마다 돌리면 토큰·시간 폭탄** → 계층화 필요(항상: 짧은 HANDOFF.md / 게이트: 템플릿 렌더링 뷰 / 마일스톤·면접용: 풀 explain-doc).
- 재사용 가능 자산: template·check.py(엔진), 용어 카드 JSON 스키마(easy/formal/src/status), "말해 보기"(면접 연습과 직결), 사실 표시 3단계(확인·추론·추정).

## 10. Orca 1.4.209 (직접 확인, 현재 세션이 Orca 안에서 실행 중)

- 구조: Run(목표 단위) → Task(작업) → Dispatch(1회 시도). `worker-start --spec ... --agent claude|codex|... --model --effort --worktree new-child --deps --parent`.
- 사람 결정: `gate-create --task --question --options` / `gate-resolve`. 워커의 막힌 질문: `ask` ↔ 코디네이터 `reply`. 완료: `worker_done`(3문장 요약 + 성공/실패 명시 + 수정 파일 + 보고서 경로).
- 원격: `--on <saved-environment>`, SSH·WSL 배치. 폴더 워크스페이스(비 git)도 가능.
- **Task spec 계약 5요소**: Target / Change / Constraints / Ownership / Observable acceptance — 하네스의 작업 명세 포맷을 이것과 1:1로 맞추면 도구 교체 시에도 재사용된다.

## 11. 현재 자산 현황 (2026-10-13, 직접 확인)

- 하네스 v1.5: 스킬 8 · 서브에이전트 3 · rules 3 · hook 1. 배포 방식은 `cp -r` 템플릿 복사.
- **v1.x를 적용한 다른 프로젝트가 없고 exec-plans가 비어 있다** (도그푸딩 0건).
- `harness-bench`(<workspace>): 과제 2개 스텁, 기준선 0%, 실측 없음. QUALITY_BAR의 경로 표기(`~/workspace/...`)와 실제 경로가 다르다.
- 여러 도구 실사용: `~/.codex`, `~/.cursor`, `~/.copilot`, `~/.gemini`, Orca. `~/.agents/skills` + vercel-labs `skills` CLI 락파일로 스킬을 여러 도구에 심링크 배포 중.
- `everything-claude-code`(47 에이전트·181 스킬) 클론 보유. `~/.claude/skills/.trash`에 353개 항목.
- 개인 자동화 루틴 운영 중.

## 12. 멀티 LLM 이식성 (2026-10-13 기준)

- **실제로 옮겨지는 것은 SKILL.md와 AGENTS.md 둘뿐**이다. 서브에이전트·hooks·커맨드·모델 설정은 표준이 없다 (서브에이전트 표준화 제안 agentskills#78은 2026-01-12 닫힘).
- Agent Skills: Anthropic 2025-10-16 출시 → 2025-12-18 오픈 표준(agentskills.io). AAIF(Linux Foundation) 편입은 TC 승인(2026-10-01), 서명·이사회 투표 남음. 필드: `name`(≤64, a-z0-9-, 폴더명과 동일) `description`(≤1024) + 선택 `license, compatibility, metadata, allowed-tools`. 검증기 `skills-ref validate`.
- **스킬 경로 지원표**

| 도구 | 프로젝트 | 사용자 | 비고 |
|---|---|---|---|
| Claude Code | `.claude/skills` | `~/.claude/skills` | **`.agents/skills` 안 읽음** (#16345 open) |
| Codex | `.agents/skills` | `~/.agents/skills` | `.claude` 안 읽음 |
| Cursor | `.agents/skills`, `.cursor/skills` | `~/.agents/skills`, `~/.cursor/skills` | `.claude`·`.codex`도 읽음 |
| Copilot (cloud·CLI·VS Code) | `.github/skills`, `.claude/skills`, `.agents/skills` | `~/.copilot/skills`, `~/.agents/skills` | |
| Gemini CLI → Antigravity CLI(개인, 2026-06-18 전환) | `.gemini/skills`, `.agents/skills` | `~/.gemini/skills`, `~/.agents/skills` | |
| OpenCode · Amp | `.agents/skills`, `.claude/skills` | 각자 경로 | |
| Kiro | `.kiro/skills` | `~/.kiro/skills` | 공통 경로 안 읽음 |

- → **`.agents/skills` + `.claude/skills` 두 곳에 놓으면 주요 도구 대부분을 덮는다.**
- AGENTS.md: AAIF 창립 프로젝트(2025-12-09), 60k+ 프로젝트. Codex·Cursor·Copilot·Amp·OpenCode·Junie·Kiro·Antigravity 등 기본 지원. 크기: Claude 200줄, Codex 합계 32KiB, Cursor rules 500줄, Copilot code review 앞 4,000자.
- **배포 매니페스트 수렴**: Claude Code 플러그인(`.claude-plugin/marketplace.json`)을 **Codex 플러그인(2026-03-25)·VS Code agent plugins·skills CLI도 읽는다**. Agent Plugins 스펙 v1.0(2026-08-06, Vercel·AWS·Cursor·GitHub·MS·OpenAI, Anthropic 불참)은 `skills/`와 `mcp.json`만 공통.
- 설치·동기화 도구 (GitHub API 2026-10-13): vercel-labs/skills 34.1k★ v1.7.2(2026-10-09, ~80개 에이전트, symlink 기본·`--copy`, 전역 설치 시 `~/.claude/skills` 미링크 버그 #851) · rulesync 1.5k★ v33.0.0(rules·MCP·commands·subagents·skills·hooks 생성, ~60개) · microsoft/apm 4.0k★(lockfile 패키지 매니저) · getsentry/dotagents(`agents.toml`+lock) · openskills(2026-01 이후 정체).
- 스킬 목록 예산: Claude 1%, Codex 2% → **라이브러리를 통째로 설치하면 스킬이 제대로 발동하지 않는다** (팩 단위 설치의 기술적 근거).
- 함정: Windows symlink(관리자 권한/Developer Mode, `core.symlinks=false`면 텍스트로 받아짐) → 팀·회사 저장소에서는 copy. 규칙 파일 형식 제각각(Cursor `.mdc`, Copilot `applyTo`, Kiro `inclusion`). MCP 설정 형식 제각각(Claude `mcpServers`, VS Code `servers`, Codex TOML). hook 이벤트명 제각각. Claude는 커맨드를 스킬로 통합(v2.1.3), Codex custom prompts deprecated → **커맨드도 스킬로 만든다**.

## 13. 한국 현업 프로세스 (7단계 비평과 보완)

- **진단**: 기존 7단계는 SI식 폭포수(분석→설계→구현→시험→이행)에 마케팅을 붙인 구조. 한국 플랫폼 기업은 "문제→가설·지표→작게 출시→실험→학습" 루프로 일한다.
- **빠진 것**: ①문제 정의·사용자 리서치·성공 지표 (토스는 하루짜리 제품도 기준선 설문과 목표 WAU부터, 2023-12-11) ②측정·실험 (토스 주지표+보호지표, 2025-10-01 / 당근 "결과가 부정적이면 배포하지 않는다", 2024-04-25) ③법무가 설계에 묻힘 — 개인정보위는 AI 서비스 **기획 단계부터 CPO 참여** 권고 (2025-08-06) ④출시 이후(운영·CS·장애·비용·회고) 공백 ⑤앱 심사 (Apple 5.1.2(i): 제3자 AI로 개인정보 전송 전 명시 동의, 2025-11-13).
- **조직 유형별**: 플랫폼(6~8명 사일로·지표) / SI·공공(RFP→제안→착수→분석·설계·구현·시험→이행→검수→하자보수, 산출물·검수 기준) / 대기업 사내(그룹 IT 계열사, 단계 게이트·보안 심의). 2025 내부거래 비중 삼성SDS 84.17%, LG CNS 57.34% (CEO스코어 2026-06-23) → 목표 기업 다수가 SI형 산출물 문화.
- **AI가 바꾸는 것 (국내 근거)**: 당근 "엔지니어를 넘어 빌더로", 프로덕트 엔지니어 (2025-11-04) · 토스 디자인 직무 6→2 통합, "도구 차이가 줄수록 중요한 건 판단 감각" (2026-04-03) · 우아한형제들 Copilot 초기엔 테스트·리뷰 병목 그대로 → **팀 규칙·스킬 기반 '하네스 엔지니어링'으로 AI 컨텍스트 평균 96.5% 절감** (2026-04-17) · 카카오 첫 그룹 공채 키워드 'AI 네이티브' (2025-09-03) · 서비스 기획자 공고 2022→2025 −71.4%, AI 개발자 +392% (Candid 2026-02-12, IT 채용 전체 위축 감안 필요).
- **반대 근거**: METR RCT 숙련 개발자 AI 사용 시 19% 느림 (2025-07), DORA 2025 AI는 증폭기, 배포 불안정성도 증가.
- **함의**: 병목이 '작성'에서 '명세·검증·판단'으로 이동. 화면설계서는 프로토타입으로, 정책서·수용기준·평가셋은 에이전트 하네스로 흡수된다.
- **규제 (제품 의무로 번역)**: AI 기본법 2026-01-22 시행(생성형·고영향 AI 사전 고지, 생성물 표시, 과태료 최대 3천만 원, 1년+ 계도) · 개인정보보호법 개정 2026-09-11 시행(과징금 상한 매출 10%, 72시간 내 통지) · ISMS-P 대형사 의무화(2027-07 조항 시행) · 망분리: 금융 SaaS 예외 시행세칙 예고(개인신용정보 제외), 공공 N2SF 등급별 통제 · CSAP 개편(2027-07 예정) · KWCAG 2.2 · 정보통신망법 광고 표기·야간 동의, 다크패턴 금지.
- **마케팅·배포 채널**: 검색 점유율 네이버 56~64%·구글 ~29% (2026-01~03) → 서치어드바이저·네이버 블로그가 SEO/GEO 양쪽 입력원 (AI 브리핑 월 3천만 명) · 인스타 2,870만, 스레드 798만(+29.6%) (2026-09-11) · 앱인토스 미니앱 1만 개, 1인 메이커 67% (2026-08-14) · 카카오 PlayMCP MCP 서버 ~200개 · 커뮤니티: GeekNews Show GN 활발, 디스콰이엇 반응 낮음.
- **SI 산출물 매핑**: 루프 산출물을 SI 문서(요구사항정의서·추적표·시험결과서)로 변환하는 매핑을 두면 플랫폼·SI 두 시장에 대응 가능.

**개정 루프 (9단계, 1회전 = 1~2주 단위 가설)**

| 단계 | 핵심 산출물 | 필요한 전문 역량 |
|---|---|---|
| 1 발견 | 문제 진술, 인터뷰·VoC 종합, 경쟁 비교 | UX 리서처 |
| 2 정의·측정 설계 | PRD(수용기준), 정책서, 이벤트 택소노미, 주·보호 지표 | PM + 데이터 분석가 |
| 3 규제 게이트 | 개인정보 흐름도, AI 고지·표시안, 약관·처리방침, 접근성 기준 | 개인정보·AI법 실무 |
| 4 프로토타입·디자인 | 작동 프로토타입, IA, 디자인 토큰 | 프로덕트 디자이너 |
| 5 명세·구현·검증 | spec/plan/tasks, ADR, OpenAPI·ERD, 테스트·LLM eval셋, 보안 리뷰 | 아키텍트 + 스택별 개발 + QA |
| 6 출시·배포 | 릴리즈 노트, 스토어 심사, SEO/GEO 글, Show GN·스레드 | 그로스 마케터 |
| 7 운영·CS | 대시보드·알림·런북, 장애 회고, 토큰·클라우드 비용 | SRE |
| 8 측정·실험 | 실험 보고서, 코호트·퍼널 분석 | 데이터 분석가 |
| 9 회고·학습 | KPT 회고, 부채 목록, 위키 노트, 커리어 증거 | 편집자 |

## 14. 오케스트레이션 도구 비교 (★·릴리스는 2026-10-13 GitHub API 조회)

- **herdr** (github.com/herdrdev/herdr, Apache-2.0 since 2026-07-22, ★43.7k, v0.9.3 2026-09-29, 1.0 이전): Rust 단일 바이너리 "agent-aware terminal multiplexer". pane마다 에이전트 상태(working/blocked/idle/done) 감지, 백그라운드 서버(detach/reattach), SSH 멀티머신. CLI+socket JSON API (`herdr agent start qa --kind codex`, `agent prompt --wait`, `agent wait --until blocked`, `worktree create`). Mac/Linux/Windows 네이티브(Windows 바이너리 서명 없음, 한글 IME 부분 지원). **없는 것: task DAG, 결정 게이트.**
- **Orca** (github.com/stablyai/orca, MIT, ★91k, v1.4.224 2026-10-10, 30일간 24회 릴리스): 에이전트별 worktree, 내장 브라우저, diff 줄 주석 회신, SSH worktree, `orca serve`(beta, 헤드리스). 오케스트레이션: Run → `task-create --deps`(DAG) → `worker-start --agent ... --worktree new-child` → 워커 `ask`/`worker_done` → `gate-create`/`gate-resolve`. CLI 40여 종 지원. 계정 불필요, 텔레메트리 `ORCA_TELEMETRY_DISABLED=1`. 업데이트는 자동 다운로드 없이 배너만 뜨고 사람이 눌러야 설치.
- **정정 (2026-10-13 재확인)**: 문서에는 "Settings → Experimental에서 켠다"고 되어 있으나 코드와 로컬 `orca-data.json`에 해당 플래그가 없다. 1.4.209에서 `orca orchestration run-list`가 토글 없이 동작함을 직접 확인. 실제 활성화 동작은 `orca skills install --skill orca-cli --skill orchestration`(내부적으로 버전 미고정 `npx skills add` 실행) → 원샷 세팅에서는 `orca skills get orchestration --full`로 앱 버전에 맞는 스킬을 받아 락에 넣는다.
- **비교 요약**

| 기준 | Orca | herdr | Claude agent teams | 스크립트(worktree+tmux+헤드리스 CLI) |
|---|---|---|---|---|
| 여러 CLI | ◎ | ◎ (Gemini·Amp는 상태만) | Claude만 | ◎ |
| 사람 결정 게이트 | ◎ DAG·gate·ask (실험 기능) | △ blocked 감지 | ○ (plan 승인은 lead 자동) | △ 파일 규약 |
| 스크립트 제어 | CLI(JSON) | CLI+socket | 자연어만 | 완전 |
| 원격 | SSH, serve(beta) | SSH 멀티머신 | 대화형 필수 | ssh+tmux |
| 토큰 오버헤드 | 낮음(추정) | 낮음(추정) | **약 7배(plan mode, 공식)** | 최저 |
| 종속 | 낮음~중간 | 최저 | Claude | 없음 |

- 기타: OrchestratorInc/agent-orchestrator(Apache, ★13.1k, Orca 대안 1순위) · oh-my-claudecode(MIT, ★39.9k, Claude lead + tmux 워커) · superset(Win 미지원) · conductor(macOS 전용·비공개) · claude-squad(게이트 없음) · vibe-kanban(**운영사 종료 공지 2026-04-10**, 제외).
- **권고**: 주력 Orca(이미 설치·사용 중, 원하는 "메인 결정 + 워커 실행" 구조와 일치), 폴백 herdr(회사 PC에서 Electron 설치가 막힐 때), 최후 폴백 스크립트(게이트는 "다음 task 전 사람 승인"만 가능). Orca 오케스트레이션은 실험 기능이고 거의 매일 릴리스 → 버전 고정 검토.
- **도구 독립 표준**: `orchestration/tasks/T-###.md`(frontmatter: id, pack, agent, deps, ownership, acceptance, gate) · `orchestration/handoffs/T-###.md`(status done/failed/needs-decision, 요약, 근거, 결정 요청) · 게이트 결과는 `docs/decisions/` · 브랜치 `agent/<pack>/<task-id>`. Orca의 `worker_done`·`ask`와 1:1 대응.
- 확인 못 함: Orca 실험 기능 토글을 CLI로 켜는 방법(원샷 설치 스크립트의 걸림돌 후보), 사람이 UI로 게이트를 승인하는 흐름, herdr의 회사 Windows 동작.
- 주의: Gemini CLI는 개인 사용자 기준 2026-06-18부터 Antigravity CLI(`agy`)로 전환(유료 API·엔터프라이즈는 유지).

## 15. 배포 채널(MCP vs 파일)과 재현 가능한 첫 세팅

- **Skills over MCP**: SEP-2640 Skills Extension **Final**(2026-09-13 머지) — 스킬을 `skill://<path>/SKILL.md` resource + `skills/list`·`skills/get`으로 노출, 파일별 sha256(서명 없음), MCP로 받은 스킬은 untrusted(allowed-tools 무시, 로컬 스킬을 못 덮음). **클라이언트 지원은 ChatGPT 부분 지원뿐**, Claude·VS Code·Cursor·Codex·Gemini 미지원 (modelcontextprotocol.io/extensions/client-matrix).
- 도구 간 이식 가능한 MCP 기능은 **tools뿐** (prompts는 Codex·ChatGPT 미지원, resources는 부분).
- 원격 MCP 위험: 도구 인자를 모델이 작성하므로 회사 코드가 개인 서버로 나갈 수 있음, 승인 후 도구 정의 변경(rug pull), 원격 서버는 버전 고정 수단 없음 → 재현성은 로컬 stdio 정확 버전 또는 컨테이너 digest. Claude Code는 claude.ai 커넥터를 기본으로 불러옴(회사: `ENABLE_CLAUDEAI_MCP_SERVERS=false`).
- **MCP Apps**(Stable 2026-01-26): Claude web/Desktop·VS Code·ChatGPT·Cursor 2.6+·Goose에서 인터랙티브 UI 렌더, **터미널 CLI는 전부 미지원** → 인터랙티브 handoff 뷰의 GUI 채널 후보, 정적 HTML 폴백 필수.
- 무설치 경로: claude.ai에 스킬 업로드 → Claude Code 2.1.273+가 `~/.claude/skills/synced/`로 동기화(현재 `/explain-doc`이 이 경로). 회사에서는 `syncClaudeAiSkills:false`.
- **락파일 설치기 비교**: microsoft/apm(SHA+파일 SHA-256 락, copy+해시, `--frozen`·`audit --ci`·`outdated`, Windows 네이티브, MCP 설정 생성 7개 도구, `apm pack` 에어갭, 텔레메트리 없음, ★4.0k v0.33.0 — 0.x라 apm 자체도 고정) · dotagents(Windows 미지원) · vercel skills(스킬만, 텔레메트리 기본 on) · rulesync(생성기, 10일간 메이저 7회). → **apm 주력, rulesync는 보조 생성기**.
- **툴체인 고정: mise + `mise.lock`**(2026.2.0+ 정식, 플랫폼별 URL·checksum, `install --locked`, mac·Windows·Linux). 한계: 락 ≠ 오프라인, 각 도구 자체 업데이터를 꺼야 함.
- **업데이트 차단 스위치**: Claude Code `DISABLE_UPDATES=1`(+관리형 required Min/Max 버전) · Codex `check_for_update_on_startup=false` · Copilot CLI `"autoUpdate": false` · Gemini CLI `general.enableAutoUpdate=false` · OpenCode `"autoupdate": false` · **Cursor CLI는 차단 방법 없음** · Orca는 수동 설치(배너만) · herdr `[update] version_check=false`.
- Orca 설치 고정: 릴리스 태그별 dmg/exe/AppImage/deb/rpm. Homebrew는 서드파티 tap `stablyai/orca/orca` (core의 `orca` cask는 다른 도구 — 혼동 주의).
- **권장 첫 세팅**: `train.yaml`(호환 매트릭스: 도구별 버전·고정 등급 A 완전/B 설치시점/C 불가·3 OS 검증 결과) + `mise.toml`/`mise.lock` + `bin/mise` 부트스트랩 + `apm.yml`/`apm.lock.yaml` + `policy/`(업데이트·텔레메트리 차단 조각). 순서: `bin/mise install --locked` → `apm install --frozen` → policy 적용 → `doctor`(버전 일치, 차단 적용, `apm audit --ci`, 스킬 검증·토큰 린트, MCP allowlist, 프록시·CA 도달).
- **업데이트 train**: 격주, Renovate가 mise 파일 갱신(minimumReleaseAge 7일) → 3 OS CI에서 doctor + eval 회귀 → 태그. 롤백 = 이전 태그. 보안 패치는 긴급 PR.
- 로컬 현황(2026-10-13): Claude Code 2.1.296·Codex 0.142.5(최신 0.162.1) 모두 업데이트 차단 설정 없음, Orca 텔레메트리 켜짐.

## 16. 작업별 모델 라우팅과 Jev

- **가격 ($/1M 입력·캐시읽기·출력)**: Claude Fable 5.1 10·0.25·50 / Opus 5.5 4·0.20·20 / Sonnet 5.5 2·0.20·10 / Haiku 5.5 0.10·0.01·0.50 (100K 초과 프롬프트는 5배) — claude-api 스킬 공식 표(2026-10-06 캐시) 기준. OpenAI GPT-6 Astra 10·1·50 / GPT-6.1 Sol 2·0.10·10 / GPT-6 Luna 0.10·0.01·0.50. Gemini 3.1 Pro(preview) 2·0.20·12 / 3.8 Flash 0.75·0.075·3.75. 구독(Claude Max, ChatGPT Plus/Pro)에서는 돈이 아니라 **쿼터**를 아끼는 문제.
- **라우팅 위치**: 작업 경계(Orca `worker-start --model --effort`)에서 한 번. 세션 중 모델 교체는 캐시(모델별)와 thinking block을 잃는다. 실패한 대화를 강한 모델이 이어받기 69.2% @$1.61 vs 강한 모델 새로 시작 79.2% @$0.90 (Handoff Tax, SWE-bench Verified, 비심사).
- **모델 교체보다 effort**: Opus 5.5 low로 시작 → 검증 실패만 high 재실행 ~97% @$0.17 vs 전부 high 95.3% @$0.29 (−41%, Anthropic 내부 SWE-bench Pro ~480문항, 테스트 신호 필수). 상위 모델 기본 effort가 최상위 모델과 같은 점수를 훨씬 싸게 낸 사례도 있음(포화 부분집합).
- **싼 모델이 더 비쌀 수 있다**: Terminal-Bench 4.0(2026-10-06) Claude Code+Sonnet 5.5 시행당 $22.2 > Opus 5.5 $14.3 (Sonnet이 토큰 2.4배). 기준은 요청당이 아니라 **완료 작업당 비용**.
- **학습형 라우터**: 상용 라우터 6종이 같은 비용의 무작위 2모델 혼합을 못 이김 (arXiv 2610.02762, 비심사). RouteLLM은 챗 전용·방치. LiteLLM Auto Router는 베타, 품질 하락 보고.
- **벤치마크**: SWE-bench Verified는 OpenAI가 보고 중단(감사 과제 59% 결함) → 과거 비교용. 쓸 만한 신호: Terminal-Bench 4.0(CLI×모델×effort별 비용), SWE-rebench(새 이슈), AA Coding Agent Index(API 무료 키). METR: SWE-bench 통과 PR의 절반가량은 머지 불가 수준 → 리더보드 상위 몇 pt 차이는 잡음. 주간 radar로 가져와 `routing.yaml` delta PR, harness-bench 카나리 통과 시 머지.
- **Jev(TypeSafe) 판정**: (a) **스킬·팩 라우팅에 적합** — 스킬 182개·영어 합성 488문항에서 잘못된 스킬 로드 16.8%→7.3%, 불필요 로드 9.8%→4.0% (TypeSafe 쿡북). 조건: 옵션 설명은 영어, "해당 없음" Noul 필수, `jev-1.13.0` 고정. (b) **모델 등급 라우팅은 이득 작음** — 작업 단위 호출은 하루 수십 건, 난이도는 작업 설명보다 코드 상태에 달림, rubric형 판단에 약함 → 위험 신호 Noul(인증·결제·개인정보, 다중 모듈, 모호한 명세) 보조로만. 데이터: 미국 호스팅, 학습 미사용, 보존 기간 미공개, ZDR은 엔터프라이즈(Vercel AI Gateway 경유 시 요청별 ZDR) → 회사 모드에서는 끈다. 한국어 정확도 수치 없음. rate limit은 jev-lab 노트(250K tok/s) 이후 100K tok/s·80 req/s로 변경.
- **최소 평가안**: (a) `~/.claude/history.jsonl` 실제 프롬프트 80개(한/영 혼합, 30%는 해당 스킬 없음)에 정답 팩 라벨 → 힌트 없음 / Jev 2단 / Haiku 5.5 분류기 비교, 채택 기준 "잘못 로드 상대 30%+ 감소, 불필요 로드 증가 없음". (b) harness-bench 오라클 라벨(통과한 가장 싼 구성)에 규칙 / 규칙+Jev / LLM 분류기.
- **기대 절감(추정)**: "전부 최상위·high" 대비 40~70%, "전부 Opus 5.5 medium" 대비 0~30%. 검증 신호가 없거나 어려운 과제 비중이 크면 0 또는 손해.
## 17. 터미널 전용 환경의 오케스트레이션 (Orca·herdr·native 비교)

- "터미널만 있는 환경"은 둘로 나뉜다: **S3 설치 가능** / **S4 에이전트 CLI만**(평가 환경 등). herdr도 설치가 필요하므로 S4에는 도움이 안 된다.
- **헤드리스 Orca**: `orca` CLI는 앱 Electron 바이너리 래퍼(단독 CLI 설치 불가). Linux는 .deb/.rpm(CLI 이름 `orca-ide`), `orca-ide serve`는 orcad(Node, 버전 고정 Node 자동 다운로드) 또는 Electron+Xvfb. 웹 클라이언트가 앱에 내장 → 브라우저로 사람이 확인 가능. 1.4.224(2026-10-10)부터 SSH 호스트에 관리형 orcad 자동 배포(원격 설치 불필요). Remote·모바일은 beta, 헤드리스 오케스트레이션은 실제 구동 미확인. 열린 이슈: Codex 샌드박스에서 worker_done 불가(#22947), 정상 에이전트 오판 종료(#18368), ask 중 send 유실(#21443), `check --wait` 끊김(#27300).
- **herdr** 0.9.3: CLI+NDJSON 소켓, 공식 스킬. Claude Code·Codex 상태를 **화면 스크래핑**으로 판정 → 대화상자를 idle로 오판(#5221), 첫 프롬프트 미전달(#4537), detach·SSH 끊김 시 프로세스 사망(#4920, #5170). 메인테이너 1인 집중(커밋 1,298 대 132). DAG·게이트·내구성 인박스·재시도 없음 → 파일로 흉내 내야 함.
- **native(설치 0)**: Claude Code agent view(`--bg`, `claude agents --json` → working/blocked/done/failed/stopped, research preview), agent teams(experimental, 사람 게이트 없음), 서브에이전트 `isolation: worktree`(정식), Codex `multi_agent`·`exec -C`. `claude --restricted`(평가 하네스용)는 명령 실행 도구를 없앰 → 파일 계약만 남는다.
- 실사용 후기: tmux→cmux→herdr→Orca로 정착(Tagbangers 09-04), tmux+mosh→Orca(모바일 효과, 09-25), 반대로 "어떤 에이전트든 `orca` CLI로 모든 셸에 명령 가능"이 싫어 tmux로 복귀(09-30).
- **판정**: "Orca + herdr"는 S4를 못 풀고 오케스트레이터 2개 유지비(설치·고정·어댑터·회귀 테스트 2배)만 생긴다. **권장 = 파일 계약(task·HANDOFF·gate)을 진실의 원천 + 어댑터 2개(Orca 주력 UX, native 최저공통분모)**. herdr는 "브라우저도 없는 TTY에서 사람이 여러 에이전트를 지켜봐야 하는" 상황이 반복될 때만 추가. 어댑터는 start/wait/read/stop 4동작만 구현, Orca는 `worker_done --report-path`로 HANDOFF 연결. 원칙: 실행 사실은 도구가, 결정과 결과는 저장소가.
- 시나리오: S1 Mac GUI → Orca 데스크톱 / S2 Mac+원격 Linux → Orca SSH 호스트(관리형 orcad), 노트북이 잠들어도 돌아야 하면 원격 `orca-ide serve`+Tailscale / S3 → 브라우저 접근 가능하면 `orca-ide serve`+웹, 순수 TTY면 native / S4 → native + 파일 계약.
- **미검증 항목 확인 결과**: Cursor CLI — 자동 업데이트 기본 on, 끄려면 **실행마다 `--disable-auto-update`**(설정 키·env·버전 고정·텔레메트리 opt-out 문서 없음) → 고정 등급 C. agy — `AGY_CLI_DISABLE_AUTO_UPDATE=true`, 텔레메트리 `~/.gemini/antigravity-cli/settings.json` `"enableTelemetry": false`, 버전 고정 방법 문서 없음(설치 스크립트는 항상 최신). apm v0.33.0 — 설치: brew / `curl -sSL https://aka.ms/apm-unix | sh -s -- @vX` / Windows `irm`+`$env:VERSION` / winget `Microsoft.APM` / pip `apm-cli`. 락 `apm.lock.yaml`(commit SHA·content_hash·배포 파일 해시), CI `install --frozen`·`audit --ci`, 갱신 `apm outdated` → `apm update`(계획 확인, `--yes`). 스킬 위치: Claude `.claude/skills`, Codex·Cursor·Gemini `.agents/skills` — **둘 다 원하면 `targets: [claude, agent-skills]` 명시 필요**.

## 18. 추가 확인 (2026-10-13 저녁)

- **shadcn/lint** (github.com/shadcn-ui/lint, 2026-09-14 공개): Tailwind 디자인 시스템용 "agent-first linter". 컴포넌트·variant·테마를 읽어 허용 규칙을 정의하고, 에이전트가 어기면 에러가 "무엇이 틀렸고 무엇을 대신 쓸지"를 제시. ESLint·Oxlint, React·Svelte·Vue, shadcn/ui 없어도 동작. "AGENTS.md 규칙만 쓸 때보다 수정 비용 10~48% 감소"(저자 주장). → ①디자인·프론트 팩에 직접 채택 후보 ②에이전트용 교정 메시지 패턴을 handoff·skill·토큰 lint에 차용.
- **Claude Code mods**: 사용자가 2026-10-13 만든 `~/.claude/dev-mods/.../apply-kit`이 실례 — `$.ui.open`(패널), `$.ui.toast`, `PushNotification` 도구 호출, 파일 쓰기 후 훅, 주기적 갱신, atom 상태, `claude-code/testing` 테스트. 상태 파일(status.json) → 패널·알림 패턴이 HANDOFF 인박스와 동일. Claude Code 전용 → 선택 어댑터로.
- **Codex 모델**: 공식 문서(learn.chatgpt.com/docs/models) 추천 `gpt-6.1-sol`, 저가 `gpt-6-luna`. 2026-09-29부터 Codex 번들 카탈로그 기본값이 `gpt-6.1-sol`. 입력 가격: gpt-6.1-sol $2(캐시 $0.10), gpt-6-luna $0.10, **현재 설정 gpt-5.6-sol $4(캐시 $0.40)** → 6.1 Sol이 더 새롭고 입력이 절반 가격. 로컬 Codex CLI 0.142.5(최신 0.162.1)의 모델 캐시에는 새 모델이 없음 → CLI 갱신 필요 가능성.
- **Codex 커스텀 프로바이더**: `~/.codex/config.toml`의 `[model_providers.<id>]`(base_url·env_key·wire_api) + 최상위 `model_provider`/`model`로 OpenAI 호환 엔드포인트(OpenRouter 등) 사용 가능, OpenRouter가 공식 가이드 제공. 프로필은 파일 단위(`~/.codex/<이름>.config.toml`). → 교차 검증 감사관 모델을 저가 모델로 교체하는 경로.

- 로컬 확인(2026-10-13): `~/.claude/settings.json`에 전역 `effortLevel: "high"`(Opus 5.5 기본은 medium). `~/.codex/config.toml`은 `gpt-5.6-sol`. **harness-bench `run.sh`는 시도마다 `output_tokens`의 마지막 값 하나만 더한다**(입력·캐시 토큰 미포함) → 측정부터 수정 필요.
