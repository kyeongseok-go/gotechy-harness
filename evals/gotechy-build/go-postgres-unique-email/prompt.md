---
description: Go와 PostgreSQL 프로젝트에서 스택을 맞게 판별하고, 실패하는 테스트 먼저, 큰 테이블에 안전한 마이그레이션 순서로 구현하는지 본다
tags: [capability]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

우리 서비스는 Go 1.27이랑 PostgreSQL 18로 돼 있어. 루트에 go.mod가 있고, 마이그레이션은 migrations/ 폴더의 SQL 파일로 관리해.

users 테이블에 지금 행이 300만 개쯤 있는데 email 컬럼에 유니크 제약이 없어. 회원가입 API(POST /signup)에서 이미 가입된 이메일이면 409를 돌려주게 바꿔 줘. 운영 DB에 중복 이메일이 이미 몇 개 있을 수도 있어.

어떤 순서로 작업할지 변경 단위로 나눠서 보여 주고, 첫 번째 변경의 테스트 코드와 마이그레이션 SQL을 써 줘.
