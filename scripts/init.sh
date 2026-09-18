#!/usr/bin/env bash
# 하네스 온보딩 검사 — 새 프로젝트에 복사한 뒤 실행한다: npm run init:harness
# "(교체)" 마커가 남아 있으면 지도가 거짓말을 하는 상태다. /gotechy-ship 게이트 0단계도 이걸 검사한다.

set -uo pipefail
cd "$(dirname "$0")/.."

echo "== Gotechy Harness 초기화 검사 =="

FAIL=0

echo
echo "[1] '(교체)' 마커 잔존 검사"
MATCHES=$(grep -rn "(교체)" --include="*.md" --include="*.json" . 2>/dev/null | grep -v "scripts/init.sh" | grep -v "docs/references/research" || true)
if [ -n "$MATCHES" ]; then
  echo "$MATCHES"
  echo "→ 위 항목을 프로젝트 값으로 교체하라."
  FAIL=1
else
  echo "통과 — 잔존 마커 없음."
fi

echo
echo "[2] 게이트 명령 실체 검사"
for s in dev lint build test; do
  if ! grep -q "\"$s\"" package.json; then echo "package.json에 $s 스크립트가 없음"; FAIL=1; fi
done
if grep -q "미설정" package.json; then
  echo "package.json에 미설정 스텁이 남아 있음 — 실제 명령으로 교체하라:"
  grep -n "미설정" package.json | sed 's/^/  /'
  FAIL=1
else
  echo "통과 — 스텁 없음."
fi

echo
echo "[3] 시크릿 규약 검사"
[ -f .gitignore ] || { echo ".gitignore 없음"; FAIL=1; }
[ -f .env.example ] || { echo ".env.example 없음 (키 매니페스트)"; FAIL=1; }
if [ -f .env ] && ! grep -q "^\.env$" .gitignore 2>/dev/null; then echo ".env가 gitignore에 없음 — 즉시 추가"; FAIL=1; fi

echo
echo "[4] hook 스모크 테스트 (강제 장치가 실제로 작동하는가 — 우회 변형 포함)"
hook_case() { # $1=command $2=expected exit
  R=$(echo "{\"tool_input\":{\"command\":\"$1\"}}" | bash .claude/hooks/guard-bash.sh >/dev/null 2>&1; echo $?)
  if [ "$R" != "$2" ]; then echo "실패 — '$1' exit=$R (기대 $2)"; FAIL=1; fi
}
hook_case "git push --force" 2
hook_case "git -C . push --force" 2
hook_case "git push -f origin main" 2
hook_case "cat .env" 2
hook_case "cat .env.local" 2
hook_case "cat .env .env.example" 2
hook_case "rm -r -f build" 2
hook_case "rm --recursive --force x" 2
hook_case "find . -name tmp -delete" 2
hook_case "git status" 0
hook_case "cat .env.example" 0
hook_case "npm test" 0
[ "$FAIL" = "0" ] && echo "통과 — 12케이스 차단/통과 정상."

echo
echo "[5] 템플릿 잔재 안내"
echo "  - README.md는 하네스 설명서다 → 프로젝트 README로 교체 권장"
echo "  - docs/references/research/ 는 하네스 리서치 원문 → 유지하거나 하네스 원본으로 반납"

echo
if [ "$FAIL" = "0" ]; then
  echo "== 초기화 검사 통과 =="
  exit 0
else
  echo "== 초기화 미완 — 위 항목을 처리하라 =="
  exit 1
fi
