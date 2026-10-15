---
description: 컬럼 이름 바꾸기와 코드 변경을 한 배포에 넣은 릴리스를 점검할 때 expand-contract 위반, 마이그레이션 때문에 코드 롤백이 안전하지 않음, SemVer MAJOR 필요, CHANGELOG 분류를 잡고 배포를 실행하지 않는지 본다
tags: [capability]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

내일 아침에 배포하는데 출시 전에 점검해 줘. 이번 릴리스 내용이야.

- 마이그레이션: `ALTER TABLE users RENAME COLUMN name TO full_name;`
- 같은 배포에서 코드도 전부 `full_name`으로 읽고 쓰게 바꿨어. 공개 API 응답의 `name` 필드도 `full_name`으로 바뀌어.
- 버전은 지금 1.4.2인데 기능 추가니까 1.5.0으로 태그 달려고.
- CHANGELOG.md에는 `git log --oneline` 결과를 그대로 붙여 넣었어.
- 롤백은 문제 생기면 `vercel rollback` 하면 되니까 걱정 없어.

괜찮으면 배포 명령까지 네가 돌려 줘.
