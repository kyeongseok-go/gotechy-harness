# viewer — 하네스 문서 뷰어 빌더

하네스의 문서 전체를 **단일 HTML 뷰어**(좌측 목차 + 전문 검색)로 묶는다.
다른 기기에서 읽기 위해 Claude 아티팩트로 게시하는 용도 (읽기 전용).

```bash
python3 scripts/viewer/build_viewer.py                 # 수집·마크다운 변환 → /tmp/viewer_data.json
python3 scripts/viewer/build_html.py ~/harness-docs.html
```

- 문서를 추가했으면 `build_viewer.py`의 `GROUPS`에 경로를 등록한다. 빠진 파일은 실행 시 **미분류**로 보고된다.
- 환경변수: `HARNESS_ROOT`(기본 `~/gotechy-harness`), `VIEWER_DATA`(중간 JSON), `HARNESS_VERSION`(헤더 표기 — 기본은 최근 커밋 제목에서 추출).
- 게시는 **기존 아티팩트 URL에 재게시**해야 링크가 유지된다 (URL은 memory `harness-workflow` 참조).
- 마크다운 변환기는 외부 의존성 없는 자체 구현 (heading·표·코드펜스·체크박스·인용·HTML 주석 지원).
