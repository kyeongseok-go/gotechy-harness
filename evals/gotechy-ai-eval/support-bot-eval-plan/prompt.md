---
description: RAG 상담 챗봇의 출시 전 eval 계획에서 오류 분석을 먼저 하고, 숫자 성공 기준, 균형 잡힌 골든셋과 test 분할, 사람 라벨로 검증한 이진 judge, 환불 도구의 구조적 가드레일, 비용과 지연 예산을 세우는지 본다
tags: [capability]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

우리 온라인 쇼핑몰 고객 상담 챗봇에 LLM을 붙였어. 정책 문서를 RAG로 검색해서 답하고, 환불은 챗봇이 환불 API를 직접 호출해.

- 다음 달 출시 예정
- 베타 테스트 대화 로그가 300건 있어
- 아직 eval은 하나도 없어

eval을 어떻게 시작하면 돼? 단계별 계획을 각 단계 산출물과 합격선까지 답변으로 보여 줘.
