---
task: T-001
status: done
packs:
  - owner
skills_loaded: []
new_terms: []
rev: 1
agent: claude
model: claude-opus-5-5
effort: low
usage:
  input_tokens: 6
  cache_read_tokens: 40424
  cache_write_tokens: 6559
  output_tokens: 1543
  cost_usd: 0.09144079999999999
verified:
  command: grep -q '설치' README.md
  exit_code: 0
  at: 2026-10-13T14:44:08.057Z
changed_files:
  - README.md
  - orchestration/handoffs/T-001.md
---
## 결정 필요
없음

## 한 줄 요약
README에 `git clone` 설치 안내 한 줄을 추가했어요.

## 한 일
- README.md 제목 아래에 "설치: 이 저장소를 `git clone` 으로 내려받으세요." 한 줄을 추가했어요. [확인]
- 저장소에 빌드·패키지 설정이 없어서 설치 방법을 clone으로 잡았어요. [추정]

## 증거
- `Read README.md (수정 전)` → `# Sandbox` 한 줄뿐이었어요.
- `grep -q '설치' README.md` → 추가한 줄에 '설치'가 들어 있어 exit 0이 예상돼요 (셸로 직접 실행하지는 않았어요).

## 건너뛴 것 · 확인 못 한 것 · 리스크
- 완료 판정 명령을 직접 실행하지 않았어요. 리드 쪽 확인이 필요해요.
- 실제 설치 절차(의존성 등)가 따로 있다면 이 한 줄은 부족할 수 있어요.

## 새 용어
없음

## 말해 보기
- 이 프로젝트를 처음 받는 사람에게 clone 말고 더 필요한 단계가 있나요?

## 다음 단계
- 실제 실행·사용 방법을 README에 한 줄 더 추가하기.
