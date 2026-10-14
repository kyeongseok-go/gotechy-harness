---
title: 이 맥에 gotechy setup 실제 적용과 복원 (Validation 14 실측)
date: 2026-10-14
type: evidence
audience: 고텍이
tags: [gotechy-harness, setup, restore, validation]
---

# 이 맥에 gotechy setup 실제 적용과 복원 (Validation 14 실측)

오너가 2026-10-14 13:05에 "지금 하자"고 정해서(T-006) 이 맥의 실제 전역 설정으로 한 번 실행했어요.

## 순서와 결과

| 단계 | 시각 (KST) | 결과 |
|---|---|---|
| 원본 기록 | 13:05 | 두 파일의 sha256과 권한(600)을 남기고, 별도 사본을 세션 임시 폴더에 둠 |
| `setup --dry-run` | 13:05 | 바꿀 내용 5줄 출력, exit 0. 두 파일 해시 그대로, `~/.gotechy` 생기지 않음 |
| 서식 확인 | 13:06 | `settings.json`을 다시 직렬화해도 원본과 바이트가 같음. 적용하면 정책만 늘어남 |
| `setup` | 13:06:20 | exit 0, 백업 `20261014T040620Z`. 의미 차이는 정책으로 넣은 5개 값뿐, 권한 600 유지 |
| `doctor` 정책 검사 | 13:06 | `ok 정책: 전역 설정에 정책이 들어가 있어요` |
| `setup --restore 20261014T040620Z` | 13:06:21 | exit 0. 두 파일의 sha256, 권한, 바이트(`cmp`)가 원본과 같음 |

- 백업 폴더와 manifest는 `~/.gotechy/backup/20261014T040620Z/`에 남아 있어요. 폴더 700, 파일 600이고, 백업 파일의 해시가 원본 해시와 같아요.
- 복원 전에 사용자가 파일을 바꾸면 복원이 멈추는 경로는 이 맥에서 일부러 만들지 않았어요. 실제 설정을 건드리지 않으려고, 임시 HOME 테스트(`tests/e2e/doctor-setup.test.ts`)의 결과로 대신해요.

## 로그

경로는 `~`와 `$S`(세션 임시 폴더)로 바꿨어요. 설정 파일의 내용은 싣지 않았어요.

마지막 "남은 임시 파일" 검사는 `gotechy` 글자를 넓게 찾다가 원래 있던 개인 파일 이름(10-13 생성)에 걸렸어요. setup의 임시 파일 형식(`.gotechy-` 뒤 16진수 12자)으로 다시 찾았을 때는 없었어요.

```text
### apply 2026-10-14T13:06:20+0900
~/.claude/settings.json
  env.DISABLE_AUTOUPDATER = "1"
  permissions.deny += Bash(gotechy decide:*)
  permissions.deny += Bash(script:*)
  permissions.deny += Bash(expect:*)
~/.codex/config.toml
  check_for_update_on_startup = false
적용했어요. 되돌리려면: gotechy setup --restore 20261014T040620Z
exit=0
### after apply
6c5a13efadc1e384cba80ba6cf5a33b54f4ef05d1aab8b03c5b8dac559eaa277  .claude/settings.json
79c2832d915440304ea04035e8eadae9ec28e8c69656deb9a72da26e61e50eed  .codex/config.toml
600 .claude/settings.json
600 .codex/config.toml
### 의미 차이 settings.json
permissions.deny: undefined => ["Bash(gotechy decide:*)","Bash(script:*)","Bash(expect:*)"]
env: undefined => {"DISABLE_AUTOUPDATER":"1"}
### 의미 차이 config.toml
check_for_update_on_startup: undefined => false
### 텍스트 차이 config.toml
0a1
> check_for_update_on_startup = false
### ~/.gotechy
700 ~/.gotechy
700 ~/.gotechy/backup
700 ~/.gotechy/backup/20261014T040620Z
600 ~/.gotechy/backup/20261014T040620Z/1.orig
600 ~/.gotechy/backup/20261014T040620Z/0.orig
600 ~/.gotechy/backup/20261014T040620Z/manifest.json
### backup 해시
212617a44d69d78e8603f29cb068999c7e502516dbfc75ca02e9ecf2b8bb5fb0  ~/.gotechy/backup/20261014T040620Z/0.orig
fd8583b23e493239dbac514306cc7788437d7f1645849e12ceec2b6263dbc2f6  ~/.gotechy/backup/20261014T040620Z/1.orig
### doctor 정책 줄
ok   정책: 전역 설정에 정책이 들어가 있어요
### restore 2026-10-14T13:06:21+0900
20261014T040620Z 백업으로 되돌렸어요.
exit=0
### after restore
sha 원본과 같음
권한 원본과 같음
바이트 원본과 같음
### 남은 임시 파일
gotechy-career.yaml
```
