#!/usr/bin/env python3
"""하네스 문서 수집 + 마크다운→HTML 변환 → /tmp/viewer_data.json

외부 의존성 없음 (자체 마크다운 변환기). build_html.py가 이 JSON을 읽어 단일 뷰어 HTML을 만든다.
문서를 추가했으면 아래 GROUPS에 경로를 넣는다 — 빠진 파일은 실행 시 "미분류"로 보고된다.
"""
import html, json, os, re, sys

ROOT = os.environ.get("HARNESS_ROOT", os.path.expanduser("~/gotechy-harness"))

# ── 최소 마크다운 → HTML 변환기 ───────────────────────────────────────────────
def inline(t):
    t = html.escape(t)
    codes = []
    def stash(m):
        codes.append(m.group(1))
        return f"\x00{len(codes)-1}\x00"
    t = re.sub(r"`([^`]+)`", stash, t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"~~([^~]+)~~", r"<del>\1</del>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)",
               lambda m: f'<a href="{m.group(2)}" target="_blank" rel="noopener">{m.group(1)}</a>'
               if m.group(2).startswith("http") else f'<span class="xref">{m.group(1)}</span>', t)
    t = re.sub(r"\x00(\d+)\x00", lambda m: f"<code>{codes[int(m.group(1))]}</code>", t)
    return t

def md2html(src):
    lines, out, i = src.split("\n"), [], 0
    n = len(lines)
    while i < n:
        ln = lines[i]

        if ln.startswith("```"):                                     # 코드 펜스
            i += 1
            buf = []
            while i < n and not lines[i].startswith("```"):
                buf.append(lines[i]); i += 1
            i += 1
            out.append(f'<pre class="code"><code>{html.escape(chr(10).join(buf))}</code></pre>')
            continue

        if ln.strip().startswith("<!--"):                             # 작성 지침 주석
            buf = [ln]
            while i < n and "-->" not in lines[i]:
                i += 1; buf.append(lines[i] if i < n else "")
            i += 1
            txt = re.sub(r"<!--|-->", "", "\n".join(buf)).strip()
            if txt:
                out.append(f'<div class="note">{inline(txt)}</div>')
            continue

        if re.match(r"^\s*\|.*\|\s*$", ln) and i + 1 < n and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i+1]):
            head = [c.strip() for c in ln.strip().strip("|").split("|")]
            i += 2
            rows = []
            while i < n and re.match(r"^\s*\|.*\|\s*$", lines[i]):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            th = "".join(f"<th>{inline(c)}</th>" for c in head)
            tb = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows)
            out.append(f'<div class="tw"><table><thead><tr>{th}</tr></thead><tbody>{tb}</tbody></table></div>')
            continue

        m = re.match(r"^(#{1,6})\s+(.*)$", ln)
        if m:
            lv = len(m.group(1))
            out.append(f"<h{lv}>{inline(m.group(2))}</h{lv}>")
            i += 1; continue

        if re.match(r"^\s*(---|===)\s*$", ln):
            out.append("<hr>"); i += 1; continue

        if ln.startswith(">"):
            buf = []
            while i < n and lines[i].startswith(">"):
                buf.append(lines[i].lstrip(">").strip()); i += 1
            out.append(f'<blockquote>{inline(" ".join(buf))}</blockquote>')
            continue

        if re.match(r"^\s*([-*+]|\d+\.)\s+", ln):
            ordered = bool(re.match(r"^\s*\d+\.", ln))
            items = []
            while i < n and re.match(r"^\s*([-*+]|\d+\.)\s+", lines[i]):
                body = re.sub(r"^\s*([-*+]|\d+\.)\s+", "", lines[i])
                cb = re.match(r"^\[([ xX])\]\s*(.*)$", body)
                if cb:
                    mark = "☑" if cb.group(1).lower() == "x" else "☐"
                    items.append(f'<li class="cb"><span class="box">{mark}</span>{inline(cb.group(2))}</li>')
                else:
                    items.append(f"<li>{inline(body)}</li>")
                i += 1
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>{''.join(items)}</{tag}>")
            continue

        if ln.strip() == "":
            i += 1; continue

        buf = []
        while i < n and lines[i].strip() and not re.match(
                r"^(#{1,6}\s|```|>|\s*[-*+]\s|\s*\d+\.\s|\s*\|)", lines[i]) \
                and not lines[i].strip().startswith("<!--"):
            buf.append(lines[i]); i += 1
        out.append(f'<p>{inline(" ".join(buf))}</p>')
    return "\n".join(out)

# ── 그룹 정의 (문서 추가 시 여기에 등록) ──────────────────────────────────────
GROUPS = [
    ("진입점", "에이전트가 처음 읽는 지도", [
        "AGENTS.md", "CLAUDE.md", "ARCHITECTURE.md", "README.md"]),
    ("핵심 규범", "판단 기준이 되는 문서군", [
        "docs/PLANS.md", "docs/AI_PLAYBOOK.md", "docs/ROUTINES.md", "docs/PRODUCT_SENSE.md",
        "docs/QUALITY_BAR.md", "docs/SECURITY.md", "docs/RELIABILITY.md", "docs/DEPLOYMENT.md",
        "docs/DESIGN.md", "docs/FRONTEND.md", "docs/BRAND.md"]),
    ("품질 목표 (ISO 25010)", "표준 기반 목표값·검증 (v1.5)", [
        "docs/QUALITY_MODEL.md",
        "docs/product-specs/_wizard-templates/15-quality-goals.md",
        ".claude/skills/gotechy-quality/SKILL.md",
        "docs/references/research/iso-25010-quality-research.md"]),
    ("기획·디자인 위저드", "단계형 7스테이지 (v1.4)", [
        "docs/WIZARD.md",
        "docs/product-specs/_wizard-templates/00-brief.md",
        "docs/product-specs/_wizard-templates/20-features.md",
        "docs/product-specs/_wizard-templates/30-user-flow.md",
        "docs/product-specs/_wizard-templates/40-sitemap.md",
        "docs/product-specs/_wizard-templates/50-wireframe.md",
        "docs/product-specs/_wizard-templates/60-style-guide.md",
        "docs/references/section-library.md",
        ".claude/skills/gotechy-design/SKILL.md"]),
    ("설계·스펙·계획", "템플릿과 색인", [
        "docs/design-docs/core-beliefs.md", "docs/design-docs/index.md",
        "docs/product-specs/index.md", "docs/product-specs/_template-prd.md",
        "docs/exec-plans/_template-exec-plan.md", "docs/exec-plans/tech-debt-tracker.md",
        "docs/decisions/README.md", "docs/decisions/_template-adr.md"]),
    ("AI·평가", "LLM 기능 전용", [
        "docs/evals/README.md", "docs/evals/example.golden.jsonl",
        "prompts/_template-prompt.md", "docs/career.example.yaml"]),
    ("실행층 (.claude)", "스킬·에이전트·규칙", [
        ".claude/settings.json",
        ".claude/skills/gotechy-spec/SKILL.md", ".claude/skills/gotechy-plan/SKILL.md",
        ".claude/skills/gotechy-ship/SKILL.md", ".claude/skills/gotechy-security/SKILL.md",
        ".claude/skills/gotechy-launch/SKILL.md", ".claude/skills/gotekie-blog-writer/SKILL.md",
        ".claude/skills/gotekie-blog-writer/references/persona-guide.md",
        ".claude/skills/gotekie-blog-writer/references/content-templates.md",
        ".claude/agents/spec-reviewer.md", ".claude/agents/security-auditor.md",
        ".claude/agents/doc-gardener.md",
        ".claude/rules/code-style.md", ".claude/rules/testing.md", ".claude/rules/security.md"]),
    ("강제 계층", "문장이 아니라 기계가 막는 것", [
        ".claude/hooks/guard-bash.sh", "scripts/init.sh", "scripts/bootstrap.sh",
        "scripts/viewer/README.md",
        ".github/workflows/ci.yml", ".dependency-cruiser.cjs", "package.json",
        ".env.example", ".gitignore", "docs/generated/README.md", "docs/references/README.md"]),
    ("리서치·심사 기록", "이 하네스가 어디서 왔나", [
        "docs/references/research/openai-harness-engineering.md",
        "docs/references/research/anthropic-claude-code-harness.md",
        "docs/references/research/ai-best-practices-2026.md",
        "docs/references/research/github-skills-ecosystem.md",
        "docs/references/research/planning-wizard-research.md",
        "docs/references/research/expert-panel-review-v1.md"]),
]

def main():
    docs, missing, seen = [], [], set()
    for gname, _gdesc, paths in GROUPS:
        for p in paths:
            full = os.path.join(ROOT, p)
            if not os.path.exists(full):
                missing.append(p); continue
            seen.add(p)
            raw = open(full, encoding="utf-8").read()
            body = md2html(raw) if p.endswith(".md") else \
                f'<pre class="code"><code>{html.escape(raw)}</code></pre>'
            docs.append({"id": f"d{len(docs)}", "path": p, "group": gname,
                         "name": os.path.basename(p), "lines": raw.count(chr(10)) + 1,
                         "body": body, "text": raw.lower()})

    allf = set()
    for dp, _, fns in os.walk(ROOT):
        if "/.git" in dp: continue
        for fn in fns:
            rp = os.path.relpath(os.path.join(dp, fn), ROOT)
            if not rp.endswith(".gitkeep"):
                allf.add(rp)
    uncovered = sorted(allf - seen)

    print(f"수록: {len(docs)}개 / 누락 경로: {missing} / 미분류: {uncovered}", file=sys.stderr)

    groups = []
    for gname, gdesc, _ in GROUPS:
        ids = [d["id"] for d in docs if d["group"] == gname]
        if ids:
            groups.append({"name": gname, "desc": gdesc, "ids": ids})

    payload = {"groups": groups,
               "docs": [{k: d[k] for k in ("id", "path", "name", "lines", "body", "text")}
                        for d in docs]}
    out = os.environ.get("VIEWER_DATA", "/tmp/viewer_data.json")
    open(out, "w", encoding="utf-8").write(json.dumps(payload, ensure_ascii=False))
    print(f"{out} — {os.path.getsize(out)//1024}KB", file=sys.stderr)

if __name__ == "__main__":
    main()
