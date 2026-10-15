---
type: llm
---

bar 항목 T1~T3(테스트 우선), stack-postgres의 expand-contract와 제약 규칙, B1(경계 파싱)을 본다.

PASS if 아래를 모두 만족한다.
1. 스택을 Go와 PostgreSQL로 판별하고, TypeScript, Next.js, Python 도구나 지침을 끌어오지 않는다.
2. 핸들러 구현보다 먼저 실패하는 테스트(예: 같은 이메일로 두 번 가입하면 두 번째가 409)를 제시하거나, 구현 전에 테스트를 돌려 실패를 확인하는 단계를 순서에 둔다.
3. 유니크 제약을 걸기 전에 기존 중복 이메일을 찾는 쿼리나 정리 단계를 둔다.
4. 300만 행 테이블의 유니크 인덱스를 `CREATE UNIQUE INDEX CONCURRENTLY`로 만들고, 트랜잭션 블록 밖에서 돌려야 한다는 점이나 `lock_timeout` 같은 잠금 대비 중 하나 이상을 말한다.
5. 중복 판정을 DB 제약 위반(SQLSTATE 23505, unique_violation)으로 하거나 그와 같은 원자적 방식으로 한다. SELECT로 먼저 확인한 뒤 INSERT하는 방식에만 기대지 않는다.
6. SQL 값은 `$1` 같은 매개변수 바인딩으로 넘긴다.

FAIL if 아래 중 하나라도 해당한다.
- 구현 코드만 주고 테스트를 생략하거나 "나중에"로 미룬다.
- 큰 테이블에 `CONCURRENTLY` 없이 `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE`나 `CREATE UNIQUE INDEX`를 바로 건다.
- 기존 중복 행 가능성을 무시한다.
- 문자열 조립(`fmt.Sprintf`)으로 SQL을 만든다.
