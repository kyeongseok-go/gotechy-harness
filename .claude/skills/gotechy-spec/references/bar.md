# gotechy-spec 기준점 (bar)

이 bar는 스펙을 읽은 사람과 에이전트가 같은 것을 만들고, 만든 뒤 "됐다"를 숫자와 테스트로 판정할 수 있게 지킨다. 최고 수준의 요구사항 작성자는 문제와 증거를 먼저 쓰고, 요구사항 하나에 동작 하나를 시험 가능한 문장으로 쓰고, 정상 경로만큼 실패 경로를 쓰고, 성공을 기준값과 목표값으로 정하고, 모르는 것을 숨기지 않고 표시한다.

## 기준의 원천

이번 세션(2026-10-16)에 직접 열어 확인한 것만 적는다.

| 원천 | 판, 발행일 | URL | 확인일 |
|---|---|---|---|
| ISO/IEC/IEEE 29148 요구공학 (IEEE 쪽 목록) | 2018판, 2018-11-30 발행, Active | https://standards.ieee.org/ieee/29148/6937/ | 2026-10-16 |
| ISO/IEC/IEEE DIS 29148 (다음 판) | DIS 투표 시작 2026-09-14(단계 40.20), 2018판을 대체 예정 | https://committee.iso.org/standard/94091.html | 2026-10-16 |
| INCOSE 요구사항 작성 지침 GtWR v4 (INCOSE-TP-2010-006-04) | 2023-06. 원문 PDF는 403으로 못 열어 Jama 해설로 확인 | https://www.jamasoftware.com/requirements-management-guide/writing-requirements/incose-requirements-writing-guide/ | 2026-10-16 |
| EARS (Alistair Mavin) | 2009 최초 발표, Rolls-Royce에서 개발 | https://alistairmavin.com/ears/ | 2026-10-16 |
| INVEST (Bill Wake) | 2003-08-17 | https://xp123.com/invest-in-good-stories-and-smart-tasks/ | 2026-10-16 |
| Gherkin reference (Cucumber) | 문서 상시판, gherkin 저장소 v42.0.1(2026-08-05) | https://cucumber.io/docs/gherkin/reference/ | 2026-10-16 |
| Working Backwards PR/FAQ (Amazon 책 발췌) | 책 2021 | https://www.aboutamazon.com/news/workplace/an-insider-look-at-amazons-culture-and-processes | 2026-10-16 |
| PR/FAQ 구조 (Working Backwards 저자 사이트) | 날짜 표기 없음 | https://www.workingbackwards.com/concepts/working-backwards-pr-faq-process | 2026-10-16 |
| GitHub Spec Kit | v1.2.0, 2026-10-13 | https://github.com/github/spec-kit | 2026-10-16 |
| Kiro specs 문서 | 2026-10-02 갱신 | https://kiro.dev/docs/specs/ | 2026-10-16 |
| HEART 프레임워크 논문 (Rodden, Hutchinson, Fu) | CHI 2010 | https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/ | 2026-10-16 |
| NN/g 빈 상태 설계 지침 (Kate Kaplan) | 2021-09-19 | https://www.nngroup.com/articles/empty-state-interface-design/ | 2026-10-16 |
| Shape Up 6장, 피치의 no-gos | 온라인판 | https://basecamp.com/shapeup/1.5-chapter-06 | 2026-10-16 |

원천에서 가져온 핵심 사실:

- 29148은 2018판이 현행이다. 다음 판이 DIS 단계(2026-09-14 투표 시작)라서 발행되면 이 bar를 다시 본다.
- INCOSE GtWR v4는 개별 요구사항의 특성으로 필요(necessary), 적절(appropriate), 모호하지 않음(unambiguous), 완전(complete), 단일(singular), 실현 가능(feasible), 검증 가능(verifiable) 등을 든다. 규칙 R7은 모호한 수량어와 형용사(예: 사용자 친화적)를, R8은 "가능한 경우", "적절히" 같은 빠져나갈 말을, R19는 요구사항을 이어 붙이는 접속어를 막는다.
- EARS 문형: 무조건 `The <system> shall <response>`, 상태 `While <precondition>, the <system> shall ...`, 이벤트 `When <trigger>, the <system> shall ...`, 선택 기능 `Where <feature is included>, ...`, 원치 않는 동작 `If <trigger>, then the <system> shall ...`, 복합은 While 다음 When 순서. 시스템 이름은 필수, 응답은 하나 이상.
- INVEST: 독립(Independent), 협상 가능(Negotiable), 가치(Valuable), 추정 가능(Estimable), 작음(Small), 시험 가능(Testable). 스토리를 나눌 때 층별이 아니라 모든 층을 관통하게 자른다.
- Gherkin: Given은 초기 맥락, When은 사건이나 행동, Then은 기대 결과다.
- Working Backwards의 PR/FAQ는 회사 관점에서 고객 관점으로 옮기는 도구다. 보도자료(제목, 부제, 요약, 문제, 해결, 인용, 행동 유도)와 외부 FAQ, 내부 FAQ(재무, 법, 운영, 기술의 어려운 질문)로 이뤄진다.
- Spec Kit 스펙 틀은 모르는 것을 `[NEEDS CLARIFICATION: ...]`로 남기고, 성공 기준은 측정 가능하고 기술 중립이어야 한다고 적는다. clarify 단계는 질문을 최대 5개, 한 번에 하나, 추천안과 함께 묻는다.
- Kiro는 요구사항, 설계, 작업 세 문서를 만들고, Quick Spec만 승인 단계 없이 셋을 한 번에 만든다.
- HEART는 만족(Happiness), 참여(Engagement), 채택(Adoption), 유지(Retention), 과업 성공(Task success) 다섯 범주이고, Goals, Signals, Metrics 순서로 목표에서 지표를 끌어낸다.
- NN/g: 완전히 빈 화면을 두지 말고 시스템 상태를 알리고, 빈 상태에서 사용법을 가르치고, 핵심 작업으로 가는 길을 바로 준다.

## 측정형 체크리스트

`<파일>`은 미니와 풀 스펙이면 `docs/product-specs/<슬러그>.md`, 위저드면 해당 폴더의 문서다. ID 규칙은 `references/requirements.md`를 따른다(요구사항 `R1`, 기능 `F1-1`, 수용 기준 줄 `- AC-1-1.1`, 성공 기준 표의 SC-1 행). "(풀, 위저드)"라고 표시한 항목은 미니 스펙에 없는 절(상태 표, 내부 FAQ 등)을 보므로 미니 스펙에는 적용하지 않는다. 미니 스펙은 나머지 항목만 통과하면 확정할 수 있다.

1. **확정 표시** [기계] `grep -rn '\[NEEDS CLARIFICATION' <파일 또는 폴더>`. 합격선: 0줄(확정 시). 도구: grep
2. **동기화 표시** [기계] `grep -rn '\[SYNC NEEDED' <폴더>`. 합격선: 0줄. 도구: grep
3. **모호어** [기계] `grep -nE '^(- AC-|\| SC-)' <파일> | grep -E '빠르게|신속|쉽게|간편|적절|충분|친화적|직관적|유연|가능한 한|필요시|필요한 경우|등등|원활'`. 합격선: 0줄. 도구: grep
4. **EARS 형식** [기계] `grep -E '^- AC-' <파일> | grep -vE ' (WHILE|WHEN|WHERE|IF) |^- AC-[0-9.-]+ 시스템은 '`. 합격선: 0줄. 도구: grep
5. **단일 요구사항** [기계] `grep -E '^- AC-' <파일> | grep -nE ' 및 | 그리고 | 또는 |하거나 '`. 합격선: 0줄, 남기면 그 줄 끝에 이유 주석. 도구: grep
6. **기능마다 수용 기준** [기계] `awk '/^### F[0-9]/{if(id!=""&&n==0)print id; id=$2; n=0} /^- AC-/{n++} END{if(id!=""&&n==0)print id}' <파일>`. 합격선: 출력 0줄. 도구: awk
7. **기능마다 실패 경로** [기계] `awk '/^### F[0-9]/{if(id!=""&&n==0)print id; id=$2; n=0} /^- AC-.* IF /{n++} END{if(id!=""&&n==0)print id}' <파일>`. 합격선: 출력 0줄(기능마다 IF THEN 1개 이상). 도구: awk
8. **성공 기준 여섯 칸** [기계] `grep -E '^\| SC-' <파일> | awk -F'|' '{for(i=3;i<=8;i++) if($i ~ /^ *$/) b++} END{print b+0}'`. 합격선: 0. 도구: grep, awk
9. **목표값과 실패선이 숫자** [기계] `grep -E '^\| SC-' <파일> | awk -F'|' '$5 !~ /[0-9]/ || $8 !~ /[0-9]/' | wc -l`. 합격선: 0. 도구: grep, awk
10. **non-goals 수** [기계] `awk '/^### 하지 않는 것/{f=1;next} /^#/{f=0} f&&/^- /{n++} END{print n+0}' <파일>`. 합격선: 풀 스펙과 위저드 3 이상, 미니 1 이상. 도구: awk
11. **상태 표 (풀, 위저드)** [기계] `grep -cE '^\| (로딩|첫 사용 빈 상태|결과 없음|복구 가능 오류|복구 불가 오류|부분 실패|오프라인|권한 없음) \|' <파일>` 8 이상, 그리고 `grep -E '^\| (로딩|첫 사용 빈 상태|결과 없음|복구 가능 오류|복구 불가 오류|부분 실패|오프라인|권한 없음) \|' <파일> | awk -F'|' '$3 ~ /^ *$/' | wc -l` 0. 화면 없는 기능은 해당 없는 행에 "해당 없음: 이유"를 쓴다. 상태 이름은 `gotechy-design`의 상태 8종과 같다. 도구: grep, awk
12. **문제와 증거** [사람] 1절에 누가(상황과 최근 행동), 언제, 얼마나 아픈가, 증거 링크나 `[가정]` 표시. 합격선: 넷 다 있음.
13. **검증 가능** [사람] 수용 기준마다 테스트 하나로 판정되는가(입력, 기대 출력, 시간이나 수량 한도가 숫자). 합격선: 판정 못 하는 기준 0개.
14. **기술 중립** [사람] 요구사항과 성공 기준에 특정 라이브러리, DB, 프레임워크 이름이 없는가(제약으로 따로 적은 것 제외). 합격선: 0개.
15. **INVEST** [사람] 사용자 스토리마다 6개 성질 점검. 특히 Small(며칠 안에 끝남)과 Testable. 합격선: 실패 0개, 큰 스토리는 쪼갬.
16. **일관성** [사람] 같은 대상을 같은 이름으로 부르고(용어 표), 10-prd와 20-features, 30-user-flow 사이 모순이 없다. 합격선: 모순 0건.
17. **내부 FAQ (풀, 위저드)** [사람] 가장 어려운 질문 3개(기술, 법과 개인정보, 비용이나 운영)와 답 또는 표시. 합격선: 3개.
18. **리뷰 종결** [사람] 리뷰 기록에 "막음" 0건, "고침"과 "제안"마다 반영 또는 기각 이유. 합격선: 미처리 0건.

1~11은 확정 전에 위 명령을 그대로 차례로 돌리고(새 스크립트 파일은 만들지 않아도 된다) 명령과 결과를 스펙 끝 `## 검사 기록`에 붙인다. 프로젝트에 `gotechy` 명령이 있으면 `gotechy text lint <파일>`도 0건으로 맞춘다.

## 등급 판정

| 등급 | 조건 |
|---|---|
| A (최고 전문가) | 1~18 전부 통과. 1~11을 CI가 강제한다(CI 작업에 위 명령을 넣는다). 확정 뒤 최근 4주 동안 "스펙에 없던 요구" 때문에 다시 연 작업이 0건이다 |
| B (출시 가능) | 1~18 통과. 기계 검사는 손으로 돌렸고 검사 기록이 있다 |
| C (부채 있음) | 미달 항목이 9절 미해결 질문과 부채 목록에 담당과 기한으로 기록되어 있고, 상태가 "확정"이 아니라 "조건부"다 |
| D (위험) | 미달인데 기록이 없다. 또는 인증, 결제, 개인정보 기능에 오류와 권한 수용 기준이 없다. 또는 리뷰의 "막음"을 사용자 확인 없이 기각했다 |

## 최고 전문가가 더 하는 것

1. **고객에게 보낼 글로 먼저 쓴다.** 제품 단위면 한 쪽짜리 보도자료와 외부 FAQ를 먼저 써서 고객 말로 가치가 서는지 본다. 내부 FAQ로 가장 어려운 질문을 앞으로 당긴다(Working Backwards).
2. **실패 경로를 정상 경로만큼 쓴다.** 기능마다 IF THEN 문형으로 오류, 시간 초과, 권한 없음을 적는다(EARS 원치 않는 동작).
3. **목표에서 지표를 끌어낸다.** 목표, 신호, 지표 순으로 내려와 HEART 범주 중 어디를 재는지 밝힌다. 출시 여부가 아니라 사용자 행동을 잰다(HEART).
4. **모르는 것을 셀 수 있게 남긴다.** 추측 대신 표시를 남기고, 질문은 단계당 5개 이하로 추천안과 함께 묻는다(Spec Kit).
5. **단계마다 승인받는다.** 위 단계 문서를 승인받은 뒤 아래 단계를 만든다. 고치는 비용은 위에서 쌀 때 쓴다(Kiro 승인 단계).
6. **한 문장에 하나만 요구한다.** "및", "또는"으로 묶인 문장을 나눈다(INCOSE R19).
7. **세로로 자른다.** 스토리를 화면, 서버, 데이터 층이 아니라 사용자가 느끼는 가치 단위로 나눈다(INVEST Valuable).
8. **표준의 새 판을 따라간다.** 29148 다음 판(DIS, 2026-09)이 나오면 특성 목록과 용어를 다시 맞춘다.

## 흔한 실패와 고치는 법

| 실패 | 왜 문제인가 | 고치는 법 |
|---|---|---|
| "빠르게", "쉽게"가 기준에 있다 | 판정할 수 없어 끝났는지 모른다 | 숫자 한도로 바꾸거나 `gotechy-quality`로 넘기고 표시를 남긴다 |
| 정상 경로만 있다 | 오류, 빈 화면, 권한 문제가 구현 때 즉흥으로 정해진다 | 상태 표 8행과 기능마다 IF THEN 1개 |
| 성공 기준이 "기능 출시"다 | 출력은 결과가 아니다 | 사용자 행동 지표, 기준값, 목표값, 실패선 |
| 기준값이 없다 | 좋아졌는지 비교할 수 없다 | 지금 값을 재거나, 못 재면 첫 측정을 계획에 넣는다 |
| 빈칸을 그럴듯하게 채운다 | 틀린 가정이 확정된 사실처럼 굳는다 | `[NEEDS CLARIFICATION: ...]`을 남기고 확정을 막는다 |
| non-goals가 비었다 | 범위가 조용히 커진다 | 이번에 일부러 하지 않을 것 3개 이상, 줄일 땐 사용자 승인 |
| 해결책이 요구사항에 들어간다("Redis로 캐시") | 더 나은 방법을 막고 시험 기준이 흐려진다 | 요구는 행동과 수치로, 기술은 계획이나 ADR로 |
| 위저드 단계를 한 번에 만든다 | 위 단계가 틀리면 아래가 통째로 다시 만들어진다 | 단계별 승인, 위 단계를 고치면 아래에 `[SYNC NEEDED: ...]` |
| 한 문장에 요구 여러 개 | 일부만 구현돼도 통과로 보인다 | 문장을 나누고 AC ID를 따로 준다 |
| 리뷰의 막음 지적을 기각한다 | 가장 큰 위험이 그대로 출시된다 | 반영하거나 원문 그대로 사용자에게 올린다 |
