// Builds site/index.html from src/page.html.
// src/page.html is the page body as published to the Claude artifact (no <html>/<head>);
// this wraps it in a full document with metadata for the public website.
// Run: npm run build
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const SITE_URL = "https://nfh2025.rdgnbl.com";
const src = fs.readFileSync(path.join(REPO, "src", "page.html"), "utf8");

// Everything up to the end of the first <style> block (title, font links, styles) belongs in <head>.
const cut = src.indexOf("</style>") + "</style>".length;
const headPart = src.slice(0, cut).replace(/<meta name="claude:[^>]*>\n?/g, "");
const bodyPart = src.slice(cut).trim();

const title = (headPart.match(/<title>([^<]*)<\/title>/) || [, "Nonfiction Hotlist"])[1];
const description = "The 2025 Nonfiction Hotlist: 23 exceptional unproduced nonfiction projects, what each needs, and how to help.";

// Visit counting for the website only (the Claude version has no window.nfhTrack, so it counts nothing).
// GoatCounter: no cookies, no personal data. Automatic counting is off because the site routes with the
// URL hash; page.html calls nfhTrack(path, title[, event]) itself. Calls made before the script loads queue up.
// A browser with localStorage "skipgc" set (the dashboard's "don't count me" switch, and the smoke tests) is skipped.
const GOATCOUNTER = "https://nonfictionhotlist.goatcounter.com/count";
const ANALYTICS = `<script>
window.nfhTrack = function (path, title, event) {
  try { if (localStorage.getItem("skipgc") === "t") return; } catch (e) {}
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
<meta name="theme-color" content="#2e4a3b">
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

fs.writeFileSync(path.join(REPO, "site", "index.html"), html);
console.log("wrote site/index.html", (html.length / 1024).toFixed(0) + " KB");
