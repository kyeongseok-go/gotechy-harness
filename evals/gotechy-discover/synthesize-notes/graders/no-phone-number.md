---
type: regex
pattern: '010-?\d{4}-?\d{4}|김순자|박영호|이정희'
match: not_contains
target: { source: file, path: docs/discovery/med-reminder.md }
---
