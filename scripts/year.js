// Which Hotlist year a script works on, and where that year's files live.
// Pick the year with NFH_YEAR=2026 or --year 2026; without either, the 'latest' year in years.json.
//
//   years/<year>/content/   text (content.json, mirrored from Drive), images and framing (layout.json),
//                           Drive file IDs (drive.json), sync problems, link check
//   years/<year>/page.html  the year's page, generated from src/page.html plus the year's data
//                           (also what gets published as a Claude artifact)
//   site/<year>/            what the website serves at https://<domain>/<year>/
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(REPO, "years.json"), "utf8"));

const argv = process.argv;
const flag = argv.indexOf("--year");
const Y = String((flag > -1 && argv[flag + 1]) || process.env.NFH_YEAR || config.latest);
if (!config.years[Y]) throw new Error(`Unknown year ${Y}. Years in years.json: ${Object.keys(config.years).join(", ")}`);
const info = config.years[Y];

const YEAR_DIR = path.join(REPO, "years", Y);
const CONTENT_DIR = path.join(YEAR_DIR, "content");
const OUT = path.join(REPO, "site", Y);
const ORIGIN = `https://${config.domain}`;

// Visit counting: page paths get the year's prefix ("/2026/manhood"); 2025 keeps its original paths.
const trackPath = p => info.trackPrefix + p;
const pdfEvent = info.trackPrefix ? `pdf-download-${Y}` : "pdf-download";

module.exports = {
  REPO, config, Y, info, YEAR_DIR, CONTENT_DIR, OUT, ORIGIN,
  SITE_URL: `${ORIGIN}/${Y}`,
  REPO_URL: `https://github.com/${config.repo}`,
  RAW: `https://raw.githubusercontent.com/${config.repo}/main`,
  PAGE: path.join(YEAR_DIR, "page.html"),
  TEMPLATE: path.join(REPO, "src", "page.html"),
  file: name => path.join(CONTENT_DIR, name),
  isDraft: info.status !== "live",
  trackPath, pdfEvent
};
