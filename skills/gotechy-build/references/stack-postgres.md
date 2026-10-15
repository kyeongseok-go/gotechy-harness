# 스택: PostgreSQL

SQL 마이그레이션 폴더, `schema.prisma`의 `postgresql`, compose 파일의 `postgres` 이미지, `.env.example`의 `postgres://` 같은 단서가 있는 프로젝트에서 스키마, 쿼리, 마이그레이션을 바꿀 때 연다.

## 현재 버전 (확인일 2026-10-16)

| 항목 | 내용 | 근거 |
|---|---|---|
| 최신 메이저 | 18 (최신 18.6, 2026-08-13 보안 수정판). 지원 중: 18.6, 17.11, 16.15, 15.19, 14.24 | https://www.postgresql.org/support/versioning/ |
| 14 지원 종료 | 2026-11-12 | 같은 곳 |
| 19 | RC 1 (2026-10-15), 정식 출시 2026-11-19 예정. 출시 전에는 운영에 쓰지 않는다 | https://www.postgresql.org/news.rss |
| PgBouncer | 1.26.1 (2026-10-14). 1.21부터 transaction 모드에서 프로토콜 수준 prepared statement 지원(`max_prepared_statements`, 기본 200) | https://www.pgbouncer.org/changelog.html |

새 프로젝트는 18로 시작한다. 14를 쓰는 프로젝트는 지원 종료 전에 올리는 작업을 부채로 기록한다.

## 18에서 앱 개발자가 쓸 것 (근거: https://www.postgresql.org/docs/release/18.0/)

- `uuidv7()`: 시간 순으로 정렬되는 UUID. 무작위 UUID보다 인덱스 지역성이 좋다.
- `RETURNING`에서 `OLD`, `NEW`를 함께 돌려받는다(INSERT, UPDATE, DELETE, MERGE).
- 생성 열의 기본이 virtual(읽을 때 계산)이 됐다. 저장이 필요하면 `STORED`를 명시한다.
- NOT NULL 제약에도 `NOT VALID`를 쓸 수 있다.
- 기간 제약: 기본키와 유니크에 `WITHOUT OVERLAPS`, 외래키에 `PERIOD`.
- `EXPLAIN ANALYZE`가 BUFFERS 정보를 자동으로 보여 준다.
- MD5 비밀번호 인증은 폐지 예정이다. SCRAM을 쓴다.

## 마이그레이션: expand-contract

한 번에 바꾸지 않고, 옛 코드와 새 코드가 동시에 돌아도 깨지지 않는 단계로 나눈다.

1. 늘리기(expand): 새 열이나 테이블을 NULL 허용으로 추가한다. 옛 코드는 영향이 없다.
2. 옮기기: 새 코드가 양쪽에 쓰고, 기존 행은 작은 묶음으로 나눠 채운다(긴 트랜잭션 하나로 하지 않는다).
3. 바꾸기: 읽기를 새 구조로 돌린다. 제약은 `NOT VALID`로 걸고 나중에 `VALIDATE CONSTRAINT`(SHARE UPDATE EXCLUSIVE 잠금이라 읽기, 쓰기를 막지 않는다).
4. 줄이기(contract): 옛 열과 코드를 다음 배포에서 지운다.

- 큰 테이블의 인덱스는 `CREATE INDEX CONCURRENTLY`. 트랜잭션 블록 안에서 돌 수 없으므로 마이그레이션 도구의 트랜잭션 감싸기를 그 파일만 끈다. 실패하면 INVALID 인덱스가 남아 쓰기 부담만 늘리므로 지우고 다시 하거나 `REINDEX INDEX CONCURRENTLY`. 근거: https://www.postgresql.org/docs/current/sql-createindex.html
- 유니크 제약을 새로 걸기 전에 중복 행을 세는 쿼리를 먼저 돌리고 결과를 기록한다.
- 마이그레이션 세션에 `SET lock_timeout = '5s'`처럼 잠금 대기 상한을 둔다. 기본값 0(무제한)이면 `ALTER TABLE` 하나가 뒤의 모든 쿼리를 줄 세운다. 이 값을 서버 전체 설정에 넣는 것은 공식 문서가 권하지 않는다. 근거: https://www.postgresql.org/docs/current/runtime-config-client.html
- 마이그레이션마다 되돌리는 절차를 적거나, 되돌릴 수 없으면 그 이유와 백업 시점을 적는다.

## 제약은 DB에 둔다

- 앱 검증은 경쟁 상태(동시에 두 요청)를 막지 못한다. `NOT NULL`, `CHECK`, `UNIQUE`, `FOREIGN KEY`, 배제 제약을 DB에 건다.
- 외래키를 선언해도 참조하는 쪽 열에는 인덱스가 자동으로 생기지 않는다. 부모 행 삭제, 갱신이 자식 테이블을 훑으므로 보통 인덱스를 만든다. 근거: https://www.postgresql.org/docs/current/ddl-constraints.html
- 타입: 시각은 `timestamptz`, 돈은 `numeric`이나 최소 단위 `bigint`, 기본키는 `bigint` identity나 `uuidv7()`.
- 멱등 처리(결제 웹훅 같은 중복 요청)는 고유 키에 `UNIQUE`를 걸고 `INSERT ... ON CONFLICT`로 판정한다.

## 쿼리와 실행 계획

- 값은 항상 매개변수로 바인딩한다. 문자열로 SQL을 조립하지 않는다.
- 느릴 것 같은 쿼리는 운영과 비슷한 데이터로 `EXPLAIN (ANALYZE, BUFFERS)`를 본다. ANALYZE는 문장을 실제로 실행하므로 쓰기 쿼리는 `BEGIN; ... ROLLBACK;`으로 감싼다. 근거: https://www.postgresql.org/docs/current/sql-explain.html
- 볼 것: 큰 테이블의 Seq Scan, 예상 행 수와 실제 행 수가 10배 넘게 차이 나는 노드, 반복 실행되는 같은 쿼리(N+1).
- 목록은 상한(`LIMIT`)을 둔다. 깊은 페이지는 `OFFSET` 대신 키 기준 페이지(keyset).

## 트랜잭션과 격리 수준

- 기본은 Read Committed다. Repeatable Read나 Serializable을 쓰면 직렬화 실패(SQLSTATE 40001)에 대비한 재시도 코드가 필수다. 근거: https://www.postgresql.org/docs/current/transaction-iso.html
- 읽고 고쳐 쓰는 흐름은 `SELECT ... FOR UPDATE`나 조건부 `UPDATE ... WHERE`로 경쟁을 막는다.
- 트랜잭션 안에서 외부 HTTP를 부르지 않는다. 트랜잭션은 짧게 둔다.
- `statement_timeout`, `lock_timeout`, `transaction_timeout`은 기본값 0(꺼짐)이다. 앱 역할이나 세션 단위로 상한을 둔다.

## Row Level Security (여러 사용자, 여러 조직 데이터)

근거: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

- RLS를 켜고 정책이 없으면 모든 행이 거부된다.
- 슈퍼유저와 `BYPASSRLS` 역할은 항상 우회한다. 테이블 소유자도 `FORCE ROW LEVEL SECURITY`가 없으면 우회한다. 그래서 앱이 접속하는 역할은 테이블 소유자가 아니어야 한다.
- 유니크, 외래키 검사는 RLS를 우회하므로, 다른 테넌트의 값이 있는지 추측하는 통로가 될 수 있다.
- 테스트: "다른 테넌트로 접속하면 0행"을 정책마다 쓴다.

## 연결 풀

- PgBouncer transaction 모드에서는 세션 기능(`SET`/`RESET`, `LISTEN`, `WITH HOLD` 커서, SQL `PREPARE`, 세션 advisory lock)을 쓸 수 없다. 세션 설정은 `SET LOCAL`로 트랜잭션 안에 둔다. 근거: https://www.pgbouncer.org/features.html
- 앱 프로세스 수와 풀 크기의 곱이 DB의 연결 한도를 넘지 않게 계산해 적는다.

## 백업과 복원

- 방식은 SQL 덤프, 파일 시스템 백업, 연속 아카이빙(PITR) 세 가지다. 운영 데이터는 연속 아카이빙을 기본으로 한다. 근거: https://www.postgresql.org/docs/current/backup.html
- `archive_command`는 성공했을 때만 0을 돌려줘야 하고, 기본 백업 이후 WAL이 끊김 없이 이어져야 복원된다. 근거: https://www.postgresql.org/docs/current/continuous-archiving.html
- 복원 리허설을 분기마다 한 번 하고 걸린 시간을 기록한다. 복원해 보지 않은 백업은 백업으로 치지 않는다.

## 자주 나는 실수

1. 큰 테이블에 `CONCURRENTLY` 없이 인덱스 생성. 쓰기가 멈춘다.
2. `lock_timeout` 없이 `ALTER TABLE`. 잠금 대기 줄이 생겨 서비스 전체가 멈춘다.
3. 앱 코드만 믿고 유니크 제약 생략. 동시 요청에서 중복 행.
4. 앱 DB 역할이 테이블 소유자라서 RLS가 조용히 꺼진 상태.
5. `NOT IN (서브쿼리)`에 NULL이 섞여 빈 결과. `NOT EXISTS`를 쓴다.
