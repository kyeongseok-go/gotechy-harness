# 스택: React, Next.js (App Router)

`package.json`에 `react`나 `next`가 있거나 `next.config.*`가 있는 프로젝트를 구현할 때 연다. 언어 규칙은 `stack-typescript.md`를 함께 본다.

## 현재 안정 버전 (확인일 2026-10-16)

| 도구 | 버전 | 근거 |
|---|---|---|
| React | 19.3 (2026-09-09), npm 19.3.1 | https://react.dev/versions |
| Next.js | 16.4 (2026-10-06), npm 16.4.1 | https://nextjs.org/blog/next-16-4 |
| Next.js 16의 하한 | Node.js 20.9 이상, TypeScript 5.1 이상 | https://nextjs.org/blog/next-16 |
| WCAG | 2.2 (W3C 권고 2024-12-12) | https://www.w3.org/TR/WCAG22/ |

## Next.js 16에서 바뀐 것 (구현 전에 확인)

- `middleware.ts`는 `proxy.ts`로 이름이 바뀌었고 Node.js 런타임에서 돈다. `middleware.ts`는 Edge용으로만 남았고 폐지 예정이다.
- `next lint` 명령이 없어졌고 `next build`가 린트를 돌리지 않는다. ESLint나 Biome을 직접 CI에 넣는다.
- `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()`는 비동기다. `await` 없이 쓰지 않는다.
- 기본 번들러는 Turbopack이다. webpack 설정이 있으면 `--webpack`로 빌드한다.
- 병렬 라우트의 각 슬롯에 `default.js`가 없으면 빌드가 실패한다.

## 캐시 규칙

- Cache Components(`cacheComponents: true`, `"use cache"`, `cacheLife`)를 켜면 캐시는 명시적으로만 걸린다. 16.4에서 새 `create-next-app` 프로젝트는 기본으로 켜져 있고, Next.js 17에서 기본값이 된다고 발표됐다.
- 쓰기 뒤 같은 요청에서 새 값을 보여야 하면 Server Action 안에서 `updateTag(tag)`를 쓴다. 조금 늦게 바뀌어도 되면 `revalidateTag(tag, 'max')`처럼 두 번째 인자(`cacheLife` 프로필)를 준다. 인자 하나짜리 `revalidateTag`는 폐지 예정이다.
- 사용자별 데이터(세션, 권한에 따라 다른 값)를 공유 캐시에 넣지 않는다. 캐시 키에 사용자가 섞이지 않으면 다른 사람 데이터가 보인다.

## 보안: Server Actions와 데이터 접근

근거: https://nextjs.org/docs/app/guides/data-security (2026-10-06 갱신)

1. Server Action은 누구나 POST로 직접 부를 수 있는 공개 엔드포인트다. 액션마다 안에서 인증(누구인가)과 인가(이 자원의 주인인가)를 확인한다. 페이지나 레이아웃에서 한 확인은 그 안에 정의한 액션을 보호하지 않는다.
2. 로그인 여부만이 아니라 대상 자원의 소유권을 확인한다(IDOR 방지).
3. DB와 비밀에 닿는 코드는 Data Access Layer 한 곳에 모은다. 이 층만 `process.env`를 읽고, 권한 확인 뒤 화면에 필요한 필드만 담은 DTO를 돌려준다. 파일 맨 위에 `import 'server-only'`를 둬서 클라이언트에서 import하면 빌드가 실패하게 한다.
4. 폼 데이터, URL 파라미터, 헤더, `searchParams`는 액션 안에서 스키마로 파싱한다. 타입 선언만으로는 검증되지 않는다.
5. 프록시 뒤에서 돌리면 `serverActions.allowedOrigins`를 설정한다.
6. `proxy.ts`(예전 미들웨어)의 확인만으로 인가를 끝내지 않는다. CVE-2025-29927은 헤더 하나로 미들웨어를 건너뛸 수 있었다(15.2.3, 14.2.25 등에서 수정). 근거: https://vercel.com/blog/postmortem-on-next-js-middleware-bypass
7. React와 Next.js 보안 패치를 미루지 않는다. CVE-2025-55182(React Server Components 원격 코드 실행, CVSS 10.0, 2025-12-03)는 인증 없이 서버 코드 실행이 가능했고, Next.js는 패치 뒤 비밀 교체를 권고했다. 근거: https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components , https://nextjs.org/blog/CVE-2025-66478
8. `NEXT_PUBLIC_` 접두사 환경변수는 빌드할 때 브라우저로 가는 JS에 그대로 박힌다. 비밀에 이 접두사를 붙이지 않는다. 근거: https://nextjs.org/docs/app/guides/environment-variables
9. `dangerouslySetInnerHTML`에는 검증된 sanitizer를 거친 값만 넣는다.

## 테스트

- 컴포넌트: Vitest와 Testing Library로 역할(role)과 이름으로 찾아 사용자 동작을 검증한다. 스냅샷으로 커버리지를 채우지 않는다.
- Server Action과 DAL: 함수로 직접 부르는 단위 테스트에 "로그인 안 함", "다른 사용자의 자원", "잘못된 입력" 세 경우를 먼저 쓴다.
- E2E: 핵심 사용자 여정 하나 이상을 Playwright로 돌리고, axe 검사 위반 0건을 같이 확인한다.

## 접근성과 성능 합격선

- WCAG 2.2 AA를 기준으로 한다. 자동 검사(axe) 위반 0건, 핵심 여정을 키보드만으로 완주, 포커스 표시가 보인다.
- Core Web Vitals는 실제 사용자 75번째 백분위에서 LCP 2.5초 이하, INP 200ms 이하, CLS 0.1 이하이고, 모바일과 데스크톱을 따로 본다. 근거: https://web.dev/articles/vitals

## 관용구

- 기본은 Server Component다. 상태나 이벤트가 필요한 가장 작은 잎 컴포넌트에만 `"use client"`를 붙인다.
- 서버에서 독립적인 데이터는 `Promise.all`로 함께 가져와 폭포(waterfall)를 피한다.
- 데이터 읽기를 `useEffect`로 하지 않는다. 서버에서 읽거나 프레임워크의 데이터 도구를 쓴다.
- 폼 상태는 판별 유니온으로 표현하고, 로딩, 빈 상태, 오류, 부분 실패 화면을 모두 만든다.

## 자주 나는 실수

1. 페이지에서만 로그인 확인하고 액션은 무방비. 고친다: 액션 첫 줄에서 인증, 인가, 파싱 순서로.
2. DB 행 전체를 Client Component의 props로 넘긴다(직렬화되어 브라우저에 노출). 고친다: DTO로 필요한 필드만.
3. 렌더링 중 `Date.now()`, `Math.random()`으로 hydration 불일치. 고친다: 서버에서 값을 정해 내려보낸다.
4. 목록 `key`에 배열 인덱스. 고친다: 안정적인 ID.
5. 쓰기 뒤 캐시 갱신 누락으로 예전 값이 보인다. 고친다: `updateTag`나 `revalidateTag(tag, 프로필)`.
6. 큰 트리 꼭대기에 `"use client"`. 고친다: 경계를 잎으로 내린다.
