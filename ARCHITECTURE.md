# ARCHITECTURE.md — 시스템 아키텍처 지도

> matklad의 ARCHITECTURE.md 관례를 따른다: **"코드가 어디에 있는지"가 아니라 "무엇이 어디에 사는지, 왜 그렇게 나뉘는지"의 지도.**
> 새 프로젝트에서 이 템플릿을 프로젝트 내용으로 교체한다. 이 파일은 큰 구조가 바뀔 때만 갱신한다 (자주 바뀌면 지도가 아니라 일기다).

## 한 줄 요약

<!-- 예: "이 서비스는 X를 하는 Next.js 앱 + Node API 서버다. 프론트는 apps/web, API는 apps/api, 공유 타입은 packages/shared에 산다." -->

(프로젝트 요약을 여기에)

## 레이어 규칙 (기본 골격)

각 비즈니스 도메인은 아래 고정 레이어로 나눈다. **의존은 항상 아래→위 단방향**이며, 역방향 import는 금지다.

```
Types   → 순수 타입·스키마 (의존 없음)
Config  → 설정·상수
Repo    → 데이터 접근 (DB/외부 API 호출은 여기만)
Service → 비즈니스 로직 (프레임워크 무관, 테스트 최우선 대상)
Runtime → 서버 엔트리·라우팅·핸들러
UI      → 컴포넌트·페이지
```

- 횡단 관심사(인증, 텔레메트리, 피처 플래그, 외부 커넥터)는 **Providers** 단일 인터페이스를 통해서만 접근한다.
- 원칙: **불변식은 강제하되 구현은 미시관리하지 않는다.** 예: "경계에서 파싱하라(parse, don't validate)"는 규칙이고, 어떤 파싱 라이브러리를 쓸지는 자유다.

## 디렉터리 지도

<!-- 프로젝트 생성 후 실제 구조로 교체. "각 폴더가 무엇을 담당하는지" 한 줄씩. -->

| 경로 | 담당 |
|---|---|
| `src/...` | (교체) |

## 경계 (Invariants)

<!-- 기계 강제 장치: .dependency-cruiser.cjs + `npm run check:boundaries` (활성화 방법은 그 파일 상단 주석). CI(.github/workflows/ci.yml)가 매 push마다 실행한다. -->

1. UI는 Repo를 직접 import하지 않는다 (Service를 거친다). — `check:boundaries` 강제
2. 외부 API 키·시크릿은 Config 레이어 밖에서 읽지 않는다. — `check:boundaries` 강제(warn)
3. (프로젝트별 추가)

## 핵심 모듈 (커버리지 95% 대상 — QUALITY_BAR 참조)

<!-- 프로젝트별로 채운다. 예: src/service/billing/**, src/service/auth/** -->

- (교체)

## 기술 선택 원칙

- **"boring" 기술 우선** — 조합 가능하고 API가 안정적이며 학습 데이터에 잘 나타나는 것.
- 작고 불투명한 외부 의존성보다, 관측 가능성이 통합된 자체 헬퍼를 선호한다.
- 새 의존성 추가는 ADR(`docs/decisions/`) 한 건으로 기록한다.
