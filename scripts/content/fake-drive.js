// Writes a simulated copy of the Drive kit's exports (CSV per sheet tab, markdown per doc),
// laid out exactly as drive-kit/setup.gs builds it. Used to test pull-drive.js without Google.
//   node scripts/content/fake-drive.js OUT_DIR
const fs = require("fs");
const path = require("path");
const { PROJECT, DOCS, ORDER } = require("./spec");

const out = process.argv[2];
if (!out) throw new Error("usage: fake-drive.js OUT_DIR");
fs.mkdirSync(out, { recursive: true });
const c = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "content", "content.json"), "utf8"));

const csv = rows => rows.map(r => r.map(v => {
  v = v == null ? "" : String(v);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}).join(",")).join("\n");
// Banner, instructions, blank row, then header and body, as in setup.gs.
const tab = (title, header, body) => csv([[title], ["Edit the white cells only."], [], header, ...body]);
const pad = (rows, n, width) => [...rows, ...Array.from({ length: Math.max(0, n - rows.length) }, () => Array(width).fill(""))];

const manifest = [["Kind", "Key", "Label", "File ID", "Tabs"]];
const write = (name, text) => fs.writeFileSync(path.join(out, name), text);

for (const slug of c.order) {
  const p = c.projects[slug];
  const id = `p-${slug}`;
  const tabs = { Page: 0 };
  write(`${id}__0.csv`, tab(p.title, ["Field", "Text", "Characters", "Limit"],
    PROJECT.page.map(f => [f.label, p[f.key] || "", String((p[f.key] || "").length), String(f.max)])));
  PROJECT.lists.forEach((list, i) => {
    const gid = 100 + i; tabs[list.tab] = gid;
    const rows = (p[list.key] || []).map(item => {
      if (list.key === "help") return [item];
      if (list.key === "laurels") return [item.event, item.year || "", item.note || "", item.source || ""];
      if (list.key === "updates") return [item.date, item.text, item.source || "", item.url || ""];
      return item;
    });
    write(`${id}__${gid}.csv`, tab(list.tab, list.cols.map(col => col.label), pad(rows, list.rows, list.cols.length)));
  });
  manifest.push(["project", slug, p.title, id, JSON.stringify(tabs)]);
}

const slots = [];
for (let pg = 1; pg <= ORDER.pages; pg++) for (let s = 1; s <= ORDER.perPage; s++) {
  const slug = c.order[(pg - 1) * ORDER.perPage + (s - 1)];
  slots.push([`Page ${pg}`, String(s), slug ? c.projects[slug].title : ""]);
}
write("order__7.csv", tab("Running order", ["Page", "Slot", "Project"], slots));
manifest.push(["order", "order", "Running order", "order", JSON.stringify({ [ORDER.tab]: 7 })]);

// Google escapes markdown punctuation with backslashes.
const esc = t => t.replace(/\*\*(.+?)\*\*/g, "\u0001$1\u0001").replace(/([\\_*\[\]#+!])/g, "\\$1").replace(/(\d)\./g, "$1\\.").replace(/\u0001/g, "**");
for (const [key, spec] of Object.entries(DOCS)) {
  const d = c[key];
  let md = `# ${spec.title}\n\nEdit the text under each heading. Keep the headings as they are.\n\n`;
  for (const s of spec.sections) {
    md += `## ${s.heading}\n\n*Up to ${s.max} characters\.*\n\n`;
    const v = d[s.key];
    if (s.kind === "text") md += esc(v) + "\n\n";
    if (s.kind === "paragraphs") md += v.map(esc).join("\n\n") + "\n\n";
    if (s.kind === "bullets") md += v.map(x => `- ${esc(x)}  `).join("\n") + "\n\n";
    if (s.kind === "steps") md += v.map(([h, t]) => `### ${esc(h)}\n\n${esc(t)}`).join("\n\n") + "\n\n";
  }
  write(`doc-${key}.md`, md);
  manifest.push(["doc", key, spec.title, `doc-${key}`, "{}"]);
}
write("manifest.csv", csv(manifest));
console.log(`fake kit written to ${out}`);
