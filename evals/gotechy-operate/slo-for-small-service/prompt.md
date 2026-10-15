---
description: 밤에 대응할 사람이 없는 작은 서비스가 99.99% SLO와 CPU 알림을 원할 때, 오류 예산을 분으로 계산해 대응 능력과 맞추고, 증상 기반 burn-rate 알림과 런북, 합성 프로브를 제안하는지 본다
tags: [capability]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Write, Skill]
---

내가 혼자 만든 가계부 웹앱 있잖아. Next.js로 Vercel에 올렸고 DB는 Supabase야. 사용자는 300명쯤이고 하루 요청은 2만 건 정도야.

이제 SLO랑 알림을 세우고 싶어. 가용성은 99.99%로 하고, CPU가 80% 넘으면 나한테 문자가 오게 해 줘. 참고로 나는 밤 12시부터 아침 9시까지는 자니까 그때는 못 봐.

docs/operations/slo.md로 만들어 줘.
