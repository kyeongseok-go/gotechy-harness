---
paths:
  - "src/**/*.{ts,tsx}"
  - "app/**/*.{ts,tsx}"
  - "components/**/*.{ts,tsx}"
  - "lib/**/*.{ts,tsx}"
  - "hooks/**/*.{ts,tsx}"
  - "packages/**/*.{ts,tsx}"
---
# 코드 스타일 규칙 (TS/React)

- TypeScript strict. `any` 사용 시 `// any 사유:` 주석 필수.
- 경계에서 파싱: 외부 입력(API 응답·폼·URL 파라미터)은 스키마 검증을 거쳐 내부 타입으로 변환한 뒤 사용한다.
- import 방향은 ARCHITECTURE.md 레이어 규칙을 따른다. 이 라이브러리는 `bun run check:boundaries`(`tests/boundaries/`)가 강제한다(core는 순수, runtime은 cli를 부르지 않음). 새 프로젝트 템플릿은 dependency-cruiser(`.dependency-cruiser.cjs`)를 쓴다.
- 함수 이름은 동사로 시작, 컴포넌트는 명사. 파일 하나에 export 주체 하나.
- 주석은 "코드가 말할 수 없는 제약"만 (왜 이 순서여야 하는지, 어떤 버그를 피하는지).
- 에러는 삼키지 않는다 — 처리하거나, 타입에 실어 올리거나, 로깅과 함께 재던진다.
