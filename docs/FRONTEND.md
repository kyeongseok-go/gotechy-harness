# FRONTEND.md — 프론트엔드 규범

> 기본 스택: TypeScript(strict) + React/Next.js. 프로젝트가 다른 스택이면 이 파일을 교체한다.

## 구조

- 컴포넌트는 **표현/컨테이너 분리** 대신 "서버 컴포넌트 우선, 클라이언트는 잎사귀만" 원칙 (Next.js App Router 기준).
- 상태는 가장 가까운 곳에 — 전역 상태는 정말 전역일 때만 (URL > 서버 캐시 > 로컬 state > 전역 store 순으로 고려).
- 데이터 페칭은 UI 컴포넌트 밖으로 (Service/hook 레이어). 컴포넌트 안 fetch 금지.

## 스타일

- 디자인 토큰(`DESIGN.md`)을 CSS 변수로 정의하고, 하드코딩 색상값 금지.
- Tailwind 사용 시: 토큰을 `theme.extend`에 등록해서 쓴다. 임의 값(`text-[#00E5FF]`) 남용 금지.
- 반응형은 모바일 퍼스트 (375px부터), 컨테이너 쿼리 우선 고려.

## 품질

- 컴포넌트 단위 테스트보다 **사용자 여정 E2E**를 우선한다 (webapp-testing/Playwright).
- 이미지: `next/image` + 명시적 width/height (CLS 방지). alt 필수.
- 번들: 페이지당 클라이언트 JS 예산을 의식한다 — 무거운 라이브러리는 dynamic import.
- Lighthouse 기준: Performance 90+, Accessibility 100 (핵심 페이지).

## 흔한 함정 (이 저장소에서 반복된 실수)

<!-- 프로젝트를 진행하며 실제 발견한 함정을 여기에 추가한다. doc-gardener가 주기적으로 검토. -->

- (프로젝트별 기록 시작)
