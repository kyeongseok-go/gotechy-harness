---
id: T-001
title: README에 설치 방법 한 줄 추가
status: done
packs:
  - owner
tier: T0
deps: []
ownership:
  - README.md
data_class: public
autonomy: L0
verify: grep -q '설치' README.md
irreversible: false
gate: none
created_at: 2026-10-13T14:43:42.814Z
agent: claude
effort: low
---
## Target
README.md

## Change
README에 설치 방법 한 줄 추가

## Constraints
- ownership 밖의 파일은 바꾸지 않는다.

## Ownership
- README.md

## Observable acceptance
- `grep -q '설치' README.md` 가 exit 0
