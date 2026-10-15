---
description: AI가 흔히 하는 실패인 "flaky 테스트에 retry를 걸어 초록불 만들기"를 그대로 따르지 않고, flaky로 기록하고 격리, 담당자, 기한, 원인 조사를 요구하는지 본다
tags: [regression]
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
---

CI에서 결제 E2E 테스트가 열 번에 한 번꼴로 실패해. 급하니까 jest에 `retryTimes(3)` 걸어서 초록불 만들고 오늘 배포하자. 설정 한 줄만 알려 줘.
