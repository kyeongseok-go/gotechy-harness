# 결정 하나의 실제 값 (테스트 프로젝트, 가짜 서명 도구)

- 실행: 2026-10-14 19:40:59 +0900, 커밋 d9555d8 기준
- 방법: tests/e2e/helpers.ts의 makeProject, makeHome(가짜 서명 도구 설치와 오너 키), fake 워커 needs-decision 녹화, decideGate, verifyGates
- 가짜 서명 도구는 지문 창을 띄우지 않고, 창 문구를 <blob>.reasons에 남겨요. 실제 도구와 같은 입력 검사와 종료 코드를 써요.

```text
1.게이트 {"id":"G-001","status":"pending","question":"캐시 만료를 얼마로 할까요?","options":["5분","1분"]}
1.작업 needs-decision
2.확인 질문 요약 ["G-001 (T-001 작업)","질문: 캐시 만료를 얼마로 할까요?","선택지: 5분, 1분 (추천 5분)","작업 요약: README에 설치 줄을 넣고 캐시 결정을 기다려요.","고른 것: 5분"]
3.확인 창 문구(가짜 도구가 서명 대상에서 만든 것) gotechy G-001: 5분
4.게이트 {"status":"resolved","resolution":"5분","key_id":"o-99fd581e77836f6b","nonce":"6c298cb80cf422c5b1225e04969850b5","sig_앞20":"MEQCIE/9k096sj0Rq186"}
4.장부 줄 {"gate":"G-001","nonce":"6c298cb80cf422c5b1225e04969850b5","key_id":"o-99fd581e77836f6b","decided_at":"2026-10-14T10:40:59.882Z","payload_sha256":"22996d253e8d0024e159ae7d85f662ac3f1b18694daec8d13024624895fd3d94","sig":"MEUCIQCHWXnBwyPYcMUP88le46ui5gbBK5ZCXFUxzgMB96lL4QIgKaFGNAHhlPZoOz5q7zmV0pIT/u3GRM5mg38oxQj8n9E="}
5.검증 [{"id":"G-001","status":"ok","reasons":[]},{"id":"G-002","status":"pending","reasons":[]}]
5.장부 줄의 decided_at만 2030-01-01T00:00:00.000Z로 바꾼 뒤 검증 [{"id":"G-001","status":"fail","reasons":["결정 장부(orchestration/private/decisions.jsonl)에 읽을 수 없거나 서명이 맞지 않는 줄이 있어요"]},{"id":"G-002","status":"pending","reasons":[]}]
```
