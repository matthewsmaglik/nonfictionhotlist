"""Apply research/updates.json (status, laurels, dated updates with sources) to the project data in src/page.html."""
import json, re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
page = REPO / "src" / "page.html"
data = json.loads((REPO / "research" / "updates.json").read_text())
s = page.read_text()

def js(v):
    return json.dumps(v, ensure_ascii=False)

for slug, d in data.items():
    if slug.startswith("_"):
        continue
    start = s.find(f'slug: "{slug}"')
    if start < 0:
        raise SystemExit(f"project {slug} not found")
    end = s.find("\n}", start)
    block = s[start:end]
    if "status" in d:
        block, n = re.subn(r'status: "(?:[^"\\]|\\.)*"', lambda _: "status: " + js(d["status"]), block, count=1)
        assert n == 1, slug
    block = re.sub(r',\s*laurels: \[.*?\](?=,\s*updates:)', "", block, flags=re.S)
    block, n = re.subn(r'updates: \[.*\]\s*$', lambda _: f'laurels: {js(d.get("laurels", []))}, updates: {js(d.get("updates", []))}', block, count=1, flags=re.S)
    assert n == 1, slug
    s = s[:start] + block + s[end:]

page.write_text(s)
print("applied", len([k for k in data if not k.startswith("_")]), "projects")
