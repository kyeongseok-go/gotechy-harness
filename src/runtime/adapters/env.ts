// 워커에 넘기는 환경 변수(보안 감사 5차 중간 1). 오너 셸의 토큰(GITHUB_TOKEN, 클라우드 자격 증명 등)이 워커에 닿지 않게
// 허용 목록만 넘긴다. 워커 CLI는 로그인을 HOME 아래 설정과 키체인에서 읽으므로 HOME과 PATH면 된다(2026-10-14 확인).
const BASE = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TERM',
  'TMPDIR',
  // 회사 프록시와 인증서
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
  'https_proxy',
  'http_proxy',
  'no_proxy',
  'SSL_CERT_FILE',
  'NODE_EXTRA_CA_CERTS',
]

/** 허용 목록의 값과, 어댑터가 따로 고른 값(로그인 방식에 필요한 키)과, 고정 값만 담는다. */
export function workerEnv(
  extra: string[],
  fixed: Record<string, string> = {},
): Record<string, string> {
  const env: Record<string, string> = {}
  for (const k of [...BASE, ...extra]) {
    const v = process.env[k]
    if (v !== undefined) env[k] = v
  }
  return { ...env, ...fixed }
}
