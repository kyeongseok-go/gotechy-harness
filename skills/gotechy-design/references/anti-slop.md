# Anti-slop 측정 검사

> 와이어프레임과 스타일가이드를 확정하기 전에, 구현된 화면을 검토할 때, 오너가 "AI 티 나는지" 물을 때 연다.

AI가 만든 화면에 흔히 보이는 기본값을 측정해서 걸러 낸다. 기본값 자체가 나쁜 것은 아니다. 근거 없이 어느 주제에나 똑같이 나오는 것이 문제다. 브리프가 그 방향을 정했으면 따르고, 정하지 않은 축을 기본값으로 채우지 않는다. 대담함은 한 곳에만 쓰고 나머지는 조용히 둔다. 테두리, 번호, 라벨 같은 구조 장치는 장식이 아니라 정보를 담을 때만 쓴다(Anthropic `frontend-design` 스킬, 2026-09-03 판).

하나라도 걸리면 재작업하거나, 근거를 Q&A 로그에 남겨 예외로 둔다. 근거 없는 예외는 위반으로 센다.

## 검사 표

| ID | 검사 | 합격선 | 판정 |
|---|---|---|---|
| AS1 | 장식 그라데이션 | 페이지당 1곳 이하, 쓰면 목적을 주석으로 | [기계] G1 |
| AS2 | 그라데이션 글자 | 0 | [기계] G2 |
| AS3 | radius 종류 | 2단계와 `radius.full` 예외 밖 값 0 | [기계] G3 고유값 수 |
| AS4 | 이모지를 UI 아이콘으로 쓰기 | 0, 아이콘 라이브러리는 1종 | [기계] G4 |
| AS5 | 블러와 유리 효과 | 오버레이, 내비게이션, 컨트롤 층에만. 콘텐츠 층 0(Apple HIG: 콘텐츠 층에 Liquid Glass를 쓰지 않고, 쓰더라도 아껴 쓴다) | [기계] G5 위치 확인 |
| AS6 | 카드 전체 hover 확대 | 0 | [기계] G6 |
| AS7 | 섹션마다 페이드와 슬라이드 등장 애니메이션 | 0, 의미 있는 상태 전환만 | [기계] G7 |
| AS8 | 중앙 정렬 반복 | 연속 3개 섹션 이상 중앙 정렬 0, 3줄 넘는 본문 중앙 정렬 0 | [사람] 변형축 확인, [기계] G8 수 |
| AS9 | 아이콘, 제목, 두 줄짜리 3열 기능 그리드 | 사이트 전체 1회 이하, 근거 기록 | [기계] D2 |
| AS10 | 같은 모양 카드 반복 | 내용을 같은 카드로 잘게 나누기 0, 카드는 같은 종류 항목 모음에만, 그림자 2단계 이하 | [사람], [기계] G9 고유값 |
| AS11 | 틀에 박힌 장식 | 모든 제목 위 대문자 eyebrow 라벨 0, 링크와 버튼 끝 화살표 문자 0, 순서가 아닌데 01, 02, 03 번호 0, 헤드라인의 한 단어만 색이나 기울임 강조 0 | [기계] G10, [사람] |
| AS12 | 큰 숫자, 작은 라벨, 그라데이션 강조로 된 통계 블록 | 실제 수치와 출처가 있을 때만 | [사람] |
| AS13 | 가짜 증거 | 출처 없는 수치, 후기, 고객 로고 0, 스톡 자리표시 이미지 0 | [기계] G11, D1, [사람] 출처 대조 |
| AS14 | 빈 수식어 | 0 | [기계] G12, D3 |
| AS15 | 토큰 우회 | 컴포넌트 안 hex, rgb, 기본 팔레트 클래스, 임의 값 0 | [기계] G13, G14 |
| AS16 | 격자 밖 간격 | 4px 배수가 아닌 px 값 0 | [기계] G15 |
| AS17 | 다크 본문 순수 흰색 | 0 | [기계] G16 |
| AS18 | 기본 폰트 그대로 | 폰트 선택 이유가 60-style-guide에 1줄 이상, 성격 축과 연결 | [기계] D4, [사람] |
| AS19 | 바꿔 끼우기 검사 | 화면을 다른 주제 제품에 그대로 옮겨도 어색하지 않으면 실패. 업종, 소재, 사용자 말에서 가져온 시각 결정이 1개 이상 | [사람] |

## 코드 grep 묶음

`SRC`는 컴포넌트 폴더이고 토큰 파일은 뺀다. 출력 줄 수가 판정 값이다. macOS 기본 grep에는 `-P`가 없어서 G4는 `rg`(ripgrep)로 쓴다.

```bash
SRC=src   # 프로젝트에 맞게 바꾼다
# G1 장식 그라데이션 (페이지 파일별로 1 이하)
grep -rnE "linear-gradient|radial-gradient|conic-gradient|bg-gradient-to-|bg-linear-to-" "$SRC"
# G2 그라데이션 글자 (0)
grep -rnE "bg-clip-text|background-clip:[[:space:]]*text" "$SRC"
# G3 radius 값 (고유값 2개와 full 예외)
grep -rhoE "rounded(-[a-z0-9]+)?|border-radius:[^;]+" "$SRC" | sort | uniq -c
# G4 이모지 (0)
rg -n "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" "$SRC"
# G5 블러 (오버레이, 내비게이션 파일에만)
grep -rnE "backdrop-blur|backdrop-filter" "$SRC"
# G6 카드 hover 확대 (0)
grep -rnE "hover:scale-|group-hover:scale-" "$SRC"
# G7 등장 애니메이션 (0)
grep -rniE "fade-?in-?up|slide-?up|whileInView|data-aos|animate-fade" "$SRC"
# G8 중앙 정렬 수 (섹션 수와 비교)
grep -rcE "text-center|text-align:[[:space:]]*center" "$SRC"
# G9 그림자 값 (고유값 2개 이하)
grep -rhoE "shadow(-[a-z0-9]+)?|box-shadow:[^;]+" "$SRC" | sort | uniq -c
# G10 틀 장식 (대문자 라벨, 끝 화살표)
grep -rnE "uppercase tracking-|text-transform:[[:space:]]*uppercase|→[[:space:]]*<|->[[:space:]]*</" "$SRC"
# G11 자리표시 이미지와 문구 (0)
grep -rniE "unsplash\.com|picsum\.photos|placehold|lorem|ipsum" "$SRC"
# G12 빈 수식어 (0)
grep -rniE "혁신적|강력한|차세대|원활한|seamless|cutting-edge|revolutionary|supercharge" "$SRC"
# G13 하드코딩 색 (0)
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" "$SRC" --include=*.tsx --include=*.jsx --include=*.vue --include=*.svelte
# G14 기본 팔레트 클래스와 임의 값 (0)
grep -rnE "(bg|text|border|from|via|to|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}|-\[[^]]+\]" "$SRC"
# G15 격자 밖 px (0)
grep -rhoE "[0-9]+px" "$SRC" | sort -u | awk -F'px' '$1 % 4 != 0'
# G16 다크 본문 순수 흰색 (0): 다크 토큰의 text.primary 값
grep -niE "#fff(fff)?\b" dark.tokens.json
```

## 문서 grep 묶음 (와이어프레임, 스타일가이드)

```bash
D=docs/product-specs/<슬러그>
# D1 자리표시 카피 (0)
grep -niE "lorem|ipsum|자리표시|들어갈 자리|TBD|XXX" "$D/50-wireframe.md"
# D2 3열 기능 그리드 수 (1 이하)
grep -cE "Feature · Grid" "$D/50-wireframe.md"
# D3 빈 수식어 (0)
grep -nE "혁신적|강력한|차세대|원활한|획기적" "$D/50-wireframe.md"
# D4 폰트 선택 이유 (1 이상)
grep -cE "고른 이유" "$D/60-style-guide.md"
# 이모지 (0)
rg -n "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" "$D"
```

## 고칠 때 방향

- 장식 그라데이션 대신 단색 면과 글자 위계, 실제 제품 화면이나 실제 사진을 쓴다.
- 이모지 대신 선 굵기가 통일된 아이콘 라이브러리 1종을 쓰거나 아이콘 없이 제목만 둔다.
- 3열 기능 그리드 대신 `Feature · Alternating`(실제 화면과 설명), `Feature · List`, `Feature · Tabs`를 쓴다.
- 빈 수식어 대신 수치("예약 확인 문자까지 30초"), 사례, 비교를 쓴다. 수치에는 출처가 있어야 한다.
- 업종의 소재, 말투, 사물에서 시각 결정 하나를 고르고 나머지는 조용히 둔다. 예: 동네 병원 예약이면 진료 시간표 형식 자체를 첫 화면의 시각 요소로 쓴다.
- 등장 애니메이션 대신 상태 변화(열림, 저장됨)에만 200ms 이하 전환을 쓴다.
