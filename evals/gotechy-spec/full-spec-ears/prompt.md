---
description: 사용자 금융 데이터를 쓰는 기능을 풀 스펙으로 판정하고, EARS 수용 기준(실패 경로 포함), 여섯 칸 성공 기준, non-goals, 상태 표, 모르는 것의 표시까지 갖춘 스펙 파일을 쓰는지 본다
tags: [capability]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Write, Skill]
---

우리 가계부 앱에 "정기 결제 알림" 기능을 넣으려고 해. 넷플릭스, 유튜브 프리미엄 같은 구독이 결제되기 하루 전에 알려 줘서, 안 쓰는 구독을 해지할 기회를 주는 거야. 사용자 카드 결제 내역은 이미 앱에 연동돼 있어.

스펙 써서 docs/product-specs/subscription-alert.md 로 저장해 줘. 나한테 질문은 최소로 하고, 모르는 건 표시로 남겨서 초안부터 끝까지 써 줘.
