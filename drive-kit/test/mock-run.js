// Runs drive-kit/setup.gs against a mock of Google's Apps Script services, then writes what
// each sheet and doc would export (CSV / markdown) so pull-drive.js can read it back.
// It catches logic errors and layout drift between the kit and the reader; it does not
// prove every Google API call is valid (that is checked on the real run).
//   node drive-kit/test/mock-run.js OUT_DIR     (NFH_YEAR picks the year, as everywhere else)
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Y = require("../../scripts/year");
const REPO = Y.REPO;
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const content = fs.readFileSync(Y.file("content.json"), "utf8");
const layout = fs.readFileSync(Y.file("layout.json"), "utf8");

let nextId = 1;
const files = {};      // id -> { kind, name, sheets | doc }
const props = {};
const calls = { fetch: 0, triggers: 0 };

// Any method not modelled returns the same object, so chained styling calls just work.
const chain = (target) => new Proxy(target, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : () => chain(t))) });

function Sheet(ss, name) {
  const sh = { name, id: ss.sheets.length ? 1000 + nextId++ : 0, cells: {}, maxRows: 1000, maxCols: 26 };
  const api = chain({
    setName: n => { sh.name = n; return api; }, getName: () => sh.name, getSheetId: () => sh.id,
    getMaxRows: () => sh.maxRows, getMaxColumns: () => sh.maxCols,
    deleteRows: (a, n) => { sh.maxRows -= n; return api; }, deleteColumns: (a, n) => { sh.maxCols -= n; return api; },
    clear: () => { sh.cells = {}; return api; },
    getRange: (r, c, nr = 1, nc = 1) => {
      if (typeof r === "string") throw new Error("A1 ranges not modelled");
      if (r + nr - 1 > sh.maxRows || c + nc - 1 > sh.maxCols) throw new Error(`range outside sheet ${sh.name}: ${r},${c},${nr},${nc}`);
      const range = chain({
        setValues: vals => {
          if (vals.length !== nr || vals.some(v => v.length !== nc)) throw new Error(`setValues shape ${vals.length}x${vals[0].length} into ${nr}x${nc} on ${sh.name}`);
          vals.forEach((row, i) => row.forEach((v, j) => sh.cells[`${r + i},${c + j}`] = v)); return range;
        },
        setValue: v => { sh.cells[`${r},${c}`] = v; return range; },
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => sh.cells[`${r + i},${c + j}`] ?? "")),
        merge: () => { if (nr * nc < 2) throw new Error("merge of a single cell"); return range; }
      });
      return range;
    },
    protect: () => chain({ getEditors: () => [], canDomainEdit: () => false }),
    getProtections: () => [], getConditionalFormatRules: () => [],
  });
  sh.api = api;
  return sh;
}
function Spreadsheet(name) {
  const id = `ss${nextId++}`;
  const ss = { kind: "sheet", name, sheets: [] };
  ss.sheets.push(Sheet(ss, "Sheet1"));
  files[id] = ss;
  return ssApi(id);
}
function ssApi(id) {
  const ss = files[id];
  return chain({
    getId: () => id, getSheets: () => ss.sheets.map(s => s.api),
    getSheetByName: n => (ss.sheets.find(s => s.name === n) || {}).api || null,
    insertSheet: n => { const s = Sheet(ss, n); ss.sheets.push(s); return s.api; },
  });
}
function Doc(name) {
  const id = `doc${nextId++}`;
  const paras = [{ text: "", heading: "NORMAL" }];
  files[id] = { kind: "doc", name, paras };
  const para = p => {
    const api = chain({
      setText: t => { p.text = t; }   /* returns nothing in Apps Script */, setHeading: h => { p.heading = h; return api; }, getText: () => p.text,
      setGlyphType: () => api, getHeading: () => p.heading, setSpacingAfter: () => api,
      editAsText: () => { const t = chain({ setBold: (a, b) => { (p.bold = p.bold || []).push([a, b]); return t; }, setItalic: v => { p.italic = v; return t; } }); return t; }
    });
    return api;
  };
  const body = chain({
    clear: () => { paras.length = 0; paras.push({ text: "", heading: "NORMAL" }); return body; },
    getParagraphs: () => paras.map(para),
    appendParagraph: t => { const p = { text: t, heading: "NORMAL" }; paras.push(p); return para(p); },
    appendListItem: t => { const p = { text: t, heading: "NORMAL", bullet: true }; paras.push(p); return para(p); }
  });
  return chain({ getId: () => id, getBody: () => body });
}
const folder = name => {
  const kids = {}; const fileNames = new Set(); const id = `folder${nextId++}`;
  const api = chain({
    getId: () => id,
    getFoldersByName: n => { const has = !!kids[n]; return { hasNext: () => has, next: () => kids[n] }; },
    createFolder: n => (kids[n] = folder(n)),
    getFilesByName: n => ({ hasNext: () => fileNames.has(n) }),
    createFile: blob => { fileNames.add(blob.name); return chain({}); }
  });
  return api;
};
const root = folder(`NFH ${Y.Y}`);

const sandbox = {
  Logger: { log: m => console.log("  log:", m) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { if (v.length > 9000) throw new Error(`property ${k} is ${v.length} bytes, over Apps Script's 9KB limit`); props[k] = v; }, deleteProperty: k => delete props[k] }) },
  UrlFetchApp: { fetch: url => { calls.fetch++; return { getContentText: () => url.endsWith("content.json") ? content : layout, getBlob: () => { const b = { setName: n => { b.name = n; return b; } }; return b; } }; } },
  DriveApp: { getFolderById: () => root, getFileById: () => chain({}), Access: {}, Permission: {} },
  SpreadsheetApp: chain({
    create: Spreadsheet, flush: () => {},
    openById: id => ssApi(id),
    newDataValidation: () => chain({}), newConditionalFormatRule: () => chain({}), ProtectionType: { SHEET: "SHEET" }
  }),
  DocumentApp: { create: Doc, ParagraphHeading: { HEADING1: "H1", HEADING2: "H2", HEADING3: "H3", NORMAL: "NORMAL" }, GlyphType: { BULLET: "BULLET" } },
  Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }) },
  ScriptApp: { newTrigger: () => chain({ create: () => { calls.triggers++; } }), getProjectTriggers: () => [] },
};
// --slow-clock: each clock read moves time forward 20 seconds, forcing pauses, to test resuming.
if (process.argv.includes("--slow-clock")) { let t = 0; sandbox.Date = { now: () => (t += 20000) }; }
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(REPO, "drive-kit", `setup-${Y.Y}.gs`), "utf8"), sandbox);
let runs = 0;
do { const before = calls.triggers; runs++; vm.runInContext(runs === 1 ? "buildKit()" : "continueKit()", sandbox); if (calls.triggers === before) break; } while (runs < 100);
console.log(`runs: ${runs}`);

// --titles "A,B": type project titles into the Running order sheet's Projects tab, then run addProjects.
const ti = process.argv.indexOf("--titles");
if (ti > -1) {
  const titles = process.argv[ti + 1].split(",").map(t => t.trim()).filter(Boolean);
  const order = Object.values(files).find(f => f.kind === "sheet" && f.sheets.some(s => s.name === "Projects"));
  if (!order) throw new Error("no Projects tab was made");
  const tab = order.sheets.find(s => s.name === "Projects");
  titles.forEach((t, i) => { tab.cells[`${5 + i},1`] = t; });
  vm.runInContext("addProjects()", sandbox);
  vm.runInContext("addProjects()", sandbox);   // a second run must change nothing
}

// Export: sheets as CSV per tab (computed formulas left blank), docs as Google-style markdown.
const csvCell = v => { v = v == null ? "" : String(v); if (v.startsWith("=")) v = ""; return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
for (const [id, f] of Object.entries(files)) {
  if (f.kind === "sheet") for (const s of f.sheets) {
    const rows = [];
    for (let r = 1; r <= s.maxRows; r++) { const row = []; for (let c = 1; c <= s.maxCols; c++) row.push(csvCell(s.cells[`${r},${c}`])); rows.push(row.join(",")); }
    fs.writeFileSync(path.join(OUT, `${id}__${s.id}.csv`), rows.join("\n"));
  }
  if (f.kind === "doc") {
    const md = f.paras.map(p => {
      let t = p.text;
      if (p.bold) [...p.bold].reverse().forEach(([a, b]) => { t = t.slice(0, a) + "**" + t.slice(a, b + 1) + "**" + t.slice(b + 1); });
      if (p.italic) t = `*${t}*`;
      if (p.heading === "H1") return `# ${t}`;
      if (p.heading === "H2") return `## ${t}`;
      if (p.heading === "H3") return `### ${t}`;
      return p.bullet ? `- ${t}` : t;
    }).join("\n\n");
    fs.writeFileSync(path.join(OUT, `${id}.md`), md);
  }
}
const man = Object.entries(files).find(([, f]) => f.name === "Site manifest (do not edit)");
fs.copyFileSync(path.join(OUT, `${man[0]}__0.csv`), path.join(OUT, "manifest.csv"));
console.log(`mock run: ${Object.keys(files).length} files, ${calls.fetch} fetches, ${calls.triggers} pauses, state ${props.kit.length} bytes`);
