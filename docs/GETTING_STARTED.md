---
title: 새 프로젝트를 하네스로 시작하기
date: 2026-10-16
audience: 오너(고텍이)
---

# 새 프로젝트를 하네스로 시작하기

새 제품을 만들 때 이 순서대로 하면 돼요. 명령은 모두 오너가 터미널에서 직접 쳐요. `gotechy`는 이 저장소의 `bin/gotechy`예요(PATH에 두거나 `alias gotechy=<저장소>/bin/gotechy`).

## 0. 한 번만 하는 준비

| 할 일 | 명령 | 확인 |
|---|---|---|
| 도구 묶음 받기 | `gotechy doctor` | 처음이면 `~/.gotechy`에 mise와 train 도구를 체크섬 그대로 받고, 항목이 모두 ok |
| 전역 정책 넣기 | `gotechy setup --dry-run`으로 보고 `gotechy setup` | 2026-10-15에 이미 했어요(백업 `20261015T033107Z`) |
| 오너 키 | `gotechy keys init` | 2026-10-15에 이미 만들었어요(`o-944e58dc073f6f1d`). 이 맥은 확인 창이 맥 로그인 암호예요(ADR 0006) |

## 1. 프로젝트 만들기

```bash
mkdir ~/workspace/<프로젝트> && cd ~/workspace/<프로젝트>
git init -b main && printf '# <프로젝트>\n' > README.md && git add -A && git commit -m init
gotechy init --packs all
git add -A && git commit -m "gotechy 하네스 연결"
```

- `--packs all`은 전문가 15명(스킬 15개)을 모두 깔아요. 세션당 스킬 상한(15개) 안이에요. 필요한 것만 깔려면 쉼표로 고르세요(아래 표).
- init이 만드는 것: `orchestration/`(작업, HANDOFF, 결정), `AGENTS.md`(지도와 팩 색인 표), `CLAUDE.md`(`@AGENTS.md` 한 줄), `.claude/skills/`와 `.agents/skills/`(apm으로 커밋에 고정), 부작용 가드 hook(Claude Code와 Codex), 커밋 전 gitleaks hook.
- Codex를 쓸 거면 Codex로 이 폴더를 한 번 열어 신뢰하고, `/hooks`에서 "gotechy 가드"를 승인하세요.

| 팩 | 전문가 | 언제 |
|---|---|---|
| `owner` | owner-protocol | 항상(보고 형식) |
| `discover` | gotechy-discover | 문제와 사용자가 아직 흐릿할 때 |
| `define` | gotechy-spec, gotechy-plan | 스펙과 실행 계획 |
| `design` | gotechy-design | 화면이 있을 때 |
| `build` | gotechy-build | 코드(스택은 TypeScript, Python, Go, PostgreSQL, React와 Next.js 참고 파일) |
| `verify` | gotechy-quality, gotechy-security | 품질 목표와 보안 리뷰 |
| `ai` | gotechy-ai-eval | LLM 기능이 있을 때 |
| `comply-kr` | gotechy-comply-kr | 개인정보, AI, 광고, 접근성 법 요구사항 |
| `ship` | gotechy-ship | 완료 게이트, 출시, 되돌리기 |
| `operate` | gotechy-operate | 운영(SLO, 장애, 비용) |
| `grow` | gotechy-launch, gotekie-blog-writer | 알리기, 블로그 |
| `learn` | gotechy-retro | 회고, ADR, 커리어 증거 |

## 2. 첫 세션: 무엇을 만들지 정하기

프로젝트 폴더에서 Claude Code를 열고 이렇게 말하면 돼요.

1. "만들고 싶은 게 있어: <한 줄>" : `gotechy-discover`가 한 번에 한 질문씩 문제와 사용자를 확인해요.
2. "스펙 위저드로 가자" : `gotechy-spec`이 브리프, PRD, 기능, 유저 플로우를 단계마다 승인받으며 써요.
3. 화면이 있으면 `gotechy-design`, 품질 목표는 `gotechy-quality`, 법 요구사항은 `gotechy-comply-kr`.
4. "실행 계획 세워 줘" : `gotechy-plan`이 ExecPlan을 쓰고 작업으로 쪼개요.

## 3. 일을 맡기고 결정하기

| 단계 | 명령 | 누가 |
|---|---|---|
| 작업 만들기 | `gotechy task new "<제목>" --verify "<판정 명령>" --ownership "<바꿀 경로>" --agent claude` (Codex면 `--agent codex`) | 리드(에이전트)도 가능 |
| 워커 실행 | `gotechy run T-001` (`--agent`를 안 적었으면 `--adapter claude`) | 리드도 가능 |
| 보고 보기 | `gotechy inbox`, 화면은 `gotechy render T-001` | 누구나 |
| 다른 계열 모델로 대조 | `gotechy audit T-001` (claude 감사관은 0.5달러 상한) | 리드도 가능(유료) |
| 결정 | `gotechy serve`(화면) 또는 `gotechy decide G-001 <선택>` | **오너만** |
| 병합 | `gotechy accept T-001` (병합 전 gitleaks 검사) | 리드도 가능 |
| 충돌이나 병합 뒤 검증 실패 | `gotechy task restart T-001` 뒤 `gotechy run T-001` | 리드도 가능 |
| 자는 동안 | `gotechy loop --budget 5` | **오너만** |

HANDOFF 화면은 결정 카드가 맨 위에 있어요. 선택지를 누르면 그 선택을 미리 고른 결정 화면이 열리고, 확인 코드가 같은 창에만 암호를 넣으면 돼요. 감사관 지적은 관련 "한 일" 항목 바로 아래에 붙어요.

## 4. 막히면

| 증상 | 해 볼 것 |
|---|---|
| 환경이 이상함 | `gotechy doctor` |
| 결정이 반영 안 됨 | `gotechy gate verify` |
| 같은 작업이 또 충돌 | `gotechy task restart T-###` |
| 스킬이 안 보임 | `apm.lock.yaml`과 `.claude/skills/` 확인, `gotechy init --packs <팩>` 다시 |

## 5. 지금 알려진 한계 (2026-10-16)

- 실제 워커로 무인 루프를 밤새 돌린 실측은 아직 없어요(녹화 워커로만).
- 전문가 팩의 평가 케이스(`evals/`)는 형식 검사만 했고, `claude plugin eval`로 실제로 돌린 기록은 없어요(유료).
- Orca는 화면과 알림에만 쓰고 워커 실행에는 쓰지 않아요(ADR 0007).
- 리눅스에서는 verify 샌드박스가 없어요(TD-009).
