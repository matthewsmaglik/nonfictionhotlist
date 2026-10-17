# nonfiction hotlist. 2025

The 2025 Nonfiction Hotlist as a website: a cover, a welcome, an about page, six pages of project cards, and a page for each of the 23 projects. Every page also exists in a downloadable PDF built from the same data.

**Live:** https://nfh2025.rdgnbl.com

## How it fits together

```
src/page.html            The page itself: layout, styles, and all project data. Edit this.
site/                    What gets published. Everything here is served as-is.
  index.html             Built from src/page.html (npm run build). Don't edit by hand.
  img/                   Card art, banners and stills for each project.
  hotlist-2025.pdf       Built from src/page.html (npm run pdf).
  og.jpg                 Link preview image (npm run og).
  CNAME, .nojekyll, 404.html, favicon.svg
scripts/
  build-site.js          Wraps src/page.html into site/index.html with metadata.
  build-pdf.js           Lays out the PDF (letter size) and prints it with Chromium.
  build-og.js            Renders the link preview image from the cover.
  check-site.js          Smoke test: every page, project and tab, on desktop and phone.
  images/                Crops and compresses images from the original asset folder.
```

There is no framework. `src/page.html` is one self-contained page that routes with the URL hash (`#welcome`, `#page-2`, `#vestibule`, `#vestibule.help`). The same file is also published as a Claude artifact, which is why it has no `<html>` or `<head>`; the build adds those for the website.

## Editing content

All text lives in two objects near the top of the `<script>` in `src/page.html`:

- `SITE` holds the year, the intro line, and the welcome and about copy.
- `PROJECTS` holds one entry per project: title, format, status, logline, summary, team, how to help, links, contact and images. Add news to a project's `updates` list (newest first) and it appears under Links & updates.

After any edit:

```sh
npm install              # first time only
npm run release          # build site/index.html, rebuild the PDF, run the smoke test
git commit -am "..." && git push
```

Pushing to `main` deploys automatically (see below). `npm run serve` previews the site at http://localhost:8080.

## News, laurels and status

Festival selections, awards, distribution and other news live in `research/updates.json`, one entry per project. Each update has a date, a sentence, and a source link, and each laurel names the event, year and honor. `research/notes.md` keeps the raw research trail.

After editing that file:

```sh
python3 scripts/apply_updates.py   # writes status, laurels and updates into src/page.html
npm run release
```

Laurels show under the logline on a project page, the first one appears on the project's card, and the newest update shows as "Latest" above the tabs. Only add what a source confirms.

## Images

Originals are not in the repo. They live in the shared folder `NFH 2025 SELECTED PROJECT ASSETS`, one subfolder per filmmaker. To redo the processed images:

```sh
ASSETS_DIR="/path/to/NFH 2025 SELECTED PROJECT ASSETS" npm run images
npm run release
```

Which source file becomes each project's card, banner and stills is set in `scripts/images/process.py` (the original 19) and `scripts/images/process_late.py` (images added later). Framing is adjustable per project: `HERO_FY` moves a banner crop up or down, and `FOCUS_X` / `FOCUS_Y` set where narrower views of the banner are anchored. Flat white or black bars at the edges of a source image are trimmed automatically.

## Deploying

`.github/workflows/deploy.yml` runs on every push to `main`. It confirms `site/index.html` matches `src/page.html`, runs the smoke test, then publishes `site/` to the `gh-pages` branch. GitHub Pages serves that branch at nfh2025.rdgnbl.com.

One-time setup (already done if the site is live):

1. **GitHub Pages:** repo Settings → Pages → Source: *Deploy from a branch*, branch `gh-pages`, folder `/ (root)`. The custom domain fills in from `site/CNAME`. Tick *Enforce HTTPS* once the certificate is issued (usually within an hour).
2. **DNS** for rdgnbl.com: add a `CNAME` record, name `nfh2025`, value `matthewsmaglik.github.io`. If the DNS host is Cloudflare, set it to *DNS only* (grey cloud) so GitHub can issue the certificate.

## Troubleshooting

- `npm run check -- https://nfh2025.rdgnbl.com` runs the smoke test against the live site.
- **Site shows a GitHub 404:** Pages isn't pointed at `gh-pages`, or the deploy workflow hasn't run yet. Check the Actions tab.
- **"Domain does not resolve" in Pages settings:** the DNS record is missing or still propagating.
- **Certificate errors:** wait for GitHub to issue the certificate, then enable *Enforce HTTPS*. On Cloudflare, make sure the record isn't proxied.
- **Deploy fails at "must be built from src/page.html":** run `npm run build` and commit `site/index.html`.
- **Old content after a deploy:** GitHub Pages caches for about 10 minutes.
