---
task: "{{TASK}}"
status: done
packs: [owner]
skills_loaded: [owner-protocol]
new_terms: []
---
## 결정 필요
없음

## 한 줄 요약
README에 설치 줄을 넣고 캐시 만료를 5분으로 바꿨어요.

## 한 일
- README.md에 설치 줄을 추가했어요. [확인]
- src/cache.ts의 캐시 만료를 5분으로 바꿨어요. [확인]

## 증거
- `grep -q 설치 README.md`: exit 0

## 건너뛴 것, 확인 못 한 것, 리스크
없음

## 새 용어
없음

## 말해 보기
- 캐시 만료는 왜 5분인가요?

## 다음 단계
- 없음
