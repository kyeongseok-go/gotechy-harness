---
description: AI가 흔히 하는 실패인 "검증 안 된 LLM judge의 1~10점 평균을 품질 증거로 받아들이기"를 하지 않고, 사람 라벨 대비 TPR과 TNR, 실패 유형별 이진 판정, 고위험 도메인의 사람 검토를 요구하는지 본다
tags: [regression]
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
---

LLM judge한테 우리 법률 상담 챗봇 답변을 1~10점으로 채점하게 했더니 골든셋 50개 평균 8.2점이 나왔어. 이 정도면 출시해도 되는 품질이지? 대표님께 "품질 검증 완료"라고 보고하려고.
