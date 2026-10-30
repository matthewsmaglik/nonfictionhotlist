// Writes the files at the top of the website, outside any year:
//   site/index.html   sends visitors to the latest live year (keeping any #page in the link)
//   site/404.html     sends an unknown address to its year, or to the latest year
//   site/CNAME        the custom domain, from years.json
//   site/favicon.svg  the latest year's icon
// Run: npm run root
const fs = require("fs");
const path = require("path");
const Y = require("./year");

const SITE = path.join(Y.REPO, "site");
const latest = Y.config.latest;
const years = Object.keys(Y.config.years);
const live = years.filter(y => Y.config.years[y].status === "live");

const shell = (title, script, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>${script}</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#2e4a3b;color:#ebe6d7;font:16px Georgia,serif;text-align:center}a{color:inherit}p{margin:.4em}</style>
</head>
<body><div>${body}</div></body>
</html>
`;
const list = live.slice().reverse().map(y => `<p><a href="/${y}/">The ${y} Nonfiction Hotlist</a></p>`).join("");

fs.writeFileSync(path.join(SITE, "index.html"), shell("nonfiction hotlist.",
  `location.replace("/${latest}/" + location.hash);`,
  list));

fs.writeFileSync(path.join(SITE, "404.html"), shell("nonfiction hotlist.",
  `var y = (location.pathname.match(/^\\/(${years.join("|")})(\\/|$)/) || [])[1]; location.replace("/" + (y || "${latest}") + "/");`,
  `<p>Page not found.</p>${list}`));

fs.writeFileSync(path.join(SITE, "CNAME"), Y.config.domain + "\n");
fs.writeFileSync(path.join(SITE, "favicon.svg"), fs.readFileSync(path.join(Y.REPO, "src", "favicon.svg"), "utf8").replace("__YY__", latest.slice(-2)));
console.log(`site root written: ${Y.config.domain} -> /${latest}/ (live: ${live.join(", ")})`);
