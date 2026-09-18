# AI를 잘 쓰는 소프트웨어 개발 — 2025–2026 최신 가이드 종합 리포트

(조사일: 2026-09-18. 범위: Anthropic/OpenAI 공식, DORA/GitHub/AWS/Airbnb, 카카오/토스/하이퍼커넥트, Karpathy/Simon Willison/swyx)

## 1. 핵심 원칙 10

1. **"모델이 아니라 하네스가 병목이다"** — 모델 능력보다 주변 시스템(컨텍스트·권한·피드백 루프·평가·상태)이 성과를 결정. (OpenAI Harness engineering, Latent Space, swyx)
2. **단순하게 시작 — 워크플로우 우선, 에이전트는 필요할 때만.** 단일 호출 → 체이닝/라우팅/병렬화 → 그래도 안 되면 에이전트. (Anthropic Building effective agents)
3. **컨텍스트는 유한 자원 — Context Engineering이 프롬프트 엔지니어링을 대체.** "가장 작은 고신호 토큰 집합". 시스템 프롬프트는 적절한 고도(altitude), 긴 작업은 compaction·구조화 노트·서브에이전트. (Anthropic)
4. **탐색 → 계획 → 실행 → 검증 → 커밋 루프 강제.** 계획 없이 바로 코딩시키면 품질 급락. (Claude Code best practices, Willison)
5. **에이전트에게 검증 수단을 줘라** — TDD, 스크린샷/브라우저 확인, init.sh. "테스트 삭제·수정 금지"를 명시. (Anthropic)
6. **Evals가 새로운 테스트다** — 골든셋 + 자동 평가를 CI처럼. eval-driven development가 업계 표준으로 수렴 (Airbnb, OpenAI Cookbook, Anthropic Demystifying evals). Gartner: eval 플랫폼 도입 18%(2025)→60%(2028) 전망.
7. **도구 설계는 에이전트용 UX 설계** — 워크플로우 단위 통합 도구, 고신호 응답, 토큰 효율. 에이전트가 도구 설명을 스스로 고치게 하는 방식으로 작업 시간 40% 단축. (Anthropic Writing tools)
8. **명세가 프롬프트다 — Spec-Driven Development.** spec.md → plan.md → tasks.md → 코드. GitHub Spec Kit, AWS Kiro, OpenAI PLANS.md가 같은 흐름.
9. **AI는 증폭기다** — DORA 2025 (~5,000명): AI 사용률 90%지만 "AI는 팀을 고치지 않는다. 이미 있는 것을 증폭한다". 성과는 플랫폼 품질·워크플로우 명확성·소규모 배치·빠른 피드백에서.
10. **사람의 역할은 계획과 검토로 이동, 검증 책임은 그대로.** Anthropic 40만 세션 분석: 사람이 계획 결정, Claude가 실행 결정. Karpathy: 바이브 코딩은 지나갔고 "감독·검토가 강화된 에이전트 프로그래밍"이 기본값.

## 2. AI 기능 개발 수명주기 베스트 프랙티스

공통 수렴 프로세스: **문제 정의 → 모델 선정 → 프롬프트/컨텍스트 설계 → RAG/도구 → 평가 → 가드레일 → 관측 → 비용·지연 최적화 → 반복**

- **① 문제 정의**: LLM이 필요한 문제인지 먼저 판단 (정답이 정해진 작업은 워크플로우). 착수 전 성공 기준(정량 지표+통과 기준) 명시. 카카오: "사람의 절차·판단 기준을 AI가 읽을 수 있는 지침으로 문서화"가 자동화의 핵심.
- **② 모델 선정**: 최강 모델+최소 프롬프트로 먼저 → 실패 모드 보고 보강. 자체 벤치마크로 선별 (Toss Benchmark). reasoning effort는 다이얼.
- **③ PoC**: 소형 프로토타입 다수 → 되는 것만 키움. 이 단계부터 골든셋 20–50개 축적 시작.
- **④⑤ 컨텍스트·RAG/도구**: just-in-time 검색(식별자만 들고 런타임 로드) 또는 하이브리드. 도구 많으면 동적 로드로 컨텍스트 절약.
- **⑥ 평가**: PoC→프로덕션 승격 조건 = eval 통과율. **평가 속도 자체가 병목** — Airbnb는 평가 소요를 수 주→하루로 줄인 것이 반복 개선의 전제.
- **⑦ 가드레일**: 계층화 — 입력 필터 → 도구 권한 allowlist → 샌드박스+네트워크 정책 → 비가역 액션은 HITL 승인.
- **⑧ 관측**: 트랜스크립트 저장 + **주기적으로 사람이 직접 읽기** (모든 벤더 공통 강조). 프로덕션 모니터링 + 온라인 judge 샘플링 + 피드백을 오프라인 eval로 환류.
- **⑨ 비용·지연**: 캐싱, 모델 라우팅, effort 하향, compaction — eval이 있어야 안전하게 가능 (회귀 감지).
- **⑩ 조직 정착**: 에이전트는 "테스트 잘 갖춰진 코드베이스의 저-중 복잡도 작업"에서 성공률 최고 → 이슈를 에이전트 크기로 쪼개는 백로그 관리가 새 스킬.

## 3. 프롬프팅/컨텍스트 실전 루틴

- **환경**: CLAUDE.md/AGENTS.md는 얇고 고신호로. 반복 워크플로우는 스킬로 패키징 (성공 접근·흔한 실수를 에이전트에게 스스로 정리시키기). 권한 allowlist + init.sh.
- **작업 루프**: ①탐색("아직 코드 쓰지 마") ②계획(파일화 — spec/plan/tasks 또는 ExecPlan) ③실행(구체 지시+정형 예시 소수, 모호하면 되묻게) ④검증(테스트·타입체크·스크린샷을 루프에) ⑤틀어지면 `/clear` 후 재시작이 대체로 더 싸다.
- **장기(멀티 윈도우) 작업** (Anthropic 공식): 첫 윈도우는 프레임워크 구축 — 테스트를 구조화 포맷(tests.json)으로 먼저, 셋업 스크립트, progress.txt 유지. 이후 윈도우는 compaction보다 **새 컨텍스트 + 파일에서 상태 재발견** ("progress.txt·tests.json·git log 검토 후 시작"). initializer agent + coding agent 패턴, 항상 커밋된 깨끗한 상태 유지.
- **예산 관리**: 도구 세트 최소화, 오래된 도구 결과는 compaction, 마일스톤형은 note-taking, 병렬 탐색은 서브에이전트.

## 4. Evals 구축법 (Anthropic Demystifying evals + OpenAI + Airbnb + 국내)

1. **20–50개 태스크로 시작** — 출처: 실제 실패 사례, 버그 트래커, 수동 테스트 절차.
2. **모호하지 않은 명세** — 전문가 2명이 독립적으로 같은 판정에 도달할 수준. 레퍼런스 솔루션 첨부.
3. **균형 세트** — 해야 할 케이스 + 거절해야 성공인 케이스.
4. **격리된 하네스** — 트라이얼마다 클린 상태.
5. **그레이더 3종**: 코드 기반(빠르고 객관) / LLM-judge(루브릭, 반드시 인간과 캘리브레이션 — 하이퍼커넥트: judge-인간 agreement 85% 목표, critique 먼저 쓰고 판정, 위치·길이·자기선호 편향 주의) / 인간 리뷰(주기 검증).
6. **결과(outcome) 중심 채점** — 최종 상태 검증. 도구 호출 순서 채점 금물.
7. **비결정성**: 탐색형은 pass@k, 고객 대면 신뢰성은 pass^k(k회 전부 성공).
8. **트랜스크립트를 종교처럼 읽기** — 0% 통과는 대개 태스크/그레이더 결함 신호.
9. **포화 관리** — 100% 근접 시 회귀 스위트로 졸업, 새 난제 추가.
10. **CI 통합** — 유닛 테스트처럼 상시 유지보수.

계층화(스위스 치즈): 자동 eval → 프로덕션 모니터링 → A/B → 주간 수동 트랜스크립트 리뷰 → 인간 스터디.

## 5. 주요 출처

Anthropic: claude-code-best-practices · effective-context-engineering-for-ai-agents · writing-tools-for-agents · building-effective-agents · multi-agent-research-system · demystifying-evals-for-ai-agents · effective-harnesses-for-long-running-agents · equipping-agents-for-the-real-world-with-agent-skills · code-execution-with-mcp (anthropic.com/engineering)
OpenAI: harness-engineering · unrolling-the-codex-agent-loop · running-codex-safely · codex_prompting_guide · eval_driven_system_design · codex_exec_plans (openai.com, developers.openai.com/cookbook)
빅테크: DORA 2025/2026 (dora.dev) · GitHub Copilot agentic harness/Spec Kit (github.blog) · Airbnb eval-driven development (medium.com/airbnb-engineering) · AWS Kiro
국내: Toss Benchmark (toss.tech/article/53109) · 카카오 LLM-as-Judge/지표 자동화 (tech.kakao.com/posts/690, 824) · 하이퍼커넥트 LLM-judge (hyperconnect.github.io)
담론: Simon Willison (simonwillison.net) · Karpathy Software 3.0→agentic engineering · Latent Space harness engineering 시리즈 · Pragmatic Engineer evals

**요약 한 줄**: "모델을 믿지 말고 시스템을 설계하라" — 스펙으로 의도를 고정하고, 컨텍스트를 예산처럼 관리하고, 에이전트에게 검증 루프를 쥐여주고, 트랜스크립트를 읽으며, 평가를 CI처럼 돌리는 사람이 이긴다.
