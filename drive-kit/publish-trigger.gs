/**
 * Nonfiction Hotlist: publish trigger.
 *
 * Every 10 minutes, checks whether any sheet or doc in the NFH 2025 kit was edited, and if so asks
 * GitHub to publish the site. Once an hour it also asks for a refresh so the dashboard's numbers stay
 * current. GitHub's own schedule only runs every few hours on this account, so this is what makes
 * edits show up within about 15 minutes.
 *
 * Setup (once):
 *   1. GitHub > Settings > Developer settings > Fine-grained tokens > Generate new token.
 *      Repository access: only matthewsmaglik/nonfictionhotlist. Permissions: Actions, Read and write.
 *   2. Here in Apps Script: Project Settings (gear) > Script properties > Add property
 *      GITHUB_TOKEN = the token.
 *   3. Choose install in the function menu and click Run. Approve the permissions.
 * To stop it: run uninstall.
 */

const REPO = "matthewsmaglik/nonfictionhotlist";
const MANIFEST_ID = "1QozY-nLtYCZNNEatyzcAn9IN9Ht9CAJdtxY7qyRIazs";   // NFH 2025 / Site manifest (do not edit)
const REFRESH_EVERY_MS = 60 * 60 * 1000;

function install() {
  uninstall();
  ScriptApp.newTrigger("check").timeBased().everyMinutes(10).create();
  PropertiesService.getScriptProperties().setProperty("lastSeen", String(newestEdit_()));
  publish_("sync");
  Logger.log("Installed. Checking the kit every 10 minutes.");
}

function uninstall() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "check").forEach(t => ScriptApp.deleteTrigger(t));
}

function check() {
  const props = PropertiesService.getScriptProperties();
  const lastSeen = Number(props.getProperty("lastSeen") || 0);
  const lastRefresh = Number(props.getProperty("lastRefresh") || 0);
  const newest = newestEdit_();
  if (newest > lastSeen) {
    if (publish_("sync")) props.setProperty("lastSeen", String(newest));
  } else if (Date.now() - lastRefresh > REFRESH_EVERY_MS) {
    publish_("sync");
  }
}

// Latest edit time across every sheet and doc the website reads (listed in the Site manifest).
function newestEdit_() {
  const rows = SpreadsheetApp.openById(MANIFEST_ID).getSheets()[0].getDataRange().getValues().slice(1);
  let newest = 0;
  rows.forEach(r => {
    const id = String(r[3] || "").trim();
    if (!id) return;
    try { newest = Math.max(newest, DriveApp.getFileById(id).getLastUpdated().getTime()); } catch (e) { Logger.log("Can't read " + id + ": " + e); }
  });
  return newest;
}

function publish_(mode) {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) throw new Error("Add the GITHUB_TOKEN script property first (see the setup notes at the top).");
  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/actions/workflows/publish.yml/dispatches`, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    payload: JSON.stringify({ ref: "main", inputs: { mode } }),
    muteHttpExceptions: true
  });
  const ok = res.getResponseCode() === 204;
  if (ok) PropertiesService.getScriptProperties().setProperty("lastRefresh", String(Date.now()));
  else Logger.log(`GitHub said ${res.getResponseCode()}: ${res.getContentText().slice(0, 300)}`);
  return ok;
}
