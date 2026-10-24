// Checks every outside link on the site (project links, laurel sources, news sources) and writes
// content/link-check.json for the dashboard. Social sites block automated visits, so their refusals
// are listed as "can't check" rather than broken. Run: npm run links (the Publish workflow runs it daily).
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..");
const OUT = path.join(REPO, "content", "link-check.json");
const content = JSON.parse(fs.readFileSync(path.join(REPO, "content", "content.json"), "utf8"));

const SOCIAL = /(^|\.)(instagram|facebook|fb|linkedin|x|twitter|tiktok|threads|youtube|vimeo)\.com$/i;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

// url -> where it appears
const links = new Map();
const add = (url, slug, title, field) => {
  if (!/^https?:\/\//i.test(url || "")) return;
  if (!links.has(url)) links.set(url, []);
  links.get(url).push({ slug, title, field });
};
for (const slug of content.order) {
  const p = content.projects[slug];
  (p.links || []).forEach(([label, url]) => add(url, slug, p.title, `Links: ${label}`));
  (p.laurels || []).forEach(l => add(l.source, slug, p.title, `Laurel source: ${l.event}`));
  (p.updates || []).forEach(u => add(u.url, slug, p.title, `News source${u.source ? ": " + u.source : ""}`));
}

async function check(url) {
  const attempt = async (method) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(url, { method, redirect: "follow", signal: ctl.signal, headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
      return { status: res.status };
    } catch (e) {
      return { error: e.name === "AbortError" ? "Timed out" : (e.cause && e.cause.code) || e.message };
    } finally { clearTimeout(t); }
  };
  let r = await attempt("HEAD");
  if (r.error || r.status >= 400) r = await attempt("GET");   // many servers refuse HEAD
  if (r.error || r.status >= 400) { await new Promise(s => setTimeout(s, 3000)); r = await attempt("GET"); }  // one retry
  return r;
}

(async () => {
  const urls = [...links.keys()];
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < urls.length) {
      const url = urls[i++];
      results.push({ url, ...(await check(url)), where: links.get(url) });
    }
  }));
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const failed = r => r.error || r.status >= 400;
  const unchecked = results.filter(r => failed(r) && SOCIAL.test(host(r.url)));
  const broken = results.filter(r => failed(r) && !unchecked.includes(r))
    .sort((a, b) => a.where[0].title.localeCompare(b.where[0].title));
  const report = {
    checkedAt: new Date().toISOString(),
    total: urls.length,
    broken: broken.map(({ url, status, error, where }) => ({ url, status: status || null, error: error || null, where })),
    unchecked: unchecked.map(r => r.url).sort()
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(`links: ${urls.length} checked, ${broken.length} broken, ${unchecked.length} can't be checked`);
  broken.forEach(b => console.log(`  ${b.status || b.error}  ${b.url}  (${b.where.map(w => w.title).join(", ")})`));
})();
