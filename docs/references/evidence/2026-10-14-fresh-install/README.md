---
title: 새 클론과 빈 HOME에서 처음 설치 (Validation 12 실측, 진행 중)
date: 2026-10-14
type: evidence
audience: 고텍이
tags: [gotechy-harness, bootstrap, mise, fresh-install, validation]
---

# 새 클론과 빈 HOME에서 처음 설치 (Validation 12 실측, 진행 중)

## 환경

- 이 맥(macOS, arm64)에서 환경 변수를 비운 셸. HOME은 빈 임시 폴더, PATH는 시스템 폴더와 claude, codex, orca 링크만 둔 폴더예요.
- 라이브러리는 이 저장소를 새로 클론하고 아직 커밋하지 않은 변경(`mise.toml`, `mise.lock`, `bin/gotechy`)을 덮어쓴 것이에요.
- 실험 스크립트는 지우는 명령 없이 파일로 만들었어요(`prep.sh`는 클론과 링크, `run.sh`는 `env -i`로 HOME, PATH만 주고 실행).

## 실행 세 번

| 회 | 시각 | 결과 |
|---|---|---|
| 1 | 13:16 | 도구 6개가 자동 설치됐지만 doctor 실패 4건: mise가 PATH에 없음, claude 버전, 정책 2건. 실행만으로 `mise.lock`이 바뀜. `node_modules`가 없는데 bun 자동 설치로 CLI가 돎 |
| 2 | 13:19 | 부트스트랩을 고친 사본(PATH, `MISE_LOCKED=1`, `bun install --frozen-lockfile`). 락 두 개 모두 그대로, mise 검사 통과 |
| 3 | 13:22 | 고친 부트스트랩으로 처음부터. 아래 로그 |

## 3회 결과

- 부트스트랩부터 setup dry-run까지 52초. mise 체크섬 일치, 도구 6개와 npm 패키지 20개 설치.
- `setup` 뒤 `doctor`: 13개 검사 중 12개 통과. 실패는 claude 하나예요.
- claude 실패의 원인: 이 맥의 전역 claude가 13:12에 2.1.296에서 2.1.299로 자동 업데이트됐어요. claude는 B등급이라 mise가 설치하지 않고 PATH의 것을 그대로 써요.
- 실행 뒤 `mise.lock`과 `bun.lock`은 바이트가 그대로예요.

## 로그 (3회)

경로는 `~`와 `$S`(세션 임시 폴더)로 바꿨고, mise 진행 막대 줄은 뺐어요.

```text
### 시작 2026-10-14T13:22:07+0900 Darwin arm64
### 격리 셸 환경
HOME=$S/v12/r3/home
PATH=$S/v12/r3/shims:/usr/bin:/bin:/usr/sbin:/sbin
TERM=xterm-256color
LANG=ko_KR.UTF-8
### 1. 부트스트랩 + setup --dry-run
bun install v1.4.3 (c6da4a4d3)

+ @biomejs/biome@2.5.15
+ @types/bun@1.4.3
+ typescript@7.0.2
+ commander@15.0.0
+ hono@4.13.13
+ markdown-it@15.0.2
+ yaml@2.9.1
+ zod@4.6.7

20 packages installed [5.10s]
$S/v12/r3/home/.claude/settings.json (새로 만듦)
  env.DISABLE_AUTOUPDATER = "1"
  permissions.deny += Bash(gotechy decide:*)
  permissions.deny += Bash(script:*)
  permissions.deny += Bash(expect:*)
$S/v12/r3/home/.codex/config.toml (새로 만듦)
  check_for_update_on_startup = false
exit=0
### 13:22:59 ~/.gotechy
$S/v12/r3/home/.gotechy:
bin

$S/v12/r3/home/.gotechy/bin:
mise
### 2. setup
$S/v12/r3/home/.claude/settings.json (새로 만듦)
  env.DISABLE_AUTOUPDATER = "1"
  permissions.deny += Bash(gotechy decide:*)
  permissions.deny += Bash(script:*)
  permissions.deny += Bash(expect:*)
$S/v12/r3/home/.codex/config.toml (새로 만듦)
  check_for_update_on_startup = false
적용했어요. 되돌리려면: gotechy setup --restore 20261014T042259Z
exit=0
### 3. doctor 13:22:59
train 2026.10.0
ok   mise: 2026.10.8
ok   bun: 1.4.3
ok   node: 24.21.0
ok   uv: 0.13.0
ok   gh: 2.102.0
ok   apm: 0.33.0
ok   gitleaks: 8.30.1
실패 claude: 2.1.299 (train 2026.10.0의 버전은 2.1.296)
     고치는 법: train 버전으로 맞추세요: 라이브러리 폴더에서 `mise install --locked`. 다른 설치본이 PATH 앞에 있으면 지우거나 순서를 바꾸세요 (`which claude`)
ok   codex: 0.162.1
ok   orca: 1.4.209
ok   mise 바이너리: $S/v12/r3/home/.gotechy/bin/mise 체크섬이 train과 같아요
ok   정책: 전역 설정에 정책이 들어가 있어요
ok   스킬 수: 1개
실패 1건
exit=1
### 라이브러리 저장소 상태
 M bin/gotechy
 M mise.lock
 M mise.toml
 M tests/e2e/bootstrap.test.ts
### 끝 2026-10-14T13:23:11+0900
```
