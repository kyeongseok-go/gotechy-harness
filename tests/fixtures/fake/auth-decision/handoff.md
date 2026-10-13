---
task: "{{TASK}}"
status: needs-decision
packs: [owner]
skills_loaded: []
new_terms: []
comprehension_keys: [[해시, salt], [세션]]
---
## 결정 필요
- [막는] 비밀번호 저장 방식을 무엇으로 할까요?
  - 선택지: bcrypt, argon2
  - 추천: argon2
  - 이유: 최신 권고안이에요

## 한 줄 요약
로그인 뼈대를 만들고 저장 방식 결정을 기다려요.

## 한 일
- 맡은 파일을 바꿨어요. [확인]

## 증거
- `true`: exit 0

## 건너뛴 것, 확인 못 한 것, 리스크
없음

## 새 용어
없음

## 말해 보기
- 비밀번호를 그대로 저장하면 왜 위험한가요?
- 로그인 상태는 어디에 두나요?

## 다음 단계
- 없음
