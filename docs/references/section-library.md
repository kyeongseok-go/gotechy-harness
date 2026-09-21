# section-library.md — 섹션 어휘 사전

> **"Assembled, not generated."** (Relume) — 와이어프레임의 섹션은 이 어휘에서 **선택**한다. 새 섹션 타입을 창작하지 않는다.
> 이유: 검증된 패턴의 조립이 환각 레이아웃보다 낫고, 어휘가 고정되어야 페이지 간 일관성·anti-slop 검사·구현 재사용이 가능하다.
> 표기법: `타입 · 변형축` (예: `Hero · Media · Horizontal`). 변형축은 필요한 것만 붙인다.

## 코어 마케팅 12 (대부분의 사이트는 이것으로 충분)

| 타입 | 역할 | 주요 변형축 |
|---|---|---|
| `Navbar` | 전역 내비게이션 | Simple / Dropdown / CTA포함 |
| `Hero` | 첫 화면 — 한 문장 가치제안 + 핵심 액션 1개 | Media(이미지·영상) / Split / Centered / Form포함 |
| `Header` | 내부 페이지 상단 (제목+부제) | Simple / Media / Breadcrumb |
| `Feature` | 기능·가치 설명 (가장 많이 쓰임) | Grid(2~4열) / Alternating(좌우 교차) / List / Tabs |
| `CTA` | 전환 유도 배너 | Simple / Split / Form포함 |
| `Testimonial` | 후기·인용 | Single / Grid / Carousel / 별점포함 |
| `Pricing` | 요금제 | Cards(2~3) / Table비교 / Toggle(월·연) |
| `FAQ` | 자주 묻는 질문 | Accordion / TwoColumn |
| `Team` | 팀·프로필 | Grid / List |
| `Logos` | 고객사·언론 로고 (social proof) | Row / Marquee |
| `Contact` | 문의 | Form / Info분리 / Map포함 |
| `Footer` | 하단 링크·법적 고지 | Simple / MultiColumn / Newsletter포함 |

## 확장 마케팅

`Stats`(수치 강조) · `Comparison`(경쟁 비교표) · `Timeline`(연혁·절차) · `Gallery`(이미지 그리드) · `Banner`(공지 띠) · `LongForm`(장문 콘텐츠·약관) · `Form` / `MultiStepForm` · `Blog`(List / PostHeader) · `Portfolio`(Grid / Detail) · `Career` · `Event`(List / Detail) · `Links`(링크 모음 페이지)

## 커머스

`ProductHeader`(상품 상세 상단: 갤러리+가격+구매) · `ProductList`(목록+정렬) · `CategoryFilter` · `Cart` · `CheckoutSteps` · `ReviewList`

## 앱 UI (로그인 이후 화면)

| 타입 | 역할 |
|---|---|
| `AppShell` | 전체 골격 (Sidebar / Topbar 변형) |
| `PageHeader` | 화면 제목 + 주요 액션 버튼 |
| `Table` | 데이터 표 (정렬·페이지네이션·행 액션) |
| `CardGrid` / `StackedList` | 카드형 / 목록형 컬렉션 |
| `StatCards` | KPI 타일 행 |
| `DetailView` | 단건 상세 (DescriptionList) |
| `FormPage` | 생성·수정 폼 (섹션 분할) |
| `EmptyState` | 빈 상태 — 첫 사용 CTA와 결과 없음을 구분 (DESIGN.md 상태 매트릭스) |
| `Modal` | 확인·간단 입력 (파괴적 행동은 되돌리기 경로 명시) |
| `Auth` | Signup / Login / 비밀번호 재설정 |
| `Onboarding` | 가입 직후 단계형 설정 |
| `Settings` | 설정 (탭·섹션 분할) |

## 조립 규칙

1. **페이지당 4~8섹션** (Relume 권장). 랜딩 표준 골격: `Navbar → Hero → Logos → Feature ×2~3 → Testimonial → Pricing → FAQ → CTA → Footer` — 여기서 빼는 것으로 시작하지, 더하는 것으로 시작하지 않는다.
2. `Navbar`·`Footer`는 전역(`@global`)으로 한 번만 정의한다.
3. 같은 타입이 연속되면 변형을 다르게 (Feature Grid 다음엔 Feature Alternating) — 리듬을 만든다.
4. 섹션마다 역할이 한 문장으로 설명되지 않으면 그 섹션은 빼라.
5. 여기 없는 타입이 정말 필요하면: 가장 가까운 타입의 변형으로 기술하고, 반복되면 이 사전에 등재한다 (사전이 진실의 원천).
