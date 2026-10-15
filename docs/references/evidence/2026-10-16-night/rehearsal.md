---
title: 새 프로젝트 리허설 (빈 폴더에서 init부터 accept까지)
date: 2026-10-16
status: 실측(워커는 녹화 재생)
---

# 새 프로젝트 리허설

`docs/GETTING_STARTED.md` 순서가 실제로 도는지 빈 폴더에서 확인했어요. 실제 `~/.gotechy`를 건드리지 않게 `GOTECHY_HOME`은 임시 폴더로 두었고, 워커는 녹화 재생(fake)이라 유료 실행은 없어요. 팩은 공개 저장소의 train 커밋(aa499c8)에서 실제 apm으로 받았어요.

| 단계 | 명령 | 결과 |
|---|---|---|
| 1 | `git init`, 첫 커밋 | ok |
| 2 | `gotechy init --packs all` | 실제 apm으로 GitHub에서 스킬 15개를 `.claude/skills`와 `.agents/skills`에 설치, 10초. AGENTS.md 팩 색인 표를 15줄로 채움 |
| 3 | `gotechy doctor`(프로젝트 안) | 팩: 깔린 파일이 apm.lock.yaml, train 커밋과 같음. 프로젝트 설정 env: 문제없음. 스킬 수 15개 |
| 4 | `gotechy task new ... --agent fake --packs owner,build` | T-001 |
| 5 | `gotechy run T-001` | done, 리드 verify exit 0. 워커 지시문에 "이번 작업의 전문가 기준" 절과 `### gotechy-build`가 들어갔고 `skills_loaded: [gotechy-build]`로 미리 채워짐 |
| 6 | `gotechy inbox`, `gotechy render T-001` | 완료 카드 1건, HTML 화면 |
| 7 | `gotechy accept T-001` | 병합 전 gitleaks 검사를 거쳐 메인에 병합 |

doctor의 도구 항목 6개(`mise`, `node`, `uv`, `gh`, `claude`, `codex`)는 이 리허설에서 PATH를 bun, apm, gitleaks만으로 좁혀서 "설치되지 않음"으로 나왔어요. 오너가 `bin/gotechy`로 실행하면 train의 mise 도구가 PATH에 잡혀요. 이 부분은 하네스 결함이 아니에요.

## 확인하지 못한 것

- 실제 claude나 codex 워커로 같은 작업을 돌리지는 않았어요(유료). 지시문에 팩 본문이 들어가는 것까지만 확인했어요.
- `gotechy serve`와 `decide`는 오너 전용이라 돌리지 않았어요.
