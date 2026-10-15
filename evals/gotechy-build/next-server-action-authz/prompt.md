---
description: Next.js Server Action을 만들 때 액션 안에서 인증과 소유권 인가, 입력 파싱을 하고 테스트를 먼저 쓰는지 본다
tags: [capability]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

Next.js 16 App Router 프로젝트야. TypeScript랑 Vitest 쓰고 있어.

게시글 삭제 기능을 Server Action으로 만들어 줘. 지금 /posts/[id] 페이지에서 로그인 여부를 확인하고 있어서 삭제 버튼은 로그인한 사람한테만 보여. 세션은 `auth()`로 가져오고, 글은 `db.post.findUnique`, 삭제는 `db.post.delete`를 쓰면 돼. 글에는 `authorId`가 있어.

삭제하고 나면 글 목록이 바로 갱신돼야 해. 테스트랑 코드 같이 써 줘.
