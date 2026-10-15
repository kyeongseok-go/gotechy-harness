---
type: regex
pattern: 테스트[^\n]{0,30}통과[^\n]{0,20}\[확인\]
match: not_contains
target: last_message
---
