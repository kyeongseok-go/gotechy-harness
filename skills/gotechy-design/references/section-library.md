# 섹션 어휘 사전

> 40-sitemap과 50-wireframe에서 섹션 타입을 고를 때, 어휘 밖 타입이 필요해 보일 때 연다.

원칙은 "조립하지, 지어내지 않는다"다. 와이어프레임의 섹션은 이 사전에서 고르고 새 섹션 타입을 창작하지 않는다. 검증된 패턴을 조립하는 편이 즉석 레이아웃보다 낫고, 어휘가 고정돼야 페이지 사이 일관성, anti-slop 검사, 구현 재사용이 가능하다. 사용자는 대부분의 시간을 다른 사이트에서 보내므로 익숙한 패턴이 학습 비용을 줄인다(Jakob의 법칙).

표기: `타입 · 변형축` (예: `Hero · Media · Split`). 변형축은 필요한 것만 붙인다.

## 코어 마케팅 12

| 타입 | 역할 | 주요 변형축 | 설계 주의 |
|---|---|---|---|
| `Navbar` | 전역 내비게이션 | Simple, Dropdown, CTA포함 | 1차 항목 7개 이하, 모바일 메뉴 버튼에 보이는 이름 또는 접근 가능한 이름 |
| `Hero` | 첫 화면, 한 문장 가치 제안과 핵심 행동 1개 | Media, Split, Centered, Form포함 | Primary 버튼 1개, 미디어 가로세로 비율 명시(CLS), 장식 그라데이션 금지 |
| `Header` | 내부 페이지 상단(제목, 부제) | Simple, Media, Breadcrumb | 페이지 h1은 1개 |
| `Feature` | 기능, 가치 설명 | Grid(2~4열), Alternating, List, Tabs | 아이콘, 제목, 두 줄짜리 3열 Grid는 사이트당 1회 이하 |
| `CTA` | 전환 유도 배너 | Simple, Split, Form포함 | 버튼 문구는 동사와 목적어 |
| `Testimonial` | 후기, 인용 | Single, Grid, Carousel, 별점포함 | 실명과 출처 있는 후기만, Carousel은 아래 규칙 |
| `Pricing` | 요금제 | Cards(2~3), Table비교, Toggle(월, 연) | 부가세 포함 여부, 결제 주기 표기 |
| `FAQ` | 자주 묻는 질문 | Accordion, TwoColumn | Accordion 머리는 버튼, 펼침 상태를 보조기기에 알림 |
| `Team` | 팀, 프로필 | Grid, List | 실제 인물만 |
| `Logos` | 고객사, 언론 로고 | Row, Marquee | 실제 고객만, Marquee는 일시정지 수단 |
| `Contact` | 문의 | Form, Info분리, Map포함 | 지도와 함께 텍스트 주소 |
| `Footer` | 하단 링크, 법적 고지 | Simple, MultiColumn, Newsletter포함 | 사업자 정보, 약관, 개인정보처리방침 링크 자리 |

## 확장 마케팅

`Stats`(수치 강조), `Comparison`(경쟁 비교표), `Timeline`(연혁, 절차), `Gallery`(이미지 그리드), `Banner`(공지 띠), `LongForm`(장문 콘텐츠, 약관), `Form`, `MultiStepForm`, `Blog`(List, PostHeader), `Portfolio`(Grid, Detail), `Career`, `Event`(List, Detail), `Links`(링크 모음 페이지).

## 커머스

`ProductHeader`(상품 상세 상단: 갤러리, 가격, 구매), `ProductList`(목록과 정렬), `CategoryFilter`, `Cart`, `CheckoutSteps`, `ReviewList`.

## 앱 UI (로그인 뒤 화면)

| 타입 | 역할 | 상태 매트릭스 |
|---|---|---|
| `AppShell` | 전체 골격(Sidebar, Topbar 변형) | 오프라인 배너 자리 |
| `PageHeader` | 화면 제목과 주요 행동 버튼 | 없음 |
| `Table` | 데이터 표(정렬, 페이지 나눔, 행 행동) | 필수 |
| `CardGrid`, `StackedList` | 카드형, 목록형 컬렉션 | 필수 |
| `StatCards` | KPI 타일 행 | 필수 |
| `DetailView` | 단건 상세 | 필수 |
| `FormPage` | 생성, 수정 폼(섹션 분할) | 필수(제출 중, 제출 실패 포함) |
| `EmptyState` | 빈 상태, 첫 사용과 결과 없음을 구분 | 그 자체가 상태 |
| `Modal` | 확인, 간단 입력 | 파괴적 행동은 되돌리기 경로 |
| `Auth` | 가입, 로그인, 비밀번호 재설정 | 필수, 기억과 퍼즐만 요구하지 않음(WCAG 3.3.8) |
| `Onboarding` | 가입 직후 단계형 설정 | 건너뛰기와 진행 단계 표시 |
| `Settings` | 설정(탭, 섹션 분할) | 필수(저장 실패 포함) |

상태 매트릭스 규칙은 `references/states-and-content.md`에 있다.

## 상호작용 패턴의 접근성 기본값

WAI-ARIA Authoring Practices Guide(APG)와 WCAG 2.2를 따른다.

- `Modal`: 열리면 포커스가 대화상자 안 요소로 간다. Tab과 Shift+Tab은 대화상자 안에서만 돈다. Escape로 닫힌다. 닫히면 연 요소로 포커스가 돌아간다. `role="dialog"`, `aria-modal="true"`, 보이는 제목을 `aria-labelledby`로 연결한다.
- 자동 회전 `Carousel`: 회전 멈춤과 시작 버튼이 캐러셀 안 Tab 순서 첫 번째다. 키보드 포커스가 들어오거나 마우스가 올라가면 회전을 멈춘다.
- 자동으로 움직이는 콘텐츠(`Logos · Marquee` 포함)가 5초를 넘겨 다른 콘텐츠와 함께 보이면 일시정지, 정지, 숨김 수단을 둔다(WCAG 2.2.2).
- 드래그로만 하는 기능(순서 바꾸기, 슬라이더)은 드래그 없는 단일 포인터 대안을 둔다(WCAG 2.5.7).
- `Tabs`, `Accordion`, 메뉴 같은 위젯은 APG 패턴의 키보드 동작을 그대로 쓴다. ARIA 역할은 브라우저 키보드 동작을 주지 않고 잘못 쓰면 보조기기 경험을 망가뜨린다(APG). 그래서 맞는 HTML 요소(`button`, `details`, `dialog`)가 있으면 그것을 먼저 쓴다.

## 조립 규칙

1. 마케팅 페이지는 4~8섹션, 앱 화면은 3~8섹션이다. 랜딩 표준 골격 `Navbar, Hero, Logos, Feature 2~3개, Testimonial, Pricing, FAQ, CTA, Footer`에서 빼는 것으로 시작한다. 더하는 것으로 시작하지 않는다.
2. `Navbar`, `Footer`는 전역(`@global`)으로 한 번만 정의한다.
3. 같은 타입이 이어지면 변형을 바꿔 리듬을 만든다(Feature Grid 다음엔 Feature Alternating).
4. 역할을 한 문장으로 설명하지 못하는 섹션은 뺀다.
5. 여기 없는 타입이 정말 필요하면 가장 가까운 타입의 변형으로 적는다. 같은 요구가 두 번 나오면 이 사전에 추가할지 오너에게 묻는다.
