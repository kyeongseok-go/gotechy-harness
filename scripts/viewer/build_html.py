#!/usr/bin/env python3
"""viewer_data.json → 단일 HTML 뷰어 (목차 + 전문 검색, 애플 스타일 라이트 테마)

사용: python3 scripts/viewer/build_html.py [출력경로]   (기본 ~/harness-docs.html)
환경변수: VIEWER_DATA(입력 JSON), HARNESS_VERSION(헤더 표기, 기본 git describe/태그 없으면 dev)
"""
import json, os, subprocess, sys

DATA = os.environ.get("VIEWER_DATA", "/tmp/viewer_data.json")
raw = open(DATA, encoding="utf-8").read()
ndocs = len(json.loads(raw)["docs"])
data = raw.replace("</script>", "<\\/script>")

ver = os.environ.get("HARNESS_VERSION")
if not ver:
    try:
        msg = subprocess.run(["git", "log", "-1", "--pretty=%s"],
                             cwd=os.path.expanduser("~/gotechy-harness"),
                             capture_output=True, text=True, timeout=5).stdout.strip()
        ver = msg.split(" ")[0] if msg.startswith("v") else "dev"
    except Exception:
        ver = "dev"

HTML = '''<title>Gotechy Harness 문서</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  /* 의도적 단일 라이트 테마 — 가이드 아티팩트와 한 세트. 모든 색을 명시적으로 칠한다. */
  :root{
    --bg:#FBFBFD; --surface:#FFFFFF; --raised:#F5F5F7; --sidebar:#F7F7F9;
    --ink:#1D1D1F; --ink2:#3C3C41; --muted:#6E6E73; --faint:#AEAEB2;
    --line:#E3E3E8; --blue:#0071E3; --blue-ink:#0058B0; --blue-soft:#EAF3FF;
    --orange:#C25605; --orange-soft:#FDF0E3;
    --code-bg:#1D1D1F; --code-ink:#F5F5F7;
    --sans:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","IBM Plex Sans KR","Pretendard","Noto Sans KR",sans-serif;
    --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
    --sbw:290px;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.75;
       word-break:keep-all;overflow-wrap:break-word;-webkit-font-smoothing:antialiased;display:flex;flex-direction:column}
  a{color:var(--blue);text-underline-offset:3px}
  :focus-visible{outline:2px solid var(--blue);outline-offset:2px;border-radius:4px}

  .top{flex:0 0 auto;display:flex;align-items:center;gap:12px;height:56px;padding:0 16px;
       background:rgba(251,251,253,.9);backdrop-filter:blur(16px);border-bottom:1px solid var(--line);
       position:sticky;top:env(safe-area-inset-top,0px);z-index:30}
  .brand{font-weight:700;font-size:15px;letter-spacing:-.02em;white-space:nowrap}
  .brand span{color:var(--muted);font-weight:500;font-size:13px;margin-left:6px}
  .search{flex:1;max-width:420px;padding:8px 13px;border:1px solid var(--line);background:var(--surface);
          color:var(--ink);font-family:var(--sans);font-size:14px;border-radius:99px}
  .search::placeholder{color:var(--faint)}
  .search:focus{outline:2px solid var(--blue);outline-offset:0;border-color:transparent}
  .menu{display:none;border:1px solid var(--line);background:var(--surface);color:var(--ink2);
        font-size:13px;font-weight:600;padding:7px 12px;border-radius:99px;cursor:pointer;font-family:var(--sans)}
  .count{font-family:var(--mono);font-size:12px;color:var(--muted);white-space:nowrap}

  .shell{flex:1;display:flex;min-height:0}
  .side{flex:0 0 var(--sbw);width:var(--sbw);background:var(--sidebar);border-right:1px solid var(--line);
        overflow-y:auto;padding:14px 10px 40px}
  .grp{margin-bottom:16px}
  .grp>h4{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
          margin:0 0 3px;padding:0 10px}
  .grp>p{font-size:11.5px;color:var(--faint);margin:0 0 7px;padding:0 10px;line-height:1.5}
  .side a{display:flex;align-items:baseline;gap:7px;font-size:13.5px;color:var(--ink2);text-decoration:none;
          padding:6px 10px;border-radius:8px;transition:background .12s}
  .side a:hover{background:var(--raised)}
  .side a.on{background:var(--blue);color:#fff;font-weight:600}
  .side a.on .ln{color:rgba(255,255,255,.75)}
  .side a .nm{font-family:var(--mono);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .side a .ln{margin-left:auto;font-family:var(--mono);font-size:10.5px;color:var(--faint);flex-shrink:0}
  .side a.hid,.grp.hid{display:none}

  .main{flex:1;min-width:0;overflow-y:auto;padding:0 20px 80px}
  .doc{display:none;max-width:52rem;margin:0 auto}
  .doc.on{display:block}
  .crumb{font-family:var(--mono);font-size:12px;color:var(--muted);padding:18px 0 4px;border-bottom:1px solid var(--line);margin-bottom:22px}
  .hitlist{max-width:52rem;margin:0 auto;padding-top:20px}
  .hit{display:block;background:var(--surface);border:1px solid var(--line);border-radius:12px;
       padding:14px 16px;margin-bottom:9px;text-decoration:none;color:var(--ink)}
  .hit:hover{border-color:var(--blue)}
  .hit b{display:block;font-family:var(--mono);font-size:13px;margin-bottom:3px}
  .hit span{font-size:13px;color:var(--muted)}
  .empty{max-width:52rem;margin:0 auto;padding-top:40px;color:var(--muted);text-align:center}

  .doc h1{font-size:30px;font-weight:700;letter-spacing:-.025em;margin:0 0 14px;line-height:1.25;text-wrap:balance}
  .doc h2{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:34px 0 12px;padding-top:10px;border-top:1px solid var(--line);line-height:1.3}
  .doc h3{font-size:17.5px;font-weight:700;margin:24px 0 9px;line-height:1.35}
  .doc h4{font-size:15.5px;font-weight:700;margin:18px 0 7px;color:var(--ink2)}
  .doc p{margin:0 0 13px;color:var(--ink2)}
  .doc ul,.doc ol{margin:0 0 14px;padding-left:22px;color:var(--ink2)}
  .doc li{margin-bottom:5px}
  .doc li::marker{color:var(--faint)}
  .doc li.cb{list-style:none;margin-left:-22px;display:flex;gap:8px;align-items:baseline}
  .doc li.cb .box{color:var(--blue);flex-shrink:0}
  .doc strong{color:var(--ink);font-weight:700}
  .doc code{font-family:var(--mono);font-size:.87em;background:var(--raised);padding:2px 6px;border-radius:6px;color:var(--ink)}
  .doc pre.code{background:var(--code-bg);color:var(--code-ink);border-radius:12px;padding:15px 17px;
                overflow-x:auto;margin:0 0 15px;line-height:1.6}
  .doc pre.code code{background:none;padding:0;color:inherit;font-size:12.8px}
  .doc blockquote{margin:0 0 15px;padding:11px 16px;background:var(--blue-soft);border-radius:0 10px 10px 0;
                  border-left:3px solid var(--blue);color:var(--blue-ink);font-size:14.5px}
  .doc blockquote code{background:rgba(0,0,0,.06)}
  .doc .note{margin:0 0 14px;padding:10px 14px;background:var(--orange-soft);border-radius:10px;
             color:var(--orange);font-size:13.5px;font-style:italic}
  .doc hr{border:0;border-top:1px solid var(--line);margin:26px 0}
  .doc .tw{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface);margin:0 0 16px}
  .doc table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:30rem}
  .doc th{background:var(--raised);text-align:left;padding:10px 13px;font-size:11.5px;letter-spacing:.06em;
          text-transform:uppercase;color:var(--muted);font-weight:600;white-space:nowrap}
  .doc td{padding:10px 13px;border-top:1px solid var(--line);vertical-align:top;color:var(--ink2)}
  .doc .xref{font-family:var(--mono);font-size:.88em;color:var(--blue-ink);background:var(--blue-soft);padding:1px 5px;border-radius:5px}
  .doc del{color:var(--faint)}

  @media(max-width:860px){
    .menu{display:block}
    .side{position:fixed;top:0;left:0;bottom:0;z-index:50;transform:translateX(-100%);transition:transform .2s;
          box-shadow:0 0 40px rgba(0,0,0,.18);padding-top:calc(14px + env(safe-area-inset-top,0px))}
    .side.open{transform:none}
    .main{padding-inline:16px}
    .brand span{display:none}
    .scrim{position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:45;display:none}
    .scrim.on{display:block}
  }
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="top">
  <button class="menu" id="menuBtn" aria-label="목차 열기">☰ 목차</button>
  <div class="brand">Gotechy Harness<span>__VER__ · 문서 __N__</span></div>
  <input class="search" id="q" type="search" placeholder="검색 — 파일명 또는 본문 (예: 게이트, eval, 품질목표)" aria-label="문서 검색">
  <div class="count" id="cnt"></div>
</div>

<div class="shell">
  <nav class="side" id="side" aria-label="문서 목차"></nav>
  <main class="main" id="main"></main>
</div>
<div class="scrim" id="scrim"></div>

<script id="data" type="application/json">__DATA__</script>
<script>
(function(){
  var D = JSON.parse(document.getElementById('data').textContent);
  var byId = {}; D.docs.forEach(function(d){ byId[d.id] = d; });
  var side = document.getElementById('side'), main = document.getElementById('main');
  var q = document.getElementById('q'), cnt = document.getElementById('cnt');
  var scrim = document.getElementById('scrim'), menuBtn = document.getElementById('menuBtn');

  D.groups.forEach(function(g){
    var w = document.createElement('div'); w.className = 'grp';
    var h = document.createElement('h4'); h.textContent = g.name; w.appendChild(h);
    var p = document.createElement('p'); p.textContent = g.desc; w.appendChild(p);
    g.ids.forEach(function(id){
      var d = byId[id];
      var a = document.createElement('a');
      a.href = '#' + id; a.dataset.id = id; a.title = d.path;
      a.innerHTML = '<span class="nm"></span><span class="ln"></span>';
      a.querySelector('.nm').textContent = d.name;
      a.querySelector('.ln').textContent = d.lines;
      w.appendChild(a);
    });
    side.appendChild(w);
  });

  D.docs.forEach(function(d){
    var s = document.createElement('article');
    s.className = 'doc'; s.id = d.id;
    s.innerHTML = '<div class="crumb"></div>' + d.body;
    s.querySelector('.crumb').textContent = d.path;
    main.appendChild(s);
  });
  var hits = document.createElement('div'); hits.className = 'hitlist'; hits.hidden = true; main.appendChild(hits);
  var empty = document.createElement('div'); empty.className = 'empty'; empty.hidden = true;
  empty.textContent = '일치하는 문서가 없습니다.'; main.appendChild(empty);

  function show(id){
    D.docs.forEach(function(d){
      var el = document.getElementById(d.id);
      if (el) el.classList.toggle('on', d.id === id);
    });
    [].forEach.call(side.querySelectorAll('a'), function(a){ a.classList.toggle('on', a.dataset.id === id); });
    hits.hidden = true; empty.hidden = true;
    main.scrollTop = 0;
    try { history.replaceState(null, '', '#' + id); } catch(e){}
    if (window.innerWidth <= 860) closeNav();
  }
  function openNav(){ side.classList.add('open'); scrim.classList.add('on'); }
  function closeNav(){ side.classList.remove('open'); scrim.classList.remove('on'); }
  menuBtn.addEventListener('click', openNav);
  scrim.addEventListener('click', closeNav);

  side.addEventListener('click', function(e){
    var a = e.target.closest('a[data-id]'); if (!a) return;
    e.preventDefault(); show(a.dataset.id);
  });

  function search(){
    var v = q.value.trim().toLowerCase();
    if (!v){
      cnt.textContent = '';
      [].forEach.call(side.querySelectorAll('a'), function(a){ a.classList.remove('hid'); });
      [].forEach.call(side.querySelectorAll('.grp'), function(g){ g.classList.remove('hid'); });
      hits.hidden = true; empty.hidden = true;
      if (!document.querySelector('.doc.on')) show(D.docs[0].id);
      return;
    }
    var found = D.docs.filter(function(d){
      return d.path.toLowerCase().indexOf(v) >= 0 || d.text.indexOf(v) >= 0;
    });
    var ids = {}; found.forEach(function(d){ ids[d.id] = 1; });
    [].forEach.call(side.querySelectorAll('a'), function(a){ a.classList.toggle('hid', !ids[a.dataset.id]); });
    [].forEach.call(side.querySelectorAll('.grp'), function(g){
      g.classList.toggle('hid', !g.querySelector('a:not(.hid)'));
    });
    cnt.textContent = found.length + '개';
    D.docs.forEach(function(d){ var el = document.getElementById(d.id); if (el) el.classList.remove('on'); });
    hits.innerHTML = '';
    found.forEach(function(d){
      var i = d.text.indexOf(v);
      var snip = i >= 0 ? d.text.slice(Math.max(0, i - 60), i + 120).replace(/\\s+/g, ' ') : '파일명 일치';
      var a = document.createElement('a');
      a.className = 'hit'; a.href = '#' + d.id;
      a.innerHTML = '<b></b><span></span>';
      a.querySelector('b').textContent = d.path;
      a.querySelector('span').textContent = '…' + snip + '…';
      a.addEventListener('click', function(e){ e.preventDefault(); q.value = ''; search(); show(d.id); });
      hits.appendChild(a);
    });
    hits.hidden = found.length === 0;
    empty.hidden = found.length !== 0;
    main.scrollTop = 0;
  }
  q.addEventListener('input', search);
  document.addEventListener('keydown', function(e){
    if (e.key === '/' && document.activeElement !== q){ e.preventDefault(); q.focus(); }
    if (e.key === 'Escape'){ if (q.value){ q.value = ''; search(); } closeNav(); }
  });

  var start = (location.hash || '').slice(1);
  show(byId[start] ? start : D.docs[0].id);
})();
</script>'''

out = HTML.replace("__DATA__", data).replace("__VER__", ver).replace("__N__", str(ndocs))
out_path = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/harness-docs.html")
open(out_path, "w", encoding="utf-8").write(out)
print(f"생성 완료: {out_path} ({len(out)//1024}KB, 문서 {ndocs}개, 버전 {ver})")
