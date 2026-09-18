#!/usr/bin/env bash
# 하네스 부트스트랩 — 검사기를 통과 가능한 상태로 "실제로 채운다".
#   scripts/init.sh --fix  또는  npm run init:harness -- --fix 로 호출된다.
#
# 왜 있나: 복사 직후의 하네스는 모든 게이트 명령이 실패 스텁이라, 규칙을 정확히 지키는
# 에이전트는 1일차에 완료를 선언할 수 없다. 검사만 하고 고쳐주지 않는 검사기는
# 온보딩 마찰의 최대 원인이다 (TD-002).
#
# 사용:
#   scripts/bootstrap.sh                                  # 대화형
#   scripts/bootstrap.sh --yes                             # 기본값(node+vitest+none)으로 즉시
#   scripts/bootstrap.sh --stack=next --test=vitest --deploy=vercel --name=my-app --yes
#   scripts/bootstrap.sh --dry-run                         # 무엇을 바꿀지만 출력

set -euo pipefail
cd "$(dirname "$0")/.."

STACK="" TESTRUNNER="" DEPLOY="" NAME="" YES=0 DRY=0
for arg in "$@"; do
  case "$arg" in
    --stack=*)  STACK="${arg#*=}" ;;
    --test=*)   TESTRUNNER="${arg#*=}" ;;
    --deploy=*) DEPLOY="${arg#*=}" ;;
    --name=*)   NAME="${arg#*=}" ;;
    --yes|-y)   YES=1 ;;
    --dry-run)  DRY=1 ;;
    --fix)      ;;   # init.sh 가 넘겨주는 플래그. 무시.
    *) echo "알 수 없는 옵션: $arg" >&2; exit 1 ;;
  esac
done

command -v python3 >/dev/null 2>&1 || { echo "python3이 필요하다 (문서·JSON 편집에 사용). 설치 후 다시 실행하라." >&2; exit 1; }

ask() { # $1=프롬프트 $2=기본값 $3=선택지
  local ans
  if [ "$YES" = "1" ] || [ ! -t 0 ]; then echo "$2"; return; fi
  printf '%s [%s] (%s): ' "$1" "$2" "$3" > /dev/tty
  read -r ans < /dev/tty || ans=""
  echo "${ans:-$2}"
}

[ -n "$NAME" ]       || NAME=$(ask "프로젝트 이름" "$(basename "$PWD")" "자유 입력")
[ -n "$STACK" ]      || STACK=$(ask "스택" "node" "node|next|none")
[ -n "$TESTRUNNER" ] || TESTRUNNER=$(ask "테스트 러너" "vitest" "vitest|none")
[ -n "$DEPLOY" ]     || DEPLOY=$(ask "배포 타깃" "none" "vercel|cloudflare|fly|none")

case "$STACK" in node|next|none) ;; *) echo "stack은 node|next|none 중 하나여야 한다 (받은 값: $STACK)" >&2; exit 1 ;; esac
case "$TESTRUNNER" in vitest|none) ;; *) echo "test는 vitest|none 중 하나여야 한다 (받은 값: $TESTRUNNER)" >&2; exit 1 ;; esac
case "$DEPLOY" in vercel|cloudflare|fly|none) ;; *) echo "deploy는 vercel|cloudflare|fly|none 중 하나여야 한다 (받은 값: $DEPLOY)" >&2; exit 1 ;; esac

echo "== 부트스트랩: name=$NAME stack=$STACK test=$TESTRUNNER deploy=$DEPLOY =="
[ "$DRY" = "1" ] && echo "(dry-run — 파일을 쓰지 않는다)"
echo

write() { # $1=경로 — stdin을 파일로. dry-run이면 경로만 출력.
  if [ "$DRY" = "1" ]; then echo "  [생성] $1"; cat > /dev/null; return; fi
  mkdir -p "$(dirname "$1")"
  cat > "$1"
  echo "  [생성] $1"
}

# ── 1. 레이어 골격 ────────────────────────────────────────────────────────────
if [ "$STACK" != "none" ]; then
  echo "[1] src/ 레이어 골격"
  for layer in types config repo service runtime ui; do
    if [ "$DRY" = "1" ]; then echo "  [생성] src/$layer/.gitkeep"; else
      mkdir -p "src/$layer" && : > "src/$layer/.gitkeep" && echo "  [생성] src/$layer/.gitkeep"
    fi
  done
else
  echo "[1] src/ 레이어 골격 — stack=none이라 건너뜀"
fi

# ── 2. 통과하는 예제 (게이트가 1일차에 돌아가는지 증명) ───────────────────────
echo
echo "[2] 동작하는 예제 + 테스트"
if [ "$STACK" != "none" ]; then
  write src/service/health.ts <<'TS'
/**
 * Service 레이어 예제 — 순수 함수, 프레임워크 무관, 테스트 최우선 대상.
 * ARCHITECTURE.md 레이어 규칙의 살아있는 본보기다. 실제 기능을 만들면 지워도 된다.
 */
export type HealthStatus = { ok: boolean; checkedAt: string };

export function buildHealth(now: Date = new Date()): HealthStatus {
  return { ok: true, checkedAt: now.toISOString() };
}
TS
fi

if [ "$TESTRUNNER" = "vitest" ] && [ "$STACK" != "none" ]; then
  write src/service/health.test.ts <<'TS'
import { describe, expect, it } from 'vitest';
import { buildHealth } from './health';

describe('buildHealth', () => {
  it('주어진 시각을 ISO 문자열로 반환한다', () => {
    expect(buildHealth(new Date('2026-01-01T00:00:00.000Z'))).toEqual({
      ok: true,
      checkedAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
TS
  write vitest.config.ts <<'TS'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // docs/QUALITY_BAR.md 의 커버리지 기준을 기계 강제한다 (선언만 있으면 지켜지지 않는다).
      thresholds: { lines: 80, functions: 80 },
      include: ['src/service/**', 'src/repo/**'],
    },
  },
});
TS
fi

if [ "$STACK" != "none" ]; then
  write tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "*.config.ts"]
}
JSON
fi

# ── 3. package.json — 실패 스텁을 실제 명령으로 ──────────────────────────────
echo
echo "[3] package.json 스크립트"
if [ "$DRY" = "1" ]; then
  echo "  [수정] package.json (scripts·devDependencies·description)"
else
  STACK="$STACK" TESTRUNNER="$TESTRUNNER" NAME="$NAME" python3 - <<'PY'
import json, os, re

stack, runner, name = os.environ["STACK"], os.environ["TESTRUNNER"], os.environ["NAME"]
p = json.load(open("package.json", encoding="utf-8"))

p["name"] = re.sub(r"[^a-z0-9._-]", "-", name.lower()) or "project"
p["description"] = f"{name} — Gotechy Harness 기반 프로젝트."

na = lambda what: f"echo '[하네스] {what} 해당 없음 (stack={stack})' && exit 0"
s = dict(p.get("scripts", {}))

if stack == "next":
    s["dev"], s["build"] = "next dev", "next build"
elif stack == "node":
    s["dev"], s["build"] = "tsx watch src/runtime/index.ts", "tsc --outDir dist --noEmit false"
else:
    s["dev"], s["build"] = na("dev"), na("build")

s["lint"] = "tsc --noEmit" if stack != "none" else na("lint")
if runner == "vitest" and stack != "none":
    s["test"] = "vitest run"
    s["test:coverage"] = "vitest run --coverage"
else:
    s["test"] = na("test")

s["check:boundaries"] = (
    "depcruise --config .dependency-cruiser.cjs src" if stack != "none" else na("경계 검사")
)
# 생성 문서가 아직 없으면 드리프트 검사는 통과가 정답이다 (없는 것을 실패로 만들지 않는다).
s["gen:docs"] = "echo '[하네스] 생성 문서 없음 — 생성기를 추가하면 이 스크립트를 교체하라' && exit 0"
s["eval"] = "echo '[하네스] eval 미연결 — AI 기능을 추가하면 docs/evals/README.md대로 러너를 연결하라' && exit 0"
s["llm:report"] = "echo '[하네스] LLM 관측 미연결 — docs/AI_PLAYBOOK.md 5절 참조' && exit 0"
s["init:harness"] = "bash scripts/init.sh"
p["scripts"] = s

dev = dict(p.get("devDependencies", {}))
if stack != "none":
    dev["typescript"] = "^5.7.0"
    dev["dependency-cruiser"] = "^16.0.0"
if runner == "vitest" and stack != "none":
    dev["vitest"] = "^3.0.0"
    dev["@vitest/coverage-v8"] = "^3.0.0"
if stack == "node":
    dev["tsx"] = "^4.19.0"
    dev["@types/node"] = "^22.0.0"
if stack == "next":
    dev["@types/react"] = "^19.0.0"
    p.setdefault("dependencies", {}).update(
        {"next": "^15.0.0", "react": "^19.0.0", "react-dom": "^19.0.0"}
    )
if dev:
    p["devDependencies"] = dict(sorted(dev.items()))

json.dump(p, open("package.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
open("package.json", "a", encoding="utf-8").write("\n")
print("  [수정] package.json")
PY
fi

if [ "$STACK" = "node" ] && [ "$DRY" != "1" ] && [ ! -f src/runtime/index.ts ]; then
  write src/runtime/index.ts <<'TS'
import { buildHealth } from '../service/health';

// Runtime 레이어 예제 — 엔트리포인트. Service를 호출할 뿐 비즈니스 로직을 담지 않는다.
console.log(JSON.stringify(buildHealth()));
TS
fi

# ── 4. 문서의 (교체) 자리를 실제 값으로 ──────────────────────────────────────
echo
echo "[4] 문서 채우기 (ARCHITECTURE·AGENTS·DEPLOYMENT)"
if [ "$DRY" = "1" ]; then
  echo "  [수정] ARCHITECTURE.md / AGENTS.md / docs/DEPLOYMENT.md"
else
  STACK="$STACK" TESTRUNNER="$TESTRUNNER" DEPLOY="$DEPLOY" NAME="$NAME" python3 - <<'PY'
import os, sys

stack, runner, deploy, name = (
    os.environ["STACK"], os.environ["TESTRUNNER"], os.environ["DEPLOY"], os.environ["NAME"]
)
missed = []

def sub(path, old, new):
    src = open(path, encoding="utf-8").read()
    if old not in src:
        missed.append(f"{path}: 앵커 없음 — 수동 확인 필요")
        return
    open(path, "w", encoding="utf-8").write(src.replace(old, new, 1))

stack_label = {
    "next": "TypeScript strict, Next.js, React",
    "node": "TypeScript strict, Node.js",
    "none": "(JS 외 스택 — 프로젝트에 맞게 기술)",
}[stack]

# ARCHITECTURE.md — 한 줄 요약 / 디렉터리 지도 / 핵심 모듈
sub("ARCHITECTURE.md", "(프로젝트 요약을 여기에)",
    f"{name} — {stack_label} 기반. 비즈니스 로직은 `src/service`, 데이터 접근은 `src/repo`, "
    "엔트리는 `src/runtime`에 산다. 레이어 방향은 `npm run check:boundaries`가 강제한다.")

if stack != "none":
    sub("ARCHITECTURE.md", "| `src/...` | (교체) |", "\n".join([
        "| `src/types` | 순수 타입·스키마 (의존 없음) |",
        "| `src/config` | 설정·상수·환경값 접근 |",
        "| `src/repo` | 데이터 접근 — DB·외부 API 호출은 여기서만 |",
        "| `src/service` | 비즈니스 로직 (프레임워크 무관, 테스트 최우선) |",
        "| `src/runtime` | 엔트리·라우팅·핸들러 |",
        "| `src/ui` | 컴포넌트·페이지 |",
    ]))
    sub("ARCHITECTURE.md", "- (교체)",
        "- `src/service/**` — 비즈니스 로직 (커버리지 임계값은 vitest.config.ts가 강제)\n"
        "- `src/repo/**` — 데이터 경계")

# AGENTS.md — 프로젝트별 설정
build_cmd = {"next": "next build", "node": "tsc --outDir dist", "none": "해당 없음"}[stack]
test_cmd = "vitest" if runner == "vitest" and stack != "none" else "해당 없음"
dev_cmd = {"next": "next dev", "node": "tsx watch src/runtime/index.ts", "none": "해당 없음"}[stack]
deploy_label = {
    "vercel": "Vercel (`vercel --prod`) — 상세는 docs/DEPLOYMENT.md",
    "cloudflare": "Cloudflare (`wrangler deploy`) — 상세는 docs/DEPLOYMENT.md",
    "fly": "Fly.io (`fly deploy`) — 상세는 docs/DEPLOYMENT.md",
    "none": "미정 — 정해지면 docs/DEPLOYMENT.md를 먼저 채운다",
}[deploy]

sub("AGENTS.md", "- **빌드/테스트 명령**: `npm run build` · `npm test` (교체 — 현재는 명시적 실패 스텁)",
    f"- **빌드/테스트 명령**: `npm run build` ({build_cmd}) · `npm test` ({test_cmd})")
sub("AGENTS.md", "- **개발 서버**: `npm run dev` (교체)", f"- **개발 서버**: `npm run dev` ({dev_cmd})")
sub("AGENTS.md", "- **배포**: `docs/DEPLOYMENT.md`의 환경 매트릭스·명령 채우기 (교체)",
    f"- **배포**: {deploy_label}")
sub("AGENTS.md", "- **스택**: TypeScript strict, React/Next.js, Node.js (기본값 — 교체 가능)",
    f"- **스택**: {stack_label}")

# DEPLOYMENT.md — 배포 명령
deploy_cmd = {
    "vercel": "vercel --prod",
    "cloudflare": "wrangler deploy",
    "fly": "fly deploy",
    "none": "# 배포 타깃 미정 — 정해지면 이 블록과 위 환경 매트릭스를 채운다",
}[deploy]
sub("docs/DEPLOYMENT.md", "# (교체) 예: vercel --prod / wrangler deploy / fly deploy", deploy_cmd)

print("  [수정] ARCHITECTURE.md / AGENTS.md / docs/DEPLOYMENT.md")
for m in missed:
    print(f"  [주의] {m}", file=sys.stderr)
PY
fi

echo
echo "== 부트스트랩 완료 =="
if [ "$DRY" = "1" ]; then
  echo "dry-run이었다. 실제로 적용하려면 --dry-run 없이 다시 실행하라."
  exit 0
fi
echo
echo "다음 순서:"
if [ "$STACK" != "none" ]; then
  echo "  1) npm install          # 방금 추가된 devDependencies 설치"
  echo "  2) npm run init:harness # 검사 재실행 — 통과해야 1일차 세팅 끝"
  echo "  3) npm test             # 예제 테스트가 통과하면 게이트가 살아있는 것"
else
  echo "  1) npm run init:harness # 검사 재실행"
fi
echo
echo "README.md는 아직 하네스 설명서다 — 프로젝트 README로 교체하라."
