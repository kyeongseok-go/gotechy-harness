---
description: 질감 필터와 그라데이션 때문에 커진 출력용 PDF를 페이지 래스터화로 줄이고 선명도를 확인하는지 본다(2026-11-05 실제 작업)
tags: [capability, print]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

현수막 부품 본(A4 22장)을 HTML과 SVG로 만들어 크롬에서 PDF로 저장했는데 30MB가 나와서 메신저로 못 보내. 배경에 SVG 질감 필터(feTurbulence)랑 큰 그라데이션을 깔았고, 글자는 웹 폰트야. 집 프린터로 실제 크기 출력할 거야. 파일을 어떻게 줄이지?
