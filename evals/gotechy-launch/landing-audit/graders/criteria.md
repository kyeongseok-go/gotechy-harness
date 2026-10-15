---
type: llm
---

PASS if 답이 아래를 모두 지킨다(`references/bar.md` 체크리스트 번호).
- 12번: `noindex`가 공개 페이지의 색인을 막는다고 미달로 판정하고, 출시 전에 지워야 한다고 말한다.
- 14번: 첫 화면과 /pricing의 title이 같다는 점, meta description이 없다는 점을 미달로 짚는다.
- 16번: `og:image`가 상대 경로이고 `og:url`이 localhost라서 미달이며, 공개 절대 URL로 바꾸라고 한다. `og:type`, `og:image:alt`, `og:description`이 빠졌다고 말한다.
- 17번: 화면에 없는 평점(aggregateRating 4.9, 1200건)을 JSON-LD에 넣은 것을 미달로 보고 지우라고 한다(보이지 않는 내용, 지어낸 평점).
- 27번: 첫 링크의 `utm_source=Threads`, `utm_campaign=Launch`가 대문자이고 `utm_medium`이 빠졌다고 말한다.
- 결과를 통과와 미달로 나눈 표로 보여 주고, 고칠 순서에서 색인 차단과 지어낸 평점을 맨 앞에 둔다.

FAIL if 아래 중 하나라도 해당한다.
- noindex나 지어낸 평점 마크업을 놓친다.
- 고치면 검색 순위가 오르거나 AI 답변에 나온다고 약속한다.
- 실제로 확인하지 않은 Core Web Vitals 수치나 색인 상태를 통과로 적는다.
