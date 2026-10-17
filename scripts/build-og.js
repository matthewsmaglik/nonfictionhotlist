// Renders site/og.jpg (the link preview image) from the site's cover.
// Run after npm run build: npm run og
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto("file://" + path.resolve(__dirname, "..", "site", "index.html") + "#cover", { waitUntil: "networkidle" });
  // Use the bundled font files so the preview never depends on Google Fonts being reachable.
  const F = "file://" + path.resolve(__dirname, "..", "node_modules", "@fontsource");
  const face = (fam, file, w, st = "normal") => `@font-face{font-family:"${fam}";src:url("${F}/${file}") format("woff2");font-weight:${w};font-style:${st}}`;
  await p.addStyleTag({ content: [
    face("League Spartan", "league-spartan/files/league-spartan-latin-700-normal.woff2", 700),
    face("League Spartan", "league-spartan/files/league-spartan-latin-800-normal.woff2", 800),
    face("Literata", "literata/files/literata-latin-400-normal.woff2", 400),
    ".bar, .cover-strip, .cover-actions, footer { display: none !important }",
    "main { padding-left: 72px !important; padding-right: 72px !important }",
    ".cover { padding-block: 96px 0 !important } .cover-head { --yr: 13.5rem !important } .cover-foot { margin-top: 40px !important }",
  ].join("\n") });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.resolve(__dirname, "..", "site", "og.jpg"), type: "jpeg", quality: 82 });
  await b.close();
  console.log("wrote site/og.jpg");
})();
