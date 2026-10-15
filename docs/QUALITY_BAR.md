# QUALITY_BAR.md — 품질 기준과 품질 점수

> **bar = 각 분야 최고 전문가.** "동작한다"와 "출시할 수 있다" 사이의 거리를 이 문서가 정의한다.
> 이 문서는 모든 작업의 **상시 하한선**이다. 프로젝트별 수치 합격선(조건+대상+지표+목표값)은 `/gotechy-quality`로 세운다 — `docs/QUALITY_MODEL.md` (ISO 25010 기준, 아래 영역들은 25010 특성의 실용 축약: 테스트·코드→유지보수성, UX→상호작용 능력, 보안→보안성, 신뢰성→신뢰성·성능 효율성).
> 완료 게이트(`/gotechy-ship`)와 리뷰 에이전트가 이 문서를 기준으로 판정한다.

## 분야별 최고 전문가 bar (전문가 팩, 2026-10-16)

이 문서의 영역별 기준은 하네스 저장소 자신의 하한선이에요. 다른 프로젝트에서 쓰는 분야별 기준은 전문가 팩의 `references/bar.md`가 원천이고, 프로젝트에 팩을 깔면 그 안에 함께 들어가요(contract.md 10.8절). 각 bar에는 원천 표준과 판, 확인일, `[기계]`와 `[사람]`으로 나눈 측정형 체크리스트, A~D 등급, 최고 전문가가 더 하는 것, 흔한 실패가 있어요.

| 분야 | bar | 주요 원천(판은 bar 안에) |
|---|---|---|
| 오너 보고 | `skills/owner-protocol/references/bar.md` | gotechy 계약 4절, 7절, Anthropic 코딩 실력 형성 연구, 쉬운 글 지침 |
| 발견 | `skills/gotechy-discover/references/bar.md` | Continuous Discovery, Mom Test, JTBD, Testing Business Ideas |
| 스펙 | `skills/gotechy-spec/references/bar.md` | ISO/IEC/IEEE 29148, EARS, Working Backwards |
| 계획 | `skills/gotechy-plan/references/bar.md` | ExecPlan, pre-mortem, DORA 작은 배치 |
| 디자인 | `skills/gotechy-design/references/bar.md` | WCAG 2.2, KWCAG, Core Web Vitals, 사용성 휴리스틱 |
| 구현 | `skills/gotechy-build/references/bar.md` | Google 코드 리뷰 지침, TDD, Parse don't validate, SLSA, Scorecard |
| 품질 | `skills/gotechy-quality/references/bar.md` | ISO/IEC 25010:2023, 25023, 29119, mutation testing |
| AI 평가 | `skills/gotechy-ai-eval/references/bar.md` | Anthropic eval 지침, 오류 분석 먼저, 채점자 정렬, NIST AI RMF, OWASP LLM Top 10 |
| 보안 | `skills/gotechy-security/references/bar.md` | OWASP ASVS 5.0, Top 10, LLM과 에이전트 Top 10, NIST SSDF, SLSA |
| 한국 법 | `skills/gotechy-comply-kr/references/bar.md` | 개인정보 보호법, AI 기본법, 정보통신망법, 장애인차별금지법 |
| 출시 | `skills/gotechy-ship/references/bar.md` | DORA 지표, SRE 출시 공학, OpenFeature, SLSA |
| 운영 | `skills/gotechy-operate/references/bar.md` | SRE SLO와 오류 예산, OpenTelemetry, FOCUS |
| 알리기 | `skills/gotechy-launch/references/bar.md` | Google Search Central, 네이버 서치어드바이저, GEO 연구, 표시광고법 |
| 글쓰기 | `skills/gotekie-blog-writer/references/bar.md` | 사람 중심 콘텐츠, 쉬운 글 |
| 회고 | `skills/gotechy-retro/references/bar.md` | 회고 시작 선언, 비난 없는 포스트모템, ADR, 기술 부채 사분면 |

bar 안의 수치 중 표준에 없는 값은 "하네스 기본값"이나 "이 bar가 정한 값"으로 표시해 두었어요. 오너가 바꿀 수 있는 값이에요. bar의 원천이 바뀌는지는 `radar/sources/<스킬>.yaml`에 적은 출처로 살펴요(최신화 자동화는 2단계).

## 영역별 품질 기준 (하네스 저장소 자신)

### 코드
- [ ] TypeScript strict 통과, `any` 사용 시 사유 주석
- [ ] 경계에서 파싱 (외부 입력은 스키마 검증 후 내부 타입으로)
- [ ] 함수는 한 가지 일, 이름만 읽고 동작 예측 가능
- [ ] 죽은 코드·주석 처리된 코드 없음

### 테스트
- [ ] Service 레이어(비즈니스 로직) 커버리지 우선 — 목표 80%+, 핵심 모듈 95%. **측정·강제**: 테스트 러너 coverage thresholds 설정으로 기계 강제하고, 게이트 통과 시 커버리지 리포트 수치를 출력에 첨부한다. "핵심 모듈" 목록은 ARCHITECTURE.md에 명시.
- [ ] 버그 수정에는 재발 방지 테스트 동반
- [ ] E2E: 핵심 사용자 여정 최소 1개 (webapp-testing/Playwright)
- [ ] 테스트가 실패하는 것을 먼저 확인 (RED → GREEN)

### 문서
- [ ] 코드 변경과 문서 변경은 한 몸 — 스펙·ARCHITECTURE·ADR 갱신 없이 구조 변경 금지
- [ ] README의 실행 명령이 실제로 동작
- [ ] 자동 생성 가능한 문서는 `generated/`로 (수동 유지 금지)

### UX/디자인
- [ ] `docs/DESIGN.md` anti-slop 체크(측정형) 통과
- [ ] 모바일(375px)에서 가로 스크롤 없음
- [ ] DESIGN.md 상태 매트릭스 커버 (로딩/빈 2종/에러 구분/부분 실패)
- [ ] axe 자동 검사(@axe-core/playwright) 위반 0건
- [ ] 모든 인터랙티브 요소에 `:focus-visible` 커스텀 링 — 마우스 클릭 시 미표시
- [ ] 핵심 여정을 키보드만으로 완주 가능 (Tab 순서 = 시각 순서)

### 보안
- [ ] `docs/SECURITY.md` 체크리스트 통과 (시크릿·입력 검증·인증)

### 신뢰성
- [ ] `docs/RELIABILITY.md` 요구사항 충족

## 품질 점수표 (QUALITY_SCORE)

> 도메인·레이어별 현재 등급을 기록하고 격차를 추적한다. `/gotechy-ship` 실행 시 **이번 작업이 건드린 영역만** 갱신한다 (6개 전부 강제하면 2번째부터 생략된다).
>
> **등급 판정 루브릭** (인상이 아니라 판정):
> - **A(전문가)**: 해당 영역 체크리스트 전부 통과 + 기계 강제 장치 존재 + 최근 4주 회귀 0
> - **B(출시 가능)**: 체크리스트 전부 통과, 일부가 수동 검증
> - **C(부채 있음)**: 체크리스트 미달 항목이 tech-debt-tracker에 기록된 상태
> - **D(위험)**: 미달 항목이 기록조차 안 됐거나 보안·데이터 관련

| 영역 | 등급 | 마지막 평가 | 격차 메모 |
|---|---|---|---|
| 코드 구조 | B | 2026-10-15 (하네스 v2 1a) | 레이어 규칙을 `check:boundaries`가 강제. 시작한 지 4주가 안 돼 A의 "최근 4주 회귀 0"을 아직 판정할 수 없음 |
| 테스트 | B | 2026-10-15 | 커버리지 기준을 `gotechy test`가 강제(전체 97%, 핵심 95% 이상). mutation check는 손으로 함(자동화 전) |
| 문서 | C | 2026-10-15 | 문체 경고 약 1,700건(TD-005), 문서 다이어트(TD-003). 계약과 코드 대조는 doc-gardener로 |
| UX | - | - | 화면 시안 비교(1b N6) 전이라 판정하지 않음 |
| 보안 | C | 2026-10-15 | 높음 0. 남은 것은 부채로 기록: TD-007, TD-009, TD-012~TD-015 |
| 신뢰성 | C | 2026-10-15 | accept 실패 뒤 다시 하기(TD-006), 리눅스 샌드박스(TD-009) |

## 운영 원칙

- **기술 부채는 고금리 대출** — 매일 소액 상환. C 이하 등급이 2주 이상 방치되면 exec-plan으로 승격한다.
- 등급을 낮추는 머지도 허용된다 — 단, 정직하게 기록하고 tech-debt-tracker에 남긴다. (교정은 싸고, 대기는 비싸다)
- 리뷰 에이전트(spec-reviewer, security-auditor)의 지적은 "반영" 또는 "기각 사유 기록" 둘 중 하나로만 종결한다.

## 하네스 자체의 측정

> 이 하네스는 "측정할 수 없으면 주장하지 말라"고 요구한다. 그 요구는 하네스 자신에게도 적용된다.
> **"AI를 잘 쓴다"는 말은 검증할 수 없다 — 어떤 구성요소가 어느 지표를 움직이는지 분리해서 재야 숫자로 말할 수 있다.**

측정 도구: `~/workspace/harness-bench` — 같은 과제를 하네스 구성요소를 켠/끈 조건으로 풀게 하고 통과율·재시도 횟수·토큰 사용량을 비교한다.

| 조건 | 적용 구성요소 |
|---|---|
| `bare` | 없음 (단일 프롬프트 1회, 재시도 없음) |
| `plan-only` | 계획 수립만 |
| `full` | 계획 + 메모리 + 루프 + 평가 |

```bash
cd ~/workspace/harness-bench
bench/run.sh                    # 전체 실행 → results/raw-<timestamp>.csv
bench/summarize.sh              # 조건별 집계표
```

**측정 규율**
- 채점은 각 과제의 `verify.sh`가 단독 책임진다. 테스트를 고쳐 통과시키는 것은 `STRICT_HASH=1`이 막는다.
- **표본이 작다** — 통과율 차이를 생산성 배수로 환산하지 않는다.
- **하네스가 손해인 구간이 나오면 그대로 기록한다.** 유리한 결과만 남기는 순간 측정이 아니라 마케팅이 된다.
- 하네스 구성요소를 크게 바꾸면(게이트 추가, 문서 구조 변경) 벤치를 다시 돌려 회귀를 확인한다 — 이것이 하네스판 eval 게이트다.
