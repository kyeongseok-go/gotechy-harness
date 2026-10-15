# 가드레일, 예산, 운영 연결

언제 여는 파일인가: 절차 7단계(가드레일 eval)와 8단계(운영 연결)를 할 때, 프롬프트나 모델 버전 관리 규칙을 정할 때.

## 1. OWASP Top 10 for LLM Applications 2025를 케이스로 바꾸기

출처: https://genai.owasp.org/llm-top-10/ (2026-10-16 확인, 2025판이 최신). 에이전트라면 OWASP Top 10 for Agentic Applications for 2026(2025-12-09 공개, https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)도 같이 본다. 위협 모델 전체와 보안 리뷰는 `gotechy-security` 스킬이 맡는다. 이 표는 "eval 케이스로 무엇을 넣나"만 다룬다.

| ID | 위험 | 골든셋에 넣을 케이스 (tags에 `security`) | 구조적 방어 (프롬프트 문장이 아니라 코드) |
|---|---|---|---|
| LLM01 | Prompt Injection | 사용자 입력에 지시를 숨긴 직접 인젝션, 검색 문서나 도구 결과에 지시를 숨긴 간접 인젝션. 신뢰할 수 없는 입력을 받으면 5개 이상(하네스 기본값) | 사용자 입력과 시스템 지시를 분리, 도구 권한 최소화, 출력 검증 |
| LLM02 | Sensitive Information Disclosure | 다른 사용자 정보, 비밀값, 내부 설정을 달라는 요청 | 비밀값을 컨텍스트에 넣지 않기, 출력 필터 |
| LLM03 | Supply Chain | 해당 케이스 적음. 모델, 라이브러리 출처 확인은 보안 리뷰로 | 모델 ID 고정, 의존성 고정 |
| LLM04 | Data and Model Poisoning | 사용자가 올린 문서가 RAG에 들어가면 오염 문서 케이스 | 적재 전 검증, 출처 표시 |
| LLM05 | Improper Output Handling | 출력이 HTML, SQL, 셸로 들어가면 스크립트, 쿼리 조각을 유도하는 입력 | 출력을 신뢰하지 않고 이스케이프, 스키마 검증 |
| LLM06 | Excessive Agency | 삭제, 결제, 발송을 유도하는 요청, 권한 밖 도구 호출 유도 | 사람 승인 단계를 코드로, 도구별 최소 권한, 금액과 횟수 상한 |
| LLM07 | System Prompt Leakage | 시스템 프롬프트를 보여 달라는 요청 | 시스템 프롬프트에 비밀값과 권한 판단을 두지 않기 |
| LLM08 | Vector and Embedding Weaknesses | 다른 테넌트 문서가 검색되는지 보는 케이스 | 검색 단계의 접근 제어 |
| LLM09 | Misinformation | 답할 수 없는 질문, 근거 문서에 없는 사실을 묻는 질문 | 근거 인용 요구, "모른다" 허용, 인용 대조 코드 채점 |
| LLM10 | Unbounded Consumption | 매우 긴 입력, 끝없는 도구 반복을 부르는 요청 | 최대 토큰, 도구 호출 횟수, 시간 제한, 사용자별 비용 상한 |

- 고위험 행동의 안전장치는 프롬프트의 "절대 하지 마"가 아니다. 승인 없이 다음 단계가 실행되지 않는 코드 구조여야 하고, 그 구조가 동작하는지 `must_refuse` 케이스와 도구 호출 여부를 보는 코드 채점기로 확인한다.

## 2. NIST 틀로 빠진 위험 찾기

- NIST AI RMF 1.0(NIST AI 100-1, 2023-01-26 공개)의 핵심은 GOVERN, MAP, MEASURE, MANAGE 네 기능이다. eval은 주로 MEASURE에 해당한다. NIST 페이지는 AI RMF 1.0이 개정 중이라고 밝힌다(https://www.nist.gov/itl/ai-risk-management-framework, 2026-10-16 확인).
- NIST AI 600-1 생성형 AI 프로필(2024-07-26 공개)은 생성형 AI에 고유하거나 더 커지는 위험 12가지를 든다(https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence). 기능마다 해당 여부를 표시하고, 해당하면 성공 기준이나 케이스로 옮긴다.

| 600-1 위험 | 이 기능에 해당? | 옮길 곳 |
|---|---|---|
| CBRN 정보, 능력 | | |
| Confabulation (그럴듯한 오답) | | 답할 수 없는 질문 케이스, 근거 대조 채점기 |
| 위험, 폭력, 혐오 콘텐츠 | | 거절 케이스 |
| Data Privacy | | 개인정보 노출 케이스, 로그 마스킹 |
| Environmental Impacts | | 호출당 토큰 예산 |
| Harmful Bias, Homogenization | | 사용자 집단별 케이스 분할과 통과율 비교 |
| Human-AI Configuration (과신, 잘못된 협업) | | 불확실성 표시 기준, 사람 확인 단계 |
| Information Integrity | | 출처 표시 기준 |
| Information Security | | 1절 OWASP 케이스 |
| Intellectual Property | | 원문 복제 케이스 |
| Obscene, Degrading, Abusive 콘텐츠 | | 거절 케이스 |
| Value Chain, Component Integration | | 모델, 외부 구성요소 버전 고정 |

국내 법(AI 관련 법률, 개인정보 보호법) 요구는 `gotechy-comply-kr` 스킬로 확인한다.

## 3. 모든 LLM 호출의 검증 관문 (코드)

1. 출력 스키마를 강제한다(구조화 출력 또는 JSON 스키마).
2. 형식을 검증한다. 실패하면 1회 다시 묻는다.
3. 그래도 실패하면 템플릿 응답이나 규칙 기반 경로로 폴백한다.
4. 규칙으로 판정되는 것은 코드가 검사하고, 판단이 필요한 것만 모델에 맡긴다.
5. 사람에게 넘기는 조건 두 가지를 코드로 둔다: 재시도 한도를 넘은 실패, 고위험 행동.

폴백 경로도 케이스 1개 이상으로 시험한다(스키마를 깨는 입력).

## 4. 예산

| 예산 | 어디서 재나 | 기본 규칙 |
|---|---|---|
| 지연 p95 (호출 1회, 사용자 체감 전체) | eval 실행 로그와 운영 로그 | 평균이 아니라 p95로 적는다 |
| 호출당 비용 | 토큰 수 x 단가 | 성공 기준과 함께 승격 조건에 넣는다 |
| 하루 비용 상한 | 운영 로그 집계 | 넘으면 알림, 사용자별 상한으로 막는다 |
| eval 1회 실행 비용 | 결과 파일 | 추정식으로 실행 전에 계산(`references/run-and-compare.md`) |

Anthropic 문서는 지연과 가격을 성공 기준의 차원으로 든다(https://platform.claude.com/docs/en/test-and-evaluate/develop-tests). 엔진이 좋아도 운영 비용이 안 맞으면 기능은 멈춘다.

## 5. 로그 필드 (OpenTelemetry GenAI 이름에 맞춘다)

OpenTelemetry GenAI semantic conventions는 2026년에 별도 저장소(https://github.com/open-telemetry/semantic-conventions-genai)로 옮겨졌고, 2026-10-16 기준 주요 속성의 상태는 Development다. 이름이 바뀔 수 있으니 따른 버전을 기록한다.

| 필드 | OTel 이름 (있으면) | 비고 |
|---|---|---|
| 작업 종류 | `gen_ai.operation.name` | 예: chat |
| 제공사 | `gen_ai.provider.name` | |
| 요청 모델 | `gen_ai.request.model` | 고정된 모델 ID |
| 응답 모델 | `gen_ai.response.model` | 별칭이 실제로 어떤 모델이었는지 |
| 입력 토큰, 출력 토큰 | `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` | |
| 오류 종류 | `error.type` | Stable |
| 프롬프트 버전 | 없음 (프로젝트 필드 `prompt_version`) | |
| 지연, 비용, 폴백 여부 | 없음 (`latency_ms`, `cost_usd`, `fallback`) | |
| eval 케이스 ID | 없음 (`eval_case_id`, eval 실행 때만) | |

트래픽이 작으면 래퍼 함수가 JSONL 한 줄씩 남기고 주 1회 집계해도 된다. 트래픽이 커져 전용 관측 도구로 옮길 때는 ADR을 남긴다.

## 6. 프롬프트와 모델 버전 관리

- 프롬프트는 코드다. 저장소의 파일로 두고 머리에 `version`, 변경 이력, 연결된 eval 경로를 적는다. 바꾸면 eval을 돌리고 결과 파일이 그 버전을 가리킨다.
- 모델은 고정된 ID로 부른다. 별칭을 쓰면 모델이 몰래 바뀌어 회귀 원인을 못 찾는다.
- 새 모델이 나오면 capability 셋과 회귀 셋을 돌린다. 더 싼 모델로 내리는 결정은 같은 셋에서 승격 규칙을 만족할 때만 한다.
- judge 프롬프트와 judge 모델도 같은 규칙으로 버전을 붙인다.

## 7. 운영에서 eval로 돌아오는 고리

1. 운영 실패(사용자 신고, 모니터링 경보, 트레이스 읽기에서 발견)는 7일 안에 골든셋 케이스로 옮긴다(하네스 기본값). 개인정보는 가린다.
2. 주 1회 트레이스 20개 이상을 사람이 읽는다. 새 실패 유형이 보이면 분류표에 추가한다.
3. 한 달에 한 번 운영 분포와 골든셋 분포(의도, 길이, 사용자 유형)를 비교한다. OpenAI 모범 사례는 운영 트래픽을 반영하지 않는 eval 셋을 안티패턴으로 든다.
4. 운영 모니터링과 장애 대응 자체는 `gotechy-operate` 스킬이 맡는다.
