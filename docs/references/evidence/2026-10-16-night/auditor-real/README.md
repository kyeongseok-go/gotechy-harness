---
title: 감사관 실제 실행 1회 (claude, 2026-10-16 00:39)
date: 2026-10-16
status: 실측
---

# 감사관 실제 실행 1회

오너가 T-007의 추천안("claude 감사관 한 번, 비용 상한 0.5달러")을 골라서 한 번 돌렸어요. 1b Validation 12(요약과 diff가 다른 HANDOFF에서 감사관이 file:line 근거와 함께 지적)를 실제 모델로 확인한 첫 기록이에요.

## 결과

| 항목 | 값 |
|---|---|
| 감사관 | claude(`--restricted --permission-mode plan`, 쓰기 거부), 모델 claude-opus-5-5(원문 로그의 modelUsage) |
| 비용 | 0.128471달러(상한 0.5달러) |
| 걸린 시간 | 20초(00:39:07부터 00:39:27까지) |
| 지적 | 6건, 리드가 작업 브랜치에서 file:line을 확인한 지적 6건 |
| 일부러 심은 불일치 3건 | 3건 모두 찾음(아래 표의 1~3) |

| 번호 | 감사관 지적 | 근거 | 리드 판정 |
|---|---|---|---|
| 1 | "연도 없는 날짜는 시행일의 해"라고 했지만 코드는 실행한 날의 해를 쓴다 | `src/deadline.ts:16` | 맞음(심은 것) |
| 2 | "시각이 없으면 18시"라고 했지만 코드는 23:59를 돌려준다 | `src/deadline.ts:25` | 맞음(심은 것) |
| 3 | 연도 없는 날짜와 시각 없는 경우의 테스트가 없다 | `tests/deadline.test.ts:4` | 맞음(심은 것) |
| 4 | 증거의 "2 pass"를 뒷받침하는 검증 출력이 없다 | HANDOFF 42행 | 맞음. 리드 verify는 파일과 함수 이름만 본다 |
| 5 | verify 명령이 동작을 확인하지 못해 [확인] 주장을 검증하지 못한다 | HANDOFF 21행 | 맞음. 작업 명세의 verify가 약하다는 지적 |
| 6 | "표 안의 날짜는 읽지 않는다"의 [확인]을 뒷받침할 근거가 없다 | HANDOFF 45행 | 반쯤 맞음. 하지 않은 일을 적은 항목이라 [확인]이 틀린 건 아니다 |

## 어떻게 돌렸나

1. 임시 폴더에 프로젝트를 만들고 `GOTECHY_HOME`을 임시 폴더로 둔 채 `gotechy init --packs ""`(실제 `~/.gotechy`는 건드리지 않음).
2. `gotechy task new "공문 마감일 추출" --verify "test -f src/deadline.ts && grep -q findDeadline src/deadline.ts" --ownership "src/deadline.ts,tests/deadline.test.ts"`.
3. `gotechy run T-001 --adapter fake --fixture <worker-fixture>`: 녹화 워커가 `worker-fixture/`의 파일과 HANDOFF를 남긴다. 저장소에는 테스트 실행기가 집어 가지 않게 테스트 파일을 `.txt`로 두었고, 실행할 때 이름을 되돌렸다.
4. `gotechy audit T-001 --adapter claude --budget 0.5`.
5. `gotechy render T-001`로 HANDOFF 화면을 만들고 폰(375px)과 넓은 화면(1280px)을 찍었다: `handoff-phone.png`, `handoff-desktop.png`. 지적 1~3은 한 일 항목 아래에, 4~6은 "감사관이 본 것" 절에 붙었다.

`audit-record-T-001.md`는 감사 기록 원본이에요(로컬 경로 없음). 감사관 원문 로그는 임시 폴더에만 두고 저장소에 넣지 않았어요.

## 이번 실행으로 고친 것

- 기록의 `auditor.model`이 비어 있었어요. 모델을 주지 않으면 오너의 claude 기본 모델로 도는데, 그 이름을 남기지 않았어요. 이제 claude 출력의 modelUsage에서 읽어 남겨요(`claudeResultModel`, `tests/core/audit.test.ts`).

## 한계

- 한 번, 리드가 만든 쉬운 예시 하나예요. 심은 불일치가 코드에 그대로 보이는 종류라, 미묘한 불일치를 얼마나 잡는지는 이 기록으로 말할 수 없어요.
- 작성자가 녹화 워커(fake)라 "다른 계열 모델" 효과를 잰 것은 아니에요.
- 같은 입력으로 여러 번 돌려 흔들림을 보지 않았어요(유료).
