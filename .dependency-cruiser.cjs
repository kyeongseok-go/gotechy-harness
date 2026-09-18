/**
 * 레이어 경계의 기계 강제 (ARCHITECTURE.md의 집행 장치).
 * 활성화: npm i -D dependency-cruiser 후 package.json의 check:boundaries를
 *   "depcruise --config .dependency-cruiser.cjs src app components lib"
 * 로 교체한다. 에러 메시지에 교정 지침을 넣는다 — 에러가 곧 에이전트 교육이다.
 * 경로 glob은 프로젝트 구조에 맞게 조정한다.
 */
module.exports = {
  forbidden: [
    {
      name: 'ui-no-repo',
      comment: 'UI는 Repo를 직접 import하지 않는다 — Service를 거쳐라 (ARCHITECTURE.md 경계 1)',
      severity: 'error',
      from: { path: '(^|/)(ui|components|app)/' },
      to: { path: '(^|/)repo/' },
    },
    {
      name: 'service-no-runtime',
      comment: 'Service는 Runtime(라우팅·핸들러)을 import하지 않는다 — 의존은 아래→위 단방향',
      severity: 'error',
      from: { path: '(^|/)service/' },
      to: { path: '(^|/)(runtime|routes|handlers)/' },
    },
    {
      name: 'no-config-bypass',
      comment: '시크릿·환경값은 Config 레이어를 통해서만 — process.env 직접 접근 금지 (ARCHITECTURE.md 경계 2)',
      severity: 'warn',
      from: { pathNot: '(^|/)config/' },
      to: { path: 'process\\.env', dependencyTypes: ['unknown'] },
    },
    {
      name: 'no-circular',
      comment: '순환 의존 금지',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};
