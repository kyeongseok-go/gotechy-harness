---
name: gotechy-ship
description: |
  완료 게이트 검사. 사용자가 "이제 끝났어?", "완료 처리해줘", "ship", "머지하자", "출시 점검"이라고 하거나
  ExecPlan의 작업이 끝났다고 판단될 때 사용한다. QUALITY_BAR 검증, 문서 동기화, 부채 기록,
  3종 출력(제품·커리어·콘텐츠) 확인까지 통과해야 완료로 인정한다. 50% 마무리 증후군의 최종 방어선.
argument-hint: "[ExecPlan 파일명 (생략 시 active에서 탐색)]"
---

# /gotechy-ship — 완료 게이트

"대충 끝"을 "증명된 완료"로 바꾸는 게이트. 아래 순서로 검사하고, **하나라도 실패하면 완료 선언을 거부**하고 남은 작업 목록을 보고한다.

**대원칙: 명령 부재 = 게이트 실패(스킵 아님).** `npm test`가 "missing script"로 실패하면 "해당 없음"으로 자기합리화하지 말고 게이트 실패로 보고한다.

## 게이트 검사 순서

### 0. 하네스 무결성
- `bash scripts/init.sh` 실행 — "(교체)" 마커 잔존, 시크릿 규약, hook 스모크 테스트 통과 확인.

### 1. 동작 증명
- ExecPlan의 Validation and Acceptance 각 항목을 **실제로 실행**하고 출력을 기록한다.
- `npm test` 전체 실행 — 실패·skip 사유 확인. 실패를 숨기고 통과 처리하는 것은 금지.
- 커버리지 리포트의 **수치를 게이트 출력에 그대로 첨부**한다 (QUALITY_BAR 기준: Service 80%+, 핵심 모듈 95%).
- `npm run check:boundaries` — 레이어 위반 0건.

### 2. 품질 bar (docs/QUALITY_BAR.md)
- 이번 작업이 건드린 영역의 체크리스트를 훑고 미달 항목을 나열한다.
- QUALITY_SCORE 표에서 **건드린 영역만** 루브릭(A/B/C/D 판정 기준)에 따라 갱신한다. 등급 하락도 정직하게.

### 3. 문서 동기화
- 스펙과 실제 동작이 어긋나면 스펙 갱신 + 변경 이력 기록 (상태 → 출시됨).
- 구조가 바뀌었으면 ARCHITECTURE.md 갱신, 승격할 결정은 ADR 생성.
- `npm run gen:docs` 실행 후 `git diff docs/generated/`가 **비어 있는지 확인** (판단이 아니라 명령).

### 4. 부채 기록
- 남긴 부채를 `docs/exec-plans/tech-debt-tracker.md`에 ID·심각도·이자와 함께 등록한다.

### 5. 3종 출력 변환 (gotechy 고유)
- **커리어**: career_signals의 `evidence`에 **제3자가 확인 가능한 링크/수치가 1개 이상** 있는가 (`docs/career.yaml`의 evidence_types 기준). 역량명 나열만 있으면 **미통과**.
- **콘텐츠**: Surprises & Discoveries에서 블로그 소재 1줄 이상을 추출해 Outcomes에 **기록**한다. (콘텐츠 생성 자체는 `/gotechy-launch`가 유일한 진입점 — 여기서 실행하지 않는다.)
- **위키**: Gotechy-Wiki ingest 대상 산출물(스펙·회고)을 안내한다.

### 6. AI 기능 게이트 (해당 시 — docs/AI_PLAYBOOK.md §6)
- 오프라인 eval 셋(`docs/evals/*.golden.jsonl`, 최소 20케이스) 존재 + `npm run eval` 통과.
- 프롬프트가 `prompts/`에 버전 관리됨, LLM 호출 전부에 스키마 검증 + 폴백.

### 7. 이동과 환류
- Outcomes & Retrospective 작성 확인 후 ExecPlan을 `completed/`로 이동한다.
- **회고에서 하네스 개선 항목을 추출**해 tech-debt-tracker 또는 새 design-doc으로 라우팅한다 (예외가 반복되면 하네스의 결함이다 — core-beliefs #1).
- 출시 2주 후 성공 기준 측정 항목을 tech-debt-tracker에 후속 등록한다.

## 보고 형식

통과: "✅ 완료 게이트 통과" + 증거 요약(테스트·커버리지 수치 포함) + 3종 출력 상태.
실패: "⛔ 게이트 미통과" + 미달 항목별 남은 작업(추정 시간) — 여기서 멈추지 말고 이어서 처리할지 사용자에게 묻는다.
