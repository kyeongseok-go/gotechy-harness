#!/bin/sh
# 오너가 터미널 앱에서 직접 실행하는 Touch ID 확인 (1b N1, contract.md 6.3, 6.4절).
# 실제 $GOTECHY_HOME(기본 ~/.gotechy)에 오너 키를 만들고, 임시 프로젝트에서 결정 두 건을 해 본다.
#   G-001: y를 누른 뒤 지문으로 승인한다. 창 문구가 "gotechy G-001: 5분"인지, 지문을 한 번만 묻는지 본다.
#   G-002: y를 누른 뒤 지문 창에서 "취소"를 누른다. 아무것도 기록되지 않아야 한다.
# 처음 실행하면 부트스트랩이 mise와 train 도구를 내려받는다(이 맥에서 새 HOME 기준 약 2분 30초).
# 임시 프로젝트는 지우지 않고 경로만 알려 준다.
set -eu

LIB=$(cd "$(dirname "$0")/.." && pwd -P)
G="$LIB/bin/gotechy"
if [ ! -t 0 ] || [ ! -t 1 ]; then
  echo "터미널 앱에서 직접 실행하세요. decide는 대화형 터미널에서만 동작해요." >&2
  exit 2
fi

echo "1/5 오너 키 만들기 (지문은 아직 묻지 않아요)"
"$G" keys init

WORK=$(mktemp -d "${TMPDIR:-/tmp}/gotechy-touchid-XXXXXX")
echo "2/5 임시 프로젝트: $WORK"
cd "$WORK"
git init -q -b main
printf '# Touch ID 확인용 임시 프로젝트\n' > README.md
"$G" init
git add -A
# 버리는 임시 프로젝트의 첫 커밋이라 gitleaks hook을 거치지 않는다(이 맥 전역에 gitleaks가 없으면 hook이 막는다)
git -c core.hooksPath=/dev/null -c user.name=owner -c user.email=owner@localhost commit -qm init

echo "3/5 녹화된 워커로 결정 두 건 열기"
"$G" task new "Touch ID 확인" --verify "grep -q 설치 README.md" --ownership README.md
"$G" run T-001 --adapter fake --fixture "$LIB/tests/fixtures/fake/needs-decision" || true

echo
echo "4/5 G-001: y를 누르고, 지문 창의 문구를 본 뒤 지문으로 승인하세요"
"$G" decide G-001 5분

echo
echo "5/5 G-002: y를 누르고, 이번에는 지문 창에서 취소를 누르세요"
if "$G" decide G-002 넣기; then
  echo "G-002가 기록됐어요. 취소를 누르지 않았다면 정상이에요."
else
  echo "G-002는 기록되지 않았어요(취소)."
fi

echo
echo "결과: G-001은 ok, G-002는 pending이어야 해요"
"$G" gate verify || true
echo "결정 장부 줄 수: $(wc -l < orchestration/private/decisions.jsonl | tr -d ' ') (1이어야 해요)"
echo "임시 프로젝트는 그대로 두었어요: $WORK"
