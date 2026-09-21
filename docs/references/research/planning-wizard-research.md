# 단계형 기획·디자인 위저드 리서치 (2026-09-22)

> WIZARD.md와 /gotechy-spec·/gotechy-design 설계의 근거 원장. 조사 대상: Relume·매니페스트·식스샵 (심층) + Spec Kit·Kiro·Lovable·Bolt·v0·Wix ADI·Durable·10Web·Framer·Looka·Realtime Colors·Shape Up·Design Sprint·Story Mapping·Lean Canvas (확장).

## 1. 3사 심층

### Relume (relume.ai)
- 앱 탭이 곧 단계: **Brief → Sitemap → Wireframe → Style Guide → Design → Publish/Export** (진행률 % 표시)
- 철학: **"Assembled, not generated"** — AI가 레이아웃을 창작하지 않고 사람이 만든 1,757개 컴포넌트(50 카테고리)에서 선택·조립. "No hallucinated layouts."
- 사이트맵: 페이지 트리 + 페이지별 섹션 카드(제목+1줄 설명). **이 한 줄이 곧 와이어프레임 생성 프롬프트.** 페이지당 4~8섹션 권장, 홈 먼저 생성→"continue" 체크포인트, 글로벌 섹션, 문서 명시: "와이어프레임 가기 전에 사이트맵에서 최대한 고쳐라"
- 와이어프레임: 사이트맵과 1:1 양방향 동기화. **기본이 실제 맞춤 카피** (로렘은 우클릭 리셋으로만). 카피 유지한 채 컴포넌트 교체 가능
- 스타일가이드: Colors(brand/accent/neutral + 섹션용 컬러 스킴 세트) · Typography · Spacing · Radius & Stroke · Icons · Buttons · Inputs 등. 복수 컨셉 생성→상위 3개 피치
- 브리프 공식 (랜딩 예시 4건에서 추출): `[업체 정의+since+규모] + [청중과 심리] + [전환 목표(행동)] + ["경쟁자가 숨기는 것을 공개"하는 신뢰 요소(구체 수치)] + [톤] + [색] + [Pages: 목록]`
- Export: Webflow(Client-First) / Figma(auto-layout+variables) / React(Tailwind+shadcn/ui) / MCP
- 출처: relume.ai, /resources/docs/building-a-sitemap-with-ai, /how-to-create-and-edit-wireframes-in-the-relume-site-builder, /concept-creation-using-the-relume-style-guide-builder, /how-to-use-the-relume-webflow-library

### 매니페스트 (manyfast.io)
- "AI 기획 워크스페이스": **PRD → 기능명세서 → 유저플로우 → 와이어프레임 (+IA)**, AI PM "매니"가 문답으로 구체화, 진행률 표시, MCP로 Claude/Cursor/Codex 전달, HWP 첨부 지원
- PRD 5섹션: 개요(한줄정의·**목표지표 전→후 수치**·배경) / 문제·해결(+비목표) / 타겟·시나리오 / 성공·위험 / 속성(카테고리·**사용자 역할**·기기). 문제 정의를 **이해관계자별로 분해**
- 기능명세: **요구사항 > 기능 > 상세 3계층** + 수용 기준 체크리스트 + 역할 연결 + 중요도/상태 + **개발 준비 9슬롯**(선행조건/트리거/동작/결과/예외/표시/권한/비즈니스 규칙/데이터, "5/9" 진척 표시)
- 유저플로우: **하드 게이트**("PRD 개요+기능 1개 없으면 생성 불가"). 노드 5종(시작/페이지/데이터/분기/행동), 분기 Y/N, 추천 프롬프트 칩("핵심 여정만/예외 포함/모바일 기준/핸드오프용 상세히")
- 와이어프레임: 유저플로우의 **페이지 노드 기준** 생성, 클릭 가능한 프로토타입, 상류 수정은 "재생성"으로 명시적 반영
- 모든 AI 수정: **편집 계획 제시 → diff 검토 → 항목별 승인/거절**
- 출처: manyfast.io, docs.manyfast.io/plan/{plan,prd,features,user-flow,wireframe,ia}

### 식스샵 (sixshop.com)
- AI 페이지: 입력(프롬프트/Figma/이미지/URL/HTML) → **스타일 참조 선택**(기존 사이트/디자인 지침/특정 URL) → 블록 단위 생성 → 수정 3경로
- 온보딩의 우선순위 설계: **"디자인은 PG 심사 요소가 아니니 PG부터 신청하고 디자인하라"** — 크리티컬 패스(결제 가능) 먼저, 꾸미기 나중
- 디자인 3층: 섹션(블록) 조립 + 데이터 바인딩 + 테마 프리셋
- 출처: sixshop.com/features/ai-page, help.pro.sixshop.com/shoppingmall-start

## 2. 확장 조사 핵심

- **Spec Kit** (github/spec-kit): constitution→specify→**clarify**→plan→tasks→implement. `[NEEDS CLARIFICATION]` 인라인 마커 + "마커 0개" 게이트. /clarify 프로토콜: 세션당 최대 5문항·1개씩·(Impact×Uncertainty) 정렬·A/B/C 표+추천안+Why it matters·답변 즉시 원자적 파일 반영·Q→A 로그
- **AWS Kiro**: requirements.md(**EARS 5형식**: WHEN…THEN…SHALL / IF…THEN / WHILE / WHERE / 무조건, 버그픽스용 SHALL CONTINUE TO) + design.md + tasks.md. **명시적 'yes/approved' 전 진행 금지, 수정→재승인 루프, 한 태스크씩 실행 후 정지.** Refine/Sync Files로 상류 수정의 하류 전파. Quick Spec 탈출구
- **Lovable**: Plan 모드(승인 전 코드 변경 0, 승인=Build 모드 전환). 첫 프롬프트 전 4문항(무엇/누구/왜/**핵심 액션 1개**), Knowledge 파일, "buzzword로 미학 다이얼인", "프롬프트당 1변경"
- **Bolt**: Enhance Prompt(질문에 답하면 프롬프트 증강). **v0**: UI 생성 전 아키텍처 계획 먼저
- **Wix ADI→AI**: 고정 설문(업종→기능→이름→스타일→테마→레이아웃 택1)에서 대화형+수동 하이브리드로 진화. **Durable**: 3문항(업종/상호/지역)→30초 생성→후편집. **10Web**: 브리프→구조→**디자인 시스템→페이지 생성** 순서 명문화
- **Looka** 8스텝: 이름→업종→**영감 로고 5개 픽**("색 말고 스타일에 집중, 색은 다음")→색 계열(Vibrant/Greyscale…)→색 3개("나중에 바꿀 수 있어요")→슬로건(선택)→심볼→시안. **한 스텝 한 축** + 결정 부담 낮추기
- **Realtime Colors**: 색을 **역할 5개(Text/BG/Primary/Secondary/Accent)**로 강제 분해, 실물 프리뷰에서 확정, 타입 스케일은 프리셋 비율(1.2/1.25…) 선택, Randomize로 탐색
- **Shape Up**: **Appetite(쓸 시간)를 솔루션보다 먼저** + 피치 5요소(Problem/Appetite/Solution/Rabbit Holes/**No-gos**)
- **Story Mapping**: 여정 백본(가로)→상세(세로)→가로 슬라이스=릴리스. **Design Sprint**: 발산→결정권자 수렴. **Lean Canvas**: Problem·고객을 Solution보다 먼저

## 3. 수렴 패턴 (WIZARD.md의 근거)

- **스테이지 순서**: 헌법/지식 → WHY·WHO(핵심 액션 1개) → 범위 잠금(Appetite+No-gos) → WHAT(스펙+검증 가능 수용 기준) → **명확화(독립 스테이지)** → 스타일 방향(성격 축→레퍼런스→토큰) → HOW(설계) → 태스크 → 한 개씩 실행. **콘텐츠가 스타일보다 먼저, 스타일이 구현보다 먼저**
- **질문 설계**: 선택지형 기본+추천안+기본값, 한 번에 소수, (Impact×Uncertainty) 상위만, 한 스텝 한 축, 왜 묻는지 표시, 답은 스토리로 유도
- **락**: 명시적 승인어 → 모드 전환, 승인 로그를 파일에, 되돌아가기=상류 수정+하류 SYNC, 탈출구(Quick)와 버전 분기로 승인 부담 완화

## 4. 하네스 반영 (v1.4)

- `docs/WIZARD.md` — 위저드 헌법 (질문 엔진·락·SYNC·탈출구)
- `docs/product-specs/_wizard-templates/` — 00-brief / 20-features / 30-user-flow / 40-sitemap / 50-wireframe / 60-style-guide (10-prd는 기존 `_template-prd.md` 재사용)
- `docs/references/section-library.md` — Relume 50종을 축약한 섹션 어휘 사전 ("Assembled, not generated")
- `/gotechy-spec` 위저드화 (00→30) + `/gotechy-design` 신설 (40→60)
