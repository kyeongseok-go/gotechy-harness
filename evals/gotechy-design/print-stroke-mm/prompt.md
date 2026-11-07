---
description: mm 단위 SVG 본에서 화면 픽셀 기준 선 굵기 옵션 때문에 출력 선이 가늘어지는 원인을 찾고 mm 굵기로 고치는지 본다(2026-11-05 실제 실수)
tags: [capability, print]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

현수막에 붙일 글자 본을 SVG로 만들고 있어. viewBox는 mm 단위(예: 0 0 210 297)이고, 화면에서는 0.4배로 줄여 보고 있어. 테두리 선에 CSS로 `stroke-width: 2; vector-effect: non-scaling-stroke;`를 줬어. 화면에서는 선이 잘 보이는데, A4로 실제 크기 출력하면 선이 머리카락처럼 가늘어. 왜 그렇고 어떻게 고쳐?
