# 스택: TypeScript (Node.js, Bun)

`tsconfig.json`이 있거나 `package.json`에 `typescript`가 있는 프로젝트를 구현할 때 연다. React, Next.js면 `stack-react-next.md`도 함께 연다.

## 현재 안정 버전 (확인일 2026-10-16)

| 도구 | 버전 | 근거 |
|---|---|---|
| TypeScript | 7.0 (npm 7.0.2). 2026-07-08 발표, Go로 다시 쓴 네이티브 컴파일러. 패키지 이름은 그대로 `typescript`, 명령은 `tsc` | https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ |
| TypeScript 6.0 | 6.0.3. 2026-03-23 발표, JavaScript 코드베이스 기반의 마지막 판. 7과 함께 돌릴 때는 `@typescript/typescript6`의 `tsc6` | https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ |
| Node.js | 24는 Active LTS(2026-10-20부터 Maintenance), 26은 Current이고 2026-10-28에 Active LTS 예정, 22는 Maintenance(2027-04-30까지). 27부터 연 1회 출시 | https://github.com/nodejs/Release , https://nodejs.org/en/about/previous-releases |
| Bun | 1.4.3 (2026-10-10) | https://github.com/oven-sh/bun/releases |
| Biome | 2.5.15 (2026-09-30) | https://github.com/biomejs/biome/releases |
| ESLint, typescript-eslint | ESLint 10.12.0 (2026-10-02), typescript-eslint 8.71.2 (2026-10-12) | https://typescript-eslint.io/users/configs/ |
| Zod, Valibot | Zod 4.6.7 (2026-10-12), Valibot 1.5.0 (2026-09-09) | https://zod.dev/ , https://valibot.dev/ |
| Vitest | 5.0.5 (2026-10-15) | https://github.com/vitest-dev/vitest/releases |

운영 런타임은 Active LTS나 Maintenance LTS 줄에서 고른다. Current 줄은 LTS 전환일(26은 2026-10-28) 이후에 운영에 올린다.

## 엄격 설정

TypeScript 6.0부터 `strict`가 기본으로 켜지지만, 기본값이 바뀌어도 의도가 남도록 명시한다. `strict`에 들어 있지 않은 아래 플래그는 따로 켠다.

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,     // arr[i], obj[key]가 undefined일 수 있음을 타입에 반영
    "exactOptionalPropertyTypes": true,   // 선택 속성에 undefined를 명시적으로 넣는 것과 생략을 구분
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,         // 타입 import는 import type으로
    "erasableSyntaxOnly": true            // enum, 런타임 namespace, 매개변수 속성 금지. 타입만 지우면 실행되는 코드
  }
}
```

- 7.0에서 `baseUrl`, `target: es5`, `moduleResolution`의 `node`/`node10`/`classic`, AMD/UMD/SystemJS 모듈 형식이 사라졌다. 6에서 7로 올릴 때 먼저 6.0에서 경고 0을 만든다.
- 6.0의 기본값 변경: `module`은 `esnext`, `types`는 `[]`, `rootDir`는 tsconfig 폴더, `noUncheckedSideEffectImports`는 `true`. 전역 타입(`@types/node` 등)은 `types`에 직접 적는다.

## 린터와 포매터 (하나의 조합만 쓴다)

- Biome 2.5: 린트와 포맷을 한 도구로. `biome ci`를 CI에서 돌린다.
- ESLint 10 + typescript-eslint 8: `tseslint.configs.strictTypeChecked`와 `parserOptions.projectService: true`. 타입 정보를 쓰는 규칙(`no-floating-promises`, `no-misused-promises`, `no-unsafe-*`)이 이 조합의 가장 큰 이점이다.
- 프로젝트가 이미 고른 조합이 있으면 바꾸지 않는다.

## 테스트 러너

- Node: Vitest 5. 커버리지 기준(thresholds)을 설정 파일에 넣어 미달이면 실패하게 한다.
- Bun: `bun test --coverage`. `bunfig.toml`의 `[test] coverageThreshold = 0.9`처럼 기준을 두면 미달일 때 0이 아닌 종료 코드로 끝난다.
- 테스트 이름은 동작을 서술한다(예: "만료된 토큰이면 401을 돌려준다").

## 패키지와 lockfile

| 관리자 | 고정 설치(CI) | 정확한 버전으로 추가 |
|---|---|---|
| npm | `npm ci` (lockfile과 package.json이 다르면 오류, 파일을 고치지 않음) | `.npmrc`에 `save-exact=true` |
| Bun | `bun ci` (= `bun install --frozen-lockfile`) | `bun add --exact <패키지>@<버전>` |
| pnpm | `pnpm install --frozen-lockfile` | `.npmrc`에 `save-exact=true` |

- Bun 1.2부터 lockfile은 텍스트 `bun.lock`이다. 예전 `bun.lockb`는 변환한다.
- Bun은 의존성의 `postinstall` 같은 수명주기 스크립트를 기본으로 실행하지 않는다. 필요한 패키지만 `trustedDependencies`에 올린다. npm은 `--ignore-scripts`로 막는다.
- Bun은 `bunfig.toml`의 `[install] minimumReleaseAge`(초 단위)로 막 올라온 버전을 거른다. 공급망 사고 대비로 3일(259200) 정도를 검토한다.

## 관용구

- 바깥 값은 `unknown`으로 받고 Zod나 Valibot 스키마로 파싱한 뒤 추론 타입(`z.infer`)으로 넘긴다. `as`로 단언하지 않는다.
- ID는 브랜드 타입(`string & { readonly __brand: 'UserId' }`)으로 섞이지 않게 한다.
- 상태는 판별 유니온(`{ kind: 'loading' } | { kind: 'ok'; data: T } | { kind: 'error'; error: E }`)으로 표현해 불가능한 조합을 막는다. `switch`의 `default`에서 `never` 검사로 빠진 경우를 컴파일 오류로 만든다.
- 설정은 시작할 때 `process.env`를 한 번 파싱한 `config` 객체로만 읽는다.
- 객체 리터럴의 모양 확인은 `satisfies`로 한다.

## 자주 나는 실수

1. `JSON.parse`, `fetch().json()`의 결과(`any`)를 그대로 쓴다. 고친다: 스키마 파싱을 거친다.
2. `await` 빠진 Promise(floating promise). 고친다: 타입 정보 린트 규칙을 켠다.
3. 비null 단언(`!`)으로 경고를 지운다. 고친다: 좁히기(narrowing)나 파싱으로 값의 존재를 증명한다.
4. `Array.prototype.sort`가 원본을 바꾼다. 고친다: `toSorted`를 쓴다.
5. 돈 계산에 `number`(부동소수점). 고친다: 최소 단위 정수나 decimal 라이브러리.
6. 시간대 없는 `Date` 문자열. 고친다: ISO 8601에 오프셋을 붙이고 저장은 UTC.
7. 테스트 사이 상태 공유(모듈 전역 변수). 고친다: 각 테스트에서 새로 만든다.

## 보안 메모

- `eval`, `new Function`, 문자열 `setTimeout`을 쓰지 않는다.
- `child_process.exec`에 문자열 명령을 넘기지 않는다. `execFile`과 인자 배열을 쓴다.
- 신뢰할 수 없는 객체를 `Object.assign`이나 깊은 병합에 넣지 않는다(prototype pollution). `__proto__`, `constructor` 키를 막거나 `Map`을 쓴다.
- 사용자 입력으로 정규식을 만들지 않는다(ReDoS).
- 의존성 감사는 `npm audit --audit-level=high` 같은 명령을 CI에 넣고, 중대와 높음 0건을 합격선으로 둔다.
