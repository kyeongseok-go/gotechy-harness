---
task: T-003
status: needs-decision
packs: [owner]
skills_loaded: [owner-protocol]
new_terms: [정규식]
rev: 1
agent: claude
model: claude-sonnet-5-5
usage:
  input_tokens: 41200
  cache_read_tokens: 0
  cache_write_tokens: 0
  output_tokens: 3900
  cost_usd: 0.21
verified:
  command: bun test tests/deadline.test.ts
  exit_code: 0
  at: 2026-10-15T05:40:00.000Z
changed_files:
  - src/deadline.ts
  - tests/deadline.test.ts
  - orchestration/handoffs/T-003.md
---
## 결정 필요
- [막는] 날짜가 "10. 20.(월)"처럼 연도 없이 오면 어느 해로 볼까요?
  - 선택지: 공문 시행일의 해, 올해, 사람에게 묻기
  - 추천: 공문 시행일의 해
  - 이유: 공문은 시행일 기준으로 쓰여요. 연말 공문만 다음 해로 넘어가는지 따로 봐요
- [막는] 마감 시각이 없으면 몇 시로 둘까요?
  - 선택지: 18시, 24시, 비워 두기
  - 추천: 18시
  - 이유: 학교 공문 회신은 보통 근무 시간 안에 받아요
- [기본값] 붙임 파일 이름의 날짜를 마감으로 볼까요?
  - 선택지: 보지 않기, 보기
  - 추천: 보지 않기
  - 이유: 붙임 이름의 날짜는 작성일인 경우가 많아요

## 한 줄 요약
공문 본문에서 마감일과 근거 문장을 뽑는 함수를 만들었고, 연도 없는 날짜 처리만 결정을 기다려요.

## 한 일
- 본문에서 "2026. 10. 20.(월) 18:00까지" 같은 마감 표현을 찾는 함수를 만들었어요. [확인]
- 찾은 마감마다 근거 문장과 줄 번호를 함께 돌려줘요. [확인]
- 연도 없는 날짜는 지금 공문 시행일의 해로 두었어요. [추론]

## 증거
- `bun test tests/deadline.test.ts`: 12개 통과

## 건너뛴 것, 확인 못 한 것, 리스크
- 표 안의 날짜는 아직 읽지 않아요. [확인]
- 실제 공문 파일(HWP)로는 확인하지 않았어요. 시험은 글로 옮긴 문장만 썼어요. [확인]

## 새 용어
- 정규식: 글에서 정해진 모양(예: 날짜)을 찾는 규칙이에요.

## 말해 보기
- 연도 없는 날짜를 시행일의 해로 보면 어떤 공문에서 틀리나요?

## 다음 단계
- 결정대로 연도 규칙을 고치고, 표 안의 날짜 읽기를 다음 작업으로 나눠요.
