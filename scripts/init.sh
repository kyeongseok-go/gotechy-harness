#!/usr/bin/env bash
# 하네스 온보딩 검사 — 새 프로젝트에 복사한 뒤 실행한다: npm run init:harness
# "(교체)" 마커가 남아 있으면 지도가 거짓말을 하는 상태다. /gotechy-ship 게이트 2단계도 이걸 검사한다.
#
#   npm run init:harness            # 검사만
#   npm run init:harness -- --fix   # 부트스트랩(실제로 채움) 후 검사
#
# 템플릿을 갓 복사한 상태에서는 실패하는 것이 정상이다 — 그 실패를 없애는 것이 --fix 다.

set -uo pipefail
cd "$(dirname "$0")/.."

for arg in "$@"; do
  if [ "$arg" = "--fix" ]; then
    bash scripts/bootstrap.sh "$@" || exit 1
    echo
    echo "── 부트스트랩 후 재검사 ──"
    break
  fi
done

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
HOOK_FAIL=0
hook_case() { # $1=command $2=expected exit
  R=$(echo "{\"tool_input\":{\"command\":\"$1\"}}" | bash .claude/hooks/guard-bash.sh >/dev/null 2>&1; echo $?)
  if [ "$R" != "$2" ]; then echo "실패 — '$1' exit=$R (기대 $2)"; HOOK_FAIL=1; FAIL=1; fi
}
hook_case "git push --force" 2
hook_case "git -C . push --force" 2
hook_case "git push -f origin main" 2
hook_case "cat .env" 2
hook_case "cat .env.local" 2
hook_case "cat .env .env.example" 2
hook_case "rm -r -f src" 2
hook_case "rm --recursive --force ~/important" 2
hook_case "rm -rf node_modules" 0
hook_case "git push --force-with-lease" 0
hook_case "find . -name tmp -delete" 2
hook_case "git status" 0
hook_case "cat .env.example" 0
hook_case "npm test" 0
[ "$HOOK_FAIL" = "0" ] && echo "통과 — 14케이스 차단/통과 정상."

echo
echo "[5] CLAUDE.md 브리지 검사 (지도가 에이전트에게 보이는가)"
# /gotechy-start 등 외부 도구가 CLAUDE.md를 덮어쓰면 @AGENTS.md 브리지가 사라지고
# 하네스 지도 전체가 Claude Code에게 보이지 않게 된다. 조용한 치명적 실패라 기계로 검사한다.
if [ ! -f CLAUDE.md ]; then
  echo "CLAUDE.md 없음 — '@AGENTS.md' 한 줄이라도 있어야 지도가 로드된다."
  FAIL=1
elif ! grep -q "@AGENTS.md" CLAUDE.md; then
  echo "CLAUDE.md에 '@AGENTS.md' 브리지가 없음 — 외부 도구가 덮어썼을 가능성."
  echo "→ CLAUDE.md 첫 줄에 '@AGENTS.md' 를 복구하라. 없으면 하네스 문서 전체가 로드되지 않는다."
  FAIL=1
else
  echo "통과 — 브리지 유효."
fi

echo
echo "[6] 템플릿 잔재 안내"
echo "  - README.md는 하네스 설명서다 → 프로젝트 README로 교체 권장"
echo "  - docs/references/research/ 는 하네스 리서치 원문 → 유지하거나 하네스 원본으로 반납"

echo
if [ "$FAIL" = "0" ]; then
  echo "== 초기화 검사 통과 =="
  exit 0
else
  echo "== 초기화 미완 — 위 항목을 처리하라 =="
  echo "   대부분은 자동으로 채울 수 있다:  npm run init:harness -- --fix"
  echo "   (무엇이 바뀌는지 먼저 보려면:    bash scripts/bootstrap.sh --dry-run)"
  exit 1
fi
