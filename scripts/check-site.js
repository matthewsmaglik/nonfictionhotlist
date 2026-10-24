// Smoke test for the site. Visits every page and project, and reports
// console errors, failed requests, images that don't load, sideways scrolling on phones,
// and whether the PDF is reachable.
// Run against a local copy:  npm run check
// Run against the live site: npm run check -- https://nfh2025.rdgnbl.com
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const SITE_DIR = path.resolve(__dirname, "..", "site");
const TYPES = { ".html": "text/html", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".js": "text/javascript", ".css": "text/css" };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      const f = path.join(SITE_DIR, p);
      if (!f.startsWith(SITE_DIR) || !fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    }).listen(0, () => resolve(srv));
  });
}

(async () => {
  let base = process.argv[2], srv;
  if (!base) { srv = await serve(); base = `http://localhost:${srv.address().port}`; }
  base = base.replace(/\/$/, "");
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const problems = [];
  const note = (where, msg) => problems.push(`${where}: ${msg}`);

  for (const [label, viewport] of [["desktop", { width: 1360, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, acceptDownloads: true });
    // Visit counting is stubbed: nothing reaches GoatCounter, and the calls are recorded so they can be checked.
    await page.route("**/gc.zgo.at/**", r => r.fulfill({ contentType: "text/javascript",
      body: "window.goatcounter = { count: function (o) { (window.__gc = window.__gc || []).push(o); } };" }));
    // Failed loads are reported with their URL by the request handlers below, so skip the generic console line.
    page.on("console", m => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) note(label, "console error: " + m.text()); });
    page.on("pageerror", e => note(label, "script error: " + e.message));
    page.on("requestfailed", r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) note(label, "request failed: " + r.url()); });
    page.on("response", r => { if (r.status() >= 400) note(label, `HTTP ${r.status()}: ${r.url()}`); });

    await page.goto(base + "/", { waitUntil: "networkidle" });
    const slugs = await page.evaluate(() => PROJECTS.map(p => p.slug));
    const pages = await page.evaluate(() => SEQ);
    const routes = [...pages, ...slugs.flatMap(s => [s, s + ".help", s + ".links"])];

    for (const r of routes) {
      await page.evaluate(h => { location.hash = h; }, r);
      await page.waitForTimeout(120);
      await page.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(res => { i.onload = i.onerror = res; }))));
      const res = await page.evaluate(() => ({
        broken: [...document.images].filter(i => i.getAttribute("src") && i.complete && i.naturalWidth === 0).map(i => i.getAttribute("src")),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        empty: !document.querySelector("#app").textContent.trim(),
      }));
      res.broken.forEach(b => note(`${label} #${r}`, "image did not load: " + b));
      if (res.overflow) note(`${label} #${r}`, "page scrolls sideways");
      if (res.empty) note(`${label} #${r}`, "page rendered empty");
    }
    const pdfVisible = await page.evaluate(() => { location.hash = "cover"; return new Promise(r => setTimeout(() => r(!document.getElementById("pdfBtn").hidden), 150)); });
    if (!pdfVisible) note(label, "Download PDF button is hidden");
    else { await page.click("#pdfBtn"); await page.waitForTimeout(200); }
    const counted = await page.evaluate(() => (window.__gc || []).map(o => o.path + (o.event ? " (event)" : "")));
    for (const want of ["/", "/welcome", "/" + slugs[0], "pdf-download (event)"])
      if (!counted.includes(want)) note(label, `visit counting: "${want}" was not counted`);
    if (counted.filter(c => c === "/" + slugs[0]).length > 1) note(label, "visit counting: a project counted more than once for one visit (tabs should not count)");
    console.log(`${label}: checked ${routes.length} views`);
    await page.close();
  }

  // Team dashboard (unlisted). Built by npm run dashboard; skipped if it hasn't been built.
  for (const [label, viewport] of [["dashboard desktop", { width: 1360, height: 900 }], ["dashboard phone", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", e => note(label, "script error: " + e.message));
    const res = await page.goto(base + "/dashboard/", { waitUntil: "domcontentloaded" });
    if (!res || res.status() === 404) { await page.close(); if (label.endsWith("desktop")) console.log("dashboard: not built, skipped"); break; }
    await page.waitForTimeout(300);
    const d = await page.evaluate(() => ({
      rows: document.querySelectorAll("#projects .row:not(.head)").length,
      sheets: [...document.querySelectorAll("#projects a.act.primary")].filter(a => a.href.includes("docs.google.com/spreadsheets")).length,
      noindex: !!document.querySelector('meta[name=robots][content*=noindex]'),
      overflow: document.documentElement.scrollWidth > innerWidth + 1
    }));
    if (!d.rows) note(label, "no project rows");
    if (d.sheets !== d.rows) note(label, `${d.rows - d.sheets} projects missing a Copysheet link`);
    if (!d.noindex) note(label, "missing noindex");
    if (d.overflow) note(label, "page scrolls sideways");
    console.log(`${label}: ${d.rows} projects`);
    await page.close();
  }

  const pdf = await (await browser.newContext()).request.get(base + "/hotlist-2025.pdf");
  const type = pdf.headers()["content-type"] || "";
  if (!pdf.ok() || !type.includes("pdf")) note("pdf", `GET hotlist-2025.pdf returned ${pdf.status()} ${type}`);
  else console.log(`pdf: ${(Number(pdf.headers()["content-length"] || (await pdf.body()).length) / 1e6).toFixed(1)} MB`);

  await browser.close();
  if (srv) srv.close();
  if (problems.length) { console.log(`\n${problems.length} problem(s):`); [...new Set(problems)].forEach(p => console.log(" - " + p)); process.exit(1); }
  console.log("\nall clear");
})();
