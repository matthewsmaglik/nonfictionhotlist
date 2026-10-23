// Builds hotlist-2025.pdf from the same SITE/PROJECTS data the microsite uses.
// Run: npm run pdf   (writes site/hotlist-<year>.pdf)
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const REPO = path.resolve(__dirname, "..");
const ROOT = path.join(REPO, "site");
const site = fs.readFileSync(path.join(REPO, "src", "page.html"), "utf8");
const script = site.match(/<script>([\s\S]*?)<\/script>/)[1];
const dataSrc = script.slice(script.indexOf("const SITE ="), script.indexOf("/* ============================================================\n   Rendering."));
const { SITE, PROJECTS } = new Function(dataSrc + "; return { SITE, PROJECTS };")();
// The laurel branch drawing is shared with the site.
const branchSrc = script.slice(script.indexOf("const BRANCH = ("), script.indexOf("})();", script.indexOf("const BRANCH = (")) + 5);
const BRANCH = new Function(branchSrc + "; return BRANCH;")();
const branch = (cls = "") => `<svg class="${cls}" viewBox="0 0 22 60">${BRANCH}</svg>`;
const laurels = list => (list || []).length ? `<ul class="laurels">${list.map(l => `<li>${branch()}<div>${l.note ? `<small>${esc(l.note)}</small>` : ""}<b>${esc(l.event)}</b>${l.year ? `<span>${l.year}</span>` : ""}</div>${branch("r")}</li>`).join("")}</ul>` : "";

const F = path.join(REPO, "node_modules", "@fontsource");
const font = (fam, file, w, style = "normal", range = "") =>
  `@font-face{font-family:"${fam}";src:url("file://${F}/${file}") format("woff2");font-weight:${w};font-style:${style};${range}}`;
const LS = "league-spartan/files/league-spartan-latin";
const LT = "literata/files/literata";
const fonts = [
  font("Spartan", `${LS}-400-normal.woff2`, 400), font("Spartan", `${LS}-600-normal.woff2`, 600),
  font("Spartan", `${LS}-700-normal.woff2`, 700), font("Spartan", `${LS}-800-normal.woff2`, 800),
  font("Lit", `${LT}-latin-400-normal.woff2`, 400), font("Lit", `${LT}-latin-400-italic.woff2`, 400, "italic"),
  font("Lit", `${LT}-latin-ext-400-normal.woff2`, 400, "normal", "unicode-range:U+0100-024F;"),
  font("Lit", `${LT}-latin-ext-400-italic.woff2`, 400, "italic", "unicode-range:U+0100-024F;"),
].join("\n");

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = n => String(n).padStart(2, "0");
const img = p => `file://${path.join(ROOT, p)}`;
const PER = SITE.PER_PAGE;
const PAGES = Math.ceil(PROJECTS.length / PER);
const Y = SITE.year;

function folio(label, n) {
  return `<div class="folio"><span>nonfiction hotlist. ${Y}</span><span>${label ? esc(label) + " · " : ""}${n}</span></div>`;
}
let pageNo = 0;
const next = () => ++pageNo;

const sheets = [];

// Cover
next();
sheets.push(`<section class="sheet cover front">
  <div class="cover-head"><div class="bigyr">${Y}</div><div class="wm">nonfiction<br>hotlist.</div></div>
  <p class="cover-lede">${esc(SITE.intro)}</p>
</section>`);

// Welcome, two sheets
const W = SITE.welcome;
const N = String(PROJECTS.length);
// **double asterisks** mark the highlight, as on the site; a leading number inside one is set bold.
const hi = t => esc(t).replace(/\*\*(.+?)\*\*/g, (_, inner) => `<span class="hi">${inner.replace(/^(\d[\d,]*)(\s)/, "<b>$1</b>$2")}</span>`);
const mosaicImgs = PROJECTS.filter(p => p.key).slice(0, 15);
sheets.push(`<section class="sheet dark wel1" id="welcome">
  <div class="mosaic">${mosaicImgs.map(p => `<a href="#${p.slug}"><img src="${img(p.key)}"></a>`).join("")}</div>
  <div class="wel-body">
    <h2>${esc(W.heading)}</h2>
    <div class="lede">${W.lede.map(t => `<p>${hi(t)}</p>`).join("")}</div>
    <div class="wrow"><div class="lbl">our invitation</div><div>${W.invitation.map(t => `<p>${hi(t)}</p>`).join("")}</div></div>
  </div>
  ${folio("", next())}
</section>`);
sheets.push(`<section class="sheet light wel2" id="why">
  <div class="why">
    <h2>${esc(W.whyHeading)}</h2>
    <div>${W.why.map(t => `<p>${hi(t)}</p>`).join("")}</div>
  </div>
  <div class="select">
    <div class="big">${N}<small>projects selected from<br>hundreds of submissions</small></div>
    <div>
      <div class="lbl">selected on their merits</div>
      <ul class="criteria">${W.criteria.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
      <p>${esc(W.selection)}</p>
    </div>
  </div>
  <div class="lbl dk">how to use this list</div>
  <ol class="steps">${W.how.map(([h, t], i) => `<li><span class="k">${i + 1}</span><b>${esc(h)}</b><span>${esc(t)}</span></li>`).join("")}</ol>
  <p class="close">${hi(W.close)}</p>
  <div class="folio"><span>nonfiction hotlist. ${Y}</span><span>${next()}</span></div>
</section>`);

// Index
sheets.push(`<section class="sheet dark index">
  <h2>index</h2>
  <ol class="toc">${PROJECTS.map((p, i) => `<li><a href="#${p.slug}"><span class="n">${pad(i + 1)}</span><span class="t">${esc(p.title)}</span><span class="f">${esc(p.format)}</span></a></li>`).join("")}</ol>
  ${folio("", next())}
</section>`);

// Grid pages
for (let n = 1; n <= PAGES; n++) {
  const start = (n - 1) * PER;
  const items = PROJECTS.slice(start, start + PER);
  sheets.push(`<section class="sheet dark grid-page">
    <div class="gp-head"><h2>projects</h2><span>${pad(start + 1)}–${pad(start + items.length)} of ${PROJECTS.length}</span></div>
    <div class="grid">${items.map((p, i) => `<a class="card" href="#${p.slug}">
      ${p.key ? `<div class="kimg"><img src="${img(p.key)}"></div>` : `<div class="kimg ph t${(start + i) % 3}"><span>${esc(p.title)}</span></div>`}
      <span class="meta">${esc(p.format)}</span>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.logline)}</p>
      ${(p.laurels || []).length ? `<span class="accolade">${branch()}<span><b>${esc(p.laurels[0].note || "Official Selection")}</b>, ${esc(p.laurels[0].event)}${p.laurels[0].year ? " " + p.laurels[0].year : ""}${p.laurels.length > 1 ? ` +${p.laurels.length - 1} more` : ""}</span></span>` : ""}
    </a>`).join("")}</div>
    ${folio("Projects", next())}
  </section>`);
}

// Project pages
PROJECTS.forEach((p, i) => {
  const stills = (p.stills || []).slice(1, 3);
  const hero = p.hero
    ? `<div class="hero"><img src="${img(p.hero)}" style="object-position:${p.focus ?? 50}% ${p.focusY ?? 50}%"></div>`
    : `<div class="hero ph t${i % 3}"><span>${esc(p.title)}</span></div>`;
  const links = p.links.length
    ? `<ul class="links">${p.links.map(([l, u]) => `<li><a href="${esc(u)}">${esc(l)}</a></li>`).join("")}</ul>` : "";
  sheets.push(`<section class="sheet light project" id="${p.slug}">
    ${hero}
    <div class="pbody">
      <div class="ptitle"><span class="pn">${pad(i + 1)} / ${PROJECTS.length}</span><h1>${esc(p.title)}</h1><p class="logline">${esc(p.logline)}</p>${laurels(p.laurels)}</div>
      <div class="cols fit">
        <div class="main">
          <h4>Summary</h4>
          <div class="prose">${p.summary.split(/\n\n+/).map(t => `<p>${esc(t)}</p>`).join("")}</div>
          ${(p.updates || []).length ? `<h4>News</h4><ul class="news">${p.updates.slice(0, 3).map(u => `<li><time>${esc(u.date)}</time><span>${esc(u.text)}${u.url ? ` <a href="${esc(u.url)}">${esc(u.source || "Source")}</a>` : ""}</span></li>`).join("")}</ul>` : ""}
          <h4>Creative team</h4>
          <ul class="team">${p.team.map(([n, r]) => `<li><b>${esc(n)}</b> ${esc(r)}</li>`).join("")}</ul>
          ${stills.length ? `<div class="stills">${stills.map(([s]) => `<div><img src="${img(s)}"></div>`).join("")}</div>` : ""}
        </div>
        <div class="side">
          <dl class="facts">
            <div><dt>Format</dt><dd>${esc(p.format)}</dd></div>
            <div><dt>Status</dt><dd>${esc(p.status)}</dd></div>
            <div><dt>Contact</dt><dd>${esc(p.contact)}</dd></div>
          </dl>
          <h4>How to help</h4>
          <ul class="needs">${p.help.map(h => `<li>${esc(h)}</li>`).join("")}</ul>
          ${links || p.onRequest ? `<h4>Links</h4>${links}${p.onRequest ? `<p class="req">${esc(p.onRequest)}</p>` : ""}` : ""}
        </div>
      </div>
    </div>
    <div class="folio"><span><a href="#p${Math.floor(i / PER) + 1}">nonfiction hotlist. ${Y}</a></span><span>${next()}</span></div>
  </section>`);
});

// Back cover
next();
sheets.push(`<section class="sheet cover back">
  <div class="cover-mark"><div class="wm">nonfiction<br>hotlist.</div></div>
  <p class="cover-lede">This document is meant to be used. These projects are meant to be made.<br><br>info@nonfictionhotlist.com</p>
</section>`);

// Give grid pages anchors for "back to grid" links
let gi = 0;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${fonts}
@page { size: 8.5in 11in; margin: 0; }
:root { --forest:#2e4a3b; --deep:#22382c; --sage:#9aab8c; --sage-soft:#c6d0bb; --cream:#ebe6d7; --paper:#f3f0e6; --ink:#1d2b23; --muted:#5b6b60; --fs:9.4pt; }
* { box-sizing:border-box; margin:0; padding:0; }
html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family:"Lit",Georgia,serif; color:var(--ink); }
a { color:inherit; text-decoration:none; }
.sheet { width:8.5in; height:11in; position:relative; overflow:hidden; page-break-after:always; break-after:page; }
.sheet:last-child { page-break-after:auto; }
.dark { background:var(--forest); color:var(--cream); padding:0.75in 0.7in 0.9in; }
.light { background:var(--paper); color:var(--ink); }
.folio { position:absolute; left:0.7in; right:0.7in; bottom:0.42in; display:flex; justify-content:space-between; font:600 7.5pt "Spartan",sans-serif; letter-spacing:.1em; text-transform:uppercase; opacity:.6; }
h2 { font:700 44pt/0.95 "Spartan",sans-serif; letter-spacing:-.02em; margin-bottom:0.3in; }

.cover { background:var(--forest); color:var(--cream); display:flex; flex-direction:column; justify-content:center; padding:0 0.9in; }
.cover .wm { font:700 64pt/0.9 "Spartan",sans-serif; letter-spacing:-.03em; }
.cover .yr { font:400 20pt "Lit",serif; opacity:.7; margin-top:0.18in; }
.cover-lede { font:400 12pt/1.55 "Lit",serif; max-width:4.6in; margin-top:0.5in; opacity:.9; }
.back { background:var(--deep); }
.front { justify-content:flex-end; padding:0 0.7in 0.9in; }
.cover-head { display:flex; align-items:last baseline; gap:16pt; }
.front .wm { font-size:53.9pt; line-height:0.9; letter-spacing:-.025em; white-space:nowrap; }
.bigyr { font:800 130pt/0.8 "Spartan",sans-serif; letter-spacing:-.055em; color:var(--sage); margin-left:-0.05in; }
.front .cover-lede { font-size:14pt; line-height:1.4; max-width:5.4in; border-top:1px solid rgba(235,230,215,.2); padding-top:0.22in; margin-top:0.42in; }
.back .wm { font-size:40pt; }

.wel1 { padding:0; }
.mosaic { display:grid; grid-template-columns:repeat(5,1fr); gap:3px; background:var(--deep); }
.mosaic a { aspect-ratio:3/2; overflow:hidden; display:block; }
.mosaic img { width:100%; height:100%; object-fit:cover; display:block; filter:saturate(.85); }
.wel-body { padding:0.55in 0.7in 0; }
.wel1 h2 { font-size:46pt; margin-bottom:0.28in; max-width:6.6in; }
.lede p { font:400 16.5pt/1.38 "Lit",serif; margin-bottom:0.12in; max-width:6.6in; }
.lede p:last-child { color:var(--sage-soft); }
.lede b { font:700 1.05em "Spartan",sans-serif; color:var(--cream); }
.hi { color:var(--cream); background:linear-gradient(transparent 52%, rgba(154,171,140,.62) 52%, rgba(154,171,140,.62) 94%, transparent 94%); padding:0 .06em; -webkit-box-decoration-break:clone; box-decoration-break:clone; }
.wrow { display:grid; grid-template-columns:1.5in 1fr; gap:0.3in; background:var(--deep); border-radius:5px; padding:0.26in 0.3in; margin-top:0.34in; font-size:10.5pt; line-height:1.55; }
.wrow p { margin-bottom:0.6em; }
.wrow p:last-child { margin:0; }
.lbl { font:700 7.5pt "Spartan",sans-serif; text-transform:uppercase; letter-spacing:.14em; color:var(--sage-soft); padding-top:.25em; }
.lbl.dk { color:var(--forest); margin-top:0.3in; }
.wel2 { padding:0.7in 0.7in 0.9in; }
.why { display:grid; grid-template-columns:2.2in 1fr; gap:0.3in; margin-bottom:0.3in; }
.why h2 { font-size:34pt; color:var(--forest); margin:0; }
.why p { font-size:10pt; line-height:1.55; margin-bottom:0.7em; }
.why p:first-child { font-size:12pt; line-height:1.45; }
.select { display:grid; grid-template-columns:2.2in 1fr; gap:0.3in; background:var(--forest); color:var(--cream); border-radius:5px; padding:0.32in; }
.select .big { font:800 92pt/0.8 "Spartan",sans-serif; letter-spacing:-.04em; }
.select .big small { display:block; font:600 7.5pt/1.5 "Spartan",sans-serif; letter-spacing:.14em; text-transform:uppercase; color:var(--sage-soft); margin-top:0.16in; }
.criteria { list-style:none; display:grid; grid-template-columns:1fr 1fr; gap:0.07in; margin:0.1in 0 0.14in; }
.criteria li { font:600 11pt "Spartan",sans-serif; border:1px solid rgba(235,230,215,.25); border-radius:2px; padding:0.09in 0.11in; }
.select p { font-size:9.5pt; line-height:1.5; opacity:.8; }
.steps { list-style:none; display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid rgba(46,74,59,.25); margin-top:0.08in; }
.steps li { padding:0.14in 0.14in 0 0; display:flex; flex-direction:column; gap:0.04in; }
.steps li + li { padding-left:0.14in; border-left:1px solid rgba(46,74,59,.25); }
.steps .k { font:700 24pt/1 "Spartan",sans-serif; color:var(--sage); }
.steps b { font:700 11pt "Spartan",sans-serif; color:var(--forest); }
.steps span:last-child { font-size:9pt; line-height:1.45; color:var(--muted); }
.close { font:700 18pt/1.18 "Spartan",sans-serif; letter-spacing:-.01em; color:var(--forest); border-top:1px solid rgba(46,74,59,.25); margin-top:0.34in; padding-top:0.2in; max-width:6.4in; }
.close .hi { color:var(--forest); background:linear-gradient(transparent 52%, rgba(154,171,140,.55) 52%, rgba(154,171,140,.55) 94%, transparent 94%); }
.wel2 .folio { color:var(--ink); }
.toc { list-style:none; columns:1; }
.toc a { display:grid; grid-template-columns:0.4in 1fr auto; gap:0.1in; padding:0.075in 0; border-bottom:1px solid rgba(235,230,215,.18); align-items:baseline; }
.toc .n { font:400 9pt "Spartan",sans-serif; opacity:.6; }
.toc .t { font:700 13pt "Spartan",sans-serif; }
.toc .f { font:600 7pt "Spartan",sans-serif; text-transform:uppercase; letter-spacing:.1em; color:var(--sage-soft); }

.gp-head { display:flex; justify-content:space-between; align-items:baseline; }
.gp-head span { font:600 9pt "Spartan",sans-serif; letter-spacing:.08em; opacity:.7; }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:0.38in 0.3in; }
.card { display:block; }
.kimg { aspect-ratio:3/2; overflow:hidden; border-radius:2px; margin-bottom:0.12in; }
.kimg img, .hero img, .stills img { width:100%; height:100%; object-fit:cover; display:block; }
.ph { display:flex; align-items:flex-end; padding:0.16in; font:800 18pt/0.95 "Spartan",sans-serif; text-transform:lowercase; letter-spacing:-.02em; }
.ph.t0 { background:var(--deep); color:var(--cream); border:1px solid rgba(235,230,215,.2); }
.ph.t1 { background:var(--sage); color:var(--ink); }
.ph.t2 { background:var(--cream); color:var(--forest); }
.card .meta { font:600 7pt "Spartan",sans-serif; text-transform:uppercase; letter-spacing:.12em; color:var(--sage-soft); }
.card h3 { font:700 15pt/1.05 "Spartan",sans-serif; margin:0.05in 0 0.06in; }
.card p { font-size:9pt; line-height:1.45; opacity:.8; }

.project .hero { height:3.35in; }
.project .hero.ph { font-size:44pt; padding:0.5in 0.7in; }
.pbody { padding:0.3in 0.7in 0; }
.pn { font:600 7.5pt "Spartan",sans-serif; letter-spacing:.12em; color:var(--muted); }
.project h1 { font:700 30pt/0.95 "Spartan",sans-serif; letter-spacing:-.02em; text-transform:lowercase; margin:0.04in 0 0.08in; color:var(--forest); }
.logline { font:italic 400 12pt/1.35 "Lit",serif; margin-bottom:0.18in; max-width:6.5in; }
.cols { display:grid; grid-template-columns:1fr 2.35in; gap:0.32in; font-size:var(--fs); line-height:1.5; }
.project h4 { font:700 7pt "Spartan",sans-serif; text-transform:uppercase; letter-spacing:.14em; color:var(--forest); margin:0 0 0.06in; padding-top:0.06in; border-top:1px solid rgba(46,74,59,.25); }
.project .prose p { margin-bottom:0.55em; }
.main h4:not(:first-child), .side h4 { margin-top:0.14in; }
.team { list-style:none; }
.team li { margin-bottom:0.02in; }
.team b { font:600 1.02em "Spartan",sans-serif; }
.stills { display:grid; grid-template-columns:1fr 1fr; gap:0.12in; margin-top:0.16in; }
.stills div { aspect-ratio:3/2; overflow:hidden; border-radius:2px; }
.facts div { display:grid; grid-template-columns:0.6in 1fr; gap:0.08in; padding:0.05in 0; border-top:1px solid rgba(46,74,59,.25); }
.facts div:first-child { border-top:0; padding-top:0; }
.facts dt { font:700 6.8pt "Spartan",sans-serif; text-transform:uppercase; letter-spacing:.12em; color:var(--forest); padding-top:.2em; }
.facts dd { overflow-wrap:anywhere; }
.needs { list-style:none; }
.needs li { padding-left:0.14in; position:relative; margin-bottom:0.03in; }
.needs li::before { content:"+"; position:absolute; left:0; font:700 1em "Spartan",sans-serif; color:var(--forest); }
.links { list-style:none; display:flex; flex-wrap:wrap; gap:0.05in; }
.links a { display:inline-block; font:600 7.5pt "Spartan",sans-serif; border:1px solid var(--forest); color:var(--forest); border-radius:99px; padding:0.025in 0.09in; }
.req { margin-top:0.06in; color:var(--muted); font-size:.92em; }
.project .folio { color:var(--ink); }
.laurels { list-style:none; display:flex; flex-wrap:wrap; gap:0.06in 0.18in; margin:-0.06in 0 0.16in; color:var(--forest); }
.laurels li { display:grid; grid-template-columns:0.13in auto 0.13in; align-items:center; gap:0.03in; }
.laurels svg { width:0.13in; height:0.36in; display:block; color:var(--sage); }
.laurels svg.r { transform:scaleX(-1); }
.laurels div { display:grid; justify-items:center; text-align:center; line-height:1.1; max-width:1.7in; }
.laurels small { font:600 5.4pt "Spartan",sans-serif; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.laurels b { font:700 7.6pt "Spartan",sans-serif; color:var(--forest); margin-top:1px; }
.laurels span { font:400 6.4pt "Spartan",sans-serif; color:var(--muted); }
.news { list-style:none; margin-bottom:0.02in; }
.news li { display:grid; grid-template-columns:0.62in 1fr; gap:0.08in; margin-bottom:0.05in; }
.news time { font:700 6.8pt "Spartan",sans-serif; text-transform:uppercase; letter-spacing:.08em; color:var(--forest); padding-top:.2em; }
.news a { font:600 0.86em "Spartan",sans-serif; color:var(--forest); text-decoration:underline; }
.card .accolade { display:flex; gap:0.05in; align-items:center; margin-top:0.07in; font:400 7.6pt "Spartan",sans-serif; color:var(--sage-soft); }
.card .accolade svg { width:0.07in; height:0.19in; flex:none; }
.card .accolade b { color:var(--cream); font-weight:700; }
</style></head><body>
${sheets.join("\n").replace(/<section class="sheet dark grid-page">/g, () => `<section class="sheet dark grid-page" id="p${++gi}">`)}
</body></html>`;

(async () => {
  const out = path.join(REPO, ".print.html");
  fs.writeFileSync(out, html);
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await b.newPage();
  await page.goto("file://" + out, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // Fit each project page: drop stills, then step the type size down until nothing overflows the folio line.
  const report = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll(".sheet").forEach(s => {
      const fit = s.querySelector(".fit"); if (!fit) return;
      const limit = () => s.getBoundingClientRect().bottom - 0.62 * 96;
      const over = () => [...fit.querySelectorAll(".main, .side, .prose")].some(el => el.getBoundingClientRect().bottom > limit());
      let fs = 9.4, dropped = false;
      while (over()) {
        const st = fit.querySelector(".stills");
        if (st && !dropped) { st.remove(); dropped = true; continue; }
        if (fs <= 7.6) break;
        fs -= 0.2; s.style.setProperty("--fs", fs + "pt");
        if (fit.classList.contains("prose")) fit.style.fontSize = (fs + 0.6) + "pt";
      }
      out.push({ id: s.id, fs: +fs.toFixed(1), dropped, overflow: over() });
    });
    return out.filter(r => r.dropped || r.fs < 9.4 || r.overflow);
  });
  console.log(JSON.stringify(report));
  await page.pdf({ path: path.join(ROOT, `hotlist-${Y}.pdf`), width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log("pages:", pageNo, "size:", (fs.statSync(path.join(ROOT, `hotlist-${Y}.pdf`)).size / 1e6).toFixed(2), "MB");
})();
