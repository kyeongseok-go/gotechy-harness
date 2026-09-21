---
name: gotechy-design
description: |
  UI 설계 위저드 — 사이트맵/IA → 와이어프레임 → 스타일가이드를 단계형으로 만든다.
  사용자가 "사이트맵", "와이어프레임", "화면 설계", "스타일가이드", "디자인 방향 잡아줘",
  "UI 기획"이라고 하거나 /gotechy-spec 위저드(유저플로우까지) 완료 후 화면 설계가 필요할 때 사용한다.
  docs/WIZARD.md 헌법과 references/section-library.md 섹션 어휘를 따른다 ("Assembled, not generated").
argument-hint: "[product-specs/<슬러그> (생략 시 탐색), 또는 --quick]"
---

# /gotechy-design — UI 설계 위저드 (5~7/7)

**하드 게이트**: `docs/product-specs/<슬러그>/30-user-flow.md`가 확정돼 있어야 시작한다 (없으면 `/gotechy-spec` 위저드부터 안내 — 기능과 흐름 없이 화면을 그리면 장식이 된다). `docs/WIZARD.md`를 먼저 읽는다. 위저드 중에는 코드를 만들지 않는다. 매 턴 `[위저드 50-wireframe · 6/7]` 형식으로 위치를 밝힌다.

## 스테이지

### 40-sitemap (5/7) — `_wizard-templates/40-sitemap.md`

1. 30-user-flow의 **페이지 노드 표를 뼈대로** 페이지 트리를 만든다 (+ 브리프의 Pages 목록 대조).
2. 각 페이지에 섹션 줄을 채운다: `[타입] 제목 — 1줄 설명`. 타입은 **section-library.md 어휘에서만**, 페이지당 4~8개, Navbar·Footer는 `@global`.
3. **체크포인트**: Home 한 페이지만 먼저 제시 → 승인 → 나머지 페이지 진행 (Relume "continue generating").
4. 여기서 최대한 다듬게 안내한다 — **섹션 한 줄이 와이어프레임의 생성 프롬프트**라서, 지금 텍스트 수정이 다음 단계 재작업보다 압도적으로 싸다.

### 50-wireframe (6/7) — `_wizard-templates/50-wireframe.md`

1. 디바이스 기준(데스크탑/모바일 우선)을 선택지로 먼저 확정.
2. 사이트맵 섹션 줄과 **1:1 동기화**로 페이지별 섹션 스펙을 채운다. 섹션 타입+변형축(`Hero · Media · Split`) + 요소별 **실제 카피** — 로렘·자리표시 금지. 카피에는 브리프의 톤과 신뢰 요소(구체 수치)를 녹인다.
3. **체크포인트**: Home 먼저 승인 → 나머지. 사이트맵을 고치게 되면 양쪽에 SYNC 마커.
4. 확보 안 된 실물(고객사 로고 등)은 `[NEEDS CLARIFICATION]`으로.

### 60-style-guide (7/7) — `_wizard-templates/60-style-guide.md`

**한 스텝 한 축** (Looka) — 각 축을 AskUserQuestion 선택지로 묻고 확정 후 다음 축. 매 질문에 "나중에 바꿀 수 있어요" 명시:

1. 성격 축 4개(Modern↔Classic 등 5단계) → **미학 서술문으로 컴파일** (이후 모든 UI 생성 프롬프트에 삽입)
2. 레퍼런스 2~4개 — "색 말고 스타일에 집중"
3. 색 **계열** 선택 → 4. **역할 5색**(Text/BG/Primary/Secondary/Accent, 라이트·다크, 대비 4.5:1 검증 — Realtime Colors)
5. 타이포 2종 + 스케일 프리셋 비율 → 6. radius·간격 밀도·모션 (성격 축과 일치 확인)
- 제약: `docs/DESIGN.md`의 수치 시스템·anti-slop이 상위 규범이다 (충돌 시 DESIGN.md 승).

## 마무리

- 60 확정 시 토큰 블록을 문서에 기록하고, 구현 단계에서 CSS 변수(2층)로 옮길 것을 ExecPlan에 넘긴다.
- 색인 갱신 + **`/gotechy-plan`으로 이어가기 안내** (스펙 4종+설계 3종이 ExecPlan의 Context 입력이 된다).
- `--quick`: 3스테이지 일괄 초안 (마커 유지). 락·질문 엔진·SYNC 규칙은 WIZARD.md와 동일.
