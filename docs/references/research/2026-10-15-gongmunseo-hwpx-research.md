---
title: 공문서 업무 AX 에이전트 첫 조각 조사 (HWP/HWPX 형식, 라이브러리, 공문서 작성 규칙)
date: 2026-10-15
status: draft
sources_checked_at: 2026-10-15
---

# 공문서 업무 AX 에이전트 첫 조각 조사

> 표기 규칙이에요.
> [확인]은 1차 출처를 직접 읽은 사실이에요.
> [추론]은 확인한 사실에서 끌어낸 판단이에요.
> [확인 못 함]은 출처를 찾지 못했거나 읽지 못한 항목이에요.
> (S번호)는 맨 아래 출처 목록을 가리켜요. 모든 출처는 2026-10-15에 확인했어요.
> 라이브러리 저장소의 README는 그 라이브러리에 대한 1차 출처로 보았어요. 다만 그 안의 자체 측정 수치는 재현하지 않았어요.

## 한 줄 요약

받는 공문은 HWP 5.0과 HWPX가 섞여 들어오고, 회신은 HWPX로 써야 해요.
읽기는 공개 스펙(HWP 5.0 PDF)과 Apache/MIT 라이브러리로 충분히 구현할 수 있어요.
쓰기는 표준 원문(KS X 6101, 유료)과 실제 한글 동작이 어긋날 수 있어요.
그래서 "실제 한글에서 열림" 게이트가 꼭 필요해요. [추론]

## 형식별 정리

### HWPX (OWPML, KS X 6101)

**표준과 버전**

- [확인] HWPX는 국가표준 KS X 6101(OWPML)을 따르는 XML 기반 형식이에요. (S3, S8)
- [확인] KS X 6101은 2011-12-30에 제정됐어요. 최종 개정은 2024-10-30(과기정통부 고시 제2024-15호)이에요. (S9)
- [확인] 개정 이력은 2015, 2018-11-08, 2024-10-30 세 번이에요. (S8, S10)
- [확인] 1차 개정일은 출처마다 달라요. 한컴 FAQ는 2015-07-18, KSSN은 2015-07-28로 적어요. (S8, S10)
- [확인] 표준 원문은 410쪽이고, KSSN에서 PDF 242,000원에 팔아요. 발행기관은 한국표준협회예요. (S10)
- [확인] 표준 범위에는 "바이너리 HWP를 100% 호환하는 규격"과 "문서 호환성 평가 기준"이 들어 있어요. (S9, S10)
- [확인] 한컴 FAQ는 OWPML을 누구나 구현할 수 있는 비독점 개방 형식이라고 설명해요. (S8)
- [확인] 2023-03에 OWPML을 포함한 신규 표준안이 ISO/TC 171 신규 프로젝트로 채택됐어요. 기사는 2026년 제정을 예상했어요. (S46)
- [확인 못 함] ISO 표준화가 2026년에 실제로 끝났는지는 확인하지 못했어요.
- [확인] 한컴 다운로드 센터는 HWP 3.0/HWPML, HWP 5.0, 배포용 문서, 수식, 차트 스펙만 내려받게 해요. OWPML 스펙 문서는 목록에 없어요. (S1)

**파일 구조** (ZIP 컨테이너)

- [확인] HWPX는 XML 파일들을 ZIP으로 묶은 패키지예요. 확장자를 zip으로 바꾸면 풀 수 있어요. (S3)
- [확인] `mimetype`은 HWPX임을 알리는 서명 파일이에요. (S3) 값은 `application/hwp+zip`이에요. (S15, S17)
- [확인] `version.xml`은 OWPML 형식 버전과 저장 환경 정보를 담아요. (S3)
- [확인] `settings.xml`은 캐럿 위치 같은 외부 설정을 담아요. (S3, S5)
- [확인] `Contents/content.hpf`는 OPF 규격의 패키지 목록이에요. metadata, manifest, spine 세 부분으로 나뉘어요. (S3)
- [확인] 본문 구역 파일은 spine 순서대로 읽어야 해요. manifest 순서는 의미가 없어요. (S3, S5)
- [확인] `Contents/header.xml`은 글자 모양, 문단 모양 같은 매핑 정보와 문서 설정을 담아요. HWP의 DocInfo와 비슷해요. (S3)
- [확인] header.xml에는 `beginNum`(시작 번호)과 `refList`(글꼴, 테두리, 글자/문단 속성, 탭, 번호, 스타일)가 있어요. (S5)
- [확인] `Contents/section0.xml`부터 구역마다 파일이 하나씩 생겨요. 본문은 `hp:p` 안의 `hp:run` 안의 `hp:t`에 있어요. (S3)
- [확인] `META-INF/`에는 container.xml, manifest.xml, container.rdf가 있어요. 암호 문서는 manifest.xml에 파일별 암호 정보를 둬요. (S3)
- [확인] `BinData/`는 그림과 OLE 개체, `Scripts/`는 스크립트, `Preview/`는 미리보기 그림과 텍스트를 담아요. (S3)
- [확인] container.xml의 rootfile은 `Contents/content.hpf`를 가리키고 media-type은 `application/hwpml-package+xml`이에요. (S15)
- [확인] 주요 네임스페이스는 `http://www.hancom.co.kr/hwpml/2011/...` 계열이에요. hp(paragraph), hs(section), hh(head), hc(core) 등이 있어요. (S5, S15)
- [확인] 한컴 블로그는 문서 버전마다 네임스페이스가 다를 수 있다고 해요. 예시 하나는 `http://www.owpml.org/owpml/2023/app`을 써요. (S5)
- [확인] version.xml 속성 이름은 철자가 `tagetApplication`이에요(r가 빠짐). hwpxlib와 python-hwpx 모두 이 철자를 써요. (S15, S17)

**최소 유효 HWPX** (표준 원문 미확인, 구현체 기준)

- [확인 못 함] KS X 6101 원문이 정한 최소 필수 파일 목록은 읽지 못했어요(유료).
- [확인] hwpxlib의 빈 문서 생성기는 version.xml, container.xml, content.hpf, header.xml, settings.xml, section0.xml을 만들어요. (S15)
- [확인] hwpxlib 쓰기 순서는 mimetype, version.xml, META-INF/manifest.xml, META-INF/container.xml, content.hpf, 본문 파일 순이에요. (S15)
- [확인] python-hwpx 검증기는 mimetype과 META-INF/container.xml이 없으면 오류로 봐요. version.xml이 없으면 경고만 내요. (S17)
- [확인] python-hwpx 검증기는 mimetype이 첫 ZIP 항목이고 무압축(STORED)이어야 한다고 봐요. (S17)
- [확인] 반면 hwpxlib는 mimetype을 첫 항목으로 쓰지만 기본값인 압축(DEFLATED)으로 저장해요. (S15)
- [추론] 두 구현이 다르므로 한글은 압축된 mimetype도 받아 주는 것으로 보여요. 그래도 "첫 항목 + 무압축"이 양쪽을 모두 만족하는 안전한 선택이에요.
- [확인] python-hwpx 검증기는 Preview/PrvText.txt가 없으면 경고를 내요. 맥용 한글 호환에 필요할 수 있다고 적었어요. (S17)
- [추론] 첫 조각의 최소 세트 후보는 mimetype, version.xml, settings.xml, META-INF/container.xml, META-INF/manifest.xml, Contents/content.hpf, Contents/header.xml, Contents/section0.xml, Preview/PrvText.txt예요. 실제 한글 열기로 검증해야 해요.
- [확인] 2014년 hwp-foss 토론에서 한글 구현이 표준과 다르거나 표준에 없는 기능을 쓴다는 지적이 있었어요. 오래된 글이에요. (S47)

**한컴 공식 도구**

- [확인] 한컴은 hwpx-owpml-model(C++, Apache-2.0)을 공개했어요. 빌드 환경은 Windows 10, Visual Studio 2017만 안내해요. 마지막 push는 2023-10-24예요. (S11, S12)
- [확인] 한컴 dvc는 HWPX가 정해진 서식 규칙을 지켰는지 검사하는 C++ 도구예요. Windows용이고 마지막 push는 2023-09-26이에요. 라이선스는 GitHub에서 NOASSERTION으로 나와요. (S13)
- [확인] 한컴은 HWP를 HWPX로 바꾸는 변환기를 무상 배포한다고 밝혀요. (S8)

### HWP 5.0 (바이너리)

**공식 스펙과 이용 조건**

- [확인] 한컴은 2010-06-29에 HWP 바이너리 형식을 공개했고, 2014-10에 HWP 5.0 보완, 배포용 문서, 수식, 차트 스펙을 공개했어요. (S1)
- [확인] 현재 PDF는 "한글 문서 파일 형식 5.0 revision 1.3"(2018-11-08)이에요. 1.0은 2010-07-01이에요. (S2)
- [확인] 수식, 차트, 배포용 문서는 별도 문서로 설명한다고 적혀 있어요. (S2)
- [확인] 열람, 복사, 배포, 게재, 사용은 자유예요. 단 배포는 수정하지 않은 원본이나 복사본만 되고, 최신 버전을 포함해야 해요. (S1, S2)
- [확인] 스펙을 참고한 결과물의 저작권은 개발자에게 있어요. 대신 UI, 매뉴얼, 도움말, 소스에 정해진 문구를 모두 적어야 해요. (S2)
- [확인] 정해진 문구는 다음과 같아요. (S2)
  > "본 제품은 한글과컴퓨터의 한/글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다."
- [추론] PDF 텍스트 추출에서 "한/글" 로고 글자가 빠져 보여요. 실제 표기는 PDF 화면으로 다시 확인해야 해요.
- [확인] 한컴은 이 스펙으로 얻은 결과를 바탕으로 한컴에 배타적 권리를 행사하려는 자에게 대응할 수 있다고 밝혀요. 정확성 보증은 하지 않아요. (S2)
- [추론] 파서를 이 스펙으로 구현해도 돼요. 단, 위 문구 표기 의무가 생겨요.
- [추론] PDF를 공개 저장소에 벤더링하는 것도 조건부로 허용돼요. 수정 금지와 최신 버전 유지 의무 때문에, 링크와 해시만 두는 편이 관리가 쉬워요.
- [추론] KS X 6101 원문은 유료 판매 표준이라 공개 저장소에 넣으면 안 돼요.

**컨테이너 구조**

- [확인] HWP 5.0은 윈도우즈 복합 파일(Compound File, CFB/OLE) 구조예요. 문자는 대부분 UTF-16LE예요. (S2, S4)
- [확인] 주요 스트림은 FileHeader, DocInfo, BodyText/Section0..n, \005HwpSummaryInformation, BinData, PrvText, PrvImage, DocOptions, Scripts, XMLTemplate, DocHistory예요. (S2)
- [확인] 레코드 구조를 쓰는 곳은 DocInfo, BodyText, DocHistory예요. 압축과 암호화 대상은 DocInfo, BodyText, BinData, DocHistory예요. (S2)
- [확인] 크기 단위 HWPUNIT은 1/7200인치예요. 모든 다바이트 값은 리틀 엔디언이에요. (S2)

**FileHeader (256바이트)**

- [확인] 서명은 "HWP Document File"(32바이트)이에요. 버전은 0xMMnnPPrr 형식이에요. (S2)
- [확인] MM이나 nn이 다르면 하위 호환이 안 되고, PP와 rr은 달라도 호환돼요. (S2)
- [확인] 속성 비트는 다음과 같아요. bit 0 압축, bit 1 암호, bit 2 배포용 문서, bit 3 스크립트, bit 4 DRM, bit 5 XMLTemplate, bit 6 문서 이력, bit 7 전자 서명, bit 8 공인 인증서 암호화, bit 9 전자 서명 예비 저장, bit 10 공인 인증서 DRM, bit 11 CCL, bit 12 모바일 최적화, bit 13 개인 정보 보안, bit 14 변경 추적, bit 15 공공누리, bit 16 비디오, bit 17 차례 필드예요. (S2)
- [확인] 두 번째 속성(라이선스 정보, 복제 제한)과 EncryptVersion(0~4) 필드가 있어요. (S2)
- [확인] 한컴 블로그 예시 파일의 버전은 5.1.1.0이에요. hwplib 변경 기록에도 5.1.0.1 파일 대응이 있어요. (S4, S14)
- [추론] 스펙 1.3(2018)이 최신 파일 버전의 모든 레코드를 다 설명하지 않을 수 있어요. 모르는 태그는 크기만큼 건너뛰는 설계가 필요해요.

**레코드 형식**

- [확인] 레코드 헤더는 32비트예요. Tag ID 10비트(0~9), Level 10비트(10~19), Size 12비트(20~31)예요. (S2)
- [확인] Size가 0xFFF이면 헤더 뒤에 실제 길이를 담은 DWORD가 하나 더 붙어요. (S2)
- [확인] Tag ID 0x000~0x00F는 특수 용도, 0x010~0x1FF는 한글 내부용(HWPTAG_BEGIN = 0x010), 0x200~0x3FF는 외부 앱용이에요. (S2)
- [확인] Level은 연관 레코드의 계층 깊이예요. 이 값으로 전체 트리를 만들어요. (S2)
- [확인] 문단은 PARA_HEADER(레벨 0) 아래 PARA_TEXT, PARA_CHAR_SHAPE, PARA_LINE_SEG, CTRL_HEADER 등(레벨 1 이상)으로 이어져요. (S2)
- [확인] 문단 텍스트의 코드 0~31은 제어 문자예요. 문자 컨트롤은 1글자, 인라인과 확장 컨트롤은 8 WCHAR를 차지해요. (S2)
- [확인] 제어 문자를 일반 문자로 처리하면 문서를 정상적으로 읽을 수 없다고 스펙이 경고해요. 표, 각주 같은 컨트롤은 자기 문단 리스트를 가져요. (S2)
- [추론] "레코드 하나가 깨지면 문서 전체가 깨진다"는 위험의 핵심이 이 크기 필드와 제어 문자 폭이에요. 파서 테스트를 여기에 집중해야 해요.

**압축과 암호화**

- [확인] 스펙은 압축에 zlib을 썼다고 적어요. 기본 정보 부분은 압축하지 않고 본문과 그림 데이터를 압축해요. (S2)
- [확인] pyhwp는 이 스트림을 "헤더 없는 zlib 압축 스트림"으로 다루는 rawunz 명령을 둬요. (S19)
- [추론] 실제 구현에서는 zlib 헤더 없는 raw deflate(wbits -15)로 풀어야 해요. 한컴 문서에는 이 점이 명시되지 않았어요.
- [확인] 한컴 블로그는 한글 설정에서 압축을 끌 수 있다고 해요. 그래서 FileHeader bit 0을 반드시 봐야 해요. (S4)
- [확인] 배포용 문서는 모든 스트림에 256바이트 배포용 문서 데이터(HWPTAG_DISTRIBUTE_DOC_DATA)가 들어가요. (S2)
- [확인] 배포용 문서의 상세 형식은 별도 스펙 문서로 공개돼 있어요. (S1)
- [확인 못 함] 그 별도 문서의 다운로드 주소와 내용은 읽지 못했어요.
- [확인] pyhwp는 배포용 스트림을 SHA-1 값과 키로 복호화하는 diststream 명령을 둬요. (S19)
- [확인 못 함] 배포용 문서가 ViewText 스토리지와 AES-128을 쓴다는 설명은 제3자 구현에서만 봤어요. 공식 문서로는 확인 못 했어요.
- [확인 못 함] 암호(bit 1) 문서의 암호화 방식은 본 스펙에 설명이 없어요.
- [확인] hwplib는 암호 HWP 읽기와 쓰기를 지원하지 않아요. python-hwpx는 암호 문서와 배포용 HWP를 오류로 거부해요. (S14, S17)

## 라이브러리 비교표

> 열 의미예요. "읽기/쓰기"와 "마지막 릴리스"는 [확인], "위험"은 [추론]이에요.
> 날짜는 레지스트리(Maven, PyPI, npm) 게시일이에요. 릴리스가 없으면 GitHub 마지막 push 날짜를 적었어요.

| 이름 | 언어 | 라이선스 | 읽기 | 쓰기 | 마지막 릴리스 | 위험 |
|---|---|---|---|---|---|---|
| hwplib (S14) | Java | Apache-2.0 | HWP 5.0, 텍스트 추출 | HWP 저장, 빈 문서 생성, 표/그림 삽입 | Maven 1.1.11 (2026-09-09), push 2026-09-11 | JVM 필요, 1인 메인테이너, 암호 문서 미지원 |
| hwpxlib (S15) | Java | Apache-2.0 | HWPX | HWPX 저장, 빈 문서 생성 | Maven 1.0.9 (2026-01-23), push 2026-08-31 | JVM 필요, 1인, mimetype 압축 저장, 암호 HWPX는 별도 확장 |
| hwp2hwpx (S16) | Java | Apache-2.0 | HWP | HWPX로 변환 | 릴리스 확인 못 함, push 2026-08-31 | 변환 손실 범위 미확인 |
| python-hwpx (S17) | Python | Apache-2.0 | HWPX, HWP 5.0 열기 | HWPX 생성/편집, HWP 저장 주장, 구조 검증 CLI | PyPI 6.8.0 (2026-10-06) | Alpha, 메이저 버전 잦음, 1인, 수치는 자체 측정 |
| python-hwpx-automation (S18) | Python | Apache-2.0 | HWPX | HWPX 작업, 한글로 PDF 렌더 | PyPI 7.3.4 (2026-10-06) | 렌더는 GUI 조작이라 무인 CI에 부적합 |
| pyhwp (S19) | Python | AGPL-3.0 이상 (PyPI) | HWP 5.0 | 없음 (ODT, HTML, TXT 변환만) | PyPI 0.1b15 (2020-05-30) | AGPL 전염, 릴리스 정체 |
| olefile (S20) | Python | BSD | OLE/CFB 컨테이너 | 확인 못 함 | PyPI 0.47 (2023-12-01) | HWP 해석은 직접 구현 |
| hwp.js (S21) | TypeScript | Apache-2.0 | HWP 뷰어/파서 | 언급 없음 | npm 0.0.3 (2020-10-01), push 2025-01-10 | 사실상 정체, HWPX 미지원 |
| hwp-rs / libhwp (S22) | Rust, Python | Apache-2.0 | HWP | 언급 없음 | PyPI libhwp 0.2.0 (2022-11-11) | 2022년 이후 정체 |
| rhwp, @rhwp/core (S23) | Rust, WASM | MIT | HWP 5.0, HWPX, 렌더(SVG, PDF) | HWP 저장, HWPX 저장(의미 보존 목표) | npm 0.8.7 (2026-10-06) | 0.x, 2026-03 생성, 열린 이슈 331건, 렌더가 한글과 같다는 보장 없음 |
| kordoc (S24) | TypeScript | MIT | HWP 3/5, HWPX, PDF, Office | Markdown에서 HWPX 생성, HWPX/HWP 패치 | npm 4.21.33 (2026-10-15) | 2026-03 생성, 1인, 버전 매우 잦음, 수치 자체 측정 |
| HwpForge (S25) | Rust | Apache-2.0 (npm은 MIT OR Apache-2.0) | HWPX | Markdown에서 HWPX, JSON 왕복 편집 | npm @hwpforge/mcp 0.16.11 (2026-10-13) | 2026-02 생성, 사용자 적음 |
| ownhwpx (S26) | TypeScript | Apache-2.0 | HWPX (hwpxlib 포팅) | HWPX | npm 0.2.16 (2026-08-26) | 저장소(GitLab) 열람 실패, 성숙도 미확인 |
| hwpx-ts (S27) | TypeScript | AGPL-3.0 | HWPX | HWPX | npm 0.1.0 (2026-01-14) | AGPL 전염 |
| hwpx-owpml-model (S12) | C++ | Apache-2.0 | HWPX | HWPX 생성 | 릴리스 없음, push 2023-10-24 | Windows/VS2017 빌드만, 갱신 정체 |
| dvc (S13) | C++ | NOASSERTION | HWPX 서식 검증 | 없음 | 릴리스 없음, push 2023-09-26 | 라이선스 불명확, Windows |
| H2Orestart (S29) | Java (LibreOffice 확장) | GPL-3.0 | HWP, HWPX (변환) | ODT 등 변환 | 릴리스 확인 못 함, push 2026-09-07 | GPL 전염 |
| pyhwpx (S30) | Python | 메타데이터에 라이선스 이름 없음 | 한글 COM 자동화 | 한글 COM 자동화 | PyPI 1.7.2 (날짜 확인 못 함) | Windows와 한글 설치 필수, 라이선스 불명 |
| cfb (S31) | JavaScript | Apache-2.0 | CFB 컨테이너 | CFB 컨테이너 | npm 1.2.2 (2022-04-06) | HWP 해석은 직접 구현, 갱신 정체 |
| 한컴 Hwp SDK (S32) | 확인 못 함 | 상용(가격 확인 못 함) | HWP, HWPX | 생성/저장, HTML/PDF 변환 | 확인 못 함 | 비용, 플랫폼 미확인 |

**표 보충**

- [확인] npm에는 2026년에 나온 HWP/HWPX 패키지가 20개 이상 있어요. 대부분 MIT 또는 Apache-2.0이에요. (S28)
- [추론] 생태계가 빠르게 늘지만 대부분 1년 미만이에요. 핵심 의존성보다 차등 검증용 오라클로 쓰는 편이 안전해요.
- [확인] 한컴 블로그(2025-12)는 공개 라이브러리 대부분이 읽기 중심이라고 정리해요. (S6)
- [추론] 상용 제품에서 가장 큰 라이선스 위험은 AGPL(pyhwp, hwpx-ts)이에요. 서버로 제공만 해도 소스 공개 의무가 생길 수 있어요.
- [추론] GPL(H2Orestart)도 같은 프로세스에 묶으면 위험해요. 별도 프로세스 변환 도구로만 써도 배포 형태를 따로 검토해야 해요.
- [추론] Apache-2.0 라이브러리를 쓰더라도, 그 라이브러리가 한컴 스펙을 참고했다면 한컴 표기 문구를 함께 넣는 편이 안전해요.

## 한글에서 열기 확인 방법 (macOS)

**선택지**

- [확인] 한컴오피스 한글 Viewer(맥 App Store)는 무료예요. hwpx, hwp, hwt, docx, doc, txt를 열어요. 최신 버전은 12.31.8이에요. (S33)
- [확인] App Store 페이지의 최소 macOS 표기가 macOS 11과 Sonoma로 서로 달라요. (S33)
- [확인] 뷰어 설명에는 편집 기능이 없어요. 인쇄 관련 수정 기록은 있어요. (S33)
- [확인] 한글 for macOS는 기본 저장 형식이 HWPX예요. 최신 3개 주요 macOS를 지원한다고 해요. (S34)
- [확인] 한글 for Mac 가정 및 학생용(제품키배송형)은 49,500원이고 1대에만 설치할 수 있어요. (S36)
- [확인 못 함] 가정 및 학생용의 상업적 이용 가능 여부와 영구 라이선스 여부는 확인 못 했어요.
- [확인] 맥용 한글은 한컴독스 구독으로도 쓸 수 있어요. (S35)
- [확인] 한컴독스 요금은 무료(2GB), 개인용 월 6,900원 또는 연 49,000원, 기업용 1인 월 10,900원 또는 연 99,000원이에요. (S37)
- [확인] 기업용은 1인당 5대 PC에 한컴오피스를 설치할 수 있어요. (S38)
- [확인 못 함] 무료 플랜이 열람 전용인지는 한컴 공식 페이지에서 명확히 확인하지 못했어요.
- [추론] 한컴독스 웹에 실제 공문을 올리면 개인정보와 보안 문제가 생겨요. 합성 문서로만 확인해야 해요.

**자동화 경로**

- [확인] 한컴 공식 자동화는 OLE/COM 객체로 한글을 제어하는 "한글 오토메이션"이에요. (S11)
- [추론] COM 기반이라 Windows 전용으로 보여요.
- [확인 못 함] 맥용 한글의 공식 CLI, AppleScript 사전, 자동화 API는 찾지 못했어요.
- [확인] python-hwpx-automation의 render-pdf는 맥에서 `Hancom Office HWP.app`을 메뉴 조작으로 움직여 PDF를 만들어요. (S18)
- [확인] 이 방식은 로그인된 GUI 세션, 손쉬운 사용과 자동화 권한이 필요해요. 한 번에 하나만 렌더해요. (S18)
- [확인] 한글이 "손상된 파일" 대화상자를 띄우면 `hancom-refused`로 실패를 보고해요. 한글이 멈추면 `hancom-hung`이고 직접 재시작해야 해요. (S18)
- [확인] Windows에서는 COM 클래스 `HWPFrame.HwpObject`를 쓰고, 파일 접근 승인 창을 피하려고 보안 모듈을 등록해요. (S18)
- [확인] python-hwpx는 한글 12.0.0.3288로 497개 중 476개 열림을 자체 측정했다고 적어요(2026-07-19). (S17)
- [추론] 이 측정 방식은 우리 게이트 설계에 좋은 참고예요. 다만 수치는 재현하지 않았어요.

**게이트 설계 제안** [추론]

1. 구조 게이트: 직접 만든 검증기로 mimetype, container, manifest, spine, 네임스페이스, standalone 속성을 검사해요. python-hwpx 검증 규칙을 참고 목록으로 써요.
2. 차등 파싱 게이트: 독립 구현(hwpxlib, rhwp, kordoc 중 둘)으로 다시 읽어 텍스트와 표 구조가 같은지 비교해요.
3. 실제 한글 게이트: 맥용 한글 Viewer 또는 한글로 열어요. 열림 여부, 손상 대화상자 여부, PDF 해시를 증거 로그로 남겨요.
4. 3번은 GUI 세션이 필요해서 무인 CI가 어려워요. 릴리스 등급에서 사람이 돌리는 수동 단계로 두는 편이 현실적이에요.

## 공문서 작성 규칙 요약

**법령 이름과 현행 버전**

- [확인] 대통령령 이름은 「행정업무의 운영 및 혁신에 관한 규정」(약칭 행정업무규정)이에요. (S39)
- [확인] 현행은 2026-10-02 시행, 대통령령 제36728호(2026-09-29 타법개정)예요. (S39)
- [확인] 시행규칙 이름은 「행정업무의 운영 및 혁신에 관한 규정 시행규칙」이에요. (S40)
- [확인] 국가법령정보센터 현행 표시는 2023-06-28 시행, 행정안전부령 제408호예요. (S40)
- [확인] 소관은 행정안전부 정보공개제도과(공문서, 서식)예요. (S39, S40)
- [확인 못 함] 행정안전부 「행정업무운영 편람」 최신판은 확인 못 했어요. 2020년 8번째 판이 나왔다는 2021년 기사만 봤어요.

**개방형 문서 형식 의무**

- [확인] 영 제3조 2의2는 "개방형 문서 형식"을 정의해요. 표준과 규격이 공개되고, 기계 판독이 가능해야 해요. (S39)
- [확인] 영 제5조 제2항은 개방형 문서 형식으로 문서요지와 키워드를 포함해 작성하라고 해요(2026-05-19 개정). (S39)
- [추론] 회신 초안은 HWP가 아니라 HWPX로 내야 해요. 문서요지와 키워드 초안도 함께 만들어 주면 쓸모가 커요.

**문서 작성 방법 (영 제7조)**

- [확인] 어문규범에 맞게 한글로 쓰고, 필요하면 괄호 안에 한자나 외국어를 함께 써요. 특별한 사유가 없으면 가로쓰기예요. (S39)
- [확인] 숫자는 특별한 사유가 없으면 아라비아 숫자를 써요. (S39)
- [확인] 날짜는 숫자로 쓰고 연, 월, 일 글자 대신 온점을 찍어요. (S39)
- [확인] 시각은 24시각제 숫자로 쓰고 시, 분 글자 대신 쌍점으로 구분해요. (S39)
- [추론] 예시는 "2026. 10. 15."와 "15:30"이에요. 숫자 사이 띄어쓰기는 조문에 없고 관행이에요.
- [확인] 용지는 특별한 사유가 없으면 가로 210mm, 세로 297mm(A4)예요. (S39)
- [확인] 금액은 아라비아 숫자 뒤 괄호에 한글로 적어요. 예시는 "금113,560원(금일십일만삼천오백육십원)"이에요. (S40)

**항목 구분 (시행규칙 제2조)**

- [확인] 상위부터 1., 가., 1), 가), (1), (가), ①, ㉮ 순서로 표시해요. (S40)
- [확인] 숫자는 오름차순, 한글은 가나다순이에요. 필요하면 □, ○, - 그리고 가운뎃점 같은 특수 기호를 쓸 수 있어요. (S40)

**기안문 구성 (시행규칙 제4조)**

- [확인] 기안문은 두문, 본문, 결문으로 구성해요. 시행문도 같은 구성을 따라요. (S40)
- [확인] 두문은 행정기관명과 수신란이에요. 내부결재면 "내부결재", 수신자가 여럿이면 "수신자 참조"라고 써요. (S40)
- [확인] 수신자명 다음 괄호에 처리할 보조기관이나 보좌기관을 적어요. 불분명하면 "○○업무담당과장"처럼 써요. (S40)
- [확인] 본문은 제목, 내용, 붙임(첨부가 있을 때만)으로 구성해요. (S40)
- [확인] 결문은 발신 명의, 기안자/검토자/협조자/결재권자의 직위와 서명, 생산등록번호와 시행일, 접수등록번호와 접수일, 기관 주소와 연락처, 공개 구분이에요. (S40)

**붙임과 끝 표시 (시행규칙 제4조 제4항, 제5항)**

- [확인] 첨부가 있으면 본문이 끝난 다음 줄에 "붙임"을 쓰고 첨부물 이름과 수량을 적어요. (S40)
- [확인] 첨부물이 둘 이상이면 제2조의 항목 구분으로 나눠 적어요. (S40)
- [확인] 본문(붙임이 있으면 붙임)의 마지막 글자에서 한 글자 띄우고 "끝"을 표시해요. (S40)
- [확인] 오른쪽 한계선에 닿으면 다음 줄 왼쪽 기본선에서 한 글자 띄우고 "끝"을 써요. (S40)
- [확인] 표로 끝나면 표 아래 왼쪽 기본선에서 한 글자 띄우고 "끝"을 써요. 표 중간에서 끝나면 다음 칸에 "이하 빈칸"을 써요. (S40)
- [추론] 조문은 "끝" 표시라고만 적어요. 실무 공문에서는 "끝."처럼 온점을 붙여 써요. 편람 원문으로 확인이 필요해요.

**문서 효력과 접수**

- [확인] 문서는 결재권자의 서명으로 성립하고, 수신자에게 도달하면 효력이 생겨요. (S39)
- [확인] 접수한 문서에는 접수일시와 접수등록번호를 전자적으로 표시해요. (S39)
- [추론] 사람 승인 단계는 결재 행위를 대신하지 않아요. 에이전트 산출물은 "기안 초안"으로만 위치시켜야 해요.

## 공문을 받는 곳과 첨부 형식 (공개 정보만)

- [확인] 온-나라 문서시스템은 중앙행정기관과 지자체가 쓰는 전자문서 시스템이에요. 한컴 웹기안기가 여기에 들어가요(2023-06 기사). (S43)
- [확인] 한컴 FAQ는 웹한글기안기가 최신 패치에서 HWPX를 지원하고 공문서 필터도 정상 동작한다고 해요. (S7)
- [확인] 행안부는 2022-08에 중앙부처 행정문서의 개방형 서식과 메타데이터 의무화를 추진한다고 발표했어요. 보도자료 첨부도 hwpx와 pdf였어요. (S41)
- [확인] 2026-04-23 보도에 따르면 중앙부처 온나라는 2022년부터 hwpx를 의무로 썼어요. 2026-05-18부터 지방정부 온나라로 확대해요. (S42)
- [확인] 같은 보도에 따르면 공직자통합메일은 2026-10부터 hwp 첨부를 제한해요. (S42)
- [확인 못 함] 이 일정의 행안부 보도자료 원문은 찾지 못했어요. 언론 보도 기준이에요.
- [확인] K-에듀파인은 교육부와 KERIS가 에듀파인(재정)과 업무관리시스템(행정)을 합쳐 2020-01-02에 개통했어요. (S44)
- [확인] 사용자는 17개 시도교육청과 유초중고 교직원 70여만 명이에요. (S44)
- [확인] 경기도교육청은 단순 알림 공문을 K-에듀파인 공문게시판에 올려 학교 접수 업무를 줄여요(2025-02 계획). (S45)
- [확인] 경기도교육청은 학교로 가는 공문 제목 앞에 핵심용어 6종을 붙여요. [제출], [협조], [설문], [출장], [연수], [공모]예요. (S45)
- [확인] 경기도교육청은 공문 "끝" 다음 줄에 학교실행 표를 넣어요. 제출, 출장, 자료집계, 자체계획수립, 위원회심의, 교육과정반영, 자체연수, 의견조사 칸에 ○로 표시해요. (S45)
- [추론] 이 표와 핵심용어는 할 일 추출의 좋은 근거예요. 다만 경기도교육청 한정이라 다른 교육청에는 없을 수 있어요.
- [확인] 교육부 2019-12 보도자료 첨부는 .hwp였어요. (S44)
- [확인 못 함] K-에듀파인 공문 첨부의 형식 정책(hwp 허용, hwpx 의무 여부)은 확인 못 했어요.
- [추론] 학교와 교육청 공문 첨부는 hwp, hwpx, pdf, xlsx가 섞여 들어올 가능성이 커요. 첫 조각도 HWP 5.0 읽기가 필요해요.

## 첫 조각에 주는 시사점

### 추천 스택 후보

**후보 A. TypeScript/Bun 단일 스택 + 직접 구현 + 외부 오라클** [추론]

- 구성: HWPX는 ZIP(fflate 등)과 XML 파서로 필요한 범위만 직접 읽고 써요. HWP 5.0은 cfb(Apache-2.0)와 raw inflate로 열고 레코드 파서를 스펙 표 그대로 구현해요.
- 오라클: 테스트에서만 @rhwp/core(MIT)와 kordoc(MIT)으로 같은 파일을 읽어 결과를 비교해요.
- 이유: 파서 충실도가 최우선이라 스펙 표와 테스트를 1:1로 묶기 쉬워요. 하네스 스택(TypeScript, Bun)과도 맞아요.
- 비용: 구현량이 가장 커요. 첫 조각은 "문단 텍스트, 표, 날짜" 읽기와 "템플릿 패치형 HWPX 쓰기"로 범위를 좁혀야 해요.

**후보 B. JVM 사이드카 (hwplib + hwpxlib + hwp2hwpx)** [추론]

- 구성: 세 라이브러리 모두 Apache-2.0이고 같은 저자예요. 2026년에도 꾸준히 갱신돼요. (S14, S15, S16)
- 이유: HWP와 HWPX 읽기와 쓰기를 모두 가진 가장 성숙한 조합이에요. 받은 HWP를 HWPX로 바꿔 파이프라인을 하나로 만들 수 있어요.
- 비용: JVM 런타임과 두 번째 언어가 생겨요. 1인 메인테이너 의존이 커요. mimetype 압축 저장처럼 세부 동작은 직접 보정해야 해요.

**후보 C. Python 사이드카 (python-hwpx + olefile + python-hwpx-automation)** [추론]

- 구성: 모두 Apache-2.0 또는 BSD예요. 구조 검증 CLI와 맥 한글 렌더 오라클이 이미 있어요. (S17, S18, S20)
- 이유: "한글에서 열림" 게이트를 가장 빨리 세울 수 있어요.
- 비용: Alpha이고 메이저 버전이 몇 달 만에 여러 번 바뀌었어요. 1인 메인테이너예요.

**조합 제안** [추론]

- 제품 코드는 후보 A로 가고, 후보 B나 C는 테스트 오라클과 게이트 도구로만 쓰는 조합이 균형이 좋아요.
- 쓰기는 "빈 문서에서 생성"보다 "한글에서 저장한 회신 템플릿 HWPX에 텍스트만 패치"가 안전해요. 파싱하지 않은 XML은 바이트 그대로 보존해요.
- mimetype은 첫 항목, 무압축으로 써요. header.xml의 참조 ID(글자/문단 모양)는 템플릿에 있는 것만 써요.
- 입력 HWP의 FileHeader bit 1(암호), bit 2(배포용), bit 4(DRM)가 켜져 있으면 처리하지 않고 사람에게 넘겨요.
- 모르는 Tag ID와 모르는 XML 요소는 경고로 남기고 건너뛰어요. 레코드 크기 불일치는 문서 단위 실패로 보고해요.
- 한컴 스펙 표기 문구를 소스, 도움말, UI에 넣어요. KS X 6101 원문은 저장소에 넣지 않아요.
- 할 일과 기한 추출 근거로 "2026. 10. 15." 같은 날짜 규칙, "끝" 표시, 붙임 목록, 경기도교육청식 핵심용어와 학교실행 표를 써요.

### 피해야 할 것 [추론]

- AGPL(pyhwp, hwpx-ts)과 GPL(H2Orestart) 코드를 제품에 넣거나 링크하는 것.
- Windows 전용 COM(한글 오토메이션, pyhwpx)을 핵심 경로에 두는 것. 맥 개발 환경과 서버 배포 모두 막혀요.
- 정체된 라이브러리(hwp.js, hwp-rs, pyhwp)를 쓰기 경로에 쓰는 것.
- HWP 5.0 바이너리로 회신을 쓰는 것. 규정이 개방형 형식을 요구하고, 바이너리 쓰기는 깨질 위험이 가장 커요.
- 배포용 문서와 암호 문서를 복호화하는 것. 작성자의 배포 제한을 우회하는 일이라 법적, 신뢰 위험이 있어요.
- 실제 공문을 한컴독스 같은 클라우드에 올려 확인하는 것.
- 신생 패키지의 자체 측정 수치를 근거로 품질을 주장하는 것.

## 확인 못 한 것

- KS X 6101:2024 원문(유료, 410쪽)의 최소 필수 파일, mimetype 규칙, 2024년 네임스페이스 변경 내용.
- 한컴이 OWPML 스펙 문서를 별도로 무료 공개하는지 여부. 다운로드 센터 목록에는 없었어요.
- e나라표준인증의 "고시원문 보기"가 표준 전문을 무료로 보여 주는지 여부.
- 배포용 문서 형식 별도 스펙의 다운로드 주소와 내용, 암호 문서의 암호화 방식.
- 맥용 한글의 공식 CLI나 스크립팅 API 존재 여부.
- 맥용 한글 최신 버전 번호, 가정 및 학생용의 상업 이용 가능 여부, 영구 라이선스 여부.
- 한컴독스 무료 플랜의 편집 가능 여부, 개인용 플랜의 개발 목적 사용 가능 여부.
- 한컴 Hwp SDK의 가격, 지원 플랫폼, 라이선스 조건.
- 행안부의 2026 hwp 첨부 제한 일정 보도자료 원문(언론 보도만 확인).
- K-에듀파인 공문 첨부 형식 정책과 교육청의 hwpx 의무화 여부.
- 행정업무운영 편람 최신판과 "끝." 온점 표기, "관련" 항목 쓰는 법 같은 실무 예시.
- ISO/TC 171 OWPML 관련 국제표준의 2026년 제정 여부.
- ownhwpx 저장소 내용(GitLab 403), hwp2hwpx와 pyhwpx의 정확한 릴리스 날짜.
- 각 라이브러리 README의 자체 측정 수치(열림률, 왕복 일치율) 재현.

## 출처 목록

모든 출처는 2026-10-15에 확인했어요.

- S1. 한컴 다운로드 센터, HWP/OWPML 형식. https://www.hancom.com/support/downloadCenter/hwpOwpml (확인 2026-10-15)
- S2. 한컴, 한글 문서 파일 형식 5.0 revision 1.3 (PDF). https://cdn.hancom.com/link/docs/한글문서파일형식_5.0_revision1.3.pdf (확인 2026-10-15)
- S3. 한컴테크, HWPX 포맷 구조 살펴보기 (2025-02-26). https://tech.hancom.com/hwpxformat/ (확인 2026-10-15)
- S4. 한컴테크, HWP 포맷 구조 살펴보기 (2025-02-24). https://tech.hancom.com/%ED%95%9C-%EA%B8%80-%EB%AC%B8%EC%84%9C-%ED%8C%8C%EC%9D%BC-%ED%98%95%EC%8B%9D-hwp-%ED%8F%AC%EB%A7%B7-%EA%B5%AC%EC%A1%B0-%EC%82%B4%ED%8E%B4%EB%B3%B4%EA%B8%B0/ (확인 2026-10-15)
- S5. 한컴테크, Python을 통한 HWPX 포맷 파싱하기 (1) (2025-06-18). https://tech.hancom.com/python-hwpx-parsing-1/ (확인 2026-10-15)
- S6. 한컴테크, AX 시대를 위한 한글 문서: 오픈소스 생태계 현황 (2025-12-01). https://tech.hancom.com/ax-era-open-source-ecosystem-strategy-hwp/ (확인 2026-10-15)
- S7. 한컴 FAQ, HWPX 관련 자주하는 질문. https://www.hancom.com/support/faqCenter/faq/detail/2784 (확인 2026-10-15)
- S8. 한컴 FAQ, HWP 문서가 PDF 대비 머신 리더블에 취약한가요. https://www.hancom.com/support/faqCenter/faq/detail/3131 (확인 2026-10-15)
- S9. e나라표준인증, KS X 6101. https://standard.go.kr/KSCI/standardIntro/getStandardSearchView.do?menuId=503&topMenuId=502&ksNo=KSX6101&tmprKsNo=KSX6101 (확인 2026-10-15)
- S10. 한국표준정보망(KSSN), KS X 6101 판매 페이지. https://www.kssn.net/search/stddetail.do?itemNo=K001010149626 (확인 2026-10-15)
- S11. 한컴디벨로퍼 메인과 오픈소스. https://developer.hancom.com/ , https://developer.hancom.com/opensources (확인 2026-10-15)
- S12. hancom-io/hwpx-owpml-model. https://github.com/hancom-io/hwpx-owpml-model , https://api.github.com/repos/hancom-io/hwpx-owpml-model (확인 2026-10-15)
- S13. hancom-io/dvc. https://github.com/hancom-io/dvc , https://api.github.com/repos/hancom-io/dvc (확인 2026-10-15)
- S14. neolord0/hwplib와 Maven 메타데이터. https://github.com/neolord0/hwplib , https://repo1.maven.org/maven2/kr/dogfoot/hwplib/maven-metadata.xml (확인 2026-10-15)
- S15. neolord0/hwpxlib, Maven 메타데이터, 소스(HWPXWriter, MineTypes, ZipEntryName, Namespaces, AttributeNames, BlankFileMaker). https://github.com/neolord0/hwpxlib , https://repo1.maven.org/maven2/kr/dogfoot/hwpxlib/maven-metadata.xml , https://raw.githubusercontent.com/neolord0/hwpxlib/main/src/main/java/kr/dogfoot/hwpxlib/commonstrings/MineTypes.java (확인 2026-10-15)
- S16. neolord0/hwp2hwpx. https://github.com/neolord0/hwp2hwpx , https://api.github.com/repos/neolord0/hwp2hwpx (확인 2026-10-15)
- S17. airmang/python-hwpx, PyPI, 패키지 검증기 소스. https://github.com/airmang/python-hwpx , https://pypi.org/project/python-hwpx/ , https://github.com/airmang/python-hwpx/blob/main/src/hwpx/tools/package_validator.py (확인 2026-10-15)
- S18. python-hwpx-automation PyPI와 render-pdf 문서. https://pypi.org/project/python-hwpx-automation/ , https://raw.githubusercontent.com/airmang/python-hwpx-automation/main/docs/render-pdf.md (확인 2026-10-15)
- S19. pyhwp PyPI와 hwp5proc 문서. https://pypi.org/project/pyhwp/ , https://pyhwp.readthedocs.io/en/latest/hwp5proc.html , https://api.github.com/repos/mete0r/pyhwp (확인 2026-10-15)
- S20. olefile PyPI. https://pypi.org/project/olefile/ (확인 2026-10-15)
- S21. hahnlee/hwp.js와 npm. https://github.com/hahnlee/hwp.js , https://registry.npmjs.org/hwp.js (확인 2026-10-15)
- S22. hahnlee/hwp-rs와 PyPI libhwp. https://github.com/hahnlee/hwp-rs , https://pypi.org/project/libhwp/ (확인 2026-10-15)
- S23. edwardkim/rhwp와 npm @rhwp/core. https://github.com/edwardkim/rhwp , https://registry.npmjs.org/@rhwp/core (확인 2026-10-15)
- S24. chrisryugj/kordoc와 npm. https://github.com/chrisryugj/kordoc , https://registry.npmjs.org/kordoc/latest (확인 2026-10-15)
- S25. ai-screams/HwpForge와 npm @hwpforge/mcp. https://github.com/ai-screams/HwpForge , https://registry.npmjs.org/@hwpforge/mcp/latest (확인 2026-10-15)
- S26. npm ownhwpx. https://registry.npmjs.org/ownhwpx/latest (확인 2026-10-15)
- S27. npm hwpx-ts. https://registry.npmjs.org/hwpx-ts/latest (확인 2026-10-15)
- S28. npm 검색 "hwpx". https://registry.npmjs.org/-/v1/search?text=hwpx&size=20 (확인 2026-10-15)
- S29. ebandal/H2Orestart. https://github.com/ebandal/H2Orestart , https://api.github.com/repos/ebandal/H2Orestart (확인 2026-10-15)
- S30. pyhwpx PyPI. https://pypi.org/project/pyhwpx/ (확인 2026-10-15)
- S31. npm cfb (SheetJS). https://registry.npmjs.org/cfb (확인 2026-10-15)
- S32. 한컴 Hwp SDK 소개. https://download.hancom.com/en/product/sdk/hwpSdk (확인 2026-10-15)
- S33. 맥 App Store, 한컴오피스 한글 Viewer. https://apps.apple.com/kr/app/id416746898 (확인 2026-10-15)
- S34. 한컴, 한글 for macOS 제품 페이지. https://www.hancom.com/product/productMacMain.do (확인 2026-10-15)
- S35. 한컴 FAQ, 맥용 제품 새로운 기능. https://www.hancom.com/support/faqCenter/faq/detail/2819 (확인 2026-10-15)
- S36. 한컴 스토어, 한글 for Mac 가정 및 학생용. https://www.hancom.com/store/item/8334 (확인 2026-10-15)
- S37. 한컴독스 요금제 FAQ. https://support.hancomdocs.com/de687788-104a-4ca3-8d66-fd9252440c9e , https://support.hancom.com/85d25cde-998c-4d2d-92dd-b1b687b9c2f4 (확인 2026-10-15)
- S38. 한컴 기업용 요금제 FAQ. https://support.hancom.com/481e1361-647c-49c7-a18a-18d51bd47ef9 , https://support.hancomdocs.com/4c4136f4-9124-4446-87c2-a55632c2f947 (확인 2026-10-15)
- S39. 국가법령정보센터, 행정업무의 운영 및 혁신에 관한 규정(대통령령 제36728호). https://www.law.go.kr/LSW/lsInfoP.do?lsNm=행정업무의+운영+및+혁신에+관한+규정 (확인 2026-10-15)
- S40. 국가법령정보센터, 행정업무의 운영 및 혁신에 관한 규정 시행규칙(행정안전부령 제408호). https://www.law.go.kr/LSW/lsInfoP.do?lsNm=행정업무의+운영+및+혁신에+관한+규정+시행규칙 (확인 2026-10-15)
- S41. 행정안전부 보도자료, 중앙부처 행정문서 생산 시 개방형 서식 등 의무화 추진(2022-08-29). https://www.mois.go.kr/frt/bbs/type010/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000008&nttId=94424 (확인 2026-10-15)
- S42. 바이라인네트워크, 공공 문서 hwp 첨부 제한 보도(2026-04-23). https://byline.network/2026/04/23-586/ (확인 2026-10-15)
- S43. 디지털데일리, 한컴 정부 전자문서 시스템에 웹기안기 공급(2023-06-29). https://www.ddaily.co.kr/page/view/2023062908414296809 (확인 2026-10-15)
- S44. 교육부 보도자료, K-에듀파인 개통(2019-12-30). https://www.moe.go.kr/boardCnts/view.do?boardID=294&boardSeq=79394&lev=0&searchType=null&statusYN=W&page=1&s=moe&m=020402&opType=N (확인 2026-10-15)
- S45. 경기도교육청, 2025 현장중심 공문생산 책임 강화 계획(2025-02, PDF). https://www.goe.go.kr/resource/old/BBSMSTR_000000000028/BBS_202502170245386760.pdf (확인 2026-10-15)
- S46. 전자신문, 한컴 HWPX 전자문서 국제표준 첫 관문 통과(2023-03-30). https://www.etnews.com/20230330000166 (확인 2026-10-15)
- S47. hwp-foss Google 그룹, OWPML/HWPX 표준 및 구현 문제점(2014-02-24). https://groups.google.com/g/hwp-foss/c/KTD4M3ZnaWc (확인 2026-10-15)
