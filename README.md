# nonfiction hotlist.

Every year of the Nonfiction Hotlist as one website: a cover, a welcome, an about page, pages of project cards, and a page for each project. Every year also has a downloadable PDF built from the same data and an unlisted team dashboard.

**Live:** https://list.nonfictionhotlist.com (the front door sends visitors to the latest year)

| Year | Address | Status |
|------|---------|--------|
| 2025 | https://list.nonfictionhotlist.com/2025/ | live, 23 projects |
| 2026 | https://list.nonfictionhotlist.com/2026/ | draft: built, hidden from search, not linked |

## How it fits together

```
years.json                 Every year, its status (live or draft), the domain and the repo.
years/<year>/
  content/
    content.json           All of that year's text, mirrored from its Drive kit. **bold** marks the highlight.
    layout.json            Image paths and framing per project. Edited here, not in Drive.
    drive.json             Drive IDs for the year's kit. Kept in step with the kit's manifest by the sync.
    sync-problems.txt      Drive edits that broke a rule and were skipped (empty when all is well).
    link-check.json        The daily outside-link check.
  page.html                The year's page (generated). Also what gets published as a Claude artifact.
  images/                  (2025) the scripts that cropped that year's images from the original assets.
src/
  page.html                The page shared by every year: layout, styles and rendering. __YEAR__ marks
                           where it names the year; the data block is filled in per year.
  favicon.svg              Tab icon template (the year's last two digits).
site/                      What gets published. Everything here is served as-is.
  index.html, 404.html     Front door and not-found page (npm run root). CNAME, favicon.svg.
  <year>/
    index.html             Built from years/<year>/page.html (npm run build). Don't edit by hand.
    img/                   Card art, banners and stills.
    hotlist-<year>.pdf     Built at publish time (npm run pdf). Not committed.
    og.jpg                 Link preview image (npm run og).
    dashboard/             Team dashboard, built at publish time. Not committed.
drive-kit/
  setup-<year>.gs          Apps Script that builds a year's Drive kit (npm run kit).
  publish-trigger.gs       Apps Script that watches every connected kit and asks GitHub to publish.
redirects/nfh2025/         Source for the old nfh2025.rdgnbl.com address, which forwards here.
scripts/
  year.js                  Which year a script works on: NFH_YEAR=2026, or --year 2026, else years.json latest.
  each-year.js             Runs an npm script once per year.
  content/                 spec.js (fields and limits), pull-drive.js (Drive to content.json),
                           write-page.js (content to the year's page), build-kit.js, fake-drive.js
  build-site.js            Wraps a year's page into site/<year>/index.html with metadata.
  build-root.js            Front door, 404, CNAME.
  build-pdf.js, build-og.js, check-site.js, dashboard/
```

There is no framework. Each year's page is one self-contained file that routes with the URL hash (`#welcome`, `#page-2`, `#vestibule`, `#vestibule.help`). It has no `<html>` or `<head>` because it is also published as a Claude artifact; the build adds those for the website.

Every script works on one year. Pick it with `NFH_YEAR`:

```sh
NFH_YEAR=2026 npm run release      # one year
npm run release:all                # every year, plus the front door
```

## Years

`years.json` lists them. A year has a `status`:

- **draft**: built at `/<year>/` so the team can see it, but search engines are told to skip it, the front door doesn't link to it, and visits aren't counted.
- **live**: public. Set `latest` to the year the front door should open.

Visits for 2026 onward are counted under the year's prefix (`/2026/manhood`, `pdf-download-2026`). 2025 keeps its original paths so its counts carry over.

**Starting a new year:** add it to `years.json` as a draft, copy the previous year's `content.json` front-page text and an empty `layout.json` into `years/<year>/content/`, set `driveRoot` to the Drive folder for its kit, then `NFH_YEAR=<year> npm run kit` and run `buildKit` from the generated `drive-kit/setup-<year>.gs`.

## Editing text: the Google Drive kits

Each year's text is edited in its own Drive kit:

```
00 How this works            Guide for editors
01 Cover, Welcome, About/    Google Docs, one heading per field. Bold becomes the highlight.
02 Index Pages/              Running order: a dropdown of project names per card slot.
                             Projects tab: the list of project titles (see "Adding projects").
03 Projects/<Title>/         A locked Google Sheet, <Title>_Copysheet (tabs: Page, Team, How to help, Links,
                             Laurels and awards, News) and a Media folder of images.
Site manifest (do not edit)  Maps every sheet, doc and folder to the site. The workflow reads it.
```

Project sheets are locked except for the white cells, and each field has a character limit that the sheet enforces as people type. Docs can't be locked, so the reader checks them: a missing heading or an over-long passage is skipped, and that part of the site keeps its previous text.

**Adding projects.** A new year starts with none. Type the titles in the Running order sheet's Projects tab, one per row, then run `addProjects` in that year's setup script. Each new title gets a folder, a locked Copysheet and a Media folder, joins the running order dropdown, and is added to the manifest. On the next sync the project appears on the site and its links appear on the dashboard. Running it again only adds titles that are new.

**How edits reach the site.** The Publish workflow runs every 15 minutes. For each year with a connected kit it reads the kit (`scripts/content/pull-drive.js`), and if anything changed it updates that year's `content.json` (and `drive.json`, if the manifest changed), rebuilds every year and its PDF, runs the smoke tests, commits and publishes. Edits that break a rule are listed in that year's `sync-problems.txt` and in the run summary; the run fails, which emails the repo owner, once each time a list changes. To publish right away, run the workflow from the Actions tab.

The kits are read through link sharing (anyone with the link can view), so no Google credentials are stored anywhere. In a Workspace Shared Drive, the admin must allow link sharing outside the organization. Editing rights are whatever you grant in Drive.

**Publishing promptly.** GitHub runs scheduled workflows only every few hours on some accounts, so the 15-minute schedule is a backup. `drive-kit/publish-trigger.gs` is a small Apps Script that runs in an NFH Google account: every 10 minutes it checks every connected kit for edits and, if any, starts the Publish workflow in `sync` mode; it also asks for an hourly refresh so dashboard numbers stay current. It needs a fine-grained GitHub token (this repo only, Actions read and write) in the script property `GITHUB_TOKEN`; see the notes at the top of the file. Fine-grained tokens expire, so renew it before the date you set. When a new year's kit is connected, `npm run kit` regenerates the trigger with that year included; paste it over the old one and run `install`.

**Building a kit.** `NFH_YEAR=<year> npm run kit` generates `drive-kit/setup-<year>.gs`. Paste it into a new project at script.google.com and run `buildKit`. It fills the folder from that year's `content.json` on GitHub, copies the images, sets link sharing and logs the Site manifest ID. Put that ID in `years/<year>/content/drive.json` as `{ "manifestId": "..." }`; the next sync fills in the rest. It pauses and resumes itself to stay under Google's time limit, and running it again only fills in what's missing.

**Changing fields or limits.** Edit `scripts/content/spec.js`, then `npm run test:kit` for each year (checks the reader against a simulated export and a mock run of the setup script; `node drive-kit/test/mock-run.js DIR --titles "A,B"` also exercises `addProjects`). Existing sheets keep their old layout until rebuilt.

**Working locally.** `npm run pull:all` reads every connected kit. Before changing code, pull first so you're working on the current text.

```sh
npm install              # first time only
npm run pull:all         # current text from Drive
npm run release:all      # build every year, the PDFs, run the smoke tests
git commit -am "..." && git push
```

`npm run serve` previews the site at http://localhost:8080. On a machine without internet access, `CHECK_OFFLINE=1 npm run check` skips outside requests (fonts) in the smoke test.

## Team dashboard

An unlisted page per year, at `/<year>/dashboard/`, for the NFH team: one-click links to every Copysheet, Media folder and front-page doc, how complete each project is, visits per project and PDF downloads, sync health (edits that were skipped), recent changes, the daily broken-link check, and where visitors come from. Nothing links to it and search engines are told to skip it; anyone with the URL can open it.

- Built by `scripts/dashboard/build-dashboard.js` from `scripts/dashboard/dashboard.html` (`npm run dashboard`). The Publish workflow rebuilds every year's on every run, so numbers are at most about 15 minutes old.
- Visits are counted with GoatCounter (nonfictionhotlist.goatcounter.com) on the website only. GoatCounter counts the whole domain; each dashboard shows only its own year. The smoke test stubs GoatCounter, so test runs never count.
- To show the numbers, the workflow needs a GoatCounter API key with read access in the repo secret `GOATCOUNTER_TOKEN`.
- The link check (`npm run links`) runs daily and writes the year's `link-check.json`. Sites that refuse automated visits (social media, and any 401/403/429 answer) are listed as unchecked, not broken.
- `DASHBOARD_SAMPLE=1 npm run dashboard` fills in sample numbers for design previews. Never publish that.

## News, laurels and status

These are edited in each project's sheet (Status on the Page tab, plus the Laurels and awards and News tabs). A news item needs a source link to appear. Laurels show under the logline on a project page, the first one appears on the project's card, and the newest news item shows as "Latest" above the tabs. `research/` keeps the October 2026 research trail that seeded 2025's.

## Images

2025: originals live in the shared folder `NFH 2025 SELECTED PROJECT ASSETS`, one subfolder per filmmaker. To redo the processed images:

```sh
ASSETS_DIR="/path/to/NFH 2025 SELECTED PROJECT ASSETS" python3 years/2025/images/process.py
NFH_YEAR=2025 npm run release
```

Which source file becomes each project's card, banner and stills is set in `years/2025/images/process.py` and `process_late.py`. Framing is adjustable per project: `HERO_FY` moves a banner crop up or down, and `FOCUS_X` / `FOCUS_Y` set where narrower views of the banner are anchored.

2026: images go in each project's Media folder in Drive. Bringing them from Drive onto the site is not automated yet.

## Deploying

`.github/workflows/publish.yml` runs on every push to `main`, every 15 minutes, and on demand. It pulls text from every connected kit, builds every year and its PDF, runs the smoke tests, then publishes `site/` to the `gh-pages` branch. GitHub Pages serves that branch at list.nonfictionhotlist.com. Scheduled runs with no Drive changes only refresh the dashboards. GitHub pauses scheduled workflows in a repo with no activity for 60 days; re-enable it from the Actions tab if that happens.

One-time setup:

1. **GitHub Pages:** repo Settings → Pages → Source: *Deploy from a branch*, branch `gh-pages`, folder `/ (root)`. Custom domain: `list.nonfictionhotlist.com`. Tick *Enforce HTTPS* once the certificate is issued (usually within an hour).
2. **Verify the domain** (recommended, prevents anyone else's Pages site claiming it): org Settings → Pages → Add a domain → `nonfictionhotlist.com`, then add the TXT record it shows.
3. **DNS** for nonfictionhotlist.com (held at Squarespace): add a `CNAME` record, host `list`, value `nonfiction-hotlist.github.io`. Leave every other record alone, especially the email (MX) records.
4. **Old address:** the files in `redirects/nfh2025/` are published from `matthewsmaglik/nfh2025` with Pages, custom domain `nfh2025.rdgnbl.com`. Its existing DNS record already points at `matthewsmaglik.github.io`, so nothing changes there.

## Troubleshooting

- `NFH_YEAR=2025 npm run check -- https://list.nonfictionhotlist.com` runs the smoke test against the live site.
- **Site shows a GitHub 404:** Pages isn't pointed at `gh-pages`, or the deploy workflow hasn't run yet. Check the Actions tab.
- **"Domain does not resolve" in Pages settings:** the DNS record is missing or still propagating.
- **Certificate errors:** wait for GitHub to issue the certificate, then enable *Enforce HTTPS*.
- **"Google returned a sign-in page" in a sync:** the kit's files aren't shared by link. In a Shared Drive, check the Workspace admin allows link sharing outside the organization.
- **Old content after a deploy:** GitHub Pages caches for about 10 minutes.
