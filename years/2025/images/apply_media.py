"""Write image paths and focus points from media.json into the project data in src/page.html."""
import json, re
from pathlib import Path
REPO = Path(__file__).resolve().parents[3]
page = REPO / "years" / "2025" / "page.html"
m = json.load(open(Path(__file__).with_name("media.json")))
s = page.read_text()
for slug, d in m.items():
    new = (f'slug: "{slug}", key: "{d["key"]}", hero: "{d["hero"]}", focus: {d.get("focus", 50)}, '
           f'focusY: {d.get("focusY", 50)}, stills: {json.dumps(d["stills"])},')
    s, n = re.subn(r'slug: "' + re.escape(slug) + r'",( key: "[^"]*", hero: "[^"]*",( focus: \d+,)?( focusY: \d+,)? stills: \[.*?\]\],)?',
                   lambda _: new, s, count=1)
    if n != 1: raise SystemExit(f"project {slug} not found in page.html")
page.write_text(s)
print("updated", len(m), "projects")
