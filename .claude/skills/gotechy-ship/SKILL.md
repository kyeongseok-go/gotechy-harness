---
name: gotechy-ship
description: |
  완료 게이트 검사. 사용자가 "이제 끝났어?", "완료 처리해줘", "ship", "머지하자", "출시 점검"이라고 하거나
  ExecPlan의 작업이 끝났다고 판단될 때 사용한다. 작업 크기에 맞는 등급(패치/기능/릴리스)으로
  동작 증명·품질·문서·부채·3종 출력을 검사한다. 50% 마무리 증후군의 최종 방어선.
argument-hint: "[ExecPlan 파일명 또는 --patch|--feature|--release]"
---

# /gotechy-ship — 완료 게이트

"대충 끝"을 "증명된 완료"로 바꾸는 게이트.

**대원칙 2가지**
1. **명령 부재 = 게이트 실패(스킵 아님).** `npm test`가 "missing script"로 실패하면 "해당 없음"으로 자기합리화하지 말고 실패로 보고한다.
2. **부분 점수를 보고한다.** "⛔ 미통과"만 던지면 사람은 다음부터 게이트를 부르지 않는다. 항상 "N개 중 M개 통과, 남은 것 X" 형태로 보고한다.

## 0. 등급 판정 (먼저 정한다)

| 등급 | 대상 | 검사 범위 |
|---|---|---|
| **패치** | 1시간 미만, 파일 1~2개, 동작 계약 불변 (오타·버그픽스·문구) | 1·2·4단계만 |
| **기능** | 스펙이 있는 작업, ExecPlan 동반 | 1~5단계 (+AI 기능이면 6) |
| **릴리스** | 배포·공개·버전 태깅 | 전 단계 + `docs/DEPLOYMENT.md` 배포 전 체크 |

인자로 `--patch|--feature|--release`가 오면 그대로. 없으면 변경 규모로 판정하고 **어느 등급으로 검사하는지 먼저 알린다**. 애매하면 높은 쪽.

## 검사 단계

### 1. 동작 증명 *(전 등급)*
- 변경과 관련된 테스트를 **실제로 실행**하고 출력을 기록한다. 기능·릴리스는 `npm test` 전체.
- ExecPlan이 있으면 Validation and Acceptance 각 항목을 실행하고 결과를 남긴다.
- 기능·릴리스: 커버리지 리포트 **수치를 출력에 첨부**(QUALITY_BAR 기준), `npm run check:boundaries` 레이어 위반 0건.

### 2. 하네스 무결성 *(전 등급)*
- `bash scripts/init.sh` — 교체 마커·시크릿 규약·hook 스모크·CLAUDE.md 브리지.
- 실패 항목은 등급과 무관하게 보고한다 (하네스가 깨진 채로 완료는 없다).

### 3. 문서 동기화 *(기능·릴리스)*
- 스펙과 실제 동작이 어긋나면 스펙 갱신 + 변경 이력 기록 (상태 → 출시됨).
- 구조가 바뀌었으면 ARCHITECTURE.md 갱신, 승격할 결정은 ADR 생성.
- `npm run gen:docs` 실행 후 `git status --porcelain docs/generated/`가 **비어 있는지 확인** (판단이 아니라 명령. diff는 새로 생긴 파일을 못 잡는다).
- 스펙·설계 문서의 미결 마커 검사: `grep -rn "NEEDS CLARIFICATION\|SYNC NEEDED" docs/product-specs/` 가 비어야 통과 (위저드 산출물의 미확정·미전파 상태 감지 — docs/WIZARD.md).
- **doc-gardener**에게 이번 작업이 건드린 범위의 문서 드리프트를 검증시킨다 (스코프 한정).

### 4. 부채 기록 *(전 등급)*
- 남긴 부채를 `docs/exec-plans/tech-debt-tracker.md`에 ID·심각도·이자와 함께 등록한다.
- 패치 등급에서 이것만은 면제되지 않는다 — 기록 없는 부채가 가장 비싸다.

### 5. 품질·3종 출력 *(기능·릴리스)*
- **품질 목표 판정**: `15-quality-goals.md`(또는 quality-goals-*.md)가 있으면 — 미판정 목표·불합격 목표·`[NEEDS CLARIFICATION]` 잔존 시 미통과. 재측정은 `/gotechy-quality --verify`.
- QUALITY_SCORE 표에서 **이번 작업이 건드린 영역만** 루브릭(A/B/C/D)에 따라 갱신. 등급 하락도 정직하게.
- **커리어**: career_signals의 `evidence`에 제3자가 확인 가능한 링크/수치가 1개 이상 있는가 (기준: `~/.claude/gotechy-career.yaml`의 evidence_types). 역량명 나열만 있으면 미통과.
- **콘텐츠**: Surprises & Discoveries에서 블로그 소재 1줄 이상을 Outcomes에 **기록**한다. (생성 자체는 `/gotechy-launch`가 유일한 진입점 — 여기서 실행하지 않는다.)
- **위키**: Gotechy-Wiki ingest 대상 산출물을 안내한다.

### 6. AI 기능 게이트 *(해당 시 — docs/AI_PLAYBOOK.md §6)*
- 오프라인 eval 셋(`docs/evals/*.golden.jsonl`, 최소 20케이스) + `npm run eval` 통과.
- 프롬프트가 `prompts/`에 버전 관리됨, LLM 호출 전부에 스키마 검증 + 폴백.

### 7. 이동과 환류 *(기능·릴리스)*
- Outcomes & Retrospective 작성 확인 후 ExecPlan을 `completed/`로 이동.
- **회고에서 하네스 개선 항목을 추출**해 tech-debt-tracker 또는 design-doc으로 라우팅 (예외가 반복되면 하네스의 결함이다 — core-beliefs #1).
- 출시 2주 후 성공 기준 측정 항목을 tech-debt-tracker에 후속 등록.

## 보고 형식

```
[등급: 기능] 게이트 5개 중 4개 통과
✅ 1 동작 증명 — npm test 42 passed, 커버리지 83%
✅ 2 하네스 무결성 — init.sh 통과
⛔ 3 문서 동기화 — ARCHITECTURE.md 디렉터리 지도가 실제와 불일치 (예상 10분)
✅ 4 부채 기록 — TD-004 등록
✅ 5 품질·3종 출력 — evidence: PR #12 링크
→ 남은 것 1개. 지금 이어서 처리할까요?
```

통과 시 "✅ 완료 게이트 통과 [등급]" + 증거 요약. 미통과 시 멈추지 말고 이어서 처리할지 묻는다.
