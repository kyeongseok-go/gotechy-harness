# 하네스 v2 2단계: 첫 실전 프로젝트로 검증하고, 효과를 재고, 최신으로 유지하기

- 상태: **초안, 오너 검토 전** (2026-10-16 밤샘 마무리 루프에서 작성)
- 관련: [1b ExecPlan](../completed/2026-10-14-harness-v2-phase1b.md), [스펙](../../product-specs/harness-v2.md), [판정표](../../product-specs/harness-v2-rubric.md), [계약](../../references/contract.md)

## Purpose / Big Picture

1단계(1a, 1b)로 맡기기, 이해하기, 결정하기, 같은 환경, 분야별 전문가 팩까지 갖췄다. 2단계는 세 가지를 한다.

1. **첫 실전 프로젝트로 검증한다.** 오너가 만들고 싶은 제품(2026-10-16에 공문서보다 먼저 하기로 함)을 하네스로 진행하며, 스펙의 실사용 지표(결정당 3분, 이해 게이트 적중률)를 잰다.
2. **잰다.** 전문가 팩의 평가 케이스를 실제로 돌려 스킬마다 기여도(스킬 있음과 없음의 차이)를 재고, harness-bench로 하네스 켬과 끔을 비교한다.
3. **최신으로 유지한다.** 팩마다 적어 둔 출처(`radar/sources/`)를 주기적으로 보고, 바뀐 사실은 eval을 통과할 때 자동 반영, 일하는 방법(SKILL.md 본문) 변경은 오너 결정으로 올린다(D6).

## Progress

- [ ] 오너 검토와 범위 승인
- [ ] P1 첫 실전 프로젝트 시작(오너의 새 제품, `docs/GETTING_STARTED.md` 순서)
- [ ] P2 실사용 지표 수집(TD-018): 결정 10건의 `active_seconds`와 이해 게이트 적중률
- [ ] P3 팩 평가 실측: `claude plugin eval`로 스킬마다 케이스 실행(유료, 예산 상한 오너 승인), 기여도 기준선 기록
- [x] (2026-10-16 01:15, 밤샘 마무리 루프에서 먼저 함) P4 radar: `gotechy radar`가 `radar/sources/*.yaml`을 읽어 GitHub 릴리스(`releases/latest` 리다이렉트), RSS, 페이지 변경을 보고서로(무료, 읽기만). 커밋 768aa94, 실측 `docs/references/evidence/2026-10-16-night/radar/`
- [ ] P5 delta PR: 바뀐 출처가 덮는 `references/` 파일만 고치는 PR 초안, eval 통과 시 머지 후보, 본문 변경은 인박스 결정
- [ ] P6 harness-bench 켬과 끔 비교(유료)
- [ ] P7 1b에서 넘어온 것: Claude Code mod(결정 대기 띠, 토스트), 폰 알림 방식(오너 결정), Orca 화면 연결(ADR 0007, Orca 브라우저가 `file://`를 여는지 실험 먼저), 상태 줄 화면 확인
- [ ] P8 부채: TD-007, TD-009(리눅스 샌드박스), TD-015, TD-019 나머지, TD-021, TD-024(유료 실험), TD-025(홈 전체 막기, 실험 먼저), TD-026, TD-027, TD-028, TD-029 나머지, TD-003과 TD-005(문서 다이어트, 문체)

## Surprises & Discoveries

(진행하며 채운다)

## Decision Log

| 결정 | 근거 | 날짜 | ADR 승격 |
|---|---|---|---|
| 첫 실전 프로젝트는 공문서가 아니라 오너가 정할 새 제품 | 오너 지시(2026-10-16) | 2026-10-16 | - |

## Outcomes & Retrospective

(완료 시 작성)

## Context and Orientation

- 팩 구조와 설치: `docs/references/contract.md` 10.7절, 10.8절. 팩 목록은 `src/core/packs.ts`.
- 평가 케이스 형식: Claude Code `claude plugin eval`(https://code.claude.com/docs/en/plugin-evals.md). 케이스는 `evals/<스킬>/<케이스>/`.
- 최신화 출처: `radar/sources/<스킬>.yaml`(`id`, `title`, `version`, `url`, `trust`, `watch`, `feed`, `cadence`, `covers`).

## Plan of Work

P1과 P2를 먼저 한다. 실제로 써 봐야 무엇을 재고 고칠지 정할 수 있다(하네스 만들기가 일이 되는 함정, 설계 문서 11절). P3과 P6은 유료라 예산을 오너가 정한 뒤에 한다. P4는 무료라 P1과 나란히 할 수 있다.

## Validation and Acceptance

1. 첫 실전 프로젝트의 ExecPlan, HANDOFF, 게이트 파일이 그 프로젝트 저장소에 있다.
2. 결정 10건의 중앙값이 3분 이하이고 이해 게이트 핵심어 적중률이 60% 이상이다(못 미치면 그대로 기록하고 원인을 고친다).
3. 스킬마다 평가 결과(점수, 기여도, 비용)가 기록돼 있다. 기여도가 0 이하인 스킬은 고치거나 은퇴 후보로 올린다.
4. `gotechy radar`가 15개 스킬의 출처를 읽어 바뀐 것과 못 읽은 것을 보고서로 남긴다(테스트는 가짜 피드로).
5. harness-bench 켬과 끔의 통과율과 완료당 비용이 기록돼 있다. 하네스가 손해인 구간도 그대로 남긴다.

## Idempotence and Recovery

- radar는 읽기만 하고, 보고서는 날짜별 한 파일이다(같은 날 다시 돌리면 덮어쓴다). 상태는 `.gotechy/radar/state.json`.
- 평가 실행은 결과 폴더를 실행마다 새로 만든다.

## Interfaces and Dependencies

- 외부: `claude plugin eval`(Claude Code 2.1.269 이상), GitHub 릴리스 웹 주소의 리다이렉트와 RSS(인증 없이).
