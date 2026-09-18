#!/usr/bin/env bash
# PreToolUse(Bash) 가드 — stdin으로 받은 tool_input.command를 검사한다.
# exit 2 = 차단 (stderr가 에이전트에게 사유로 전달), exit 0 = 통과.
# 검사 방식: 정규식 한 방이 아니라 토큰 단위 — 우회 변형(.env.local, git -C . push, rm -r -f)까지 잡는다.
# 주의: 이 가드는 방어선의 한 층일 뿐 완전한 shell parser가 아니다. 보안의 최종 책임은 permissions + 리뷰에 있다.
# 수정 시 반드시 스모크 테스트 재실행: bash scripts/init.sh (4번 항목)

set -euo pipefail

if command -v jq >/dev/null 2>&1; then
  CMD=$(jq -r '.tool_input.command // empty' 2>/dev/null || true)
else
  CMD=$(cat)
fi
[ -z "${CMD:-}" ] && exit 0

block() { echo "$1" >&2; exit 2; }

# 셸 연산자를 공백으로 치환해 토큰화 (파이프·서브셸 내부 명령도 토큰으로 잡히게)
TOKENS=$(echo "$CMD" | tr '|;&()<>' ' ')

# --- 1) 시크릿 파일 접근 차단 (.env 계열 전부 — .env.example만 허용) ---
for t in $TOKENS; do
  base="${t##*/}"
  shopt -s nocasematch
  if [[ "$base" == .env || "$base" == .env.* ]] && [[ "$base" != .env.example ]]; then
    shopt -u nocasematch
    block "시크릿 파일($t) 접근은 차단됨 — 키 이름이 필요하면 .env.example을 읽어라 (docs/SECURITY.md)."
  fi
  if [[ "$base" == *.pem || "$t" == *secrets/* ]]; then
    shopt -u nocasematch
    block "시크릿 파일($t) 접근은 차단됨 (docs/SECURITY.md)."
  fi
  shopt -u nocasematch
done

# --- 2) force push 차단 (git 전역 옵션 사이에 끼어도 잡는다) ---
if echo " $TOKENS " | grep -qE ' git ' && echo " $TOKENS " | grep -qE ' push '; then
  if echo " $TOKENS " | grep -qE ' (--force|--force-with-lease|-f) ' || echo " $TOKENS " | grep -qE ' \+[A-Za-z]'; then
    block "force push는 차단됨 — 사용자에게 직접 실행을 요청하라 (AGENTS.md)."
  fi
fi

# --- 3) 재귀 삭제 차단 (rm의 모든 재귀 변형 + find -delete/-exec rm) ---
if echo " $TOKENS " | grep -qE ' rm '; then
  if echo " $TOKENS " | grep -qE ' (--recursive|-[a-zA-Z]*[rR][a-zA-Z]*) '; then
    block "재귀 삭제는 차단됨 — 삭제 대상을 사용자에게 확인받아라."
  fi
fi
if echo " $TOKENS " | grep -qE ' find ' && echo " $TOKENS " | grep -qE ' (-delete|-exec) '; then
  if echo " $TOKENS " | grep -qE ' -delete ' || echo " $TOKENS " | grep -qE ' rm '; then
    block "find 기반 일괄 삭제는 차단됨 — 삭제 대상을 사용자에게 확인받아라."
  fi
fi

exit 0
