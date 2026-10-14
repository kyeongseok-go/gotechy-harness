---
title: 1b N0 전제 확인 실험 (Secure Enclave, Bun 검증, 로컬 서버, Orca, Claude Code 확장)
date: 2026-10-14
type: evidence
audience: 고텍이
tags: [gotechy-harness, secure-enclave, touch-id, ecdsa, orca, claude-code]
---

# 1b N0 전제 확인 실험

오너가 외출한 동안(18:29~18:33, 커밋 기록 기준) 실험했어요. 결과 요약은 1b ExecPlan의 Surprises에 있어요. 실험 키는 세션 임시 폴더에만 만들었고 키체인에는 저장하지 않았어요.

## 파일

- `ownerkey.swift`: 실험용 Secure Enclave 도구(create, pub, sign). `swiftc -O -o ownerkey ownerkey.swift`로 빌드해요.
- `verify.ts`: Bun으로 서명을 검증하는 스크립트예요.
- `server.ts`: 127.0.0.1 서버가 요청마다 도구로 서명하고 검증하는 실험이에요.

## 실험 1, 2: 서명과 Bun 검증 (사람 확인 없는 키)

```text
### 1. 사람 확인 없는 키
exit=0 공개키 길이 124
blob 바이트 324
sign exit=0 서명 길이 96
곡선 prime256v1, 원문 검증 true, 바꾼 원문 검증 false
### 2. 다시 꺼낸 공개 키가 같은가
같음
### 3. blob이 개인 키 원문인가 (P-256 개인 키는 32바이트)
00000000: 0482 0140 3182 013c 3081 f50c 0272 6b31  ...@1..<0....rk1
00000010: 81ee 300b 0c03 6269 6404 0473 73d2 ca30  ..0...bid..ss..0
### 4. 사람 확인 필요 키 만들기
exit=0 공개키 길이 124
blob 바이트 427
```

## 실험 1: 사람 확인 키로 서명 (5초 제한)

```text
18:30:37
5초 동안 끝나지 않아 멈춤 (인증 대기로 보임)
stdout 길이        0, stderr:
남은 서명 프로세스 없음
```

인증 창이 실제로 떴는지, Touch ID를 통과하면 서명이 나오는지, 취소하면 실패하는지는 오너가 확인해야 해요(설명 문서의 "확인 필수").

## 실험 3: 로컬 서버

```text
포트 64054, 응답 {"exit":0,"ok":true}
```

## 추가 실험: verify 샌드박스 안에서 서명

```text
### 지금 verify 프로필 안에서 사람 확인 없는 키로 서명
exit=0
### 서비스 3개를 막은 프로필
exit=1 sign: Error Domain=NSCocoaErrorDomain Code=4099 "The connection to service named com.apple.ctkd.token-client was invalidated: failed at lookup with error 159 - Sandbox restriction."
```

막은 서비스: `com.apple.ctkd.token-client`, `com.apple.CoreAuthentication.daemon`, `com.apple.coreauthd`.

## 실험 4: Orca와 Claude Code

- Orca 1.4.209 `orca orchestration send --help`: `--type worker_done`, `--outcome succeeded|failed`, `--report-path`, `--files-modified`가 있어요.
- `claude agents --help`: "Manage background agents". `--json`, `--all`, `--cwd`가 있어요.
- Claude Code 문서 조사(mod, 상태 줄, hook, 폰 푸시, 세션에 알림 넣기)는 1b ExecPlan Surprises에 출처와 함께 적었어요.
