---
description: 랜딩 페이지 head와 링크를 주고 런치 점검을 시킨다. 심어 둔 색인 차단, 깨진 Open Graph, 보이지 않는 평점 마크업, 대문자 UTM을 잡는지 본다.
tags: [capability]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

다음 주 화요일에 메모 앱 "메모숲"을 출시해요. 배포 주소는 https://memosup.example.com 이에요. 아래가 첫 화면 HTML의 head 부분이고, 가격 페이지(/pricing)도 title이 똑같아요. 홍보 링크도 같이 붙여요. 런치 점검해 주고, 무엇이 통과고 무엇이 미달인지 표로 답에 바로 보여 주세요. 고칠 순서도 알려 주세요.

```html
<head>
  <title>메모숲</title>
  <meta name="robots" content="noindex, nofollow">
  <meta property="og:title" content="메모숲">
  <meta property="og:image" content="/og.png">
  <meta property="og:url" content="http://localhost:3000/">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"SoftwareApplication","name":"메모숲",
   "aggregateRating":{"@type":"AggregateRating","ratingValue":"4.9","ratingCount":"1200"}}
  </script>
</head>
```

화면에는 평점이나 후기가 아직 없어요(출시 전이라서요).

홍보 링크:
- https://memosup.example.com/?utm_source=Threads&utm_campaign=Launch
- https://memosup.example.com/?utm_source=geeknews&utm_medium=community&utm_campaign=launch-memosup-202610
