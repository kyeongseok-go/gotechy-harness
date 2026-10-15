# 토큰, 수치 시스템, 대비 계산

> 60-style-guide에서 색, 글자, 간격, radius, 모션을 정할 때, 토큰 블록을 쓸 때, 구현 인계 목록을 만들 때 연다.

## 토큰 2층

컴포넌트는 시맨틱 토큰만 쓴다. 원시 팔레트를 직접 쓰는 코드는 재작업 대상이다.

- 1층 원시 팔레트: 색 이름과 단계. 예: `color.palette.cyan-700`
- 2층 시맨틱 토큰: 쓰임과 역할. 예: `color.text.primary`, `color.bg.base`, `color.action.primary.bg`
- 3층 컴포넌트 토큰(선택): 같은 역할이 컴포넌트마다 다르게 바뀌어야 할 때만. 예: `button.primary.bg`

이름 규칙은 `범주.역할.변형.상태` 순서의 소문자다. 예: `color.action.primary.bg-hover`. CSS 변수는 점을 하이픈으로 바꾼다: `--color-action-primary-bg-hover`. 값(`blue`, `16`)이 이름에 들어가는 것은 1층에서만 허용한다.

시맨틱 색 최소 세트: `bg.base`, `bg.raised`, `text.primary`, `text.muted`, `border.default`, `border.strong`(입력란 경계), `action.primary.bg`, `action.primary.text`, `accent`, `focus`, `danger`, `warning`, `success`, `info`.

## DTCG 형식 (Design Tokens 2025.10)

Design Tokens Community Group의 첫 안정판(2025.10, Final Community Group Report)이다. W3C 표준은 아니고 Format, Color, Resolver 모듈로 나뉜다.

- 토큰은 `$value`가 있는 객체다. `$type`은 직접 쓰거나 상위 그룹에서 물려받는다. `$description`, `$deprecated`, `$extensions`는 선택이다.
- 별칭은 중괄호로 쓴다: `{color.palette.cyan-700}`. 순환 참조는 오류다.
- 색 값은 `colorSpace`, `components`(필수)와 `alpha`, `hex`(선택, 6자리)로 쓴다.
- dimension 값은 `value`와 `unit`(`px` 또는 `rem`)이고 0에도 단위를 쓴다. duration 값은 `value`와 `unit`(`ms` 또는 `s`)이다.
- 이름은 `$`로 시작할 수 없고 `{`, `}`, `.`을 담을 수 없다.
- 파일 확장자는 `.tokens` 또는 `.tokens.json`, 미디어 타입은 `application/design-tokens+json`이다.
- 라이트와 다크 같은 여러 맥락은 Resolver 모듈이 다룬다. 구현 도구가 Resolver를 지원하는지는 이 bar가 확인하지 못했다(확인 못 함). 지원하지 않으면 같은 시맨틱 이름으로 `light.tokens.json`, `dark.tokens.json` 두 파일로 나누고 원시 팔레트는 공유한다.

```json
{
  "color": {
    "palette": {
      "$type": "color",
      "gray-900": { "$value": { "colorSpace": "srgb", "components": [0.1216, 0.1608, 0.2157], "hex": "#1f2937" } },
      "gray-500": { "$value": { "colorSpace": "srgb", "components": [0.4196, 0.4471, 0.502], "hex": "#6b7280" } },
      "gray-450": { "$value": { "colorSpace": "srgb", "components": [0.5294, 0.549, 0.5882], "hex": "#878c96" } },
      "gray-100": { "$value": { "colorSpace": "srgb", "components": [0.9529, 0.9569, 0.9647], "hex": "#f3f4f6" } },
      "white": { "$value": { "colorSpace": "srgb", "components": [1, 1, 1], "hex": "#ffffff" } },
      "cyan-700": { "$value": { "colorSpace": "srgb", "components": [0.0549, 0.4549, 0.5647], "hex": "#0e7490" } }
    },
    "bg": {
      "$type": "color",
      "base": { "$value": "{color.palette.white}" },
      "raised": { "$value": "{color.palette.gray-100}" }
    },
    "text": {
      "$type": "color",
      "primary": { "$value": "{color.palette.gray-900}", "$description": "bg.base 14.67:1" },
      "muted": { "$value": "{color.palette.gray-500}", "$description": "bg.base 4.83:1, bg.raised 4.39:1이라 raised 위에는 쓰지 않는다" }
    },
    "border": {
      "$type": "color",
      "strong": { "$value": "{color.palette.gray-450}", "$description": "입력란 경계, bg.base 3.37:1" }
    },
    "action": {
      "primary": {
        "$type": "color",
        "bg": { "$value": "{color.palette.cyan-700}" },
        "text": { "$value": "{color.palette.white}", "$description": "action.primary.bg 5.35:1" }
      }
    },
    "focus": { "$type": "color", "$value": "{color.palette.cyan-700}", "$description": "bg.base 5.35:1" }
  },
  "space": {
    "$type": "dimension",
    "1": { "$value": { "value": 4, "unit": "px" } },
    "2": { "$value": { "value": 8, "unit": "px" } },
    "4": { "$value": { "value": 16, "unit": "px" } },
    "6": { "$value": { "value": 24, "unit": "px" } }
  },
  "radius": {
    "$type": "dimension",
    "control": { "$value": { "value": 8, "unit": "px" } },
    "surface": { "$value": { "value": 12, "unit": "px" } },
    "full": { "$value": { "value": 9999, "unit": "px" }, "$description": "아바타, 상태 점 전용" }
  },
  "duration": {
    "$type": "duration",
    "state": { "$value": { "value": 200, "unit": "ms" } }
  }
}
```

## 수치 시스템 (지어내지 못하게)

| 항목 | 규칙 |
|---|---|
| 간격 | 4px 배수만: 4, 8, 12, 16, 24, 32, 48, 64 |
| radius | 2단계: 컨트롤 8px, 카드와 모달 12px. 원형(아바타, 상태 점)은 `radius.full` 예외 토큰으로만. 세 번째 값이 나오면 재작업 |
| 타입 스케일 | 기본 프리셋 12, 14, 16, 20, 24, 32, 40px. 비율 프리셋(1.2, 1.25, 1.333)을 고르면 정수 px로 반올림하고 7단계 이하 |
| 본문 | 16px, 줄 높이 1.7(한글 본문). 최소 글자 14px |
| 헤딩 | 줄 높이 1.3, 자간 -0.02em, `text-wrap: balance` |
| 한글 줄바꿈 | `word-break: keep-all`은 헤딩과 짧은 라벨에만. 긴 본문에는 쓰지 않는다 |
| 그림자 | 2단계 이하(떠 있는 요소, 모달) |
| 모션 | 상태 전환 200ms 이하. `prefers-reduced-motion: reduce`에서는 이동과 확대를 끄거나 페이드로 바꾼다 |
| 타깃 | 최소 24×24 CSS px(WCAG 2.5.8 AA). 하우스 기준은 주요 터치 타깃 44×44px(Apple HIG iOS 기본 44×44pt, Android 권장 48×48dp) |
| 포커스 | `:focus-visible`에 2px 이상 링, `outline-offset` 2px, 링과 인접 색 대비 3:1 |

4px 격자, radius 2단계, 타입 프리셋, 줄 높이, 200ms는 표준이 아니라 하우스 규칙이다. 바꾸려면 이유를 60-style-guide Q&A 로그에 남긴다. 반면 WCAG 1.4.12 문자 간격 검사(줄 높이 1.5배, 문단 뒤 간격 2배, 자간 0.12배, 단어 간격 0.16배로 덮어써도 잘림 없음)는 바꿀 수 없는 합격선이다.

## 색 역할과 대비 합격선

| 대상 | 합격선 | 근거 |
|---|---|---|
| 본문, 작은 글자 | 4.5:1 | WCAG 1.4.3 |
| 큰 글자(24px 이상, 굵게 18.5px 이상) | 3:1 | WCAG 1.4.3 |
| 컴포넌트를 알아보는 데 필요한 경계(입력란 테두리 등), 아이콘, 그래프 | 3:1 | WCAG 1.4.11 |
| 포커스 링 | 인접 색과 3:1, 포커스 전후 같은 픽셀끼리 3:1 | WCAG 1.4.11, 2.4.13(AAA를 하우스 기준으로) |
| 비활성 컨트롤 | 요구 없음. 단 비활성인지 모양이나 텍스트로도 알 수 있게 | WCAG 1.4.3 예외 |

- 반올림하지 않는다. 4.499:1은 4.5:1 미달이다(WCAG 이해 문서).
- 라이트와 다크 모두 계산한다. Apple HIG도 두 모드 모두 최소 대비를 확인하라고 한다.
- 같은 글자색이라도 배경마다 따로 계산한다. `#6b7280`은 흰 배경에서 4.83:1로 합격이지만 `#f3f4f6` 위에서는 4.39:1로 불합격이다.
- Accent는 화면 면적 10% 이하, Primary 색은 주 행동에만 쓴다(하우스 규칙).
- 다크 모드 본문은 순수 흰색 대신 조금 낮춘 색을 쓴다. 예: `#e7e9f0` on `#0b0d12`, 16.02:1(하우스 규칙).
- 테마 전환은 `prefers-color-scheme` 기본에 `[data-theme]` 덮어쓰기, `body` 배경색은 명시한다.
- 기본 테마는 대상 사용자로 정한다. 고령층이나 초심자가 대상에 있으면 라이트 기본, 다크 기본은 스펙에 근거를 남겼을 때만.
- 네온 계열 밝은 색(예: `#00e5ff`)은 흰 배경 글자로 1.53:1이라 다크 배경 전용이다.
- APCA는 쓰지 않는다. WCAG 3.0 초안(2026-09-10)도 대비 알고리즘이 "아직 정해지지 않았다"고 적는다. 참고 값으로만 적고 합격 판정에 쓰지 않는다.

## 대비 계산 스크립트

WCAG 2.2의 상대 휘도 정의(sRGB, 임계 0.04045)를 그대로 옮겼다. 6자리 hex만 받는다.

```python
# 사용: python3 contrast.py "#767676" "#ffffff"
import sys

def channel(c8):
    c = c8 / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def luminance(hex_color):
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

def ratio(a, b):
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)

r = ratio(sys.argv[1], sys.argv[2])
print(f"{r:.4f}:1", "본문 합격" if r >= 4.5 else "본문 불합격", "경계 합격" if r >= 3 else "경계 불합격")
```

자주 쓰는 회색의 흰 배경 대비(2026-10-16에 위 스크립트로 계산):

| 색 | 대비 | 판정 |
|---|---|---|
| `#999999` | 2.84:1 | 본문 불합격 |
| `#9ca3af` | 2.53:1 | 본문 불합격 |
| `#767676` | 4.54:1 | 본문 합격 |
| `#6b7280` | 4.83:1 | 본문 합격 |
| `#d1d5db` | 1.47:1 | 입력란 경계로 불합격 |

표의 값은 소수 둘째 자리에서 버렸다(반올림하지 않음). WebAIM 같은 도구는 반올림해 `#999999`를 2.85:1처럼 보여 줄 수 있다. 합격 판정은 같다.

## 구현 인계 (ExecPlan에 넘기는 목록)

- 토큰 JSON에서 CSS 변수 2층(원시, 시맨틱)을 만들고 컴포넌트는 시맨틱 변수만 쓴다. 컴포넌트 안 hex, rgb 하드코딩은 0건.
- Tailwind를 쓰면 토큰을 theme에 등록한다. 임의 값(`text-[#00e5ff]`, `p-[13px]`)과 기본 팔레트 클래스(`bg-indigo-500`)를 컴포넌트에서 쓰지 않는다.
- 모바일 우선(375px부터)으로 짜고, 컴포넌트 단위 반응형은 컨테이너 쿼리를 먼저 검토한다.
- 이미지와 영상에 width, height 또는 `aspect-ratio`를 준다(CLS 방지). 의미 있는 이미지는 alt, 장식 이미지는 빈 alt.
- CI 검사: axe-core(태그 wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa), 375px와 320px 가로 스크롤 검사, `references/anti-slop.md`의 grep 묶음, 대비 스크립트.
- 사용자 여정 E2E 테스트(예: Playwright)를 컴포넌트 단위 테스트보다 먼저 쓴다.
