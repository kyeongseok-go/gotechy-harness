#!/bin/sh
# 오너가 터미널 앱에서 직접 실행하는 Touch ID 확인 (1b N1, contract.md 6.3, 6.4절).
# 실제 $GOTECHY_HOME(기본 ~/.gotechy)에 오너 키를 만들고, 임시 프로젝트에서 결정 두 건을 해 본다.
#   확인 창은 지문 창이다. 지문 장치가 없는 맥(맥 미니, 맥 스튜디오 등)에서는 맥 로그인 암호 창이 뜬다.
#   G-001: y를 누른 뒤 지문(또는 암호)으로 승인한다. 창 문구가 "gotechy G-001 T-001: 5분 (확인 XXXX)"이고 코드가
#          터미널에 보인 확인 코드와 같은지, 한 번만 묻는지 본다.
#   G-002: y를 누른 뒤 창에서 "취소"를 누른다(암호를 넣지 않는다). 아무것도 기록되지 않아야 한다.
# 처음 실행하면 부트스트랩이 mise와 train 도구를 내려받는다(이 맥에서 새 HOME 기준 약 2분 30초).
# 임시 프로젝트는 지우지 않고 경로만 알려 준다. 마지막에 화면 결정(serve)으로 G-002를 다시 해 보는 방법을 알려 준다.
set -eu

LIB=$(cd "$(dirname "$0")/.." && pwd -P)
G="$LIB/bin/gotechy"
if [ ! -t 0 ] || [ ! -t 1 ]; then
  echo "터미널 앱에서 직접 실행하세요. decide는 대화형 터미널에서만 동작해요." >&2
  exit 2
fi

echo "1/5 오너 키 만들기 (지문이나 암호는 아직 묻지 않아요)"
echo "    지문 장치가 없는 맥에서는 지문 대신 맥 로그인 암호 창이 떠요"
"$G" keys init

WORK=$(mktemp -d "${TMPDIR:-/tmp}/gotechy-touchid-XXXXXX")
echo "2/5 임시 프로젝트: $WORK"
cd "$WORK"
git init -q -b main
printf '# Touch ID 확인용 임시 프로젝트\n' > README.md
# Touch ID 확인에는 팩이 필요 없다. 팩 설치(apm, 네트워크)를 건너뛴다
"$G" init --packs ''
git add -A
# 버리는 임시 프로젝트의 첫 커밋이라 gitleaks hook을 거치지 않는다(이 맥 전역에 gitleaks가 없으면 hook이 막는다)
git -c core.hooksPath=/dev/null -c user.name=owner -c user.email=owner@localhost commit -qm init

echo "3/5 녹화된 워커로 결정 두 건 열기"
"$G" task new "Touch ID 확인" --verify "grep -q 설치 README.md" --ownership README.md
"$G" run T-001 --adapter fake --fixture "$LIB/tests/fixtures/fake/needs-decision" || true

echo
echo "4/5 G-001: y를 누르면 확인 코드가 나와요. 확인 창의 코드가 같은지 본 뒤 지문이나 맥 암호로 승인하세요"
"$G" decide G-001 5분

echo
echo "5/5 G-002: 취소가 막히는지 보는 시험이에요"
echo "  y를 누른 뒤 터미널에 '코드가 같으면 승인하세요'가 나와도, 이번에는 확인 창의 취소 버튼을 마우스로 누르세요."
echo "  지문이나 암호를 넣지 말고 Enter도 누르지 마세요."
G2=pending
if "$G" decide G-002 넣기; then
  G2=recorded
  echo "G-002가 기록됐어요. 확인 창에서 승인된 것이라 취소 시험은 되지 않았어요. 스크립트를 다시 실행해 주세요."
else
  echo "G-002는 기록되지 않았어요(취소)."
fi

echo
echo "결과: G-001은 ok, G-002는 pending이어야 해요"
"$G" gate verify || true
echo "결정 장부 줄 수: $(wc -l < orchestration/private/decisions.jsonl | tr -d ' ') (1이어야 해요)"
echo "임시 프로젝트는 그대로 두었어요: $WORK"
# 화면 결정은 결정할 G-002가 남아 있을 때만 권한다(이미 기록됐으면 화면에 결정 버튼이 없다)
if [ "$G2" = pending ]; then
  echo
  echo "(선택) 화면 결정도 확인하려면: cd $WORK && $G serve"
  echo "  출력된 주소를 브라우저로 열고 G-002를 결정해 보세요. 화면의 확인 코드와 확인 창의 코드가 같은지 보세요."
fi
