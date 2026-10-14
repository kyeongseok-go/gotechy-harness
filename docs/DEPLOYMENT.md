# DEPLOYMENT.md — 배포·롤백·환경

> "동작하는 제품"은 **배포된** 제품을 뜻한다. 1인 개발에서 배포는 팀이 아니라 이 문서가 담당한다.

## 환경 매트릭스 (프로젝트별 교체)

| 환경 | 트리거 | URL | env 소스 |
|---|---|---|---|
| preview | PR push | (예: *.vercel.app) | 호스팅 preview env |
| production | main merge 또는 수동 | (도메인) | 호스팅 production env |

## 배포 명령

> 프로덕션 배포는 **에이전트가 실행하지 않는다** — 사용자가 직접 실행하거나 CI가 실행한다 (고위험 행동의 human-in-the-loop).

하네스 v2 라이브러리(이 저장소)에는 배포 명령이 없다. `harness-v2` 브랜치에 푸시한 커밋이 곧 배포다. 프로젝트는 `gotechy init`이 train의 `packs.ref` 커밋으로 팩을 받고, 도구는 `bin/gotechy`가 train의 버전으로 설치한다. 되돌리기는 train의 `packs.ref`와 도구 버전을 이전 값으로 돌린 커밋이다. 새 프로젝트의 배포 명령은 그 프로젝트의 이 문서에 적는다.

```bash
# 새 프로젝트에서 채운다. 예: vercel --prod / wrangler deploy / fly deploy
```

## 배포 전 체크

- [ ] `/gotechy-ship` 게이트 통과
- [ ] DB 마이그레이션 동반 여부 확인 — 동반 시 expand-contract(추가→마이그레이트→제거를 분리 배포), 롤백 계획 명시
- [ ] env 키 diff: `.env.example`의 키 목록과 배포 환경 키 목록 대조 (누락 키 = 배포 중단)

## 롤백 절차 (5분 안에 끝나야 한다)

1. 직전 배포가 원인이면 즉시 이전 배포로 롤백 (예: `vercel rollback` / 이전 deployment promote)
2. 마이그레이션 동반 배포는 코드만 롤백 불가 — expand-contract를 지켰다면 코드 롤백 안전, 아니면 쓰기 경로 차단 후 복구
3. 롤백 후: 원인을 인시던트 런북(docs/RELIABILITY.md)대로 기록

## 시크릿 수명주기

- 진실의 원천: `.env.example` (키 이름 + 주석으로 환경별 필수 여부. 값은 절대 없음)
- 주입: 호스팅 대시보드 또는 CLI (예: `vercel env add`) — 절차를 여기 기록
- 로테이션: 유출 의심 시 즉시 + 정기(분기 권장). 로테이션 후 배포 환경 갱신까지가 완료.
