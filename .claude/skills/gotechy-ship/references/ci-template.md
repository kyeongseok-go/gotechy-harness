# 최소 CI 틀 (스택 무관)

게이트 2단계에서 CI가 없다고 판정했을 때, 또는 `gotechy-plan`의 M1에서 게이트 명령과 CI를 처음 만들 때 연다.

## 원칙

- CI는 로컬 게이트 명령(lint, 타입, 테스트)을 그대로 부른다. 같은 게이트가 두 곳에서 따로 자라면 어긋난다.
- 워크플로 파일은 `.github/workflows/ci.yml`에 둔다(없으면 만든다). 만든 뒤 저장소 설정에서 이 작업을 필수 체크로 묶어야 머지를 막는다. 설정 변경은 오너가 한다.
- 토큰 권한은 읽기만 준다. GitHub 보안 문서는 `GITHUB_TOKEN` 기본 권한을 저장소 내용 읽기로 두고 작업마다 필요한 만큼만 올리라고 쓴다.
- action은 판 태그로 적되, 쓰기 전에 그 태그의 전체 커밋 SHA로 바꾸고 태그는 주석으로 남긴다. 태그는 옮겨지거나 지워질 수 있다. 저장소가 GitHub의 workflow dependency lockfile을 쓰면 그것이 SHA 고정보다 강한 방법이다.

## 틀

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  gate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      # 쓰기 전에 v7.0.1 태그의 전체 커밋 SHA로 바꾼다: actions/checkout@<40자리 SHA> # v7.0.1
      - uses: actions/checkout@v7.0.1
        with:
          persist-credentials: false

      # 런타임 설치: 스택의 공식 setup action을 그 저장소 releases에서 현재 판을 확인해 같은 방식으로 고정한다.
      # 예: Node는 actions/setup-node, Python은 astral-sh/setup-uv 또는 actions/setup-python, Go는 actions/setup-go.

      - name: install
        run: <고정 설치 명령, 예: npm ci, bun ci, uv sync --locked, go mod download>
      - name: lint
        run: <린트 명령>
      - name: typecheck
        run: <타입 검사 명령>
      - name: test
        run: <테스트 명령, 커버리지 기준 포함>
```

채울 때:

- `<...>` 자리는 `references/gate-levels.md` 2절에서 찾은 프로젝트 명령으로 바꾼다. 찾지 못한 명령은 지어내지 않고 실패로 보고한다.
- 기본 브랜치 이름이 `main`이 아니면 바꾼다.
- 런타임 버전은 저장소의 버전 파일(`.nvmrc`, `.python-version`, `go.mod`의 `go` 줄 등)에서 읽게 한다.
- 비밀이 필요한 단계(배포, 외부 API)는 이 작업에 넣지 않는다. 게이트는 비밀 없이 돌아야 한다.

## 확인한 사실 (2026-10-16)

| 사실 | 출처 |
|---|---|
| `actions/checkout` 최신 릴리스는 v7.0.1이고 README 예시는 `@v7`이다. v7은 `pull_request_target`, `workflow_run`에서 포크 PR 코드를 기본으로 체크아웃하지 않는다 | https://github.com/actions/checkout/releases , https://github.com/actions/checkout |
| `persist-credentials` 입력이 있고 기본값은 true다 | https://github.com/actions/checkout |
| 전체 커밋 SHA 고정 권장, 태그는 옮겨지거나 지워질 수 있음, workflow dependency lockfile이 SHA 고정보다 강함, `GITHUB_TOKEN`은 읽기 기본 | https://docs.github.com/en/actions/reference/security/secure-use |

setup action들의 현재 판은 이번에 확인하지 않았다(확인 못 함). 쓰기 전에 각 저장소의 releases에서 확인한다.
