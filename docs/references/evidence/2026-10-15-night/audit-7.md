# 보안 감사 7차: 1a 전체 보안 리뷰 (2026-10-15 새벽, 밤샘 루프 2)

`/gotechy-security` 절차대로 했어요. 읽기 전용 security-auditor에게 1a 전체와 그날 새로 들어간 apm 설치를 맡겼고, 정적 확인을 함께 했어요.

## 판정과 처리

| 등급 | 지적 | 처리 |
|---|---|---|
| 중간 1 | 남이 만든 저장소의 apm.yml에 든 다른 의존성, MCP, 다른 키까지 init이 설치 | init이 다루는 키와 train의 팩 줄만 허용, 나머지는 apm을 부르기 전에 exit 1 |
| 중간 2 | 락이 스스로를 보증(락과 스킬 파일을 함께 바꾸면 통과) | 깔린 파일을 라이브러리 저장소의 train 커밋(git blob id)과 락 해시 둘 다와 대조. 설치 전, 설치 뒤, doctor |
| 중간 3 | git 이름 바꾸기 감지로 보호 파일(예: AGENTS.md)을 허용 범위 안으로 옮긴 커밋이 범위 검사를 통과 | run과 accept의 diff에 `--no-renames` |
| 중간 4 | 저장소에 커밋된 심볼릭 링크를 따라 저장소 밖에 쓰거나 지움 | init, render, 팩 설치, 프로젝트 명령이 주요 경로의 링크를 거부 |
| 낮음 5 | apm에 오너 환경 변수 전체를 넘김 | 허용 목록만 넘김 |
| 낮음 6 | CI 토큰 범위가 넓음 | `permissions: contents: read`, checkout `persist-credentials: false`, 토큰은 apm 설치 단계에만, action은 커밋 SHA로 고정 |
| 낮음 7 | Codex 워커에 비용 상한이 없음 | 계약에 한계로 적고 TD-015 |
| 낮음 8 | 리드가 `gotechy keys rotate`로 모든 결정을 무효로 만들 수 있음 | 정책 deny에 `Bash(gotechy keys:*)` |

높음은 없었어요. 이전 감사(1~6차)의 수정은 모두 유지되고 있었어요(샌드박스, 환경 변수 허용 목록, git 설정 검사, 링크 거부, 원천에서 계산하는 게이트, 서명 도구의 두 메시지 검사).

## 정적 확인

- `bun audit`: 취약점 0건(패키지 45개).
- gitleaks 전체 이력: 커밋 39개, 누출 0건.
- `docs/SECURITY.md` 위협 모델 표를 처음으로 채움(자산 9개, 행위자 4종).

## 검증

- 수용 테스트: `tests/e2e/audit7.test.ts`, `tests/e2e/init-apm.test.ts`의 "보안 감사 7차", `tests/core/apm.test.ts`, `tests/core/ci-hygiene.test.ts`.
- mutation check 18종을 모두 테스트가 잡음(방어 코드를 하나씩 빼 봄).
- git 2.39.5에서 이름 바꾸기 감지가 기본으로 켜져 있음을 직접 확인함(`git diff --name-only`가 옛 이름을 빼고 새 이름만 출력).
- apm `audit --ci`도 "파일과 락 해시를 함께 바꾼" 변조는 잡음. 그래도 하네스가 따로 대조하는 이유는 apm이 놓치는 경우(락의 커밋만 바꿈, 원본에 없는 파일 추가, train 밖 의존성)가 있고, 라이브러리 커밋이 진짜 기준이기 때문. 테스트는 audit이 통과한다고 답하는 가짜 apm으로 하네스의 대조만 따로 봄.

## 격리 환경 실측 (실제 GitHub, 로컬 경로는 <격리 HOME>으로 바꿈)

```text
$ gotechy init --packs owner
Thu Oct 15 02:08:40 KST 2026
created: apm.yml
created: .claude/skills/owner-protocol/ (apm)
created: .agents/skills/owner-protocol/ (apm)
exit=0
$ gotechy doctor (팩 줄)
ok   팩: 깔린 팩이 apm.lock.yaml, train의 커밋과 같아요
실패 1건
$ 스킬과 락 해시를 함께 바꾼 뒤 doctor (팩 줄)
실패 팩: 깔린 팩이 apm.lock.yaml과 달라요 (apm audit --ci exit 1)
Thu Oct 15 02:08:44 KST 2026
```

doctor 전체의 "실패 1건"은 정책 검사였어요. 격리 HOME은 예전 train으로 setup을 했기 때문에, 이번에 더한 deny 두 줄(`Bash(gotechy serve:*)`, `Bash(gotechy keys:*)`)이 빠졌다고 알려 줬어요.
