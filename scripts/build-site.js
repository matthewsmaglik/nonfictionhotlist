// Builds site/<year>/index.html from years/<year>/page.html.
// The year's page is the page body as published to the Claude artifact (no <html>/<head>);
// this wraps it in a full document with metadata for the public website.
// Run: npm run build   (NFH_YEAR=2026 npm run build for another year)
const fs = require("fs");
const path = require("path");
const Y = require("./year");

const SITE_URL = Y.SITE_URL;
const src = fs.readFileSync(Y.PAGE, "utf8");
const content = JSON.parse(fs.readFileSync(Y.file("content.json"), "utf8"));
const count = Object.keys(content.projects).length;

// Everything up to the end of the first <style> block (title, font links, styles) belongs in <head>.
const cut = src.indexOf("</style>") + "</style>".length;
const headPart = src.slice(0, cut).replace(/<meta name="claude:[^>]*>\n?/g, "");
const bodyPart = src.slice(cut).trim();

const title = (headPart.match(/<title>([^<]*)<\/title>/) || [, "Nonfiction Hotlist"])[1];
const description = count
  ? `The ${Y.Y} Nonfiction Hotlist: ${count} exceptional unproduced nonfiction projects, what each needs, and how to help.`
  : `The ${Y.Y} Nonfiction Hotlist.`;

// Visit counting for the website only (the Claude version has no window.nfhTrack, so it counts nothing).
// GoatCounter: no cookies, no personal data. Automatic counting is off because the site routes with the
// URL hash; page.html calls nfhTrack(path, title[, event]) itself. Calls made before the script loads queue up.
// A browser with localStorage "skipgc" set (the dashboard's "don't count me" switch, and the smoke tests) is skipped.
// Each year counts under its own prefix ("/2026/manhood", "pdf-download-2026"); 2025 keeps its original paths.
// A draft year counts nothing.
const GOATCOUNTER = `${Y.config.goatcounter}/count`;
const ANALYTICS = Y.isDraft ? "" : `<script>
window.nfhTrack = function (path, title, event) {
  try { if (localStorage.getItem("skipgc") === "t") return; } catch (e) {}
  path = event ? (path === "pdf-download" ? ${JSON.stringify(Y.pdfEvent)} : path) : ${JSON.stringify(Y.info.trackPrefix)} + path;
  var go = function () { window.goatcounter.count({ path: path, title: title || path, event: !!event }); };
  if (window.goatcounter && window.goatcounter.count) go(); else (window.nfhQueue = window.nfhQueue || []).push(go);
};
</script>
<script data-goatcounter="${GOATCOUNTER}" data-goatcounter-settings='{"no_onload": true}' async src="https://gc.zgo.at/count.js"
  onload="(window.nfhQueue || []).forEach(function (f) { f(); }); window.nfhQueue = [];"></script>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${description}">
<meta name="theme-color" content="#2e4a3b">${Y.isDraft ? '\n<meta name="robots" content="noindex, nofollow">' : ""}
<link rel="canonical" href="${SITE_URL}/">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="nonfiction hotlist.">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:image" content="${SITE_URL}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<style>
:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px system-ui, -apple-system, sans-serif; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
${headPart}
${ANALYTICS}
</head>
<body>
${bodyPart}
</body>
</html>
`;

fs.mkdirSync(Y.OUT, { recursive: true });
fs.writeFileSync(path.join(Y.OUT, "index.html"), html);
// The tab icon carries the year's last two digits.
fs.writeFileSync(path.join(Y.OUT, "favicon.svg"), fs.readFileSync(path.join(Y.REPO, "src", "favicon.svg"), "utf8").replace("__YY__", Y.Y.slice(-2)));
console.log(`wrote site/${Y.Y}/index.html`, (html.length / 1024).toFixed(0) + " KB");
