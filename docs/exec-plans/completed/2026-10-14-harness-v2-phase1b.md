# 하네스 v2 1b단계: 화면에서 결정하고, 오너만 결정할 수 있게

- 상태: **완료(2026-10-16, 리드 판정, 오너 확인 전)**. N4 나머지와 N5는 2단계로 이관. (2026-10-14 밤샘 루프에서 작성, 2026-10-14 13:05 오너가 범위와 순서를 승인)
- 관련: [1a ExecPlan](../completed/2026-10-13-harness-v2-phase1.md), [스펙](../../product-specs/harness-v2.md), [계약](../../references/contract.md), [ADR 0005 결정 서명](../../decisions/0005-decision-signing.md), [밤샘 보고](../../references/evidence/2026-10-14-overnight/README.md)

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
- [x] (2026-10-14 13:05) 오너 검토와 범위 승인 (밤샘 보고 T-007)
- [x] (2026-10-14 18:33) N0 전제 확인 (실험). Touch ID를 실제로 통과시키는 확인과 Claude Code 확장 경로 일부는 오너 확인으로 남김
- [x] (2026-10-14 18:55) N1 오너 인증 관통 중 Touch ID 없이 할 수 있는 부분: 계약 6.3, 6.4절, `native/ownerkey.swift`, 오너 키 관리(`keys init`, `keys rotate`), ECDSA 검증, 서명된 결정 장부, 테스트용 가짜 서명 도구, 실제 Swift 도구 테스트, ADR 0006(제안)
- [x] (2026-10-15 13:51) N1 마무리 중 오너의 실제 기기 확인: 확인 창(이 맥은 로그인 암호), 결정마다 한 번, 확인 코드, 첫 decide의 키 고정, 거절 시 기록 없음. 확인 창의 취소 버튼은 실기기에서 누르지 않음(ADR 0006 실측 절)
- [x] (2026-10-16 00:07) ADR 0006 승인. 오너가 T-007 추천안("암호 확인으로 승인")을 골랐다. 이 맥의 확인은 맥 로그인 암호, 약한 점은 TD-023
- [x] (2026-10-15 밤샘 E5) 프로젝트 공개 키 고정(TD-013)과 장부 끝 기록(TD-014), `gotechy keys pin`. 수용 테스트 15개(`tests/e2e/pin-ledger.test.ts`) [확인]
- [x] (2026-10-15, 밤샘 루프 2) N2 화면에서 결정: `gotechy serve`. 감사 8차(높음 0, 중간 5, 낮음 7) 모두 반영. 실제 헤드리스 Chrome으로 결정 흐름 실측. 실제 Touch ID로 화면 결정은 오너 확인으로 남김(Touch ID 확인 스크립트 마지막 단계)
- [x] (2026-10-15, 밤샘 루프 2) N3 무인 루프: `gotechy loop`와 아침 보고서. 감사 9차(높음 0, 중간 5, 낮음 5) 반영. 실제 워커로 밤새 돌리는 실측은 오너 확인으로 남김(유료)
- [x] (2026-10-15, 밤샘 루프 2) N4 중 부작용 가드(`gotechy guard`, TD-008)와 상태 줄(`gotechy status --line`). 감사 10차(높음 0, 중간 6, 낮음 8) 반영
- [x] (2026-10-15 오후 루프) N4 중 Codex hook: `gotechy init`이 `.codex/hooks.json`에 같은 가드를 깐다(공식 문서로 형식 확인, Codex 입력으로 가드 테스트). 실제 Codex 세션에서 막히는지는 오너가 `/hooks` 승인 뒤 확인
- [ ] N4 나머지: Claude Code mod(결정 대기 띠, 토스트), 폰 알림(오너 결정), 상태 줄 화면 확인(Validation 10, 오너). **2단계로 이관**(2026-10-16, 2단계 ExecPlan P7). mod는 API 실험이 먼저고, 폰 알림은 직접 보낼 공식 방법이 없어 오너 결정이 필요하다(N0)
- [ ] N5 Orca 화면 연결(범위 축소: 2026-10-16 오너가 "Orca는 화면과 알림에만"을 골라 워커 어댑터는 만들지 않는다, ADR 0007). **2단계로 이관**(P7): Orca 내장 브라우저가 `file://` 화면을 여는지 실험이 먼저다. 지금도 `gotechy render`의 주소를 Orca 탭에 붙여 넣으면 된다
- [x] (2026-10-15 오후 루프) N6 중 교차 검증 감사관 `gotechy audit`(contract.md 13절). 녹화 재생으로 Validation 12 자동 테스트. 실제 모델로 감사한 증거는 오너 승인 뒤(유료)
- [x] (2026-10-15 오후 루프) N6 화면 시안 비교: 같은 HANDOFF를 세 안(A 지금, B 결정 카드 먼저, C 주장과 증거 대조)으로 그리고 폰과 넓은 화면에서 비교(`docs/references/evidence/2026-10-15-afternoon/handoff-mockups/`). 리드 제안은 B 기본에 한 일 절만 C 방식. 오너 확인 전
- [x] (2026-10-16 00:30) 고른 시안을 렌더러에 반영(B+C, 2478ee7). 결정 카드 먼저, 상태 칩, 한 일 옆에 감사 지적, 선택지 버튼이 미리 고른 결정 화면으로. 실제 감사 기록으로 그린 화면: `docs/references/evidence/2026-10-16-night/auditor-real/`
- [x] (2026-10-16) 1a에서 넘어온 부채 정리: TD-006(`gotechy task restart`), TD-008(2026-10-15)은 상환. TD-007(무시 파일 검사)은 2단계로 이관(verify 샌드박스와 병합 전 gitleaks가 피해를 줄인다)
- [x] (2026-10-16 01:40) 보안 리뷰: 감사 15차(높음 1 추정은 TD-030, 중간 3과 낮음 8은 모두 고침, `docs/references/evidence/2026-10-16-night/audit-15.md`)
- [x] (2026-10-16) 완료 게이트: 아래 Outcomes의 판정. N4 나머지와 N5는 2단계로 이관

## Surprises & Discoveries

**N5 Orca 어댑터 사전 조사 (2026-10-15 오후 루프, `orca --help`만 읽음, 워커 실행 없음)**
- Orca 1.4.209의 `orchestration`에는 Run(`run-create`), 감독되는 워커(`worker-start`, `worker-show`, `worker-read`, `worker-stop`), 메시지(`send`, `check`), 작업(`task-create`), 게이트(`gate-create`, `gate-resolve`)가 있다. `worker-start`는 `--agent`(대화형 에이전트)나 `--terminal`로 띄우고, 작업 폴더는 Orca가 고르거나 만든 worktree(`--worktree path:<경로>` 등)다. [확인, 도움말]
- 그래서 Orca로 띄운 워커에는 gotechy가 워커에 거는 격리(claude `--restricted`와 거부 규칙, codex `workspace-write`, 허용 목록 환경 변수)를 그대로 걸 수 없다. worktree는 `path:`로 gotechy의 것을 줄 수 있어 보호 경로 검사와 verify 샌드박스는 그대로 쓸 수 있을 것으로 본다. [추론]
- 결정이 필요하다(D7 보강): Orca 워커를 쓸 때 격리 수준을 낮추는 것을 받아들일지, Orca는 화면과 알림에만 쓰고 실행은 native로 둘지. 실제 에이전트를 띄우는 실험(유료)이 먼저라 오후 루프에서는 하지 않았다. [확인]

**오너 Touch ID 확인 (2026-10-15 12:11~12:12, 오너가 `scripts/owner-touchid-check.sh` 실행. 결과는 리드가 임시 프로젝트와 macOS 통합 로그(`/usr/bin/log show`, LocalAuthentication)를 읽어 확인)**
- 실제 오너 키(`o-944e58dc073f6f1d`)가 생겼고, `keys init`의 `probe`를 통과했다(키 활성화는 probe 통과 뒤에만 한다). 설치된 서명 도구에는 실제 빌드 문구("오너 확인을 받지 못했어요")가 있고 테스트 빌드 문구("확인 문구")는 없다. 바이트로 찾았다. 처음에 `strings`로 본 확인은 한글을 못 찾아 근거가 되지 않았다. [확인]
- **이 맥(맥 미니)에는 지문 장치와 Apple Watch가 없어 확인 창이 맥 로그인 암호 창이었다.** 로그에 `MechanismPasscode`만 있고, 지문 장치는 "No paired accessory", 시계는 "No AppleWatch was discovered"다. 스크립트와 문서는 지문만 말하고 있었다. 스크립트 안내문을 고쳤다. [확인]
- 첫 실행(12:11)은 G-001에서 멈췄고 확인 창은 뜨지 않았다(12:11:37 probe 뒤 12:12:22까지 인증 기록 없음). 서명 단계 전에 decide가 끝났다. [확인]
- 두 번째 실행(12:12): G-001과 G-002 모두 ok(장부 2줄)다. 로그에서 두 창 모두 암호 칸에 글자가 입력되고(커서 이동), Enter로 OK가 눌리고, macOS가 암호를 맞다고 확인했다(`PasscodeVerified`). 창을 닫거나 취소한 기록은 없다. 결정마다 창은 한 번씩만 떴다. 오너는 "암호 넣는 곳이 없었고 그냥 껐던 것 같다"고 기억한다. 그래서 G-002 취소 확인은 아직 안 됐고, 같은 스크립트를 다시 실행해 확인한다. [확인]
- 다시 실행(13:04)해도 G-002가 승인됐다. 창이 뜨고 1.3초 안에 암호와 Enter가 들어갔다. 원인은 안내끼리 부딪힌 것이다. 스크립트는 "이번엔 취소"라고 했지만, 바로 뒤 decide가 "코드가 같으면 승인하세요"라고 띄웠고 오너는 그 안내를 따랐다. 또 스크립트 마지막 단계는 G-002가 이미 기록됐는데도 화면 결정을 권해서, 오너가 결정 버튼 없는 화면(TD-022)을 열었다. 스크립트가 G-002 직전에 시험임을 밝히고 마우스로 취소하라고 하며, G-002가 남아 있을 때만 화면 결정을 권하게 고쳤다. decide와 화면 문구는 "Touch ID(지문 장치가 없으면 맥 암호)"로 바꿨다. 습관처럼 승인하기 쉬운 점은 TD-023으로 남겼다. [확인]
- 13:51 세 번째 실행에서 G-001 ok, G-002 pending, 장부 1줄로 스크립트 통과 기준을 채웠다. 로그에는 G-002의 서명 도구 호출이 없다. 오너가 터미널의 y 질문에서 거절했고, 확인 창의 취소 버튼은 누르지 않았다. [확인]

**N3 loop, N4 guard와 보안 감사 9, 10차 (2026-10-15 새벽, 밤샘 루프 2)** 증거 `docs/references/evidence/2026-10-15-night/audit-9-10.md`
- 감사 9차(N3): 루프 상태와 보고서, 계약 폴더 안의 링크 파일, 파일 이름과 다른 명세 id, Codex 비용 상한 없음, 워커가 적은 `lead_note`. 모두 반영. 워커의 `lead_note`는 doc-gardener도 같은 날 따로 찾았다(인박스에 "리드:"로 보임). [확인]
- 감사 10차(N4): 첫 판정기는 셸을 연결자로만 나눠서, 주석이나 here-doc 안의 따옴표 하나, 줄 이어 쓰기, `for`/`if`, `npx`로 부른 배포를 놓쳤다. 셸처럼 읽는 판정기로 다시 썼다. Claude Code의 표준 커밋 형태(here-doc 안에 `it's`)는 막지 않도록 괄호 짝 찾기도 here-doc을 건너뛴다. [확인]
- hook이 2가 아닌 코드로 끝나면 Claude Code가 명령을 실행한다(감사관 지식, 실측 안 함). 그래서 래퍼가 가드 실패를 모두 exit 2로 바꾼다. [추론]
- 실수: guard-cli 테스트가 HOME을 저장소로 둬서 bun 캐시 150개가 f4156ca에 커밋되어 공개됐다. 비밀 값과 로컬 경로는 없었다. `.gitignore`에 넣었고, Library 폴더의 git 추적 해제는 저장소 hook이 확인을 요구해 오너 몫으로 남겼다. [확인] 오너가 추적 해제를 고른 뒤(2026-10-15 낮, T-005) 리드가 해제했다. 저장소 hook은 `git rm -r --cached`도 재귀 삭제로 보고 막아서, 오너 확인을 받은 뒤 파일 목록을 하나씩 넘겨 색인에서만 뺐다(디스크 파일은 그대로). [확인]

**N2 serve와 보안 감사 8차 (2026-10-15 새벽, 밤샘 루프 2)** 증거 `docs/references/evidence/2026-10-15-night/audit-8.md`
- **Chrome 155는 `Referrer-Policy: no-referrer`인 페이지의 같은 출처 폼 POST에 `Origin: null`을 보낸다.** 처음 커밋한 serve(e5f4bfc)는 그래서 실제 브라우저에서 오너의 제출을 모두 403으로 막는 상태였다. 자동 테스트는 fetch에 Origin을 직접 넣어 이것을 놓쳤다. `same-origin`으로 바꾸고 헤드리스 Chrome으로 결정 흐름 전체를 실측했다. [확인]
- Bun 1.4.3 `Bun.serve`의 기본 유휴 시간은 응답을 기다리는 핸들러를 12초 넘게도 끊지 않았다. 감사관의 추정(10초에 끊김)은 이 환경에서는 일어나지 않았다. [확인]
- 형식 문자(U+200B 같은 Cf)를 lint가 오류로 막으면서, 보이지 않는 글자만 다른 선택지는 HANDOFF 단계에서 먼저 걸린다. 게이트를 열 때의 겹침 검사는 lint로 못 잡는 호환 글자(전각 숫자 `５분`)를 막는다. [확인]


**보안 감사 6차, N1 (2026-10-14 18:56~19:14, 오너 외출. 시각은 커밋 기록 기준)**
- 높음 0, 중간 1, 낮음 5. 중간 1: 서명 도구가 한 번의 확인으로 메시지를 개수 제한 없이 서명했고, 창 문구도 호출한 쪽이 정했다. decide 경로가 바뀌면 오너가 기대한 순간의 지문 한 번으로 숨은 결정까지 서명될 수 있었다. 도구가 `[결정 서명 대상, 그 장부 줄]` 두 개만 받아 서로 맞는지 검사하고, 문구를 서명 대상에서 직접 만들게 했다. [확인]
- 낮음: 장부 끝줄 지우기(TD-014로 남김), 남아 있던 도구로 사람 확인 없는 키를 만드는 경로(`keys init`이 도구를 다시 빌드하고 `probe`로 확인), `null` 장부 줄에서 예외(깨진 줄로 판정), 샌드박스 서명 테스트 보강(화면 잠김으로 건너뜀), 워커 로그인 값 검사(되살림). [확인]
- mutation 6종 중 1종은 처음에 살아남았다(null 검사 하나만 빼면 뒤 검사가 예외를 catch로 넘겨 결과가 같음). 형식 검사 전체를 빼는 mutation은 테스트가 잡았다. 테스트 도구(가짜 서명 도구)의 쌍 검사 mutation은 살아남는다. 같은 성질은 실제 Swift 도구 테스트가 검사한다. [확인]

**N1 오너 인증 (2026-10-14 18:41~18:55, 오너 외출. 시각은 커밋 기록 기준)**
- 맥 화면이 18:35:15에 잠겼다(`ioreg`의 `CGSSessionScreenLockedTime`). 그 뒤 Secure Enclave 키 만들기가 `-25308`(errSecInteractionNotAllowed)로 실패했다. `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` 키는 화면이 잠긴 동안 만들 수도 쓸 수도 없다. 오너가 앞에 있어야 결정하는 설계와 맞으므로 그대로 둔다. 실제 키 생성 테스트는 잠겨 있으면 건너뛴다. [확인]
- 샌드박스 안에서는 `SecureEnclave.isAvailable`부터 false가 되어 도구가 exit 3으로 끝난다. 밖에서는 0(성공)이나 1(잠김)이라 화면 잠금과 상관없이 테스트로 구별된다. [확인]
- 순서를 지키지 못한 부분: 계약을 먼저 쓴 뒤 구현하고 수용 테스트를 나중에 썼다(오너 부재 중 큰 리팩터링이라 기존 테스트 289개를 먼저 옮겨 회귀를 막는 쪽을 택함). 대신 mutation 9종으로 테스트의 힘을 확인했고, 그중 하나(payload 묶기)는 처음 테스트가 약해 시나리오를 바꿨다. [확인]
- `Bun.which`도 `Bun.spawn`처럼 PATH를 생략하면 시작 시점의 PATH를 쓴다(`process.env.PATH`를 바꿔도 `/bin/ls`를 찾음). swiftc가 없을 때의 테스트가 실제 빌드를 돌려 드러났다. `Bun.which`에 PATH를 명시하고 위생 테스트로 고정했다. [확인]
- 서명 도구는 테스트에서 소프트웨어 키를 쓰는 가짜 도구(`tests/fixtures/ownerkey/fake-ownerkey.ts`)로 바꿔 끼운다. 같은 명령과 종료 코드를 쓰므로 decide의 실제 실행 경로(프로세스 실행, 종료 코드 4, 출력 검증)가 테스트된다. [확인]

**N0 전제 확인 (2026-10-14 18:29~18:33, 오너 외출, macOS arm64, Swift 6.1.2. 시각은 커밋 기록 기준)** 증거 `docs/references/evidence/2026-10-14-n0/`
- 1. Secure Enclave 도구: CryptoKit으로 쓴 Swift 도구(70줄)가 `swiftc -O`로 5초에 빌드됐다. 서명을 위한 entitlement나 코드 서명 없이 동작한다. 키 파일(blob)은 개인 키 원문이 아니라 Secure Enclave가 감싼 ASN.1 구조(사람 확인 없는 키 324바이트, 있는 키 427바이트)다. [확인]
- 1. 사람 확인(userPresence) 키로 서명하면 결과 없이 기다렸다(5초 제한에서 끝냄). Touch ID를 실제로 통과시키거나 취소하는 확인은 오너가 한다. [확인, Touch ID 통과는 미확인]
- 2. CryptoKit 서명(DER)과 공개 키(SPKI DER)를 Bun의 `crypto.verify('sha256', ..., { dsaEncoding: 'der' })`가 검증한다. 원문을 한 글자 바꾸면 false. [확인]
- 3. TTY가 없는 백그라운드 프로세스에서도 인증 대기가 걸렸고, 127.0.0.1 `Bun.serve`가 요청마다 Swift 도구를 불러 서명하고 검증하는 경로가 동작했다(사람 확인 없는 키로). [확인]
- **verify 샌드박스 안에서도 Secure Enclave 서명이 된다.** 지금 프로필로 감싼 프로세스가 사람 확인 없는 키로 서명에 성공했다. `com.apple.ctkd.token-client`, `com.apple.CoreAuthentication.daemon`, `com.apple.coreauthd`의 mach-lookup을 막자 "Sandbox restriction"으로 실패했다. N1에서 샌드박스에 넣는다. 막지 않으면 워커가 쓴 테스트가 오너 키 blob으로 인증 창을 띄워 오너를 속일 수 있다. [확인]
- 4. Orca 1.4.209: 워커는 `orca orchestration send --type worker_done --outcome succeeded|failed --report-path <path> --files-modified <csv>`로 완료를 보고한다. Orca에도 `gate-create`, `gate-resolve`가 있지만 서명이 없어, 결정의 원천은 gotechy 게이트로 둔다(D7). [확인]
- 4. `claude agents`는 서브에이전트 정의가 아니라 백그라운드 세션을 관리한다(`--json`, `--all`). [확인]
- 4. Claude Code 확장(공식 문서 조사, claude-code-guide 서브에이전트): mod는 v2.1.287 이상의 터미널에서 토스트, 입력창 위 띠, 창, 도구 호출 가드를 그릴 수 있다(`-p`와 VS Code 패널에서는 그리지 않음). 상태 줄은 stdin JSON을 받는 명령으로 글자만 보여 준다(`refreshInterval` 최소 1초). PreToolUse hook은 `permissionDecision: "deny"`와 이유로 명령을 막고, PostToolUse hook은 exit 2나 `decision: "block"`으로 lint 오류를 모델에 돌려준다. [확인, 문서]
- 4. **폰 푸시는 스크립트가 직접 보낼 방법이 문서에 없다.** Remote Control의 "Push when actions required" 설정으로 Claude가 판단해 보내는 것뿐이다. 실행 중인 세션에 밖에서 알림을 넣는 방법은 Channels(연구 미리보기, MCP 서버, 개발용 플래그 필요)와 세션 inbox 소켓(메시지 형식 미공개)이다. N4의 폰 알림 방식은 오너 결정으로 올린다. [확인, 문서]

## Decision Log

| 결정 | 근거 | 날짜 | ADR 승격 |
|---|---|---|---|
| 1b의 첫 마일스톤은 오너 인증이다 | 1a 보안 감사의 남은 한계(같은 사용자 자가 승인, Codex 키 읽기, 장부 무서명, TTY 우회)가 모두 "키가 파일이다"에서 나온다 | 2026-10-14 | ADR 0005 대체 예정 |
| 범위(N0~N6)와 순서 승인, 오너 인증은 Secure Enclave | 오너가 밤샘 보고 T-007에 답함. 기본값(Secure Enclave)에 이의 없음 | 2026-10-14 | - |
| 게이트 서명과 장부 줄 서명을 한 번의 Touch ID로 받는다(도구가 먼저 `evaluatePolicy`, 같은 context로 여러 서명) | 결정마다 두 번 묻지 않게. 실제로 한 번만 묻는지는 오너 확인 | 2026-10-14 | ADR 0006 |
| 1a HMAC 결정은 옮기지 않고 다시 결정하게 한다(`keys migrate` 없음) | 실제로 쓰인 HMAC 결정이 없다. 명령을 늘리지 않는다 | 2026-10-14 | ADR 0006 |
| 서명 도구는 `keys init`이 소스에서 `swiftc`로 빌드한다. 테스트 빌드만 `-D GOTECHY_TEST_NO_PRESENCE` | 바이너리를 저장소에 넣지 않는다. 사람 확인 없는 키는 테스트 빌드에서만 만들 수 있다 | 2026-10-14 | ADR 0006 |
| 프로젝트 공개 키 고정은 다음 단계(TD-013) | N1 범위를 Touch ID 없이 끝낼 수 있는 데까지로 자른다 | 2026-10-14 | - |
| serve 화면의 리퍼러 정책은 `same-origin` | `no-referrer`면 Chrome이 같은 출처 POST에 `Origin: null`을 보낸다(실험). Origin 검사를 느슨하게 하는 대신 정책을 바꾼다 | 2026-10-15 | - |
| Touch ID 창 문구에 작업 번호와 확인 코드(nonce 앞 4자리)를 넣는다 | 승인 계열 게이트는 선택지가 같아 게이트 번호만으로는 구분이 어렵다. 화면을 본 사람만 아는 코드로 자기 결정의 창을 알아본다(감사 8차 중간 5) | 2026-10-15 | - |
| serve 토큰은 한 번만, serve는 대화형 터미널에서만 | 브라우저 기록이나 에이전트 셸로 토큰이 새는 길을 줄인다(감사 8차 중간 4, 낮음 2) | 2026-10-15 | - |
| run은 작업별 pid 잠금 | serve의 자동 실행과 리드의 run이 같은 worktree에서 겹치지 않게(감사 8차 중간 3) | 2026-10-15 | - |
| 무인 루프는 autonomy L2 이상만, Codex 작업은 돌리지 않음, 시도마다 최소 0.1달러 예약 | 비용 상한이 없는 워커와 아주 작은 예산 값으로 예산을 피하지 못하게(감사 9차) | 2026-10-15 | - |
| 리드는 `gotechy loop`를 실행하지 않는다(정책 deny와 가드) | 리드가 autonomy를 올리고 큰 예산으로 루프를 돌릴 수 있다(감사 9차 낮음 7) | 2026-10-15 | - |
| 검증은 프로젝트에 커밋한 고정 키(`orchestration/owner.pub`)로 하고, 첫 decide가 처음 고정한다(TD-013) | 홈의 키만 바꿔서는 결정을 만들 수 없고, 고정 파일을 바꾸면 git diff에 드러난다. 별도 명령 없이 첫 결정에서 고정해 오너의 할 일을 늘리지 않는다 | 2026-10-15 | - |
| 장부 끝 기록은 장부 파일 전체 해시로, 줄 잇기 해시는 두지 않는다(TD-014) | 장부는 이 맥 밖으로 나가지 않는다. 서명 대상에 순번을 넣으면 Touch ID를 기다리는 동안 장부 잠금이 필요하다 | 2026-10-15 | - |
| 가드는 셸처럼 읽는다. 닫히지 않은 따옴표, here-doc, `$(`는 막는다 | 셸과 다르게 읽으면 뒤 명령을 놓친다. 셸에서도 문법 오류라 막아도 오탐 비용이 거의 없다(감사 10차) | 2026-10-15 | - |
| 가드 hook은 settings.local.json에 넣고, 이미 있으면 다른 키는 지키고 hook만 더한다 | Claude Code가 허용 규칙을 쌓아 두는 개인 파일이라 대부분 이미 있다. 건너뛰면 가드가 조용히 꺼진다(감사 10차 중간 5) | 2026-10-15 | - |
| 감사관은 작성 계열의 반대가 기본이고, 지적은 권고다. 불일치 수는 리드가 작업 브랜치에서 file:line을 확인한 지적만 센다 | 감사관도 워커가 쓴 글을 읽어 주입될 수 있고, 없는 파일과 줄을 지어낼 수 있다. 기계로 확인한 근거만 세면 D9 지표(감사관 불일치율)가 지어낸 지적에 부풀지 않는다 | 2026-10-15 | - |
| HANDOFF 화면은 B(결정 카드 먼저)를 기본으로, 한 일 절만 C(주장 옆에 감사 지적) 방식으로 바꾸자고 제안(오너 확인 전) | 오너가 할 일은 결정이라 폰 첫 화면에서 바로 고를 수 있어야 한다. 감사 지적이 결정과 이어질 때 B만으로는 놓칠 수 있다. C를 통째로 쓰면 HANDOFF 계약을 바꿔야 한다(시안 비교 README) | 2026-10-15 | - |
| 감사관은 `run`과 `loop`가 자동으로 부르지 않는다(첫 판) | 실제 모델 감사의 비용과 품질을 아직 재지 않았다. 녹화 하나로 재 본 뒤 자동 연결을 정한다 | 2026-10-15 | - |
| 전역 정책은 자동 업데이트 끄기를 빼고 켠다. train에서 두 값을 지우고, 값이 없으면 setup은 그 설정을 건드리지 않는다 | 오너 결정(T-005). 오너 전용 명령을 막는 줄은 바로 효과가 있고, 자동 업데이트 끄기는 오너가 쓰는 claude와 codex에 영향이 크다. 워커는 어댑터가 따로 끈다 | 2026-10-15 | - |
| 공개된 bun 캐시 150개는 추적만 해제한다(이력은 그대로) | 오너 결정(T-005). 비밀 값과 로컬 경로가 없었고, 이력에서 지우려면 force push가 필요하다 | 2026-10-15 | - |
| ADR 0006 승인, 이 맥의 확인은 맥 로그인 암호 | 오너가 T-007 추천안을 골랐다(2026-10-16 00:07). 맞는 암호 없이는 칩이 서명하지 않는 것을 로그로 확인했다. 습관 승인은 확인 코드로 줄이고 TD-023으로 남긴다 | 2026-10-16 | ADR 0006 |
| Orca는 화면과 알림에만, 워커 실행은 native | 오너가 T-007 추천안을 골랐다. Orca 워커는 대화형 에이전트라 거부 규칙과 비용 상한을 걸 수 없다 | 2026-10-16 | ADR 0007 |
| HANDOFF 화면은 B(결정 카드 먼저) + 한 일 절만 C(주장 옆에 감사 지적) | 오너가 T-007 추천안을 골랐다 | 2026-10-16 | - |
| 하위 폴더의 CLAUDE.md, AGENTS.md, `.claude/`도 보호 경로로 둔다 | 오너가 T-007 추천안(그대로)을 골랐다. 하위 지시 파일도 에이전트가 읽어 워커가 지시를 심을 수 있다(보안 감사 12차 중간 5) | 2026-10-16 | - |
| 감사관 실제 실행은 claude 한 번(0.5달러 상한) | 오너가 T-007 추천안을 골랐다. codex는 폴더 밖 읽기 실험(TD-024)을 먼저 한다 | 2026-10-16 | - |
| 공문서 브리프는 보류 | 오너가 다른 프로젝트를 먼저 하겠다고 했다(2026-10-16). 준비물은 메모리와 `docs/references/research/2026-10-15-gongmunseo-*`에 | 2026-10-16 | - |

## Outcomes & Retrospective

**판정(2026-10-16, 리드 자체 판정, 오너 확인 전)**: 표의 목표 여섯 가지 중 다섯을 이뤘고, 하나(알림과 mod)는 2단계로 넘겼다.

| 목표 | 결과 | 근거 |
|---|---|---|
| 결정에는 오너의 확인이 필요하다 | 이룸. 이 맥은 로그인 암호 창(지문 장치 없음) | ADR 0006 실측 절과 승인, `tests/e2e/pin-ledger.test.ts` |
| 화면에서 바로 결정한다 | 이룸. 결정 카드에서 선택지를 누르면 그 선택을 미리 고른 결정 화면, 제출과 확인 창은 그대로 | `gotechy serve`, 감사 8차, 15차, 헤드리스 Chrome 실측 |
| 밤새 맡기는 무인 루프 | 이룸(녹화 워커로만). 실제 워커로 밤새 돈 실측은 없음(유료) | `gotechy loop`, 감사 9차 |
| 부작용 명령은 승인 없이 실행되지 않는다 | 이룸. Claude Code와 Codex hook, deny 규칙 | 감사 10차, 13차 |
| 결정이 생기면 오너에게 알린다(mod, 폰) | **못 이룸**. 상태 줄만 있음 | 2단계 P7 |
| 교차 검증 감사관 | 이룸. 실제 claude 감사 1회(0.128달러, 심은 불일치 3건 모두 찾음) | `docs/references/evidence/2026-10-16-night/auditor-real/` |

1b 기간에 더한 것(계획 밖): 팩 12개와 스킬 15개(분야별 최고 전문가 bar), 위임 작업 지시문에 팩 본문 넣기, `gotechy radar`, `gotechy task restart`, 병합 전 gitleaks, 워커 프로세스 그룹.

**잘 된 것**: 외부 경계(Chrome Origin, gitleaks 설정 우회, git worktree 동작, 프로세스 그룹)를 커밋 전에 실험으로 확인했다. 감사 15차의 중간 3도 실험으로 사실을 확인한 뒤 고쳤다.

**잘못한 것**: (1) 프로세스 그룹 변경이 Ctrl-C 고아라는 회귀를 만들었고 감사가 잡았다. 새 그룹이 터미널 신호를 받지 못한다는 것을 실험에서 함께 봤어야 했다. (2) 커밋 명령을 검사와 `;`로 이어 lint 실패 커밋이 한 번 올라갔다(768aa94, 바로 고침). (3) 일부 기능(팩 색인 갱신, 지시문 팩 본문)은 구현을 먼저 쓰고 테스트를 뒤에 썼고, mutation으로 힘을 확인했다.

**다음**: 2단계 ExecPlan(`2026-10-16-harness-v2-phase2.md`). 첫 실전 프로젝트에서 실사용 지표를 잰다.

## Context and Orientation

- 결정의 현재 구조: `src/core/gate.ts`(서명 대상과 판정), `src/runtime/gates.ts`(게이트 열기, decide, 필요한 게이트 계산), `src/runtime/keys.ts`(파일 키). 계약은 `docs/references/contract.md` 6절과 9절.
- 화면: `src/core/view/pages.tsx`(읽기 전용, CSP로 스크립트와 form 금지). 1b의 결정 화면은 이 렌더러를 그대로 쓰되 serve 모드에서만 form을 허용한다.
- 워커 격리: worktree, 보호 경로 되돌리기, 심볼릭 링크 거부, verify 샌드박스(`src/runtime/sandbox.ts`).
- 오늘 밤의 수동 루프 설계: `docs/exec-plans/completed/2026-10-14-overnight-loop.md`. N3는 이것을 코드로 옮긴다.
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
- work: 서명을 HMAC에서 Secure Enclave ECDSA로 바꾼다. 공개 키는 `$GOTECHY_HOME/owner/<key_id>.pub`(2026-10-14 구현). 프로젝트 `orchestration/owner.pub` 지문 고정은 TD-013. 결정 장부 줄마다 서명한다. `keys rotate`는 새 키 쌍. 1a의 HMAC 결정은 마이그레이션 명령으로 한 번에 다시 서명하거나 superseded 처리.
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
