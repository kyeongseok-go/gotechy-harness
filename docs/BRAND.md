# BRAND.md — 고텍이 브랜드·콘텐츠·마케팅 규범

> 개발 산출물을 브랜드 자산으로 변환하는 규칙. 모든 프로젝트는 완료 시 콘텐츠 재료를 남긴다 (3종 출력 변환).

## 브랜드 코어

- **슬로건**: "Go, Build the technology, more easier." / "기술을 만들고, 더 쉽게 산다"
- **페르소나**: 고텍이 — ESFJ, 따뜻한 실전파. 상세는 `.claude/skills/gotekie-blog-writer/` 참조.
- **시그니처**: "고!!" 계열(추진·시작) + "이지~" 계열(안심·마무리). 글 1편당 4-5회.
- **대상 독자**: 부모님 + AI 초심자 (1순위), 채용 담당자·동료 개발자 (2순위)

## 채널 구조

```
고텍이 블로그 (메인: 포트폴리오 + 뉴스레터)
  ├── 유튜브 (서브)
  └── 쓰레드 (서브)
```

- 산출물 저장: Gotechy-Wiki `Output/blog/`, `Output/threads/`, `Output/youtube/`, `Output/drafts/`
- 모든 콘텐츠는 노션 API 호환 frontmatter(title/description/tags/category/date/author) 포함.

## 콘텐츠 파이프라인

1. **재료 수집 (자동)** — ExecPlan의 Surprises & Discoveries, 삽질 기록이 곧 블로그 소재다. `/gotechy-ship`이 완료 시 "블로그 소재 1줄"을 요구한다.
2. **집필** — `/gotekie-blog-writer`로 페르소나 적용 초안 (유형: 리뷰/삽질기/튜토리얼/비교/회고).
3. **배포 변환** — 블로그 본문 → 쓰레드 5-7개 분량 요약, 유튜브 스크립트 아웃라인 (`/gotechy-launch`).
4. **위키 내재화** — Gotechy-Wiki `raw/`로 ingest → 링크 연결.

## SEO/GEO 기준 (AI 검색 시대)

- 제목: 검색 의도 포함 + 40자 이내. description: 120자 이내 요약.
- 첫 문단에 결론 (AI 답변 엔진이 인용하기 좋은 구조 — GEO/AEO).
- 코드·수치·단계는 구조화 (목록·표) — 인용 가능성(citability)을 높인다.
- 이미지 alt, 시맨틱 헤딩 구조 (H1 1개, H2 대섹션).
- 프로젝트 제품 페이지: OG 태그 + 구조화 데이터(JSON-LD) 기본 포함.

## 마케팅 산출물 체크 (제품 런치 시)

- [ ] 랜딩 페이지: 첫인상 기준(`docs/DESIGN.md` 경험 원칙 1) — "누구의 어떤 불편함을 해결"이 즉시 보임
- [ ] 스크린샷/데모 GIF 1개 이상
- [ ] 런치 글: 블로그 1 + 쓰레드 1 세트
- [ ] README에 라이브 링크·설치법·스크린샷 (채용 담당자 시선 기준)
