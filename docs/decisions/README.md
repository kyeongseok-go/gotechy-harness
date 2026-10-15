# decisions/ — 의사결정 기록 (ADR)

> 구조·기술 선택의 "왜"를 남긴다. 6개월 뒤의 나(또는 에이전트)가 "이거 왜 이렇게 했지?"라고 물을 때의 답.

## 언제 ADR을 쓰는가

- 새 의존성·프레임워크·인프라 도입
- 레이어 구조·데이터 모델의 변경
- 한 번 정하면 되돌리기 비싼 모든 것
- ExecPlan Decision Log에서 "ADR 승격" 표시된 결정

## 규칙

- 파일명: `NNNN-결정-슬러그.md` (예: `0001-use-nextjs-app-router.md`)
- 템플릿: [_template-adr.md](_template-adr.md)
- ADR은 **불변** — 결정이 바뀌면 새 ADR을 쓰고 이전 것을 "대체됨"으로 표시한다 (역사를 지우지 않는다).

## 색인

| # | 결정 | 상태 | 날짜 |
|---|---|---|---|
| [0001](0001-harness-stack-typescript-bun.md) | 하네스 구현 스택: TypeScript + Bun (차선: Python 3.14 + uv) | 승인됨 | 2026-10-14 |
| [0002](0002-distribution-files-agents-apm.md) | 배포: 파일이 정본, AGENTS.md가 라우터, apm이 설치기 (D5) | 승인됨 | 2026-10-14 |
| [0003](0003-orchestration-file-contract-adapters.md) | 오케스트레이션: 파일 계약이 원천, 어댑터는 Orca와 native 둘 (D7) | 승인됨 (Orca 어댑터 부분은 0007로 대체) | 2026-10-14 |
| [0004](0004-train-v1.md) | 첫 세팅 train v1: macOS 우선, 검증된 버전 묶음 (D13) | 승인됨 | 2026-10-14 |
| [0005](0005-decision-signing.md) | 오너 결정 서명: HMAC과 원천에서 계산한 필수 게이트 | 서명 방식은 0006으로 대체 | 2026-10-14 |
| [0006](0006-owner-auth-secure-enclave.md) | 오너 인증: Secure Enclave 키와 Touch ID로 결정에 서명 | 승인됨 (2026-10-16, 맥 로그인 암호 확인) | 2026-10-14 |
| [0007](0007-orca-screen-only.md) | Orca는 화면과 알림에만, 워커 실행은 native (0003의 Orca 어댑터 부분 대체) | 승인됨 | 2026-10-16 |
