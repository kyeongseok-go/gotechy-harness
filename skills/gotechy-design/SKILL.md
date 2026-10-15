---
name: gotechy-design
description: '화면 설계 위저드와 디자인 검토. 사용자 흐름을 받아 사이트맵(IA), 실제 카피와 상태 매트릭스가 든 와이어프레임, DTCG 토큰과 대비 계산이 든 스타일가이드를 단계별 승인으로 만들고, 화면과 설계 문서를 WCAG 2.2 AA, KWCAG 2.2, anti-slop 기준으로 판정한다. 예: "사이트맵이랑 와이어프레임 짜줘", "스타일가이드 색 정해줘", "이 화면 AI 티 나는지 봐줘". 화면이 없는 제품, 스펙 작성, 코드 구현에는 쓰지 않는다.'
argument-hint: "[docs/product-specs/<슬러그>] [--quick] [--review <파일 또는 URL>]"
---

# gotechy-design: 사이트맵, 와이어프레임, 스타일가이드

사용자 흐름을 화면으로 옮기는 스킬이다. 사이트맵의 섹션 한 줄이 와이어프레임의 입력이 되고, 와이어프레임의 실제 카피가 스타일가이드의 입력이 된다. 그래서 수정은 늘 상류에서 하고, 각 단계는 오너의 명시 승인으로 잠근다. 합격선은 그 분야 최고 수준이다. WCAG 2.2 AA와 KWCAG 2.2를 지키고, 데이터 화면마다 상태 매트릭스를 그리고, 대비를 계산으로 증명하고, AI 생성 화면의 흔한 기본값을 측정 검사(anti-slop)로 걸러 낸다.

## 언제 쓰나, 쓰지 않나

- 쓴다: 위저드 5~7단계(40-sitemap, 50-wireframe, 60-style-guide), "화면 설계", "와이어프레임", "스타일가이드", "색과 폰트 정해줘", 기존 화면이나 설계 문서의 디자인 검토("AI 티 나는지", "접근성 괜찮은지").
- 쓰지 않는다: 화면이 없는 제품(CLI, 라이브러리), 스펙과 사용자 흐름 작성(`gotechy-spec` 스킬), 품질 목표 수치 결정(`gotechy-quality` 스킬), 코드 구현(`gotechy-build` 스킬), 런치 카피와 SEO(`gotechy-launch` 스킬).

## 시작 조건 (하드 게이트)

1. `docs/product-specs/<슬러그>/30-user-flow.md`가 확정 상태여야 한다. 없으면 멈추고 `gotechy-spec` 스킬로 흐름부터 만들자고 안내한다. 흐름 없이 그린 화면은 장식이 된다. 페이지를 지어내지 않는다.
2. 화면 하나짜리 작은 기능은 미니 스펙(`docs/product-specs/<슬러그>.md`)의 사용자 흐름 절을 30-user-flow 대신 입력으로 쓴다. 그 절도 없으면 1번처럼 멈춘다.
3. 위저드 중에는 코드를 만들지 않는다. 매 턴 첫 줄에 위치를 밝힌다: `[위저드 50-wireframe, 6/7]`.
4. 진행 규칙(질문 엔진, 승인 락, SYNC 마커, `--quick`)은 필요할 때 `references/wizard-design.md`를 연다.

## 절차 A: 설계 위저드

1. 입력 읽기. `00-brief.md`, `10-prd.md`, `20-features.md`, `30-user-flow.md`, 있으면 `15-quality-goals.md`를 읽는다. 산출물: 대상 사용자, 핵심 행동 1개, 톤, 페이지 노드 수, 품질 목표를 5줄로 요약해 오너에게 보인다.
2. 40-sitemap (5/7). `references/templates/40-sitemap.md`를 복사해 만든다. 흐름의 페이지 노드를 페이지로 1:1 옮기고, 섹션은 `references/section-library.md` 어휘에서만 고른다. Home 한 장을 먼저 승인받고 나머지를 진행한다. 산출물: 확정된 `40-sitemap.md`.
3. 50-wireframe (6/7). `references/templates/50-wireframe.md`로 만든다. 디바이스 기준을 먼저 정하고 섹션마다 변형축과 실제 카피를 쓴다. 데이터 섹션마다 상태 매트릭스를, 폼마다 필드 표를 채운다(`references/states-and-content.md`). 섹션마다 375px 배치를 한 줄 적는다. 산출물: 확정된 `50-wireframe.md`.
4. 60-style-guide (7/7). `references/templates/60-style-guide.md`로 만든다. 한 질문에 한 축만 묻는다: 성격 축, 레퍼런스, 색 계열, 역할 색, 타이포, 형태와 모션. 역할 색은 라이트와 다크 모두 대비를 계산해 적는다(`references/tokens.md`의 스크립트). 산출물: DTCG 토큰 블록이 든 `60-style-guide.md`.
5. 자체 검사. `references/bar.md` 체크리스트와 `references/anti-slop.md`를 돌리고 각 문서 하단 `## 기준 검사` 표(항목, 결과, 근거)를 채운다. 미달은 고치거나 `docs/exec-plans/tech-debt-tracker.md`에 적는다(없으면 만든다).
6. 마무리. `docs/product-specs/index.md`의 진행 상태를 갱신하고(없으면 만든다) `gotechy-plan` 스킬로 이어 가도록 안내한다. 구현에 넘길 목록(`references/tokens.md`의 구현 인계 절)을 함께 건넨다.

## 절차 B: 디자인 검토 (`--review`)

1. 대상과 범위를 확정한다: 파일, URL, 스크린샷, 그리고 핵심 여정 1~3개.
2. `[기계]` 항목은 도구를 실제로 돌린다(axe-core, Lighthouse, 대비 스크립트, anti-slop grep). 돌리지 못했으면 "미실행"으로 적고 합격 처리하지 않는다.
3. `[사람]` 항목은 NN/g 10 휴리스틱과 bar 체크리스트로 판정한다. 문제마다 bar 항목 번호를 근거로 단다.
4. 산출물: 등급(A~D), 핵심 여정을 막는 문제와 나머지 문제 목록(항목, 근거, 고치는 법), 확인 못 한 것. 오너가 원하면 `docs/product-specs/<슬러그>/design-review-YYYY-MM-DD.md`로 저장한다(없으면 만든다).

## 기준 요약 (전체는 `references/bar.md`)

1. 섹션 타입은 어휘 사전 안에서만 고르고, 카피는 실제 문구로 쓰고, `NEEDS CLARIFICATION`, `SYNC NEEDED` 마커가 0개다.
2. 데이터 섹션마다 상태 8종(로딩, 첫 사용 빈 상태, 결과 없음, 복구 가능 오류, 복구 불가 오류, 부분 실패, 오프라인, 권한 없음)과 상태별 다음 행동 1개가 있다.
3. 대비는 반올림 없이 계산한다. 본문 4.5:1, 큰 글자와 컴포넌트 경계와 포커스 링 3:1, 라이트와 다크 모두.
4. 키보드만으로 핵심 여정을 끝낼 수 있고, `:focus-visible` 링이 sticky 요소에 완전히 가려지지 않고, 타깃은 최소 24×24 CSS px(하우스 기준 44×44px)이다.
5. axe-core 위반 0건(태그 wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa)에 스크린리더 수동 확인 1회를 더한다. 자동 검사는 바닥일 뿐이다.
6. 375px 폭에서 가로 스크롤 0, 320px에서도 정보와 기능 손실 0.
7. 출시 뒤 현장 데이터 75번째 백분위로 LCP 2.5초 이하, INP 200ms 이하, CLS 0.1 이하(모바일, 데스크톱 따로).
8. anti-slop 측정 검사 위반 0건(`references/anti-slop.md`).

## 산출물과 저장 위치

| 파일 | 내용 |
|---|---|
| `docs/product-specs/<슬러그>/40-sitemap.md` | 흐름 노드 대조, 페이지 트리, 섹션 줄, IA 트리 (없으면 만든다) |
| `docs/product-specs/<슬러그>/50-wireframe.md` | 섹션 스펙, 실제 카피, 상태 매트릭스, 필드 표, 375px 배치 (없으면 만든다) |
| `docs/product-specs/<슬러그>/60-style-guide.md` | 성격 축, 역할 색과 대비 값, 타입 스케일, DTCG 토큰 블록 (없으면 만든다) |
| `docs/product-specs/index.md` | 위저드 진행 상태 (없으면 만든다) |

토큰 파일(`*.tokens.json`)과 CSS 변수로 옮기는 일은 구현 단계 몫이라 ExecPlan에 넘긴다.

## 완료 기준

- 세 문서 모두 `## 확정 이력`에 날짜가 있고 마커 검사가 0이다: `grep -cE "NEEDS CLARIFICATION|SYNC NEEDED" docs/product-specs/<슬러그>/[456]0-*.md`
- 세 문서의 `## 기준 검사` 표가 채워져 있고 등급이 B 이상이다. C면 미달 항목이 부채 목록에 있다. D면 완료가 아니다.
- 위임받은 작업이면 보고는 `owner-protocol` 스킬의 HANDOFF 형식을 따른다.

## 하지 않는 것

- 흐름 없이 화면 만들기, 어휘 밖 섹션 창작, 로렘과 자리표시 카피, 출처 없는 수치와 후기와 고객 로고.
- 콘텐츠보다 스타일 먼저 정하기(와이어프레임 확정 전에 색과 폰트 결정).
- 여러 스테이지를 한 턴에 합치기, 승인 없이 다음 단계 진행, 하류 문서 자동 재생성.
- WCAG 3.0 초안이나 APCA 값을 합격선으로 쓰기. 참고 값으로만 적는다.
- 위저드 중 코드 작성. 구현은 `gotechy-build` 스킬 몫이다.
