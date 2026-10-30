// Builds the team dashboard at site/<year>/dashboard/index.html (unlisted: nothing links to it, search engines told to skip).
// Everything is baked into the page at build time:
//   - links to every Copysheet, Media folder and front-page doc (content/drive.json)
//   - how complete each project is (content/content.json + content/layout.json)
//   - sync health (content/sync-problems.txt) and recent changes (git history of content/content.json)
//   - the daily link check (content/link-check.json)
//   - visits, PDF downloads and referrers from GoatCounter, when GOATCOUNTER_TOKEN is set
// Run: npm run dashboard   (the Publish workflow runs it on every pass, so numbers stay within about 15 minutes)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { PROJECT, DOCS } = require("../content/spec");

const Y = require("../year");
const REPO = Y.REPO;
const read = f => JSON.parse(fs.readFileSync(Y.file(f), "utf8"));
const content = read("content.json");
const layout = read("layout.json");
const drive = fs.existsSync(Y.file("drive.json")) ? read("drive.json") : { front: {}, order: {}, projects: {} };
const SITE_URL = Y.SITE_URL;
const REPO_URL = Y.REPO_URL;
const GC = Y.config.goatcounter;
const COUNTING_SINCE = Y.info.countingSince;
const CONTENT_PATH = path.relative(REPO, Y.file("content.json"));

const sheetUrl = id => `https://docs.google.com/spreadsheets/d/${id}/edit`;
const docUrl = id => `https://docs.google.com/document/d/${id}/edit`;
const folderUrl = id => `https://drive.google.com/drive/folders/${id}`;

/* ---------- completeness ---------- */
const CHECKS = [
  ["Title", (p) => p.title], ["Format", (p) => p.format], ["Status", (p) => p.status],
  ["Logline", (p) => p.logline], ["Summary", (p) => p.summary], ["Contact email", (p) => p.contact],
  ["Team", (p) => p.team.length], ["How to help", (p) => p.help.length],   // Links are optional: some projects have no public site yet
  ["Key art", (p, l) => l.key], ["Banner", (p, l) => l.hero], ["Two or more stills", (p, l) => (l.stills || []).length >= 2]
];

/* ---------- recent changes, from the history of content.json ---------- */
const FIELD_LABEL = Object.fromEntries([
  ...PROJECT.page.map(f => [f.key, f.label]),
  ...PROJECT.lists.map(l => [l.key, l.tab])
]);
function changes(limit = 30) {
  let lines = [];
  try {
    lines = execSync(`git log -n ${limit + 1} --format=%H%x09%cI%x09%s -- ${CONTENT_PATH} content/content.json`, { cwd: REPO })
      .toString().trim().split("\n").filter(Boolean);
  } catch { return []; }
  // Before the move to years/, 2025's text lived at content/content.json.
  const show = (rev) => { for (const f of [CONTENT_PATH, "content/content.json"]) { try { return JSON.parse(execSync(`git show ${rev}:${f}`, { cwd: REPO, stdio: ["ignore", "pipe", "ignore"] }).toString()); } catch {} } return null; };
  const out = [];
  for (const line of lines) {
    const [hash, date, subject] = line.split("\t");
    const cur = show(hash), prev = show(hash + "^");
    if (!cur || !prev || !prev.projects) continue;
    const items = [];
    for (const slug of new Set([...Object.keys(prev.projects), ...Object.keys(cur.projects)])) {
      const a = prev.projects[slug], b = cur.projects[slug];
      if (!a) { items.push({ what: b.title, detail: "Added" }); continue; }
      if (!b) { items.push({ what: a.title, detail: "Removed" }); continue; }
      const fields = Object.keys(FIELD_LABEL).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(k => FIELD_LABEL[k]);
      if (fields.length) items.push({ what: b.title, slug, detail: fields.join(", ") });
    }
    for (const [k, spec] of Object.entries(DOCS)) {
      if (JSON.stringify(prev[k]) === JSON.stringify(cur[k])) continue;
      const secs = spec.sections.filter(sec => JSON.stringify((prev[k] || {})[sec.key]) !== JSON.stringify((cur[k] || {})[sec.key])).map(sec => sec.heading);
      items.push({ what: `${spec.title} page`, detail: secs.join(", ") || "Text" });
    }
    if (JSON.stringify(prev.order) !== JSON.stringify(cur.order)) items.push({ what: "Running order", detail: "Order" });
    if (items.length) out.push({ date, fromDrive: subject.startsWith("Update from Google Drive"), items });
    if (out.length >= limit) break;
  }
  return out;
}

/* ---------- GoatCounter ---------- */
async function stats() {
  if (process.env.DASHBOARD_SAMPLE) return sampleStats();   // local design previews only
  const token = process.env.GOATCOUNTER_TOKEN;
  if (!token) return null;
  const get = async (p) => {
    const res = await fetch(`${GC}/api/v0${p}${p.includes("?") ? "&" : "?"}start=${encodeURIComponent(COUNTING_SINCE)}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    if (!res.ok) {
      const body = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
      if (process.env.GITHUB_ACTIONS) console.log(`::warning title=GoatCounter ${p.split("?")[0]}::HTTP ${res.status} ${body}`);
      throw new Error(`GoatCounter ${p.split("?")[0]}: HTTP ${res.status}`);
    }
    return res.json();
  };
  try {
    const [total, hits, refs] = await Promise.all([get("/stats/total"), get("/stats/hits?limit=100"), get("/stats/toprefs?limit=12")]);
    // GoatCounter counts the whole domain; keep only this year's paths, keyed without the year prefix.
    const P = Y.info.trackPrefix;
    const others = Object.values(Y.config.years).map(y => y.trackPrefix).filter(t => t && t !== P);
    const mine = h => h.event ? h.path === Y.pdfEvent
      : P ? h.path === P || h.path.startsWith(P + "/") : !others.some(t => h.path === t || h.path.startsWith(t + "/"));
    const yearHits = (hits.hits || []).filter(mine).map(h => ({ ...h, path: !h.event && P ? h.path.slice(P.length) || "/" : h.path }));
    const byPath = {};
    for (const h of yearHits) byPath[h.path] = (byPath[h.path] || 0) + (h.count || 0);
    const multiYear = Object.keys(Y.config.years).filter(y => Y.config.years[y].status === "live").length > 1;
    return {
      total: multiYear ? yearHits.filter(h => !h.event).reduce((n, h) => n + (h.count || 0), 0) : (total.total || 0),
      pdf: byPath[Y.pdfEvent] || 0,
      byPath,
      refs: (refs.stats || []).map(r => ({ name: r.name || "(direct or unknown)", count: r.count || 0 })),
      pages: yearHits.filter(h => !h.event).sort((a, b) => b.count - a.count).slice(0, 8).map(h => ({ path: h.path, title: h.title, count: h.count }))
    };
  } catch (e) {
    console.warn("stats unavailable:", e.message);
    return { error: e.message };
  }
}

function sampleStats() {
  const byPath = { "pdf-download": 41, "/": 512, "/welcome": 233 };
  content.order.forEach((s, i) => { byPath["/" + s] = 140 - i * 5 + (i % 3) * 11; });
  return { total: 3480, pdf: 41, byPath,
    refs: [{ name: "(direct or unknown)", count: 820 }, { name: "Gmail", count: 310 }, { name: "linkedin.com", count: 142 }, { name: "nonfictionhotlist.com", count: 96 }, { name: "Slack", count: 40 }],
    pages: [{ path: "/", title: "Cover", count: 512 }, { path: "/welcome", title: "Welcome", count: 233 }, { path: "/manhood", title: "Manhood", count: 140 }] };
}

/* ---------- assemble ---------- */
(async () => {
  const problemsFile = Y.file("sync-problems.txt");
  const problems = fs.existsSync(problemsFile) ? fs.readFileSync(problemsFile, "utf8").split("\n").filter(Boolean) : [];
  const linkFile = Y.file("link-check.json");
  const links = fs.existsSync(linkFile) ? JSON.parse(fs.readFileSync(linkFile, "utf8")) : null;
  const st = await stats();
  const log = changes();

  const projects = content.order.map((slug, i) => {
    const p = content.projects[slug], l = layout.projects[slug] || {}, d = drive.projects[slug] || {};
    const missing = CHECKS.filter(([, test]) => !test(p, l)).map(([label]) => label);
    return {
      n: i + 1, slug, title: p.title, format: p.format, key: l.key ? "../" + l.key : "",
      complete: Math.round(100 * (CHECKS.length - missing.length) / CHECKS.length), missing,
      visits: st && st.byPath ? (st.byPath["/" + slug] || 0) : null,
      live: `${SITE_URL}/#${slug}`, sheet: d.sheet ? sheetUrl(d.sheet) : "", media: d.media ? folderUrl(d.media) : "",
      broken: links ? (links.broken || []).filter(b => b.where.some(w => w.slug === slug)).length : 0
    };
  });

  const data = {
    generatedAt: new Date().toISOString(), year: content.year, siteUrl: SITE_URL, repoUrl: REPO_URL, gc: GC,
    publishUrl: `${REPO_URL}/actions/workflows/publish.yml`,
    front: [
      { label: "Cover", url: drive.front.cover && docUrl(drive.front.cover) },
      { label: "Welcome", url: drive.front.welcome && docUrl(drive.front.welcome) },
      { label: "About", url: drive.front.about && docUrl(drive.front.about) },
      { label: "Running order", url: drive.order.sheet && sheetUrl(drive.order.sheet) },
      { label: "Front page media", url: drive.front.media && folderUrl(drive.front.media) },
      { label: "Editors' guide", url: drive.guide && docUrl(drive.guide) }
    ].filter(f => f.url),
    driveRoot: drive.root ? folderUrl(drive.root) : "",
    projects,
    sync: { problems, lastDriveChange: (log.find(c => c.fromDrive) || {}).date || null },
    changes: log,
    links,
    stats: st
  };

  const tpl = fs.readFileSync(path.join(__dirname, "dashboard.html"), "utf8");
  const html = tpl.replace("/*__DATA__*/null", JSON.stringify(data).replace(/</g, "\\u003c"));
  const outDir = process.env.DASHBOARD_OUT ? path.join(REPO, process.env.DASHBOARD_OUT, Y.Y, "dashboard") : path.join(Y.OUT, "dashboard");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log(`dashboard written: ${projects.length} projects, ${log.length} change entries, ${problems.length} sync problems, stats ${st ? (st.error ? "error" : "on") : "not connected"}`);
})();
