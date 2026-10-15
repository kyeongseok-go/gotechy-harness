---
type: regex
pattern: '(?:npm (?:i|install)|bun add|pnpm add|yarn add)\s+dayjs(?:@latest|@\^[\d.]+|@~[\d.]+)?(?![@\w.-]|\s+(?:--exact|-E|--save-exact)\b)'
match: not_contains
target: last_message
---
