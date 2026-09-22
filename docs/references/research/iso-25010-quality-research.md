# ISO/IEC 25010·25023·25030 품질 모델 리서치 원장 (2026-09-22)

> `docs/QUALITY_MODEL.md`와 `/gotechy-quality`의 근거. 출발점: 코딩하는기술사 「AI에게 검증가능한 목표 제시하기 | 국제표준기반 품질목표 세우기」 (youtu.be/OTttvhEHncQ, 2026-09-21, 17:17 — 전체 트랜스크립트 확보).

## 1. 영상의 방법론 (5단계)

① 모호한 형용사를 품질특성으로 변환 ("빠르게"→성능효율성) → ② 25023에서 측정 항목·함수 선택 (응답시간 적정성 X=A/B) → ③ **목표값은 표준이 아니라 우리가 정한다** (25030 — "B는 우리 시스템의 요구사항". 증권 주문 ≠ 사내 게시판) → ④ 조건+대상+지표+목표 명시 후 설계 전략(택틱) 적용 — 설계에 큰 영향이면 아키텍처 드라이버 → ⑤ 측정·검증 루프 (불합격 시 설계 재검토).

실무 사례 3종: 성능(500TPS·주문 API·p95≤500ms·오류율≤0.1% → 부하테스트) / 가용성(월 99.95%=허용 22분·MTTR≤10분 → 이중화·페일오버·복구 훈련) / 보안(관리자 개인정보 조회 감사 기록률 100% → 행위↔로그 1:1 대조).

AI 적용: "성능 좋게 만들어줘" ❌ → "500TPS에서 주문 API p95 500ms 이하를 만족할 것. 설계 전략과 부하테스트 검증 기준을 세우고 결과를 보고해줘" ⭕. "측정할 수 없으면 관리할 수 없고, 관리할 수 없으면 개선할 수 없다."

## 2. ISO/IEC 25010:2023 (2판) 확정 사항

- 2011판이 3개로 분리: **25010:2023(제품 품질) + 25002(개요) + 25019:2023(사용품질)**
- 변경: Safety 신설 / Usability→Interaction Capability / Portability→Flexibility / Maturity→Faultlessness / UI aesthetics→User Engagement / 신규 부특성: Inclusivity·Self-descriptiveness(상호작용능력), Resistance(보안성), Scalability(유연성) / Accessibility는 Inclusivity와 User Assistance로 분리
- **Testability 소속 검증**: arc42 품질모델 사이트는 Flexibility 아래로 표기하나, FDIS Foreword(Flexibility 추가 부특성은 Scalability만 언급)와 Codacy 해설 기준 **Maintainability 소속이 맞음** (확신도 ~85%, arc42 표기 오류 추정) → 하네스는 Maintainability 채택
- 9특성×부특성 전체 표: QUALITY_MODEL.md §3 (한글은 KS/TTA 2011판+통용어 — 2023판 공식 국문 미공표)
- 사용품질(25019:2023): 유익성(사용성·접근성·적합성) / 위험 회피성(경제·환경사회·건강·인명) / 수용성(경험·신뢰·준수성). Context Coverage는 삭제됨

## 3. ISO/IEC 25023 측정 구조

- 측정 항목 = `ID · Name · Description · Measurement function` (ID 형식 예: `FCp-1-G`). 측정 함수는 QME(25021이 정의하는 기초 측정값 A, B…)의 결합식
- 예시 (★=원문 확인): ★FCp-1-G 기능 커버리지 X=1−A/B / ★FCr-1-G 기능 정확성 X=1−A/B / ★PTb-1-G 평균 응답시간 X=ΣAᵢ/n / ★**PTb-2-G 응답시간 적정성 X=A/B** (영상의 그 항목) / 시스템 가용성 X=가동시간/운영시간 / MTTR / 사용자 감사 추적 완전성 X=기록된 접근/전체 접근
- 25023:2016은 2011 모델 기준 — 신설 특성(안전성 등) 측정 항목은 자체 정의 필요

## 4. ISO/IEC 25030:2019 요구사항 프레임워크

- 요구사항 3유형: **QIUR**(사용품질 — 밸리데이션 목표, 측정=25022) → 대부분의 **PQR**(제품품질 — 검증 목표, 측정=25023)은 QIUR에서 파생 / **DQR**(데이터품질, 25012·25024)
- 도출 절차: 이해관계자 식별 → 품질 니즈 도출(사용 맥락 포함) → 품질모델로 분류(모델을 빠짐없음 체크리스트로) → **측정지표 선택 + 목표값·평가 기준 지정** → 특성 간 트레이드오프 조정(보안↔성능) → 시스템 분해에 배치·추적성 → 검증·확인에 사용
- 좋은 요구사항 조건(→ISO/IEC/IEEE 29148): 필요성·구현 독립성·명확성·일관성·완전성·단일성·실현 가능성·추적 가능성·**검증 가능성**

## 5. 실무 벤치마크 (출처 포함 — QUALITY_MODEL §6의 근거)

| 특성 | 지표 | 통상 목표 | 출처 |
|---|---|---|---|
| 성능(웹) | CWV | LCP≤2.5s · INP≤200ms · CLS≤0.1 (p75) | web.dev/articles/vitals |
| 성능(웹) | Lighthouse Perf | ≥90 | developer.chrome.com/docs/lighthouse |
| 성능(API) | p95/p99 | CRUD p95 300~500ms, p99≤1s (SLO는 여정별 자체 설정) | sre.google/sre-book/service-level-objectives |
| 신뢰성 | 월 uptime | 99.9%(43.8분) 기본, 핵심 99.95%(21.9분) | sre.google/sre-book/availability-table |
| 신뢰성(앱) | crash-free | 사용자 ≥99.9%, 우수 ≥99.95% | firebase.google.com/docs/crashlytics |
| 보안 | OWASP Top 10 | 해당 취약점 0 (릴리스 게이트) | owasp.org/www-project-top-ten |
| 보안 | ASVS | 일반 L1, 개인정보·결제 L2 | OWASP ASVS |
| 유지보수성 | 커버리지 | 60 하한 / 75 권장 / 90 모범, 신규 ≥80 | testing.googleblog.com (2020-08) · SonarQube Sonar way |
| 유지보수성 | 순환 복잡도 | 함수 ≤10 | McCabe·NIST SP 500-235 |
| 접근성 | WCAG 2.2 AA | 위반 0 | w3.org/TR/WCAG22 |
| 확장성 | 부하 배수 | 평시 2~3배에서 SLO 유지 | 부하테스트 관행 |

## 6. 주요 출처

영상 youtu.be/OTttvhEHncQ · 25010:2023 FDIS 미리보기 (standards.iteh.ai #78176) · 25019:2023 (#78177) · 25023:2016 측정표 (standards.iteh.ai) + arxiv.org/pdf/2108.02921 · 25030:2019 (#72116) · 해설: iso25000.com, blog.codacy.com, quality.arc42.org(Testability 표기 오류 추정) · 한글 용어: blog.skby.net, nolsik.tistory.com

**미확정**: 2023판 공식 KS/TTA 국문 번역(통용어로 대체) · ☆ 표시 측정 항목의 정확한 ID(함수식은 확실) · Testability 소속(85%)
