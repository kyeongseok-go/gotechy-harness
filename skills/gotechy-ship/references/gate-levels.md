# 게이트 등급, 명령 찾기, 보고 틀

등급을 정하거나, 게이트 명령을 찾거나, `docs/quality/score.md`를 처음 만들 때 연다.

## 1. 등급 판정

등급은 SKILL.md의 작업 크기 표(`gotechy-spec`, `gotechy-plan`, `gotechy-build`와 같은 표)에서 정한다. 여기에 다른 기준(파일 수 같은)을 더하지 않는다.

| 등급 | 고르는 조건 | 검사 번호 |
|---|---|---|
| 패치 | 크기 표의 패치(1시간 미만, 파일 1~2개, 공개 동작 계약인 API, 화면 흐름, 데이터 모양이 그대로) | 1 동작 증명, 2 CI(있으면), 3 하네스(gotechy 프로젝트면), 5 부채 |
| 기능 | 크기 표의 작은 기능(미니 스펙 경로), 큰 기능, 제품 | 1~6, 8 |
| 출시 | 배포, 버전 태그, 패키지 발행, 사용자에게 공개, DB 마이그레이션 동반 | 1~8 전부 |

- 사용자 데이터, 인증, 결제, 외부 발행을 건드리면 크기 표대로 큰 기능이고 기능 등급 이상이다.
- 애매하면 높은 쪽으로 잡고, 보고 첫 줄에 고른 이유를 적는다.
- 인자로 받은 등급이 실제 변경보다 낮아 보이면 그대로 검사하되, 보고에 "변경 규모로는 기능 등급"이라고 알린다.

### 미니 스펙 경로 (작은 기능)

작은 기능은 ExecPlan 없이 미니 스펙(`docs/product-specs/<슬러그>.md`)만 있다. 기능 등급으로 검사하되 아래처럼 바꾼다.

| 검사 | ExecPlan이 있을 때 | 미니 스펙 경로 |
|---|---|---|
| 1 동작 증명의 Validation | ExecPlan의 Validation and Acceptance 항목마다 명령과 출력 | 미니 스펙의 수용 기준(AC ID)마다 판정하는 테스트나 명령과 출력 한 줄 |
| 4 문서 동기화의 표시 검사 | ExecPlan 머리 `- 스펙:` 줄의 경로 | 미니 스펙 파일 |
| 8 출력 변환과 마무리 | Artifacts and Notes 읽기, Outcomes 확인, `completed/`로 옮기기 | 하지 않는다(옮길 계획이 없다). 부채와 보고만 한다 |

ExecPlan을 전제로 하는 검사는 ExecPlan이 있을 때만 적용한다. 없다는 이유로 실패로 세지 않는다.

## 2. 게이트 명령 찾기

아래 순서로 찾고, 찾은 명령을 표로 만든 뒤 실행한다. 찾지 못한 칸은 "없음"이 아니라 **실패**로 적는다.

| 단서 | 볼 곳 | 흔한 명령 |
|---|---|---|
| `package.json` | `scripts`의 `lint`, `typecheck`, `test`, `build`, `check` | `npm run lint`, `npm test`, `bun run check` |
| `pyproject.toml`, `uv.lock` | `[tool.*]` 설정, `Makefile` | `uv run ruff check`, `uv run mypy .`, `uv run pytest --cov` |
| `go.mod` | `Makefile`, CI 워크플로 | `go vet ./...`, `go test ./... -race -cover` |
| `Cargo.toml` | CI 워크플로 | `cargo clippy -- -D warnings`, `cargo test` |
| `Makefile`, `justfile`, `Taskfile.yml` | 대상 이름 `check`, `test`, `lint` | `make check` |
| `.github/workflows/*.yml` | CI가 실제로 돌리는 명령 | CI와 같은 명령을 로컬에서 돌린다 |
| `orchestration/tasks/` | gotechy 프로젝트 | `gotechy doctor`, HANDOFF가 있으면 `gotechy handoff lint <파일>` |

- 스텁 명령(`echo ... && exit 1`처럼 "미설정"을 알리고 실패하는 스크립트)은 정의되지 않은 것과 같다. 실패로 적는다.
- CI 워크플로가 없으면 `references/ci-template.md`의 틀을 고치는 법으로 제안한다. 만드는 일 자체는 다음 작업(또는 ExecPlan의 M1)으로 넘긴다.
- CI 워크플로와 로컬 명령이 다르면 CI 쪽을 기준으로 삼고, 차이를 부채로 적는다(같은 게이트가 두 곳에서 따로 자라면 어긋난다).
- 비밀 파일(`.env`, 키 파일)은 단서로도 열지 않는다. `.env.example`만 본다.

## 3. CI 확인 명령

```bash
sha=$(git rev-parse HEAD)
# PR이 있을 때: 필수 체크만, bucket은 pass|fail|pending|skipping|cancel
gh pr checks --required --json name,bucket,state
# PR이 없을 때: 이 커밋의 실행 기록
gh run list --commit "$sha" --json name,status,conclusion,headSha
```

판정:

- fail, cancel이 하나라도 있으면 실패다.
- pending이면 끝날 때까지 기다리거나(`gh pr checks --watch --fail-fast`) "CI 대기 중, 완료 아님"으로 보고한다. `gh pr checks`는 pending일 때 exit 8을 낸다.
- skipping인 필수 체크는 워크플로의 `if:` 조건을 읽고 이번 변경에 정말 해당이 없는지 확인한다. 경로 필터 때문에 테스트가 안 돌았는데 코드가 바뀌었으면 실패다.
- 실행 기록의 `headSha`가 HEAD와 다르면 그 결과는 증거가 아니다. push 후 다시 본다.
- 같은 커밋에서 다시 돌려 통과했으면 flaky다. 통과로 세되, 해당 테스트를 부채 표에 적는다.
- `gh`가 없거나 인증이 안 되면 CI 상태를 "확인 못 함"으로 쓰고 실패로 센다. 사용자에게 CI 화면 확인을 부탁한다.

## 4. 보고 틀

```
[등급: <패치|기능|출시>] 게이트 <N>개 중 <M>개 통과 (HEAD <짧은 sha>)
[통과] <번호> <이름>: `<명령>` <결과 핵심>
[실패] <번호> <이름>: <무엇이 왜 실패했나> (예상 <시간>)
남은 것 <N-M>개. 지금 이어서 처리할까요?
```

- 통과 줄에는 반드시 명령과 결과가 있다. 명령 없이 "확인함"만 있는 줄은 통과로 세지 않는다.
- 실패 줄에는 고치는 데 드는 예상 시간을 적는다. 사람이 다음 행동을 고를 수 있게 하기 위해서다.
- 모두 통과하면 "완료 게이트 통과 [등급]"과 증거 요약 3줄 이내로 끝낸다.
- 위임 작업이면 같은 내용을 `owner-protocol` 스킬의 HANDOFF "증거" 절에 `` `명령`: 결과`` 형식으로 옮긴다. 미통과 항목은 리스크 절에 적는다.

## 5. `docs/quality/score.md` 틀

파일이 없으면 아래로 만든다. 행은 프로젝트에 맞게 더하거나 뺄 수 있지만, 루브릭 문장은 바꾸지 않는다.

```markdown
# 품질 점수표

`gotechy-ship` 스킬이 완료 게이트에서 이번 작업이 건드린 영역만 갱신한다.

판정 루브릭(인상이 아니라 판정):
- A(최고 전문가): 그 영역 체크리스트 전부 통과 + 기계 강제 장치 있음 + 최근 4주 회귀 0
- B(출시 가능): 전부 통과, 일부는 수동 검증
- C(부채 있음): 미달 항목이 tech-debt-tracker에 기록됨
- D(위험): 미달이 기록조차 없거나 보안, 데이터, 법 관련

| 영역 | 등급 | 마지막 평가 | 근거와 격차 |
|---|---|---|---|
| 코드 | - | - | |
| 테스트 | - | - | |
| 문서 | - | - | |
| UX와 접근성 | - | - | |
| 보안 | - | - | |
| 신뢰성과 운영 | - | - | |
| 출시와 변경 관리 | - | - | |
```

운영 규칙:

- "마지막 평가" 칸에는 날짜와 짧은 sha를 함께 적는다(예: `2026-10-16 3f2a91c`).
- 근거 칸에는 등급을 정한 증거(명령 결과, 리뷰 문서 경로)와 A까지 남은 격차를 한 줄로 쓴다.
- C 이하 등급이 2주 넘게 그대로면 `gotechy-plan` 스킬로 상환 계획(ExecPlan)을 세우자고 보고에 적는다.
- 판정하지 않은 영역은 `-`로 둔다. 추측으로 등급을 채우지 않는다.
