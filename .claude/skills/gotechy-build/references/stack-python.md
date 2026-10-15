# 스택: Python

`pyproject.toml`, `uv.lock`, `requirements*.txt`가 있는 프로젝트를 구현할 때 연다.

## 현재 안정 버전 (확인일 2026-10-16)

| 도구 | 버전 | 근거 |
|---|---|---|
| CPython | 3.15.0 (2026-10-09, bugfix 단계). 3.14는 3.14.8(2026-10-01), 다음 3.14.9는 2026-12-01 예정. 3.10은 2026-10-01 지원 종료 | https://peps.python.org/pep-0790/ , https://www.python.org/downloads/ |
| uv | 0.13.1 (2026-10-14) | https://github.com/astral-sh/uv/releases |
| Ruff | 0.17.1 (2026-10-15), 린터와 포매터(`ruff format`) | https://github.com/astral-sh/ruff/releases |
| mypy | 2.4.0 (2026-10-01) | https://pypi.org/project/mypy/ |
| Pyright | 1.1.414 (PyPI 2026-09-10) | https://pypi.org/project/pyright/ |
| Pyrefly | 1.3.2 (2026-09-28), 1.0부터 stable | https://github.com/facebook/pyrefly |
| ty | 0.0.88 (2026-10-15), 아직 beta. 단독 게이트로 쓰지 않는다 | https://github.com/astral-sh/ty |
| pytest | 9.1.1 (2026-06-19) | https://pypi.org/project/pytest/ |
| Hypothesis | 6.169.4 (2026-10-15) | https://hypothesis.readthedocs.io/en/latest/changelog.html |

버전 고르기: 새 프로젝트는 의존성 전부가 3.15를 지원하면 3.15, 아니면 3.14로 시작한다. `pyproject.toml`의 `requires-python`과 `.python-version`을 함께 적는다. 3.10 이하에 머무른 프로젝트는 지원 종료 상태이므로 올리는 작업을 부채로 기록한다.

## 엄격 설정

- 타입 검사 하나를 고른다.
  - mypy: `--strict`(정의된 선택 검사 묶음을 켠다). `--warn-unreachable`은 `--strict`에 들어 있지 않으니 따로 켠다.
  - Pyright: `[tool.pyright]`에 `typeCheckingMode = "strict"`. 값은 `off`, `basic`, `standard`(기본), `strict`.
- Ruff 규칙은 최소 `E`, `F`, `I`, `B`, `UP`, `S`(보안), `SIM`, `RUF`를 켠다. `# noqa`와 `# type: ignore`에는 규칙 코드와 사유를 함께 적는다.
- CI: `ruff format --check`(바뀔 파일이 있으면 종료 코드 1), `ruff check`, 타입 검사, `pytest`.

## 패키지와 lockfile (uv)

- 의존성 추가: `uv add '<패키지>==<버전>'`. `uv.lock`을 커밋 대상에 올린다.
- CI 설치: `uv sync --locked`(lockfile이 최신이 아니면 고치지 않고 오류). 검사만 할 때는 `uv lock --check`.
- `--frozen`은 lockfile이 최신인지 확인하지 않으므로 CI 게이트로 쓰지 않는다.
- 근거: https://docs.astral.sh/uv/concepts/projects/sync/

## 테스트

- pytest: 픽스처로 준비를 나누고 `@pytest.mark.parametrize`로 표 형식 테스트를 쓴다.
- Hypothesis: 파서, 직렬화, 정렬, 금액 계산처럼 규칙이 있는 함수에 속성 테스트를 붙인다(예: "직렬화 후 다시 파싱하면 같은 값").
- 커버리지는 `--cov-fail-under`처럼 기준 미달이면 실패하는 설정으로 강제한다.
- 외부 HTTP, DB는 경계에서만 가짜로 바꾼다. 내부 함수를 `mock.patch`로 덮기 시작하면 설계를 의심한다.

## 관용구

- 경계 파싱: 요청 본문, 환경변수, 파일, 외부 API 응답은 들어오는 지점에서 스키마 모델(pydantic 같은 파서나 `dataclass`와 변환 함수)로 바꾼다. 안쪽 함수는 `dict[str, Any]`를 받지 않는다.
- 값 객체는 `@dataclass(frozen=True)`, 구분이 필요한 ID는 `typing.NewType`, 고정 선택지는 `enum.Enum`이나 `Literal`.
- 파일은 `open(path, encoding="utf-8")`처럼 인코딩을 명시한다. 3.15부터 기본이 UTF-8이지만 버전 사이 호환을 위해 공식 문서도 명시를 권한다.
- 3.14부터 주석(annotation)은 필요할 때 평가된다(PEP 649, 749). 앞선 참조에 문자열 따옴표가 필요 없다.
- 3.14의 t-string(PEP 750)은 정적 텍스트와 끼워 넣은 값을 나눠 주므로, SQL이나 HTML을 만들 때 f-string 대신 안전한 처리기와 함께 쓴다.
- 3.15의 `lazy import`(PEP 810)는 모듈 최상위에서만 쓸 수 있다. 시작 시간이 문제일 때만 쓴다.
- `print` 대신 `logging`. 비밀은 로그에 남기지 않는다.

## 자주 나는 실수

1. 가변 기본 인자(`def f(x=[])`). 고친다: `None`을 기본으로 두고 안에서 만든다.
2. `except:`나 `except Exception: pass`로 삼키기. 고친다: 구체적 예외를 잡고 처리하거나 맥락을 붙여 다시 던진다.
3. `assert`로 입력 검증. `python -O`에서 사라진다. 고친다: 명시적 검사와 예외.
4. 돈 계산에 `float`. 고친다: `decimal.Decimal`이나 최소 단위 정수.
5. 시간대 없는 `datetime`. 고친다: 시간대가 있는 값을 만들고 저장은 UTC.
6. `async` 함수 안의 블로킹 호출(동기 HTTP, `time.sleep`). 고친다: 비동기 클라이언트나 스레드로 넘기기.
7. 3.15로 올리며 생기는 차이: `__cached__` 제거(`__spec__.cached` 사용), `tarfile` 추출 동작 변경. 근거: https://docs.python.org/3.15/whatsnew/3.15.html

## 보안 메모

- SQL은 드라이버의 매개변수 바인딩만 쓴다. f-string으로 쿼리를 조립하지 않는다.
- `subprocess`에 `shell=True`와 사용자 입력을 함께 쓰지 않는다. 인자 목록을 넘긴다.
- 신뢰할 수 없는 데이터에 `pickle.loads`, `yaml.load`(안전 로더가 아닌 것), `eval`을 쓰지 않는다.
- 토큰과 비밀번호 재설정 코드는 `secrets` 모듈로 만든다. `random`은 보안용이 아니다.
- Ruff `S` 규칙 위반 0건을 합격선으로 둔다.
