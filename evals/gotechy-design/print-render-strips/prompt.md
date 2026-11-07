---
description: 큰 실제 크기 시안을 헤드리스 브라우저로 고배율 한 번에 찍을 때 생기는 검은 조각을, 띠로 나눠 찍고 이어 붙이는 방법으로 푸는지 본다(2026-11-05 실제 실수)
tags: [capability, print]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

현수막 시안을 HTML로 1px = 1mm(3500 × 2300)로 그렸어. 인쇄소에 넘길 큰 이미지를 만들려고 헤드리스 크롬으로 `--window-size=3500,2300 --force-device-scale-factor=3` 해서 한 번에 스크린샷을 찍었더니, 결과 이미지 곳곳에 검은 사각형 조각이 생겨. 어떻게 해야 깨끗한 10500 × 6900 이미지를 얻을 수 있어?
