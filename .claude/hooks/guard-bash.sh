#!/usr/bin/env bash
# PreToolUse(Bash) 가드 — stdin의 tool_input.command를 검사한다.
# exit 2 = 차단(stderr가 에이전트에게 사유로 전달), exit 0 = 통과.
#
# 이 하네스에서 "권고가 아니라 강제"를 담당하는 유일한 층이다 (docs/design-docs/core-beliefs.md #5).
# 한계: 완전한 shell parser가 아니다. 변수 우회(E=.env; cat $E)나 인터프리터 경유
#       (node -e "readFileSync('.env')")는 막지 못한다. permissions.deny와 리뷰가 나머지 층이다.
#
# ── 예외를 추가하거나 끄는 법 ────────────────────────────────────────────────
#   · 삭제 허용 경로 추가: 아래 RM_ALLOW 배열에 패턴을 넣는다.
#   · 일시적으로 끄기: .claude/settings.json 의 hooks.PreToolUse 블록을 주석 대신
#     `"hooks": {}` 로 바꾼다. 끈 이유와 복구 시점을 tech-debt-tracker에 남긴다.
#   · 규칙을 바꾸면 반드시 `npm run init:harness` 의 [4] 스모크 테스트를 다시 통과시킨다.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

INPUT=$(cat)
[ -z "${INPUT:-}" ] && exit 0

block() { echo "$1" >&2; exit 2; }

# --- 명령 추출: jq → python3 → sed 순으로 시도하고, 전부 실패하면 fail-closed ---
CMD=""
PARSED=0
if command -v jq >/dev/null 2>&1; then
  CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) && PARSED=1
fi
if [ "$PARSED" = "0" ] && command -v python3 >/dev/null 2>&1; then
  CMD=$(printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception:
    sys.exit(1)' 2>/dev/null) && PARSED=1
fi
if [ "$PARSED" = "0" ]; then
  CMD=$(printf '%s' "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)"[[:space:]]*}.*/\1/p')
  [ -n "$CMD" ] && PARSED=1
fi
# 파서가 전부 실패 = 검사 불능. 조용히 통과시키면 가드가 없는 것과 같으므로 막는다.
[ "$PARSED" = "0" ] && block "guard-bash: 명령을 파싱할 수 없어 차단함 (jq 또는 python3 설치 권장). 입력 형식을 확인하라."
[ -z "$CMD" ] && exit 0

# 셸 연산자를 공백으로 치환해 토큰화 (파이프·서브셸 내부 명령도 토큰으로 잡히게)
TOKENS=$(printf '%s' "$CMD" | tr '|;&()<>' ' ')

# --- 1) 시크릿 파일 접근 차단 (.env 계열 전부 — .env.example만 허용) ---
for t in $TOKENS; do
  base="${t##*/}"
  shopt -s nocasematch
  if { [[ "$base" == .env || "$base" == .env.* ]] && [[ "$base" != .env.example ]]; } \
     || [[ "$base" == *.pem ]] || [[ "$t" == *secrets/* ]]; then
    shopt -u nocasematch
    block "시크릿 파일($t) 접근은 차단됨 — 키 이름이 필요하면 .env.example을 읽어라 (docs/SECURITY.md)."
  fi
  shopt -u nocasematch
done

# --- 2) force push 차단 (--force-with-lease는 안전한 형태라 허용) ---
if echo " $TOKENS " | grep -qE ' git ' && echo " $TOKENS " | grep -qE ' push '; then
  if echo " $TOKENS " | grep -qE ' (--force|-f) ' || echo " $TOKENS " | grep -qE ' \+[A-Za-z]'; then
    block "force push는 차단됨 — 되감기가 꼭 필요하면 --force-with-lease를 쓰거나 사용자에게 직접 실행을 요청하라 (AGENTS.md)."
  fi
fi

# --- 3) 재귀 삭제: 빌드 산출물만 허용, 그 외는 차단 ---
# 매일 쓰는 rm -rf node_modules 까지 막으면 사람이 hook을 통째로 꺼버린다. 마찰과 방어의 균형점.
RM_ALLOW='^(\./)?(node_modules|\.next|\.nuxt|dist|build|out|coverage|\.turbo|\.cache|\.parcel-cache|target|tmp)(/.*)?$|^/tmp/.+'
if echo " $TOKENS " | grep -qE ' rm ' && echo " $TOKENS " | grep -qE ' (--recursive|-[a-zA-Z]*[rR][a-zA-Z]*) '; then
  seen_rm=0
  for t in $TOKENS; do
    if [ "$seen_rm" = "0" ]; then [ "$t" = "rm" ] && seen_rm=1; continue; fi
    case "$t" in
      -*) continue ;;                       # 플래그는 건너뛴다
    esac
    if ! echo "$t" | grep -qE "$RM_ALLOW"; then
      block "재귀 삭제 대상($t)이 허용 목록 밖이다 — 빌드 산출물(node_modules·dist·build 등)만 자동 허용된다. 그 외는 사용자에게 확인받아라."
    fi
  done
fi
if echo " $TOKENS " | grep -qE ' find ' && echo " $TOKENS " | grep -qE ' -delete '; then
  block "find -delete 일괄 삭제는 차단됨 — 삭제 대상을 사용자에게 확인받아라."
fi
if echo " $TOKENS " | grep -qE ' find ' && echo " $TOKENS " | grep -qE ' -exec ' && echo " $TOKENS " | grep -qE ' rm '; then
  block "find -exec rm 일괄 삭제는 차단됨 — 삭제 대상을 사용자에게 확인받아라."
fi

exit 0
