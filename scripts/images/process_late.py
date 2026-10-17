# Adds/updates images for projects whose assets arrived later. Merges into media.json.
try: import pillow_avif
except ImportError: pass
from PIL import Image, ImageOps, ImageFilter
import os, json, sys
from pathlib import Path
REPO = Path(__file__).resolve().parents[2]
SITE = REPO / "site"
# Folder of original assets (one subfolder per filmmaker). Override with ASSETS_DIR.
R = os.environ.get("ASSETS_DIR", os.path.expanduser("~/Documents/Nonfiction Hotlist/NFH 2025 SELECTED PROJECT ASSETS")).rstrip("/") + "/"
MEDIA = Path(__file__).with_name("media.json")
H = str(SITE) + "/"
N = " "
# key/hero: (file, focusY, mode) mode "cover" crops, "fit" letterboxes onto a blurred fill (for title art)
# stills: first item is shown last in the site gallery; the PDF shows items 2-3
SPEC = {
 "state-of-gambling": dict(key=("Austin Sokol_/Screenshot 2026-10-17 at 10.08.16"+N+"AM.png",.5,"cover"),
    hero=("Austin Sokol_/Screenshot 2026-10-17 at 10.08.16"+N+"AM.png",.45,"cover"),
    stills=["Austin Sokol_/Screenshot 2026-10-17 at 10.08.16"+N+"AM.png","Austin Sokol_/Screenshot 2026-10-17 at 10.07.58"+N+"AM.png","Austin Sokol_/Screenshot 2026-10-17 at 10.10.18"+N+"AM.png"]),
 "manhood": dict(key=("Rebecca Shaid_/horizontal-poster-1-1024x576.avif",.5,"fit"),
    hero=("Rebecca Shaid_/Still1.jpg",.5,"cover"),
    stills=["Rebecca Shaid_/horizontal-poster-1-1024x576.avif","Rebecca Shaid_/Still2.jpg","Rebecca Shaid_/MV5BODBkNTY5MzMtMDU3OC00YzkyLTliZTAtYjAyNjY3ZTFhNzRiXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"]),
 "aunties": dict(key=("Guo Guo_/AUF.png",.5,"cover"), hero=("Guo Guo_/AUF.png",.15,"cover"),
    stills=["Guo Guo_/AUF.png","Guo Guo_/Screenshot 2026-10-17 at 10.13.00"+N+"AM.png","Guo Guo_/Screenshot 2026-10-17 at 10.13.14"+N+"AM.png"]),
 "city-in-the-forest": dict(key=("Ike Rofe_/20260722_acitf_website_thumb_16x9_v2.webp",.5,"fit"),
    hero=("Ike Rofe_/acityintheforest_still_04_belkis.jpg",.4,"cover"),
    stills=["Ike Rofe_/acityintheforest_still_04_belkis.jpg","Ike Rofe_/image-w1280.webp","Ike Rofe_/images.jpeg"]),
 "screw-lucy": dict(key=("Mary Pilon_/209bcb5a-66cb-412e-a0c6-290732782bfc_1280x740.jpg",.4,"cover"),
    hero=("Mary Pilon_/209bcb5a-66cb-412e-a0c6-290732782bfc_1280x740.jpg",.4,"cover"),
    stills=["Mary Pilon_/dnd0902.jpg","Mary Pilon_/a7e6a2e4-ae2f-4e10-83cb-48988c7023c1_1280x728.jpg","Mary Pilon_/e548a130-2e9e-4f3b-8e01-7626424bc041_1280x711.jpg"]),
 "erins-law": dict(key=("Adam Schomer_/Erin-Merryn-110825-2-faf1ccf0fa3247c4abbc1eb0648d433c.jpg",.35,"cover"),
    hero=("Adam Schomer_/Erin-Merryn-110825-2-faf1ccf0fa3247c4abbc1eb0648d433c.jpg",0,"cover"),
    stills=["Adam Schomer_/Erin-Merryn-110825-2-faf1ccf0fa3247c4abbc1eb0648d433c.jpg","Adam Schomer_/MV5BNGJkYWU4NTYtMTlmMS00MGRkLTk2OTUtYmJlZTJiMzQ0ZTQ3XkEyXkFqcGc@._V1_.jpg"]),
 "lift-off": dict(key=("Lift Off_/images.jpeg",.5,"cover"), hero=("Lift Off_/Untitled_Page_4.webp",.45,"cover"),
    stills=["Lift Off_/images.jpeg","Lift Off_/Untitled_Page_4.webp","Lift Off_/Untitled_Page_7.webp"]),
}

def trim_edges(im):
    """Remove flat white or black bars left over from screenshots and exports."""
    import numpy as np
    a = np.asarray(im.convert("L")).astype(int)
    H0, W0 = a.shape
    def flat(line): return (line.std() < 6 and line.mean() > 225) or (line.std() < 1.5 and line.mean() < 2)
    t, b, l, r = 0, H0, 0, W0
    while t < b - 10 and flat(a[t, l:r]): t += 1
    while b > t + 10 and flat(a[b - 1, l:r]): b -= 1
    while l < r - 10 and flat(a[t:b, l]): l += 1
    while r > l + 10 and flat(a[t:b, r - 1]): r -= 1
    pad = 2  # clear the anti-aliased row next to a bar
    t += pad if t else 0; l += pad if l else 0
    b -= pad if b < H0 else 0; r -= pad if r < W0 else 0
    return im.crop((l, t, r, b)) if (t, b, l, r) != (0, H0, 0, W0) else im

def load(f):
    p = R + f
    if not os.path.exists(p): p = p.replace(N, " ")
    return trim_edges(ImageOps.exif_transpose(Image.open(p)).convert("RGB"))
def cover(im, ratio, fy):
    w, h = im.size
    if w / h > ratio:
        nw = int(h * ratio); x = (w - nw) // 2; return im.crop((x, 0, x + nw, h))
    nh = int(w / ratio); y = max(0, min(h - nh, int((h - nh) * fy))); return im.crop((0, y, w, y + nh))
def fit(im, ratio, W):
    Hh = int(W / ratio)
    bg = cover(im, ratio, .5).resize((W, Hh), Image.LANCZOS).filter(ImageFilter.GaussianBlur(40))
    bg = Image.blend(bg, Image.new("RGB", bg.size, (34, 56, 44)), 0.35)
    fg = im.copy(); fg.thumbnail((W, Hh), Image.LANCZOS)
    bg.paste(fg, ((W - fg.size[0]) // 2, (Hh - fg.size[1]) // 2)); return bg
def make(src, ratio, box, out, q):
    f, fy, mode = src; im = load(f)
    if mode == "fit": r = fit(im, ratio, box[0])
    else: r = cover(im, ratio, fy); r.thumbnail(box, Image.LANCZOS)
    r.save(H + out, quality=q, optimize=True, progressive=True); return out
media = json.load(open(MEDIA))
for slug, sp in SPEC.items():
    for old in [x for x in os.listdir(H + "img") if x.startswith(slug + "-")]: os.remove(H + "img/" + old)
    d = {"key": make(sp["key"], 3/2, (960, 640), f"img/{slug}-key.jpg", 76),
         "hero": make(sp["hero"], 21/9, (1800, 772), f"img/{slug}-hero.jpg", 74), "stills": []}
    for i, f in enumerate(sp["stills"]):
        im = load(f); w, h = im.size
        if h > w:  # portrait posters sit on a blurred 3:2 field so they read in the gallery
            im = fit(im, 3/2, 1400)
        else: im.thumbnail((1400, 1400), Image.LANCZOS)
        n = f"img/{slug}-{i+1}.jpg"; im.save(H + n, quality=76, optimize=True, progressive=True)
        d["stills"].append([n, im.size[0], im.size[1]])
    d["focus"] = {"screw-lucy": 68, "city-in-the-forest": 58, "erins-law": 40}.get(slug, 50)
    d["focusY"] = {"erins-law": 0}.get(slug, 50)
    media[slug] = d
json.dump(media, open(MEDIA, "w"), indent=1)
print("ok", len(media))
