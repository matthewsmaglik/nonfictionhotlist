# Notes for working in this repo

- Source of truth is `src/page.html` (project data in the `SITE` and `PROJECTS` objects). Never hand-edit `site/index.html`; run `npm run build`.
- After any content or design change, run `npm run release` (build + PDF + smoke test) and commit `site/index.html`, `site/hotlist-2025.pdf` and any changed images together. The PDF must always match the site.
- `src/page.html` is also published as a Claude artifact (https://claude.ai/artifact/Dts97zw9KGjPXs9KodiHWD). Keep it free of `<html>`/`<head>`, and keep the Download PDF code working in both places: it uses the artifact `downloads` capability inside Claude and a plain file link on the website.
- Design: forest green / sage / cream, League Spartan for display, Literata for body. Restraint is preferred: no novelty motifs (filmstrips, tickets, stamps). Marker-style highlights and dark rounded panels are in use and liked.
- Copy: understated and direct. No em dashes.
- Official contact email: info@nonfictionhotlist.com. Project contacts belong to the filmmakers.
- Deploys: pushing to `main` publishes `site/` to `gh-pages` (custom domain nfh2025.rdgnbl.com).
- Project news (laurels, dated updates with sources, status) is kept in `research/updates.json` and applied with `python3 scripts/apply_updates.py`. Every item needs a source; never add a laurel or award that a source doesn't confirm.
