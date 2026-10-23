// Generates drive-kit/setup.gs (the Apps Script that builds the Drive editing kit) from
// drive-kit/setup.template.gs and the shared field spec. Run: npm run kit
const fs = require("fs");
const path = require("path");
const spec = require("./spec");

const REPO = path.resolve(__dirname, "..", "..");
const RAW = "https://raw.githubusercontent.com/matthewsmaglik/nonfictionhotlist/main";
const KIT = {
  rootFolderId: "1Eu7dbIrIPNk2auC9DPzxwy3crbAWR__u",   // Google Drive: .../Nonfiction Hotlist/NFH 2025
  contentUrl: `${RAW}/content/content.json`,
  layoutUrl: `${RAW}/content/layout.json`,
  siteBase: `${RAW}/site/`,
  siteUrl: "https://nfh2025.rdgnbl.com",
  repoUrl: "https://github.com/matthewsmaglik/nonfictionhotlist",
  spec
};

const tpl = fs.readFileSync(path.join(REPO, "drive-kit", "setup.template.gs"), "utf8");
const out = tpl.replace("__KIT__", JSON.stringify(KIT, null, 2));
fs.writeFileSync(path.join(REPO, "drive-kit", "setup.gs"), out);
console.log("drive-kit/setup.gs written");
