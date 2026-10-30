// Generates the Apps Scripts that run in Google Drive:
//   drive-kit/setup-<year>.gs      builds that year's editing kit (from setup.template.gs and the field spec)
//   drive-kit/publish-trigger.gs   watches every connected year's kit and asks GitHub to publish
// Run: npm run kit   (NFH_YEAR=2026 npm run kit for another year's setup script)
const fs = require("fs");
const path = require("path");
const spec = require("./spec");
const Y = require("../year");

const KIT_DIR = path.join(Y.REPO, "drive-kit");
const rel = f => path.relative(Y.REPO, f).split(path.sep).join("/");
const drivePath = Y.file("drive.json");
const drive = fs.existsSync(drivePath) ? JSON.parse(fs.readFileSync(drivePath, "utf8")) : {};
const rootFolderId = Y.info.driveRoot || drive.root;
if (!rootFolderId) console.warn(`${Y.Y}: no Drive folder yet. Set years.json > years.${Y.Y}.driveRoot to the folder the kit should be built in.`);

const KIT = {
  year: Y.Y,
  rootFolderId: rootFolderId || "PASTE_FOLDER_ID",
  contentUrl: `${Y.RAW}/${rel(Y.file("content.json"))}`,
  layoutUrl: `${Y.RAW}/${rel(Y.file("layout.json"))}`,
  siteBase: `${Y.RAW}/site/${Y.Y}/`,
  siteUrl: Y.SITE_URL,
  repoUrl: Y.REPO_URL,
  spec
};
const tpl = fs.readFileSync(path.join(KIT_DIR, "setup.template.gs"), "utf8");
fs.writeFileSync(path.join(KIT_DIR, `setup-${Y.Y}.gs`), tpl.replace("__KIT__", JSON.stringify(KIT, null, 2)));
console.log(`drive-kit/setup-${Y.Y}.gs written`);

// The publish trigger covers every year whose kit is connected.
const manifests = {};
for (const year of Object.keys(Y.config.years)) {
  const f = path.join(Y.REPO, "years", year, "content", "drive.json");
  if (fs.existsSync(f)) manifests[year] = JSON.parse(fs.readFileSync(f, "utf8")).manifestId;
}
const trig = fs.readFileSync(path.join(KIT_DIR, "publish-trigger.template.gs"), "utf8")
  .replace(/__REPO__/g, Y.config.repo).replace(/__OWNER__/g, Y.config.repo.split("/")[0])
  .replace("__MANIFESTS__", JSON.stringify(manifests));
fs.writeFileSync(path.join(KIT_DIR, "publish-trigger.gs"), trig);
console.log(`drive-kit/publish-trigger.gs written (years: ${Object.keys(manifests).join(", ") || "none"})`);
