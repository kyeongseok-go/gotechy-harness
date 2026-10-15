# 검색 기반과 AI 검색 점검

절차 4~6단계(검색 기반, 성능, AI 크롤러 정책)를 실제로 점검할 때 연다.

## 1. 색인 점검 명령

`DOMAIN`과 `PAGES`를 바꿔 실행하고, 출력 핵심 줄을 런치 문서의 증거 칸에 붙인다.

```bash
DOMAIN=https://example.com
PAGES="/ /pricing /docs"

# robots.txt: 200, text/plain 이어야 한다
curl -sI "$DOMAIN/robots.txt" | grep -Ei '^HTTP|^content-type'
curl -s "$DOMAIN/robots.txt"

# sitemap: 200, robots.txt에 Sitemap 줄
curl -sI "$DOMAIN/sitemap.xml" | grep -E '^HTTP'
curl -s "$DOMAIN/robots.txt" | grep -i '^sitemap:'

for p in $PAGES; do
  echo "== $p"
  curl -sI "$DOMAIN$p" | grep -Ei '^HTTP|^x-robots-tag'          # noindex 헤더가 없어야 한다
  html=$(curl -sL "$DOMAIN$p")
  echo "$html" | grep -Eio '<meta[^>]+name="robots"[^>]*>'          # noindex가 없어야 한다
  echo "$html" | grep -Eio '<title>[^<]*</title>'
  echo "$html" | grep -Eio '<meta[^>]+name="description"[^>]*>'
  echo "$html" | grep -Eio '<link[^>]+rel="canonical"[^>]*>'
  echo "$html" | grep -Eio '<meta[^>]+property="og:[a-z:_]+"[^>]*>'
  echo "$html" | grep -Eic '<h1[ >]'                                 # 1이어야 한다
  echo "$html" | grep -Eio '<script[^>]+application/ld\+json'
done
```

- 자바스크립트로 그리는 페이지는 `curl` 결과에 내용이 없을 수 있다. 그때는 Search Console의 URL 검사에서 Google이 본 HTML을 확인한다. 네이버 가이드는 내용 전체를 자바스크립트로 불러오는 구조를 피하고 표준 HTML 마크업을 권한다.
- 페이지 사이 title, description 중복은 위 출력을 모아 `sort | uniq -d`로 찾는다.
- 이미지 alt 누락: 빌드 결과 폴더에서 `rg -nP '<img(?![^>]*\balt=)' dist/`.

## 2. 메타 태그 틀

```html
<title>제품명 - 누구의 어떤 불편을 덜어 주나</title>
<meta name="description" content="한두 문장 요약. 페이지마다 다르게.">
<link rel="canonical" href="https://example.com/">
<meta property="og:title" content="제품명 - 핵심 가치">
<meta property="og:type" content="website">
<meta property="og:url" content="https://example.com/">
<meta property="og:image" content="https://example.com/og.png">
<meta property="og:image:alt" content="이미지에 보이는 것을 설명하는 문장">
<meta property="og:description" content="한두 문장 요약">
<meta property="og:locale" content="ko_KR">
```

Open Graph 필수 속성은 `og:title`, `og:type`, `og:image`, `og:url` 네 가지다. `og:image:alt`는 `og:image`를 쓰면 함께 넣으라고 원문이 권한다.

## 3. 구조화 데이터(JSON-LD)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "제품명",
  "applicationCategory": "ProductivityApplication",
  "operatingSystem": "Web",
  "url": "https://example.com/"
}
</script>
```

- Google은 JSON-LD를 권장 형식으로 쓴다. Rich Results Test와 URL 검사로 오류 0건을 확인한다.
- 화면에 보이지 않는 내용, 지어낸 평점과 후기는 넣지 않는다. 구조화 데이터가 있어도 리치 결과 표시는 보장되지 않는다.
- 유형별 리치 결과 자격 요건은 Google의 유형별 문서에서 그때 확인한다. 이 파일은 요건을 고정하지 않는다.

## 4. 성능 측정

- 필드 데이터(실제 사용자): PageSpeed Insights의 실제 사용자 데이터 칸, Search Console의 Core Web Vitals 보고서, CrUX. 75번째 백분위, 모바일과 데스크톱을 따로 적는다.
- 실험실 데이터: Lighthouse, Chrome DevTools. LCP와 CLS는 잴 수 있지만 INP는 못 잰다. 대신 TBT를 참고값으로 적는다.
- 보고 형식: `LCP 2.1s / INP 180ms / CLS 0.04 (모바일, p75, 필드, PSI, 2026-10-16 14:00)`.
- 새 사이트는 필드 데이터가 쌓이지 않아 비어 있을 수 있다. 그때는 실험실 값으로 보고하고 D+28 재확인을 부채로 적는다.

## 5. AI 크롤러 정책

| user agent | 회사 | 하는 일 | robots.txt |
|---|---|---|---|
| GPTBot | OpenAI | 생성형 AI 기반 모델 학습용 수집 | 따른다 |
| OAI-SearchBot | OpenAI | ChatGPT 검색. 막으면 검색 답변에 안 나올 수 있다 | 따른다 |
| ChatGPT-User | OpenAI | 사용자가 시킨 방문(자동 수집 아님) | 적용되지 않을 수 있다고 문서가 쓴다 |
| ClaudeBot | Anthropic | 모델 학습에 쓰일 수 있는 수집 | 따른다 |
| Claude-SearchBot | Anthropic | 검색 답변 품질용 색인. 막으면 노출이 줄 수 있다 | 따른다 |
| Claude-User | Anthropic | 사용자가 Claude에게 물을 때의 방문 | 따른다고 문서가 쓴다. 막으면 사용자 요청형 검색 노출이 줄 수 있다 |
| Google-Extended | Google | Gemini 학습과 Gemini 앱, Vertex AI의 grounding 사용 여부 제어. 별도 크롤러가 아닌 제품 토큰 | 따른다. Google 검색 포함 여부와 순위에 영향 없음 |
| Googlebot | Google | Google 검색(AI 개요, AI 모드 포함) | 따른다 |
| Yeti | 네이버 | 네이버 검색 | 따른다 |

오너에게 두 가지를 따로 묻는다. 학습에 써도 되나? 검색 답변에 나와도 되나? 흔한 세 가지 정책의 robots.txt는 아래와 같다.

```text
# 정책 1: 모두 허용 (기본)
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
```

```text
# 정책 2: 학습만 막고 검색은 허용
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
```

```text
# 정책 3: AI 학습, AI 검색 모두 막고 일반 검색만 허용
User-agent: GPTBot
Disallow: /

User-agent: OAI-SearchBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-SearchBot
Disallow: /

User-agent: Claude-User
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
```

- 정책 3도 Google 검색의 AI 개요와 AI 모드는 막지 못한다. Google 문서는 그쪽 노출을 `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`로 제한한다고 쓴다. 이 선택은 일반 검색 노출도 줄이므로 오너에게 따로 묻는다.
- 서브도메인마다 robots.txt가 따로 필요하다(Anthropic 문서, 네이버 가이드).
- IP 차단으로 크롤러를 막지 않는다. Anthropic과 네이버 모두 IP 대역은 바뀔 수 있고 robots.txt를 쓰라고 한다.
- robots.txt는 접근 권한이 아니다(RFC 9309). 비공개 내용은 로그인으로 막는다.

## 6. 네이버 점검

- 웹마스터도구 사이트 등록은 호스트 단위다(`https://blog.example.com` 가능, `https://example.com/myid` 불가). 소유 확인은 meta 태그나 HTML 파일 업로드로 한다.
- 메인 페이지가 자바스크립트나 meta refresh로 이동하면 소유 확인이 안 된다. HTTP redirect를 쓴다.
- "요청" 메뉴에서 사이트맵과 RSS를 제출한다. 사이트맵과 RSS 안의 링크가 상대 경로이거나 등록한 호스트와 다르면 수집하지 않는다.
- 모든 페이지 제목을 같게 두지 않는다. 같은 내용으로 여러 사이트를 만들면 불이익을 받을 수 있다.
- 반영 확인: 검색로봇 방문 뒤 최대 1주일. D+7에 네이버 웹문서 검색에서 `site:example.com`으로 확인한다.

## 7. GEO와 llms.txt를 말하는 법

**근거가 말하는 것.** GEO 논문(Aggarwal 외, KDD 2024)은 실험용 생성형 엔진(상위 5개 Google 결과를 gpt-3.5-turbo가 요약)과 Perplexity 200개 표본에서, 출처 인용, 인용문 추가, 통계 추가가 노출 지표를 상대 30~40% 올렸고 키워드 반복은 효과가 없거나 기준선보다 낮았다고 보고했다. 저자들은 엔진이 바뀌면 방법도 바뀌어야 하고, 검색 순위 영향은 평가하지 않았다고 쓴다.

**Google이 말하는 것.** AI 개요와 AI 모드에 나오기 위한 추가 요건이나 특별한 최적화는 없다. 새 기계용 파일, AI 텍스트 파일, 특별한 schema가 필요 없다. 색인되고 스니펫과 함께 보여 줄 수 있는 페이지면 된다. 그래도 노출은 보장되지 않는다.

**llms.txt.** Jeremy Howard가 2024-09-03에 낸 제안이고, 사이트 루트나 하위 경로에 두는 마크다운 파일이다(H1 하나만 필수, 요약 인용 블록, 링크 목록 H2). 원문 스스로 표준이 아니라 제안이라고 쓰고, 주요 검색 엔진이나 LLM 회사가 추론이나 학습에 쓴다는 주장은 하지 않는다. 문서 사이트라면 개발자 편의로 둘 수 있지만 런치 효과로 보고하지 않는다.

**그래서 할 일.**

- 본문에 근거 링크, 수치, 짧은 인용을 붙인다. 이것은 사람 독자에게도 좋은 일이다.
- 질문형 제목 아래 첫 문단에 답을 쓴다. 쉬운 말로 쓴다(논문의 쉬운 표현 방법도 15~30% 개선 범위였다).
- 키워드 반복과 분량 늘리기는 하지 않는다. Google은 키워드 반복을 spam policies 위반으로 보고, 선호하는 글자 수가 없다고 쓴다.

**쓰면 안 되는 문장.** "AI 검색 상위 노출 보장", "llms.txt를 넣으면 ChatGPT가 읽는다", "GEO로 트래픽 40% 증가"(논문의 40%는 실험 지표의 상대 개선이지 트래픽이 아니다).
