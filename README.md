# Gotechy Harness v2

> **Go, Build the technology, more easier.**
> 고텍이(고경석)의 개인 작업 시스템. Claude Code와 Codex 같은 AI 워커에게 같은 파일 약속으로 일을 맡기고, 사람이 이해하고 서명한 결정만 다음 일과 병합으로 이어지게 한다.

## 무엇인가

`gotechy`는 TypeScript와 Bun으로 쓴 명령줄 도구다. 하는 일은 다섯 가지다.

1. **맡기기**: 작업 명세(`orchestration/tasks/T-###.md`)로 워커에게 일을 맡긴다. 워커는 별도 git worktree에서 일하고, 리드가 샌드박스 안에서 검증한다.
2. **보고 받기**: 워커는 정해진 형식의 HANDOFF를 남기고, lint가 형식과 문체를 검사한다.
3. **이해하기**: 인박스 3초 카드, 읽기 전용 HTML, 화면에서 결정하는 로컬 서버(`gotechy serve`).
4. **결정하기**: 맥의 보안 칩(Secure Enclave) 키와 Touch ID로 결정에 서명한다. 되돌리기 어려운 결정은 이해 질문에 먼저 답한다. 승인한 결과만 메인에 병합한다(`gotechy accept`).
5. **어디서든 같게**: 검증한 도구 버전 묶음(train)을 체크섬 그대로 깔고(`bin/gotechy`), 팩(스킬)은 apm으로 커밋에 고정해 깐다.

진행 상태(2026-10-16): 1a, 1b 완료(화면 결정, 무인 루프, 부작용 가드, 교차 감사관과 실제 claude 감사 1회, HANDOFF 화면 결정 카드 먼저). 알림과 Claude Code mod는 2단계. 전문가 팩 12개(스킬 15개)에 분야별 최고 전문가 기준(bar)을 넣었다. 새 프로젝트를 시작하는 순서는 `docs/GETTING_STARTED.md`.

## 시작하기 (macOS)

```bash
git clone https://github.com/kyeongseok-go/gotechy-harness.git && cd gotechy-harness
bin/gotechy doctor            # 처음이면 ~/.gotechy에 mise와 train 도구를 체크섬 그대로 받는다
bin/gotechy setup --dry-run   # 전역 설정(Claude Code, Codex)에 넣을 정책을 먼저 본다
bin/gotechy keys init         # 오너 키를 보안 칩에 만든다(Xcode Command Line Tools 필요)
```

프로젝트에서(`gotechy`는 이 저장소의 `bin/gotechy`. `~/.zshrc`에 `export PATH="<이 저장소>/bin:$PATH"`를 넣는다. alias는 에이전트 셸에서 안 보이고, 링크는 라이브러리 위치를 못 찾는다):

```bash
gotechy init --packs all              # 계약 폴더, 지도, 전문가 팩(apm), 부작용 가드. 일부만: --packs owner,define,build
gotechy task new "README에 설치 줄" --verify "grep -q 설치 README.md" --ownership README.md --agent claude
gotechy run T-001                     # 워커 실행, 검증, HANDOFF
gotechy inbox                         # 3초 카드
gotechy serve                         # 화면에서 결정(터미널에서 직접)
gotechy accept T-001                  # 승인한 결과를 메인에 병합(병합 전 gitleaks 검사)
gotechy task restart T-001            # 충돌하면 새 메인 위에서 처음부터
gotechy loop --budget 5               # 자리를 비운 동안 autonomy L2 작업을 차례로(아침 보고서)
```

명령 전체는 `docs/generated/cli.md`(자동 생성).

## 안전 장치

- 결정(`decide`, `serve`), 오너 키(`keys`), 무인 루프(`loop`)는 오너만 실행한다. `gotechy init`이 프로젝트에 deny 규칙과 PreToolUse 가드를 깐다.
- 에이전트는 이 저장소를 확인할 때 `bin/gotechy` 대신 `bun run dev -- <명령>`을 쓴다. `bin/gotechy`는 처음 실행할 때 `~/.gotechy`에 도구를 내려받는다.
- 위협 모델과 알려진 한계: `docs/SECURITY.md`, `docs/references/contract.md` 6.3절. 보안 감사 기록: `docs/references/evidence/`.

## 어디를 볼까

| 알고 싶은 것 | 문서 |
|---|---|
| 새 프로젝트 시작하기 | `docs/GETTING_STARTED.md` |
| 지도(에이전트와 사람 공통) | `AGENTS.md` |
| 전문가 팩과 분야별 bar | `skills/`, `docs/QUALITY_BAR.md`, 계약 10.8절 |
| 파일 약속과 명령의 원천 | `docs/references/contract.md` |
| 구조와 레이어 | `ARCHITECTURE.md` |
| 설계와 결정 | `docs/design-docs/`, `docs/decisions/` |
| 진행 중인 계획 | `docs/exec-plans/active/` |
| 검사 | `bun run check`, `bun run check:boundaries`, `bun run gen:docs` |

## v1.x 템플릿

v1.2까지는 프로젝트마다 통째로 복사하는 템플릿이었다. 그 방식과 설명은 git 이력(커밋 `6a4d892`)에 있다. 새 프로젝트용 지도와 hook 원본은 `templates/project/`로 옮겼고, 남은 v1.x 문서의 정리는 2단계(문서 다이어트, TD-003)에서 한다.
