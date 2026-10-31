# Notes for working in this repo

- One site, one folder per year. `years.json` lists the years (live or draft), the domain (list.nonfictionhotlist.com) and the repo (Nonfiction-Hotlist/list). Every script works on one year, chosen with `NFH_YEAR=<year>` (default: `latest` in years.json); `node scripts/each-year.js <npm script>` runs one for every year.
- Text source of truth is each year's Google Drive kit, mirrored into `years/<year>/content/content.json` by `npm run pull`. Image paths and framing are in `years/<year>/content/layout.json`. `src/page.html` is the page shared by all years; `years/<year>/page.html` and `site/<year>/index.html` are generated from it. Never hand-edit those.
- Run `npm run pull:all` before changing anything, so local text matches Drive. A text fix should be made in Drive, not in content.json, or the next sync overwrites it.
- After any change, run `npm run release:all` (build + PDF + smoke test for every year) and commit `years/`, `site/` and any changed images together. PDFs and dashboards are built at publish time and not committed.
- Kit fields and limits live in `scripts/content/spec.js`. After changing it, `npm run kit` and `npm run test:kit` for each year.
- `years/2025/page.html` is also published as a Claude artifact (https://claude.ai/artifact/Dts97zw9KGjPXs9KodiHWD). Keep `src/page.html` free of `<html>`/`<head>`, and keep the Download PDF code working in both places: it uses the artifact `downloads` capability inside Claude and a plain file link on the website.
- Design: forest green / sage / cream, League Spartan for display, Literata for body. Restraint is preferred: no novelty motifs (filmstrips, tickets, stamps). Marker-style highlights and dark rounded panels are in use and liked.
- Copy: understated and direct. No em dashes.
- Official contact email: info@nonfictionhotlist.com. Project contacts belong to the filmmakers.
- Deploys: `.github/workflows/publish.yml` runs on push to `main`, every 15 minutes (Drive edits) and on demand; it publishes `site/` to `gh-pages` (custom domain list.nonfictionhotlist.com). The old nfh2025.rdgnbl.com forwards here from `matthewsmaglik/nfh2025-redirect` (source in `redirects/nfh2025/`).
- Project news, laurels and status are edited in each project's sheet in Drive. When adding researched items there, every item needs a source; never add a laurel or award that a source doesn't confirm. `research/` is the October 2026 archive for 2025.
- Team dashboards: `site/<year>/dashboard/` (unlisted, built by `npm run dashboard`, never committed). GoatCounter counts visits on the website only, through `window.nfhTrack` in `scripts/build-site.js`; the Claude version and draft years must not count. 2025 counts on unprefixed paths, later years under `/<year>`. Stats need the `GOATCOUNTER_TOKEN` repo secret.
- The NFH Google Workspace (nonfictionhotlist.com) should own the kits, in a Shared Drive. Claude's Google connector is Matthew's personal Gmail, which has access as a member.
