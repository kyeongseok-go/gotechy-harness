---
type: regex
pattern: '(사용자\s*흐름|유저\s*플로우|user\s*flow)[^\n]{0,40}(먼저|없어|없으|필요|부터)'
flags: i
match: not_contains
target: last_message
---
