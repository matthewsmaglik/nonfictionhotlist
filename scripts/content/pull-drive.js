// Reads the Google Drive kit (project sheets, running order, front page docs) and writes
// content/content.json. Problems never break the site: a field or doc that breaks the rules
// keeps its previous text, and every problem is listed in sync-problems.txt so the publish
// workflow can flag it after deploying everything that was valid.
//
//   node scripts/content/pull-drive.js                 read from Google (needs link sharing)
//   node scripts/content/pull-drive.js --from-dir DIR  read a local copy (tests)
//   add --dry-run to print what would change without writing
const fs = require("fs");
const path = require("path");
const { PROJECT, DOCS, ORDER } = require("./spec");

const Y = require("../year");
const CONTENT = Y.file("content.json");
const DRIVE = Y.file("drive.json");
const PROBLEMS = Y.file("sync-problems.txt");

const args = process.argv.slice(2);
const fromDir = args.includes("--from-dir") ? args[args.indexOf("--from-dir") + 1] : null;
const dryRun = args.includes("--dry-run");

const problems = [];
const warn = (where, msg) => problems.push(`${where}: ${msg}`);

/* ---------- fetching ---------- */
async function get(url, file) {
  if (fromDir) {
    const f = path.join(fromDir, file);
    if (!fs.existsSync(f)) throw new Error(`missing ${file}`);
    return fs.readFileSync(f, "utf8");
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      const type = res.headers.get("content-type") || "";
      if (res.ok && !type.includes("text/html")) return await res.text();
      if (type.includes("text/html")) throw new Error("Google returned a sign-in page. Is the NFH folder shared as 'anyone with the link can view'?");
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
}
const sheetCsv = (id, gid) => get(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`, `${id}__${gid}.csv`);
const docMd = id => get(`https://docs.google.com/document/d/${id}/export?format=md`, `${id}.md`);

/* ---------- parsing helpers ---------- */
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const clean = s => String(s == null ? "" : s).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/ /g, " ").trim();
const paragraphs = s => clean(s).split(/\n+/).map(t => t.trim()).filter(Boolean).join("\n\n");
const isEmail = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const isUrl = s => /^https?:\/\/\S+$/i.test(s);

function checkValue(where, col, v) {
  if (!v) return true;
  if (col.max && v.length > col.max) { warn(where, `${v.length} characters, limit is ${col.max}`); return false; }
  if (col.type === "email" && !isEmail(v)) { warn(where, `"${v}" is not an email address`); return false; }
  if (col.type === "url" && !isUrl(v)) { warn(where, `"${v}" is not a full link starting with https://`); return false; }
  if (col.type === "year" && !/^(19|20)\d\d$/.test(v)) { warn(where, `"${v}" is not a year`); return false; }
  return true;
}

// Rows after the header row whose first cell equals `first`.
function bodyRows(rows, first) {
  const h = rows.findIndex(r => clean(r[0]) === first);
  if (h < 0) throw new Error(`header row "${first}" not found`);
  return rows.slice(h + 1);
}

/* ---------- projects ---------- */
async function readProject(m, prev) {
  const name = prev ? prev.title : m.label;
  const out = prev ? JSON.parse(JSON.stringify(prev)) : { title: "", format: "", status: "", logline: "", summary: "", team: [], help: [], links: [], onRequest: "", contact: "", laurels: [], updates: [] };
  const tabs = m.tabs;

  // Page tab
  try {
    const rows = bodyRows(parseCsv(await sheetCsv(m.fileId, tabs.Page)), "Field");
    for (const f of PROJECT.page) {
      const r = rows.find(r => clean(r[0]) === f.label);
      if (!r) { warn(name, `the "${f.label}" row is missing`); continue; }
      const v = f.multiline ? paragraphs(r[1]) : clean(r[1]).replace(/\s*\n\s*/g, " ");
      if (f.required && !v) { warn(`${name}, ${f.label}`, "is empty, kept the previous text"); continue; }
      if (checkValue(`${name}, ${f.label}`, f, v)) out[f.key] = v;
    }
  } catch (e) { warn(`${name}, Page tab`, `${e.message}; kept the previous text`); }

  // List tabs
  for (const list of PROJECT.lists) {
    try {
      const rows = bodyRows(parseCsv(await sheetCsv(m.fileId, tabs[list.tab])), list.cols[0].label).slice(0, list.rows);
      const items = [];
      let ok = true;
      rows.forEach((r, i) => {
        const cells = list.cols.map((c, j) => clean(r[j]).replace(/\s*\n\s*/g, " "));
        if (cells.every(c => !c)) return;
        const where = `${name}, ${list.tab} row ${i + 1}`;
        if (!list.cols.every((c, j) => checkValue(where, c, cells[j]))) { ok = false; return; }
        const missing = list.cols.filter((c, j) => (c.required || j === 0) && !cells[j]);
        if (missing.length) { warn(where, `needs ${missing.map(c => c.label).join(" and ")}, row skipped`); return; }
        items.push(cells);
      });
      if (!ok) { warn(`${name}, ${list.tab}`, "kept the previous list"); continue; }
      out[list.key] = items.map(c => toItem(list.key, c));
    } catch (e) { warn(`${name}, ${list.tab} tab`, `${e.message}; kept the previous list`); }
  }
  return out;
}

function toItem(key, c) {
  if (key === "team") return [c[0], c[1]];
  if (key === "help") return c[0];
  if (key === "links") return [c[0], c[1]];
  if (key === "laurels") { const o = { event: c[0] }; if (c[1]) o.year = Number(c[1]); if (c[2]) o.note = c[2]; if (c[3]) o.source = c[3]; return o; }
  if (key === "updates") { const o = { date: c[0], text: c[1] }; if (c[3]) o.url = c[3]; if (c[2]) o.source = c[2]; return o; }
}

/* ---------- docs ---------- */
// Google's markdown export: "## Heading", "**bold**", "*italic*", "- bullet", backslash escapes.
function mdSections(md) {
  const sections = {}; let cur = null, sub = null;
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    let m;
    if ((m = line.match(/^##\s+(.*)$/)) && !line.startsWith("###")) { cur = sections[plain(m[1])] = { lines: [], steps: [] }; sub = null; continue; }
    if ((m = line.match(/^###\s+(.*)$/)) && cur) { sub = { title: plain(m[1]), lines: [] }; cur.steps.push(sub); continue; }
    if (/^#\s/.test(line) || !cur) continue;
    if (isNote(line)) continue;                       // the kit's grey guidance lines
    (sub || cur).lines.push(line);
  }
  return sections;
}
// Guidance lines the kit writes under each heading ("Up to 40 characters." and the intro),
// in italics or not. Anything else in italics is content and keeps its words.
const isNote = line => /^\s*[*_]?\s*(Up to \d|Edit the text under each heading)/.test(line);
// A line wrapped in single asterisks or underscores (whole-line italics) loses the wrapper.
const unwrapItalic = s => {
  const m = s.match(/^\s*\*(?!\*)(.*?[^*\\])\*(?!\*)\s*$/) || s.match(/^\s*_(?!_)(.*?[^_\\])_\s*$/);
  return m ? m[1] : s;
};
function inline(s) {
  s = unwrapItalic(s);
  return s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")          // links keep their text
    .replace(/\\([\\`*_{}\[\]()#+\-.!>|~&])/g, (_, ch) => String.fromCharCode(0xE000 + ch.charCodeAt(0))) // protect escaped characters
    .replace(/\*\*(.+?)\*\*/g, "\u0001$1\u0001")         // bold stays as **highlight**
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")            // italics dropped
    .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1$2")
    .replace(/\u0001/g, "**")
    .replace(/[\uE000-\uE0FF]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xE000))
    .replace(/\*\*\s*\*\*/g, "")
    .trim();
}
const plain = s => inline(s).replace(/\*\*/g, "");
// Google's export never wraps a paragraph across lines, so every non-empty line is a paragraph
// (consecutive paragraphs and soft line breaks both come out as single newlines).
const paras = lines => lines.map(l => inline(l.trim())).filter(Boolean);
const bullets = lines => lines.map(l => l.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)).filter(Boolean).map(m => plain(m[1].trim())).filter(Boolean);

function readDoc(key, md, prev) {
  const spec = DOCS[key];
  const secs = mdSections(md);
  const out = { ...prev };
  for (const s of spec.sections) {
    const where = `${spec.title} doc, "${s.heading}"`;
    const sec = secs[s.heading];
    if (!sec) { warn(where, "heading not found, kept the previous text"); continue; }
    let v;
    if (s.kind === "text") v = paras(sec.lines).join(" ");
    else if (s.kind === "paragraphs") v = paras(sec.lines);
    else if (s.kind === "bullets") v = bullets(sec.lines);
    else if (s.kind === "steps") v = sec.steps.map(st => [st.title, paras(st.lines).join(" ").replace(/\*\*/g, "")]).filter(([t, b]) => t || b);
    const list = Array.isArray(v) ? v : [v];
    if (!list.length || (s.kind === "text" && !v)) { warn(where, "is empty, kept the previous text"); continue; }
    if (s.maxItems && list.length > s.maxItems) { warn(where, `has ${list.length} items, limit is ${s.maxItems}; kept the previous text`); continue; }
    const len = x => (Array.isArray(x) ? x[1] : x).replace(/\*\*/g, "").length;
    const tooLong = list.find(x => len(x) > s.max);
    if (tooLong) { warn(where, `a passage is ${len(tooLong)} characters, limit is ${s.max}; kept the previous text`); continue; }
    if (s.kind === "steps" && list.some(x => !x[0] || x[0].length > s.maxTitle)) { warn(where, `each step needs a title of up to ${s.maxTitle} characters; kept the previous text`); continue; }
    out[s.key] = v;
  }
  return out;
}

/* ---------- main ---------- */
(async () => {
  const content = JSON.parse(fs.readFileSync(CONTENT, "utf8"));
  if (!fs.existsSync(DRIVE) && !fromDir) { console.log(`${Y.Y}: Drive kit not connected yet (no drive.json). Nothing to pull.`); return; }
  const drive = fromDir ? { manifestId: "manifest" } : JSON.parse(fs.readFileSync(DRIVE, "utf8"));

  const manifest = parseCsv(await (fromDir ? get(null, "manifest.csv") : sheetCsv(drive.manifestId, drive.manifestGid || 0)))
    .slice(1).filter(r => clean(r[0]))
    .map(r => ({ kind: clean(r[0]), key: clean(r[1]), label: clean(r[2]), fileId: clean(r[3]), tabs: JSON.parse(clean(r[4]) || "{}") }));

  const next = JSON.parse(JSON.stringify(content));

  // Projects: existing ones keep their slug; a project only in Drive is added.
  for (const m of manifest.filter(m => m.kind === "project")) {
    next.projects[m.key] = await readProject(m, content.projects[m.key]);
  }

  // Running order: a dropdown of project names per slot. Duplicates keep the first slot;
  // projects left out are added at the end so nothing disappears by accident.
  const om = manifest.find(m => m.kind === "order");
  if (om) {
    try {
      const rows = bodyRows(parseCsv(await sheetCsv(om.fileId, om.tabs[ORDER.tab])), "Page");
      const bySlugLabel = Object.fromEntries(manifest.filter(m => m.kind === "project").map(m => [m.label, m.key]));
      const order = [];
      rows.forEach(r => {
        const label = clean(r[2]); if (!label) return;
        const slug = bySlugLabel[label];
        if (!slug) return warn("Running order", `"${label}" is not a project in the kit`);
        if (order.includes(slug)) return warn("Running order", `"${label}" appears twice; kept its first slot`);
        order.push(slug);
      });
      const missing = Object.keys(next.projects).filter(s => !order.includes(s));
      if (missing.length) warn("Running order", `not placed, added at the end: ${missing.map(s => next.projects[s].title).join(", ")}`);
      next.order = [...order, ...missing];
    } catch (e) { warn("Running order", `${e.message}; kept the previous order`); }
  }

  // Front page docs
  for (const m of manifest.filter(m => m.kind === "doc")) {
    if (!DOCS[m.key]) continue;
    try { next[m.key] = readDoc(m.key, await docMd(m.fileId), content[m.key]); }
    catch (e) { warn(`${DOCS[m.key].title} doc`, `${e.message}; kept the previous text`); }
  }

  // Report
  const changed = [];
  for (const s of new Set([...Object.keys(content.projects), ...Object.keys(next.projects)]))
    if (JSON.stringify(content.projects[s]) !== JSON.stringify(next.projects[s])) changed.push(next.projects[s] ? next.projects[s].title : s);
  for (const k of Object.keys(DOCS)) if (JSON.stringify(content[k]) !== JSON.stringify(next[k])) changed.push(`${DOCS[k].title} page`);
  if (JSON.stringify(content.order) !== JSON.stringify(next.order)) changed.push("Running order");

  console.log(changed.length ? `Changed: ${changed.join("; ")}` : "No text changes in Drive.");
  if (problems.length) console.log(`\nProblems (${problems.length}):\n- ` + problems.join("\n- "));

  if (dryRun) return;
  if (changed.length) fs.writeFileSync(CONTENT, JSON.stringify(next, null, 2) + "\n");
  // The current list of skipped edits is kept in the repo, so an alert goes out once when the
  // list changes rather than on every run.
  const listed = problems.length ? problems.join("\n") + "\n" : "";
  const before = fs.existsSync(PROBLEMS) ? fs.readFileSync(PROBLEMS, "utf8") : "";
  if (listed !== before) fs.writeFileSync(PROBLEMS, listed);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
    `changed=${changed.length ? "true" : "false"}\nproblems_changed=${listed !== before ? "true" : "false"}\nproblems=${problems.length}\nsummary=${(changed.join("; ") || "skipped edits list").slice(0, 300)}\n`);
})().catch(e => { console.error(`Could not read the Drive kit: ${e.message}`); process.exit(1); });
