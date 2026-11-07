---
type: regex
pattern: '(non-scaling-stroke|vector-effect)[^\n]{0,80}(빼|제거|지우|없애|쓰지 말|끄|remove|none)|(빼|제거|지우|없애|쓰지 말|끄)[^\n]{0,40}(non-scaling-stroke|vector-effect)'
flags: i
target: last_message
---
