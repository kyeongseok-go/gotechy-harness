# 하네스 v2 1b단계: 화면에서 결정하고, 오너만 결정할 수 있게

- 상태: **초안, 오너 검토 대기** (2026-10-14 밤샘 루프에서 작성. 오너가 범위와 순서를 승인하면 착수)
- 관련: [1a ExecPlan](2026-10-13-harness-v2-phase1.md), [스펙](../../product-specs/harness-v2.md), [계약](../../references/contract.md), [ADR 0005 결정 서명](../../decisions/0005-decision-signing.md), [밤샘 보고](../../references/evidence/2026-10-14-overnight/README.md)

## Purpose / Big Picture

1a가 끝나면 오너는 터미널에서 인박스를 보고 `gotechy decide`로 결정한다. 그런데 결정 서명은 같은 OS 사용자 안의 비밀 키라서, 오너와 같은 권한으로 도는 프로그램(예: 키 파일을 읽을 수 있는 Codex 워커)이 오너인 척 결정할 수 있다. 화면에서 바로 결정할 수도 없고, 밤새 맡겨 두는 무인 실행도 사람이 손으로 돌려야 한다.

1b가 끝나면 다음이 달라진다.

1. 결정에는 오너의 손가락(Touch ID)이 필요하다. 키는 맥의 보안 칩(Secure Enclave)에 있고 파일로 꺼낼 수 없어서, 워커가 키를 읽는 일이 원천적으로 없어진다.
2. 오너는 HTML 화면에서 선택지를 누르고 다음 지시를 적어 바로 결정한다. 화면 제출부터 다음 작업 시작까지 사람 손이 더 필요 없다(스펙 지표).
3. 오늘 밤 사람이 손으로 돌린 밤샘 루프를 `gotechy loop`가 예산과 멈춤 규칙을 지키며 돌리고, 아침 보고서를 만든다.
4. 배포, force push, 외부 발행 같은 부작용 명령은 승인 게이트 없이는 실행되지 않는다.

범위 밖(2단계): harness-bench 실측과 라우팅 보정, radar와 train 자동 갱신, 기존 스킬 이관과 문서 다이어트, 리눅스 샌드박스(TD-009).

## Progress

> 시각은 해당 커밋 시각(KST) 기준.

- [x] (2026-10-14) 초안 작성 (밤샘 루프, 오너 부재)
- [ ] 오너 검토와 범위 승인
- [ ] N0 전제 확인 (실험)
- [ ] N1 오너 인증 관통: Secure Enclave 서명과 Touch ID
- [ ] N2 화면에서 결정: `gotechy serve`
- [ ] N3 무인 루프: `gotechy loop`와 아침 보고서
- [ ] N4 부작용 가드, Claude Code mod, Codex hook
- [ ] N5 Orca 어댑터와 라우팅
- [ ] N6 교차 검증 감사관, 화면 시안 비교
- [ ] 1a에서 넘어온 부채 정리 (TD-006, TD-007, TD-008)
- [ ] 보안 리뷰, 완료 게이트

## Surprises & Discoveries

(진행하며 채운다. 1a 밤샘 루프의 발견은 1a ExecPlan에 있다.)

## Decision Log

| 결정 | 근거 | 날짜 | ADR 승격 |
|---|---|---|---|
| 1b의 첫 마일스톤은 오너 인증이다 | 1a 보안 감사의 남은 한계(같은 사용자 자가 승인, Codex 키 읽기, 장부 무서명, TTY 우회)가 모두 "키가 파일이다"에서 나온다 | 2026-10-14 | ADR 0005 대체 예정 |

## Outcomes & Retrospective

(완료 시 작성)

## Context and Orientation

- 결정의 현재 구조: `src/core/gate.ts`(서명 대상과 판정), `src/runtime/gates.ts`(게이트 열기, decide, 필요한 게이트 계산), `src/runtime/keys.ts`(파일 키). 계약은 `docs/references/contract.md` 6절과 9절.
- 화면: `src/core/view/pages.tsx`(읽기 전용, CSP로 스크립트와 form 금지). 1b의 결정 화면은 이 렌더러를 그대로 쓰되 serve 모드에서만 form을 허용한다.
- 워커 격리: worktree, 보호 경로 되돌리기, 심볼릭 링크 거부, verify 샌드박스(`src/runtime/sandbox.ts`).
- 오늘 밤의 수동 루프 설계: `docs/exec-plans/active/2026-10-14-overnight-loop.md`. N3는 이것을 코드로 옮긴다.
- 처음 보는 용어
  - Secure Enclave: 맥의 보안 칩이에요. 안에서 만든 개인 키는 밖으로 꺼낼 수 없고, 서명할 때 Touch ID 같은 사용자 확인을 요구하게 할 수 있어요.
  - user presence: "지금 사람이 기기 앞에 있다"는 확인이에요. Touch ID나 암호 입력으로 증명해요.
  - CSRF: 다른 웹 페이지가 사용자 몰래 내 로컬 서버에 요청을 보내게 만드는 공격이에요.

## Plan of Work

### N0 전제 확인 (반나절, 실험)

- goal: 1b가 기대는 외부 동작을 먼저 확인한다(테스트 규칙: 외부 경계는 실험 후 고정).
- work:
  1. Secure Enclave에 user presence가 필요한 P-256 키를 만들고 서명하는 작은 Swift 도구가 이 맥에서 빌드되고, 서명마다 Touch ID를 요구하는지. 키를 파일로 꺼낼 수 없는지.
  2. 그 서명을 Bun의 `crypto.verify`(ECDSA P-256)로 검증할 수 있는지.
  3. 127.0.0.1 로컬 서버에서 Touch ID 대화상자를 띄울 수 있는지(브라우저 제출 뒤 서버가 Swift 도구를 부름).
  4. Orca `worker_done --report-path`, `claude agents --json`, Claude Code mod API, 폰 푸시 경로.
- result: 실험 결과를 Surprises에 기록하고, 안 되는 것은 대안을 고른다.
- proof: 실험 로그를 Artifacts에.

### N1 오너 인증 관통

- goal: `gotechy decide`가 Touch ID 없이는 결정을 기록하지 못한다.
- work: 서명을 HMAC에서 Secure Enclave ECDSA로 바꾼다. 공개키는 `$GOTECHY_HOME/owner.pub`와 프로젝트 `orchestration/owner.pub`(지문 고정). 결정 장부 줄마다 서명한다. `keys rotate`는 새 키 쌍. 1a의 HMAC 결정은 마이그레이션 명령으로 한 번에 다시 서명하거나 superseded 처리.
- result: 키가 파일로 존재하지 않으므로 워커가 읽을 키가 없다. TTY 검사 우회(`script`)로도 Touch ID 없이는 결정이 나오지 않는다.
- proof: Validation 1~3.

### N2 화면에서 결정 (`gotechy serve`)

- goal: HTML 화면에서 선택지를 누르면 결정이 서명되고 다음 작업이 시작된다.
- work: 127.0.0.1의 임의 포트, 실행마다 바뀌는 일회용 토큰, Host와 Origin 검사, CSRF 토큰, CSP는 `form-action 'self'`만 추가. 제출하면 같은 decide 경로(이해 문항 포함)를 지나고 Touch ID를 요구한다. 결정 뒤 `run`을 이어서 부를지는 작업의 `autonomy`로 정한다.
- result: 스펙 지표 "화면 제출부터 다음 작업 시작까지 사람 손 없음".
- proof: Validation 4~6.

### N3 무인 루프 (`gotechy loop`)

- goal: 오늘 밤 사람이 돌린 루프를 명령 하나로 돌린다.
- work: 대기열(작업 명세 목록), 작업마다 run, verify, lint, 같은 실패 2회 시 그 작업만 정지, 밤 예산(달러) 상한, 결정이 필요하면 그 작업만 대기, 아침 보고서(인박스 카드와 HANDOFF 묶음)를 `.gotechy/digest/`에 생성. 부작용 명령은 하지 않는다.
- result: 자리 비움, 야간 모드(D14)가 동작한다.
- proof: Validation 7, 8.

### N4 부작용 가드, mod, hook

- goal: 배포, force push, 외부 발행, 위키 적재는 승인 게이트 없이 실행되지 않는다. 결정이 생기면 오너에게 알린다.
- work: 리드 에이전트 설정에 deny 규칙(`gotechy decide`, `script`, `expect`, `git push --force` 등, TD-008). Claude Code mod: 상태 줄의 대기 결정 수, 결정 대기 띠, 토스트와 폰 푸시, 저장 직후 HANDOFF lint. Codex hook은 같은 lint와 가드.
- proof: Validation 9, 10.

### N5 Orca 어댑터와 라우팅

- goal: Orca를 주력 어댑터로 붙이되(D7), Orca가 없어도 native로 끝까지 돈다.
- work: Orca 작업 생성과 `worker_done` 보고를 파일 계약으로 옮기는 어댑터, 작업 경계 라우팅과 라우팅 canary(D12).
- proof: Validation 11.

### N6 교차 검증 감사관, 화면 시안

- goal: 작성 모델과 다른 계열 모델이 HANDOFF를 실제 diff와 테스트 로그에 대조해 "요약과 실제가 다른 곳"을 지적한다. HANDOFF 화면 시안 2~3안을 비교해 하나를 고른다.
- proof: Validation 12, 13.

## Concrete Steps

(N0 실험 뒤 확정한다. 1a처럼 명령과 예상 출력을 적는다.)

## Validation and Acceptance

1. Touch ID를 취소하면 `gotechy decide`가 아무것도 기록하지 않고 exit 1이다.
2. 키 파일이 디스크에 없다(`$GOTECHY_HOME` 아래에 개인 키가 없음을 테스트로 확인). 워커 샌드박스에서 서명을 시도하면 실패한다.
3. 결정 장부의 줄을 손으로 더하거나 바꾸면 `gate verify`가 실패한다.
4. `gotechy serve`의 화면에서 선택하고 제출하면 게이트가 서명되고 `gate verify`가 ok다.
5. 토큰 없는 요청, 다른 Origin의 요청, 다른 Host 헤더의 요청은 거부된다(자동 테스트).
6. 화면 제출 뒤 `autonomy`가 허용하는 작업은 사람 손 없이 다음 run이 시작된다.
7. `gotechy loop`가 같은 실패 2회에서 그 작업만 멈추고 다른 작업은 계속한다. 예산을 넘으면 새 작업을 시작하지 않는다.
8. 루프가 끝나면 아침 보고서가 생기고, 그 안의 HANDOFF가 모두 lint를 통과한다.
9. 리드 에이전트가 `gotechy decide`나 `git push --force`를 실행하려 하면 가드가 막는다.
10. 결정이 열리면 mod 상태 줄의 대기 수가 바뀐다(수동 확인 1회 스크린샷).
11. Orca가 없는 환경에서 같은 작업이 native로 끝까지 돈다. Orca가 있으면 Orca로 돈다.
12. 요약과 diff가 다른 HANDOFF fixture에서 감사관이 file:line 근거와 함께 지적한다.
13. 화면 시안 비교 결과와 고른 이유가 Decision Log에 있다.

## Idempotence and Recovery

- 키를 새로 만들어도 이전 결정은 superseded나 재서명 대상으로 남고 지워지지 않는다.
- `gotechy loop`는 중단 뒤 다시 실행하면 대기열의 남은 작업부터 이어 간다.

## Artifacts and Notes

(진행하며 채운다.)

## Interfaces and Dependencies

- 새 명령: `gotechy serve`, `gotechy loop`, `gotechy keys migrate`.
- 새 외부 의존(N0에서 확인): Swift 도구(Xcode Command Line Tools), macOS LocalAuthentication과 CryptoKit.

## 1a에서 넘어온 것

- 알려진 한계(contract.md 6.3절): 같은 사용자 자가 승인, Codex 키 읽기, 장부 무서명, TTY 우회, project.yaml 복사, 무시 파일.
- 부채: TD-006(병합 충돌 뒤 다시 하기), TD-007(무시 파일 검사), TD-008(리드 deny 규칙).

## career_signals

```yaml
career_signals:
  hypothesis:
    capabilities:
      - 하드웨어 보안 칩과 생체 인증으로 Human-in-the-loop 결정을 사람만 내릴 수 있게 설계
      - 로컬 결정 서버의 웹 보안(CSRF, Origin, CSP) 설계와 자동 검증
      - 예산과 멈춤 규칙이 있는 무인 에이전트 루프
    jd_keywords_matched: [AI 에이전트, Human-in-the-loop, 보안, 에이전트 오케스트레이션, 자동화 파이프라인]
  evidence:
    links: []
    metrics: []
    story: ""
```
