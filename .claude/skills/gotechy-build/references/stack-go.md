# 스택: Go

`go.mod`가 있는 프로젝트를 구현할 때 연다.

## 현재 안정 버전 (확인일 2026-10-16)

| 도구 | 버전 | 근거 |
|---|---|---|
| Go | 1.27.2 (2026-10-08). 1.27.0은 2026-08-19. 1.26 줄은 1.26.9 | https://go.dev/doc/devel/release |
| 지원 정책 | 각 메이저는 새 메이저가 두 개 나올 때까지 지원. 지금은 1.27과 1.26 | https://go.dev/doc/devel/release |
| golangci-lint | v2.14.0 (2026-09-24) | https://github.com/golangci/golangci-lint/releases |
| staticcheck | 2026.2.2 (v0.8.2, 2026-10-12) | https://github.com/dominikh/go-tools/releases |

`go.mod`의 `go` 줄은 지원 중인 버전으로 두고, `go.sum`을 커밋 대상에 올린다. 1.25 이하에 머문 모듈은 보안 수정을 받지 못하므로 올리는 작업을 부채로 기록한다.

## 검사 명령 (CI 순서)

```sh
test -z "$(gofmt -l .)"        # 포맷 차이 0
go vet ./...
staticcheck ./...              # 또는 golangci-lint run (staticcheck 포함 설정)
go test -race -cover ./...
govulncheck ./...              # 실제로 호출하는 취약 함수만 보고
go mod verify
```

- Go 1.27부터 `go test`가 vet의 `stdversion` 검사를 기본으로 돌린다. vet `printf` 검사는 이제 `E` 자체가 `error`일 때 `*E`를 `%w`로 감싸는 코드를 잡는다. 근거: https://go.dev/doc/go1.27
- 퍼징: `func FuzzXxx(f *testing.F)`를 쓰고 `go test -fuzz=FuzzXxx`로 돌린다(1.18부터). 파서와 디코더에 붙인다. 근거: https://go.dev/doc/security/fuzz/
- govulncheck 근거: https://go.dev/doc/security/vuln/

## 테스트

- 표 형식 테스트: 입력, 기대값, 이름을 담은 구조체 슬라이스를 돌며 `t.Run(tc.name, ...)`.
- 1.24부터 `t.Context()`(테스트가 끝나면 취소되는 context), 벤치마크는 `b.Loop()`.
- 1.25부터 `testing/synctest`가 정식이다(`synctest.Test`). 시간과 고루틴이 얽힌 코드를 가짜 시계로 결정적으로 테스트한다. 1.27은 `synctest.Sleep`과 메모리 안 가짜 네트워크용 `httptest.NewTestServer`를 더했다.
- 1.26부터 `t.ArtifactDir()`로 실패 분석용 파일을 남길 수 있다.
- 근거: https://pkg.go.dev/testing , https://pkg.go.dev/testing/synctest
- 외부 의존(DB, HTTP)은 소비하는 쪽에 둔 작은 인터페이스 뒤로 숨기고, 테스트에서 가짜 구현을 넣는다.

## 관용구

- 에러 감싸기: `fmt.Errorf("사용자 %d 조회: %w", id, err)`. 판정은 `errors.Is`, `errors.As`, 1.26부터는 `errors.AsType`. 여러 에러는 `errors.Join`(1.20). 근거: https://pkg.go.dev/errors
- context: 첫 번째 매개변수로 `ctx`를 넘기고, 구조체에 저장하지 않는다. 근거: https://pkg.go.dev/context
- 경계 파싱: `json.Decoder`로 요청을 구조체에 디코딩한 뒤(`DisallowUnknownFields` 검토), 검증 함수가 내부 도메인 타입을 돌려준다. 안쪽 함수는 `map[string]any`를 받지 않는다.
- 1.22부터 `for` 반복 변수는 반복마다 새로 만들어진다. 오래된 `v := v` 복사는 지워도 된다(`go.mod`의 `go` 줄이 1.22 이상일 때).
- 인터페이스는 쓰는 쪽 패키지에 작게 정의한다. 구현 쪽은 구체 타입을 돌려준다.
- Effective Go는 2009년 판 그대로이고 제네릭과 모듈을 다루지 않는다. 최신 규칙은 릴리스 노트와 패키지 문서를 따른다. 근거: https://go.dev/doc/effective_go

## 자주 나는 실수

1. `_ = f()`나 반환 에러 무시. 고친다: golangci-lint 설정에서 `errcheck`가 켜져 있는지 `golangci-lint linters`로 확인하고 처리한다.
2. 끝나지 않는 고루틴(취소 신호 없음). 고친다: `ctx.Done()`을 기다리고, 테스트에서 synctest로 확인한다.
3. 데이터 경합. 고친다: CI에서 `-race`를 항상 켠다.
4. nil 맵에 쓰기(패닉). 고친다: `make`로 만든다.
5. 타입이 있는 nil 포인터를 인터페이스로 돌려 `err != nil`이 참이 되는 경우. 고친다: 실패가 없으면 그냥 `nil`을 돌려준다.
6. 반복문 안의 `defer`(함수가 끝날 때까지 자원이 쌓인다). 고친다: 반복 본문을 함수로 뺀다.
7. 타임아웃 없는 `http.Client`, `ReadHeaderTimeout` 없는 `http.Server`. 고친다: 둘 다 명시한다.

## 보안 메모

- SQL은 `$1` 같은 자리표시자로 바인딩한다. `fmt.Sprintf`로 쿼리를 만들지 않는다.
- HTML은 `html/template`로 만든다(자동 이스케이프). `text/template`로 HTML을 만들지 않는다.
- 토큰은 `crypto/rand`로 만든다. `math/rand`는 보안용이 아니다.
- `os/exec`는 인자를 나눠 넘기고 `sh -c`에 사용자 입력을 넣지 않는다.
- govulncheck 결과에서 호출되는 취약점 0건을 합격선으로 둔다.
