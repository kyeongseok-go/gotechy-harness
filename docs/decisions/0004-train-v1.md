# 0004. 첫 세팅 train v1: macOS 우선, 검증된 버전 묶음 그대로 설치

- 상태: 승인됨
- 날짜: 2026-10-14 (결정 D13, 2026-10-13)
- 관련: [설계 문서 10-1절, 12절 D13](../design-docs/2026-10-13-expert-library-v0.md), [1a ExecPlan M0, M3](../exec-plans/completed/2026-10-13-harness-v2-phase1.md)

## 맥락

컴퓨터를 바꾸거나 새로 세팅할 때 도구 버전이 조금씩 달라 "내 컴퓨터에서는 되는데"가 생긴다. 에이전트 CLI는 릴리스가 잦고 설정 형식도 자주 바뀐다. 한 번에 같은 묶음을 깔고, 버전이 어긋났는지 기계로 확인해야 한다.

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| A. train(함께 검증된 버전 묶음)을 mise 락과 apm 락으로 고정, macOS 우선 (선택) | 체크섬으로 검증한 바이너리, `install --locked`로 재현(M0: 8개 도구 79초) | 묶음 갱신 절차와 CI가 필요하다 |
| B. 도구마다 최신 설치 | 단순 | 재현 불가, 깨지는 날을 고를 수 없다 |
| C. 컨테이너 개발 환경 | 완전 격리 | GUI 도구(Orca)와 맥 키체인을 쓰기 어렵다 |

## 결정

A. train v1 = `Claude Code`, `Codex`, `Orca`, `mise`, `apm`, `node`, `uv`, `gh`(+ `gitleaks`, 구현 스택 `bun`). macOS 우선, Windows는 회사 모드로 2순위, Linux는 CI 검증만. Cursor CLI 같은 도구는 쓰기 시작할 때 더한다(파일 계약으로는 지금도 동작). 갱신은 자동 감지, doctor와 eval 통과 시 적용, 실패하면 이전 train으로 돌아간다.

## 결과 (Consequences)

- 쉬워지는 것: 새 컴퓨터에서 같은 결과. doctor가 어긋난 버전과 교정 명령을 알려 준다.
- 어려워지는 것: 다른 OS의 보안 장치가 따로 필요하다. 예: verify 샌드박스는 지금 macOS `sandbox-exec`에만 있다(TD-009).
- 현재 상태(2026-10-14 18:14): A등급 도구 6개(`bun`, `node`, `uv`, `gh`, `apm`, `gitleaks`)를 13:23에 `mise.toml`과 `mise.lock`에 고정했고, train.yaml, setup, doctor, 부트스트랩이 있다. 새 클론과 빈 HOME에서 52초에 설치된다. 처음에는 claude, codex를 B등급(설치 시점 고정)으로 뒀지만, 새 설치에서 train 버전을 보장하지 못해(1a ExecPlan Surprises) 18:14에 A등급(mise 고정)으로 올렸다. 새 클론과 빈 HOME에서 doctor 13개 검사가 모두 통과한다(2분 31초). 오너 확인 전 기본값이다.
