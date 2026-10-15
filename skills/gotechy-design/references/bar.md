# gotechy-design bar: 화면 설계와 디자인 검토의 최고 수준 기준

설계 문서(40-sitemap, 50-wireframe, 60-style-guide)를 확정하거나, 구현된 화면을 검토하고 등급을 매길 때 연다.

## 이 bar가 지키는 것

사용자가 처음 보는 화면에서 무엇을 할 수 있는지 알고, 키보드나 스크린리더로도, 375px 폰에서도, 느린 연결에서도 핵심 행동을 끝낸다. 그리고 그 화면이 이 제품만의 결정으로 만들어졌다. 그래서 흐름 없이 그린 화면, 계산 없이 고른 색, 상태가 빠진 데이터 화면, 어느 주제에나 붙는 AI 기본값을 걸러 낸다.

## 기준의 원천 (2026-10-16에 직접 열어 확인)

| 원천 | 판 | 날짜 | URL |
|---|---|---|---|
| W3C WCAG 2.2 | W3C 권고 | 2024-12-12 | https://www.w3.org/TR/WCAG22/ |
| WCAG 2.2 이해 문서 2.5.8(타깃 크기 최소, AA) | 24x24 CSS px | 2024 | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| 한국형 웹 콘텐츠 접근성 지침 2.2 | KS X OT0003:2022, 검사 항목 33개 | 2022-12 | https://www.bizinfo.go.kr/biz/bizd/selectBIZD130View.do |
| WCAG 3.0 | 초안(대비 알고리즘 미정, 합격선으로 쓰지 않음) | 2026-09-10 초안 | https://www.w3.org/TR/wcag-3.0/ |
| Nielsen Norman Group, 10 Usability Heuristics | 1994 원문, 2024-01-30 검토 | 2024-01-30 | https://www.nngroup.com/articles/ten-usability-heuristics/ |
| Design Tokens Format Module(DTCG) | 2025.10, 첫 안정판(Final Community Group Report, W3C 표준 아님) | 2025-10-28 | https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/ |
| web.dev Core Web Vitals | LCP 2.5초, INP 200ms, CLS 0.1, 75번째 백분위 | 상시 갱신 | https://web.dev/articles/vitals |
| axe-core | 자동 검사로 WCAG 문제의 평균 57%를 찾음(README) | 상시 갱신 | https://github.com/dequelabs/axe-core |

세부 절차의 원천은 각 참고 파일(`tokens.md`, `states-and-content.md`, `anti-slop.md`, `section-library.md`)에 있다.

## 측정형 체크리스트

### 1. 구조와 흐름

- D1 [기계] 40-sitemap의 페이지가 30-user-flow의 페이지 노드와 1:1로 대응하고, 대응 안 되는 페이지 0개. 도구: 두 문서의 페이지 표 대조(grep)
- D2 [기계] 섹션 타입은 `section-library.md` 어휘 안에서만 쓴다. 어휘 밖 섹션 0개. 도구: 와이어프레임 섹션 이름을 어휘 목록과 grep 대조
- D3 [기계] `NEEDS CLARIFICATION`, `SYNC NEEDED` 마커 0개. 도구: `grep -cE "NEEDS CLARIFICATION|SYNC NEEDED" docs/product-specs/<슬러그>/[456]0-*.md`
- D4 [사람] 페이지마다 핵심 행동이 1개로 정해져 있고, 첫 화면에서 보인다(NN/g 1, 6번).

### 2. 상태와 문구

- D5 [기계] 데이터 섹션마다 상태 8종(로딩, 첫 사용 빈 상태, 결과 없음, 복구 가능 오류, 복구 불가 오류, 부분 실패, 오프라인, 권한 없음)의 행이 있다. 도구: 와이어프레임 상태 표의 행 수 grep
- D6 [사람] 상태마다 사용자가 할 다음 행동이 1개 있고, 오류 문구가 무엇이 잘못됐는지와 고치는 법을 말한다(NN/g 9번, `states-and-content.md`).
- D7 [기계] 자리표시 카피(로렘, "텍스트", "제목") 0개. 도구: `anti-slop.md`의 D1 grep

### 3. 접근성 (기본 목표 WCAG 2.2 AA와 KWCAG 2.2)

- D8 [기계] axe-core 위반 0건(태그 wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa). 도구: `@axe-core/playwright` 또는 axe CLI
- D9 [기계] 대비: 본문 4.5:1, 큰 글자와 컴포넌트 경계와 포커스 링 3:1 이상. 라이트와 다크 모두, 배경마다 따로, 반올림 없이. 도구: `tokens.md`의 대비 계산 스크립트
- D10 [기계] 타깃 크기 24x24 CSS px 이상(WCAG 2.5.8), 하우스 기준 44x44px(하네스 기본값). 도구: 브라우저 개발자 도구나 Playwright로 요소 크기 측정
- D11 [사람] 핵심 여정을 키보드만으로 끝낸다. Tab 순서가 시각 순서와 같고, `:focus-visible` 링이 sticky 요소에 완전히 가려지지 않는다(WCAG 2.4.11).
- D12 [사람] 스크린리더(VoiceOver 등)로 핵심 여정 1회 확인. 자동 검사는 문제의 절반 남짓만 찾는다(axe-core README 57%).

### 4. 반응형과 성능

- D13 [기계] 375px 폭에서 가로 스크롤 0, 320px에서 정보와 기능 손실 0(WCAG 1.4.10). 도구: Playwright 뷰포트 스크린샷과 `document.documentElement.scrollWidth` 비교
- D14 [기계] 출시 뒤 현장 데이터 75번째 백분위로 LCP 2.5초 이하, INP 200ms 이하, CLS 0.1 이하(모바일, 데스크톱 따로). 도구: CrUX나 web-vitals 라이브러리 수집값, 출시 전에는 Lighthouse로 대리 측정

### 5. 토큰과 일관성

- D15 [기계] 토큰은 DTCG 2025.10 형식이고, 컴포넌트는 시맨틱 토큰만 쓴다. 컴포넌트 안 hex, rgb 하드코딩 0. 도구: `anti-slop.md`의 G13, G14 grep
- D16 [기계] 간격은 4px 격자, radius는 2단계와 full, 그림자는 2단계 이하. 도구: `anti-slop.md`의 G3, G9, G15 grep

### 6. 이 제품다움 (anti-slop)

- D17 [기계] `anti-slop.md` 측정 검사 위반 0건(근거를 남긴 예외는 위반으로 세지 않는다). 도구: `anti-slop.md`의 코드 grep 묶음과 문서 grep 묶음
- D18 [사람] 바꿔 끼우기 검사: 화면을 다른 주제 제품에 옮기면 어색하다. 업종, 소재, 사용자 말에서 가져온 시각 결정이 1개 이상(AS19).

## 등급 판정

- A(최고 전문가): D1~D18 모두 통과. axe와 대비 검사와 anti-slop grep이 CI에서 돌고, 최근 4주에 접근성 회귀 0.
- B(출시 가능): D1~D18 모두 통과. 스크린리더 확인이나 성능 측정 일부가 출시 전 대리값이다.
- C(부채 있음): 미달 항목이 `docs/exec-plans/tech-debt-tracker.md`에 담당과 기한과 함께 적혀 있다. 핵심 여정을 막는 접근성 미달은 C로 두지 않는다(D).
- D(위험): 핵심 여정을 키보드나 스크린리더로 끝낼 수 없거나, 본문 대비 미달, 375px 가로 스크롤, 미달인데 기록이 없다.

## 최고 전문가가 더 하는 것

- 콘텐츠 먼저: 실제 카피와 실제 데이터 모양으로 와이어프레임을 그리고, 색과 폰트는 그 뒤에 정한다.
- 빈 상태, 오류, 부분 실패를 "정상 화면만큼" 설계한다. 사용자가 가장 오래 머무는 화면이 이들일 때가 많다.
- 대비를 눈이 아니라 계산으로 증명하고, 다크 모드도 따로 계산한다.
- 자동 검사를 바닥으로 보고, 키보드와 스크린리더로 직접 끝까지 가 본다.
- 대담한 선택은 한 곳에만 하고 나머지는 조용히 둔다. 그 한 곳은 이 제품의 사용자와 소재에서 가져온다.
- 결정마다 근거(어떤 사용자, 어떤 휴리스틱, 어떤 수치)를 Q&A 로그에 남겨 6개월 뒤에도 설명할 수 있다.

## 흔한 실패와 고치는 법

| 실패 | 고치는 법 |
|---|---|
| 흐름 없이 화면부터 그린다 | 30-user-flow를 먼저 확정하고 페이지 노드를 1:1로 옮긴다 |
| 회색 보조 글자(`#999999`)를 흰 배경에 쓴다(2.84:1) | `#767676` 이상(4.54:1)을 쓰고 스크립트로 확인한다 |
| 로딩과 빈 상태만 있고 부분 실패, 오프라인, 권한 없음이 없다 | 상태 8종 표를 데이터 섹션마다 채운다 |
| axe 0건이라 접근성 끝이라고 본다 | 키보드와 스크린리더로 핵심 여정을 직접 확인한다 |
| 그라데이션 히어로, 3열 기능 카드, 섹션마다 페이드 | `anti-slop.md` 검사를 돌리고 근거 없는 기본값을 지운다 |
| 토큰을 만들고도 컴포넌트에 hex를 적는다 | 시맨틱 토큰만 쓰게 하고 G13 grep을 CI에 넣는다 |
| WCAG 3.0 초안이나 APCA 값으로 합격을 판정한다 | WCAG 2.2 값으로 판정하고 초안 값은 참고로만 적는다 |
