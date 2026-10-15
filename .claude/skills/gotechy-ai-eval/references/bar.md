# gotechy-ai-eval bar: AI 평가 최고 전문가의 기준

언제 여는 파일인가: AI 기능의 eval 체계를 판정할 때, 승격이나 출시 전에 등급(A~D)을 매길 때.

이 bar가 지키는 것: "AI가 잘한다"는 주장이 사람 판단과 맞춰진 채점기, 운영 실패에서 나온 케이스, 잡음을 계산한 비교로 증명되는 상태. 검증 안 된 judge 점수, 같은 셋으로 고치고 같은 셋으로 자랑하는 과적합, 1~2개 케이스 차이를 개선이라 부르는 착각, 프롬프트 문장에 기댄 안전장치를 막는다.

## 기준의 원천 (모두 2026-10-16에 직접 열어 확인)

| 원천 | 판, 상태 | 발행일 | URL |
|---|---|---|---|
| Anthropic 문서, 성공 기준 정의와 eval 만들기 | 공식 문서 | 상시 갱신 | https://platform.claude.com/docs/en/test-and-evaluate/develop-tests |
| Anthropic Engineering, `Demystifying evals for AI agents` | 공식 블로그 | 2026-01-09 | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents |
| OpenAI, 평가 모범 사례 | 공식 문서 | 상시 갱신 | https://developers.openai.com/api/docs/guides/evaluation-best-practices |
| Hamel Husain, Shreya Shankar의 LLM evals FAQ | 실무자 문서 | 2026-09-18 (2026-09-21 수정) | https://hamel.dev/blog/posts/evals-faq/ |
| Shankar 외, `Who Validates the Validators?` (EvalGen) | arXiv 2404.12272 | 2024-04-18 | https://arxiv.org/abs/2404.12272 |
| Evan Miller, `Adding Error Bars to Evals` | arXiv 2411.00640 | 2024-11-01 | https://arxiv.org/abs/2411.00640 |
| NIST AI RMF 1.0 (NIST AI 100-1) | 1.0, 개정 진행 중이라고 NIST가 밝힘 | 2023-01-26 | https://www.nist.gov/itl/ai-risk-management-framework |
| NIST AI 600-1 생성형 AI 프로필 | 1판 (페이지 2026-04-08 갱신) | 2024-07-26 | https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence |
| OWASP Top 10 for LLM Applications | 2025판 | 2025 | https://genai.owasp.org/llm-top-10/ |
| OWASP Top 10 for Agentic Applications | 2026판 | 2025-12-09 | https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ |
| OpenTelemetry GenAI semantic conventions | 상태 Development, 2026년 별도 저장소로 이전 | 상시 갱신 | https://github.com/open-telemetry/semantic-conventions-genai |
| Claude Code 플러그인 eval 문서 (Δ 개념) | 공식 문서 | 상시 갱신 | https://code.claude.com/docs/en/plugin-evals.md |

"(하네스 기본값)"이라고 적은 숫자는 원천의 숫자가 아니라 하네스가 고른 값이다. 프로젝트가 근거를 적고 바꿀 수 있다. `[기계]` 줄은 끝에 `도구: <이름이나 명령>`을 적는다.

## 측정형 체크리스트

### A. 문제와 성공 기준

- [ ] [사람] AI 적합성 3문항(규칙 코드로 못 푸는가, 오답 비용, 출발점이 사용자 문제인가)의 답이 `criteria.md`에 있다.
- [ ] [사람] 성공 기준이 4개 이상 차원(과업 정확도, 안전과 거절, 지연 p95, 호출당 비용)에 숫자로 있다. "좋은 답변", "자연스럽게" 같은 말만 있는 기준 0개.
- [ ] [사람] 각 기준이 지금 모델로 달성 가능한 근거(기준선 측정, 이전 실험)를 갖고 있다(Anthropic의 Achievable 조건).
- [ ] [사람] 품질 결정권자 1명이 이름으로 적혀 있다.

### B. 오류 분석과 골든셋

- [ ] [사람] 품질 결정권자가 직접 라벨한 트레이스 30개 이상과 자유 메모가 있다.
- [ ] [사람] 실패 분류표가 있고 유형마다 정의 한 문장, 개수, 예시 ID가 있다. 새 유형이 안 나올 때까지(포화) 읽었다는 기록이 있다.
- [ ] [기계] `golden.jsonl` 케이스 20개 이상(하네스 기본값). 도구: `wc -l docs/evals/<기능>/golden.jsonl`
- [ ] [기계] 모든 케이스에 `id`, `input`, `expected_behavior`, `severity`, `split`, `source`가 있다. 도구: `jq -c 'select((.id and .input and .expected_behavior and .severity and .split and .source) | not)' docs/evals/<기능>/golden.jsonl` 출력 0줄
- [ ] [기계] 하지 말아야 할 행동 케이스(`must_refuse: true` 등)가 전체의 20% 이상(하네스 기본값). 도구: `grep -c '"must_refuse": true'`와 `wc -l`
- [ ] [기계] `split: test`가 전체의 20% 이상이다(하네스 기본값). 도구: `grep -c '"split": "test"'`와 `wc -l`
- [ ] [사람] 프롬프트 변경 기록에 test 결과를 보고 고친 흔적이 없다.
- [ ] [기계] `source: prod` 또는 `manual` 케이스가 1개 이상. 운영 중이면 운영 실패의 100%가 7일(하네스 기본값) 안에 케이스로 들어왔다. 도구: `grep -cE '"source": "(prod|manual)"'`와 사고 기록 날짜 대조
- [ ] [기계] 골든셋 케이스가 프롬프트의 few-shot 예시에 들어 있지 않다. 도구: 케이스 입력 문자열로 프롬프트 파일 `grep -F`
- [ ] [기계] 개인정보 패턴(전화번호, 주민등록번호, 이메일)이 골든셋에 0건. 도구: `grep -nE '01[0-9]-?[0-9]{3,4}-?[0-9]{4}|[0-9]{6}-?[1-4][0-9]{6}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' docs/evals/<기능>/golden.jsonl`

### C. 채점기

- [ ] [사람] 규칙으로 판정되는 기준(스키마, 금지어, 숫자, 도구 호출)은 전부 코드 채점기다.
- [ ] [기계] LLM judge는 실패 유형 하나만 보고 PASS, FAIL, UNKNOWN만 낸다. 1~10점 척도 judge 0개. 도구: `grep -rnE '1~10|1-10|1에서 10|점수를 매겨' docs/evals/<기능>/graders/` 출력 0줄
- [ ] [기계] judge마다 사람 라벨 50개 이상(하네스 기본값, 권장 100~200)의 test 분할에서 TPR 0.8 이상, TNR 0.8 이상이 기록돼 있다. critical 실패 유형은 TPR 0.9 이상(하네스 기본값). 도구: `grep -rn 'TPR\|TNR' docs/evals/<기능>/graders/`
- [ ] [기계] judge 프롬프트와 judge 모델 ID에 버전이 있고, 바뀐 뒤 일치도를 다시 쟀다. 도구: graders 파일의 버전 줄 grep과 `git log -p`로 버전과 일치도 기록 날짜 대조
- [ ] [사람] 주 1회 트레이스 20개 이상을 사람이 읽은 기록이 있다(하네스 기본값).

### D. 실행과 비교

- [ ] [기계] eval 실행 명령이 프로젝트 스크립트 목록에 있고 CI나 손으로 돌릴 수 있다. 실행할 수 없으면 게이트 미통과. 도구: `package.json` scripts나 `Makefile`에서 eval 명령 grep, 그 명령의 종료 코드
- [ ] [기계] 결과 파일마다 날짜, 평가한 sha, 감시 경로, 프롬프트 버전, 고정된 모델 ID, judge 버전, n, k, 통과율과 표준오차, 실행 비용(추정과 실제)이 있다. 평가한 sha 뒤로 감시 경로가 바뀌면 그 결과는 출시 판정에 쓰지 않는다(`gotechy-ship`이 본다). 도구: 결과 파일 grep, `git diff --quiet <평가한 sha> HEAD -- <감시 경로>`
- [ ] [기계] 사용자 대면 critical 케이스는 k=3(하네스 기본값) 전부 통과(pass^3). 도구: eval 러너 결과
- [ ] [기계] 승격 판정은 같은 케이스에서 기준 버전과 비교한 Δ와 짝지은 표준오차로 했다. 개선 주장은 Δ > 2 x SE일 때만. 도구: 결과 파일의 Δ, SE 칸(`references/run-and-compare.md`의 계산)
- [ ] [기계] critical 케이스 100% 통과, 회귀 셋에서 새로 실패한 케이스 0개. 도구: eval 러너 결과
- [ ] [기계] dev와 test 통과율 격차가 10%p 이하(하네스 기본값)이거나, 넘으면 원인이 기록돼 있다. 도구: 결과 파일의 dev, test 통과율
- [ ] [기계] 1회 실행 예산이 `criteria.md`에 있고 실제 비용이 예산 안이다. 도구: `criteria.md`의 예산 줄과 결과 파일의 실제 비용 grep
- [ ] [사람] capability 셋이 2회 연속 95% 이상(하네스 기본값)이면 회귀 셋으로 옮기고 새 난제를 넣었다.

### E. 가드레일과 운영

- [ ] [기계] 모든 LLM 호출이 스키마 검증, 1회 재질의, 폴백을 지난다. 폴백 경로를 시험하는 케이스가 1개 이상. 도구: 폴백 케이스를 eval 러너나 테스트 러너로 실행
- [ ] [기계] 신뢰할 수 없는 입력(사용자 글, 검색 문서, 도구 결과)을 받으면 프롬프트 인젝션 케이스(직접, 간접)가 5개 이상(하네스 기본값, OWASP LLM01). 도구: `grep -c '"security"' docs/evals/<기능>/golden.jsonl`
- [ ] [기계] 고위험 행동(삭제, 결제, 발송)은 코드의 승인 단계로 막혀 있고, 승인 없이 실행되지 않는지 보는 케이스가 있다(OWASP LLM06). 도구: 그 케이스를 테스트 러너로 실행
- [ ] [기계] 최대 토큰, 도구 호출 횟수, 시간, 사용자별 비용 상한이 코드에 있다(OWASP LLM10). 도구: 상한 설정 이름 grep과 상한을 넘기는 테스트
- [ ] [기계] 호출 로그에 모델 ID, 프롬프트 버전, 입력과 출력 토큰, 지연, 비용, 폴백 여부가 남는다(OpenTelemetry GenAI 이름 권장). 도구: 테스트 호출 1회 뒤 로그에서 필드 grep
- [ ] [기계] 운영 지연 p95와 하루 비용이 예산 안이고, 넘으면 알림이 간다. 도구: 모니터링 대시보드 질의와 알림 규칙 파일
- [ ] [사람] NIST AI 600-1의 12개 위험마다 해당 여부를 표시했고, 해당 항목은 기준이나 케이스로 옮겼다.

## 등급 판정

| 등급 | 일반 정의 | 이 분야의 구체화 |
|---|---|---|
| A (최고 전문가) | 체크리스트 전부 통과, 기계 강제 장치 있음, 최근 4주 회귀 0 | 프롬프트, 모델, judge 변경 PR마다 eval이 CI에서 돌고 승격 규칙을 못 넘으면 머지가 막힌다. 모든 judge의 일치도가 기록돼 있다. 최근 4주 동안 critical 실패 0, 운영 실패는 전부 7일(하네스 기본값) 안에 케이스가 됐다 |
| B (출시 가능) | 전부 통과, 일부 수동 | 체크리스트를 다 넘지만 eval 실행이나 승격 판정을 사람이 손으로 한다 |
| C (부채 있음) | 미달 항목이 부채 목록에 기록됨 | judge 일치도 미측정, test 분할 부족 같은 미달이 있지만 전부 부채 목록에 담당자와 날짜와 함께 있다 |
| D (위험) | 미달이 기록조차 없거나 보안, 데이터, 법 관련 | 검증 안 된 judge 점수로 출시를 판정했다, 고위험 행동이 프롬프트 문장으로만 막혀 있다, 인젝션 케이스가 없다, 개인정보가 골든셋에 그대로 있다, eval을 실행할 수 없다 |

## 최고 전문가가 더 하는 것

1. 지표를 고르기 전에 데이터를 읽는다. 오류 분석으로 실패 분류표를 만들고 그 실패에만 채점기를 만든다(Husain, Shankar FAQ: 그들의 프로젝트에서 개발 시간의 60~80%가 오류 분석과 평가).
2. 척도 대신 실패 유형별 이진 판정을 쓴다. 3과 4의 차이로 다투지 않고 "무엇이 틀렸나"에 집중한다(같은 FAQ).
3. judge를 사람 라벨로 검증한다. TPR, TNR을 test 분할에서 재고, 기준은 출력을 보면서 바뀐다는 사실(기준 표류)을 받아들여 라벨과 기준을 함께 고친다(FAQ, Shankar 외 EvalGen).
4. 트랜스크립트를 읽는다. 실패가 진짜 실수인지 채점기가 올바른 답을 떨어뜨린 것인지 트랜스크립트만 알려 준다. 0% 통과는 과제 결함부터 의심한다(Anthropic).
5. 비교에 오차 막대를 단다. 같은 케이스의 짝지은 차이로 표준오차를 내고, temperature를 낮춰 잡음을 숨기지 않는다(Miller, `Adding Error Bars to Evals`).
6. 행동해야 할 때와 하지 말아야 할 때를 둘 다 시험한다. 한쪽만 시험하면 한쪽으로만 최적화된다(Anthropic).
7. 경로가 아니라 결과를 채점하고, 케이스마다 통과하는 기준 답을 만들어 과제가 풀 수 있는 것인지 먼저 확인한다(Anthropic).
8. 운영 로그를 eval의 원천으로 쓴다. 로그를 남겨야 좋은 케이스를 캐낼 수 있다(OpenAI 모범 사례의 "Log everything").

## 흔한 실패와 고치는 법

1. **범용 지표(ROUGE, BLEU, "도움됨 1~5")로 품질을 말한다.** 오류 분석으로 찾은 실패 유형별 이진 채점기로 바꾼다.
2. **judge를 검증하지 않고 점수를 믿는다.** 실패 유형마다 사람 라벨 50개 이상으로 TPR, TNR을 잰다. 못 넘으면 그 유형은 사람이 채점한다.
3. **같은 셋으로 고치고 같은 셋으로 보고한다.** dev와 test로 나누고 test는 승격 판정 때만 연다. dev와 test 격차를 감시한다.
4. **한 번 돌려 1~2개 차이로 "좋아졌다".** k회 반복과 짝지은 표준오차로 판정한다. 20개 셋에서 1개 차이는 잡음과 구별되지 않는다.
5. **해야 할 행동만 시험한다.** 거절, 도구 호출 안 하기, "모른다" 케이스를 20% 이상 넣는다.
6. **통과율 100%에 머문다.** capability 셋이 포화되면 회귀 셋으로 옮기고 더 어려운 케이스를 넣는다. 100%면 충분히 시험하지 않는 것일 수 있다.
7. **합성 케이스만 있다.** 운영 로그와 수동 테스트에서 케이스를 뽑고 운영 분포와 비교한다.
8. **비용을 안 잰다.** 실행 전에 추정식으로 계산하고 예산을 넘으면 계단을 낮춘다. 결과 파일에 실제 비용을 적는다.
9. **모델 별칭으로 기록한다.** 고정된 모델 ID와 응답 모델 이름을 기록해 회귀 원인을 추적할 수 있게 한다.
10. **프롬프트 문장을 안전장치로 보고한다.** 금액, 횟수 상한과 승인 단계를 코드로 두고 인젝션 케이스로 뚫리는지 시험한다.
