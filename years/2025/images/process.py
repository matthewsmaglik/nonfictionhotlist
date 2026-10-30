"""Crop and compress project images: card key art (3:2), banner (21:9) and gallery stills.
Run before process_late.py, then apply_media.py."""
from PIL import Image, ImageOps
import os, json, sys
from pathlib import Path
REPO = Path(__file__).resolve().parents[3]
SITE = REPO / "site" / "2025"
# Folder of original assets (one subfolder per filmmaker). Override with ASSETS_DIR.
R = os.environ.get("ASSETS_DIR", os.path.expanduser("~/Documents/Nonfiction Hotlist/NFH 2025 SELECTED PROJECT ASSETS")).rstrip("/") + "/"
MEDIA = Path(__file__).with_name("media.json")
out = str(SITE / "img"); os.makedirs(out, exist_ok=True)
Z = "Zilla Barbosa_/Photos from 1.6.25/Screenshot 2025-12-28 at 4.3"
M = {  # slug: [(file, focusY)] first = key art
 "animated-mind": [("Dempsey Rice_/Animatd Mind Oliver with Patient.png",.5),("Dempsey Rice_/Screenshot 2025-03-03 at 3.09.13 PM.png".replace(" "," "),.5)],
 "arrival-center": [("Gregory Purpura_/240716 Yang_Roosevelt-16.jpg",.5),("Gregory Purpura_/240520_Yang_Migrant_Project_-_The_Roosevelt-18.jpg",.5),("Gregory Purpura_/240520_Yang_Migrant_Project_-_The_Roosevelt-3.jpg",.5)],
 "aunties": [("Guo Guo_/AUF.png",.5)],
 "daddy": [("Hannah Myers_/DADDY_still_nonfiction hotlist_2.jpg",.5),("Hannah Myers_/DADDY Still.jpg",.5)],
 "earth-to-michael": [("Dustin Nakao-Haider_/33a_sep2018_michaellopezalegria_live.jpg",.5),("Dustin Nakao-Haider_/image (1).jpg",.4),("Dustin Nakao-Haider_/image (5).jpg",.3)],
 "father-figures": [("Emma D. Miller_/Bruce and dummies_red curtain_8966.jpg",.5),("Emma D. Miller_/Emma and Bruce dummy heads_3145.jpg",.5)],
 "god-of-sight": [("Cole  Sax_/God of Sight Key Art.png",.5),("Cole  Sax_/Screenshot 2025-03-02 at 3.50.44 PM.png",.5)],
 "good-kids": [("Daniel Yonathan/2 A047_08132138_C164.braw.21_37_22_16.Still001.jpg",.5),("Daniel Yonathan/2 A055_09070713_C149.braw.07_21_01_00.Still001(1).jpg",.5)],
 "the-grind": [("Dan Chen_/THEGRIND_COVERIMAGE_v2.jpg",0),("Dan Chen_/THEGRIND_LeoStill.jpg",.5)],
 "making-the-line": [("Zilla Barbosa_/Making The Line_NFHL.png",.5),(Z+"0.57 PM.png",.5),(Z+"1.21 PM.png",.5)],
 "manhood": [("Rebecca Shaid_/Still1.jpg",.5),("Rebecca Shaid_/Still2.jpg",.5)],
 "movement": [("Diane Quon_/Diane Quon_OG/sean bankheaad 3.jpg",.05),("Diane Quon_/Sienna_Lalau_Photo Feb 24 2025, 9 29 18 PM.jpg",.4),("Diane Quon_/mandy-moore-2.jpg",.5)],
 "screw-lucy": [("Mary Pilon_/dnd0902.jpg",.4)],
 "talked-to-death": [("Josh Zeman_/TTD_HERO_20250304.jpg",.5),("Josh Zeman_/AlanBerg-20211203-0008.jpg",.5)],
 "thank-you-for-listening": [("Gene Gallerano_/JRW_Still_02.jpg",.5),("Gene Gallerano_/JRW_Still_03.jpg",.5)],
 "vestibule": [("Riley Hooper_/Vestibule2.jpeg",0),("Riley Hooper_/Vestibule1.jpeg",.5)],
 "walk-with-me": [("Renee Muza_/Cino Thurman.jpg",.24),("Renee Muza_/Cino Frank.jpg",.35)],
 "whale-like-me": [("Malcolm Wright_/WLM_statues_02_1.34.1_1.1.1_1.1.1.jpg",.5),("Malcolm Wright_/unnamed.jpg",.5)],
 "when-we-all-get-to-heaven": [("Ariana Nedelman_/Ariana Nedelman_/2.jpg",.5),("Ariana Nedelman_/Ariana Nedelman_/1.jpg",.5),("Ariana Nedelman_/Ariana Nedelman_/4.jpg",.5)],
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

# Banner (21:9) vertical focus where it differs from the card crop
HERO_FY = {"vestibule": 0, "walk-with-me": .42, "thank-you-for-listening": .1, "aunties": .15, "movement": .02}
# Horizontal focus for narrower views of the banner (phones, PDF), as a CSS object-position x
FOCUS_X = {"animated-mind": 65, "daddy": 22, "movement": 30, "making-the-line": 38, "vestibule": 45, "screw-lucy": 68}

def crop(im, ratio, fy):
    w,h = im.size
    if w/h > ratio:
        nw = int(h*ratio); x=(w-nw)//2; return im.crop((x,0,x+nw,h))
    nh = int(w/ratio); y=int((h-nh)*fy); y=max(0,min(h-nh,y)); return im.crop((0,y,w,y+nh))
res = {}; total=0
for slug, items in M.items():
    res[slug] = {"key": "", "stills": []}
    for i,(f,fy) in enumerate(items):
        p = R+f
        if not os.path.exists(p): p = R+f.replace(" "," ")
        im = trim_edges(ImageOps.exif_transpose(Image.open(p)).convert("RGB"))
        if i == 0:
            k = crop(im, 3/2, fy); k.thumbnail((960,640), Image.LANCZOS)
            n=f"img/{slug}-key.jpg"; k.save(str(SITE / n), quality=74, optimize=True, progressive=True)
            res[slug]["key"]=n; total+=os.path.getsize(str(SITE / n))
            h = crop(im, 21/9, HERO_FY.get(slug, fy)); h.thumbnail((1800,772), Image.LANCZOS)
            n=f"img/{slug}-hero.jpg"; h.save(str(SITE / n), quality=72, optimize=True, progressive=True)
            res[slug]["hero"]=n; total+=os.path.getsize(str(SITE / n))
        s = im.copy(); s.thumbnail((1400,1400), Image.LANCZOS)
        n=f"img/{slug}-{i+1}.jpg"; s.save(str(SITE / n), quality=74, optimize=True, progressive=True)
        res[slug]["stills"].append([n, s.size[0], s.size[1]]); total+=os.path.getsize(str(SITE / n))
FOCUS_Y = {"vestibule": 0, "erins-law": 0}  # vertical anchor when a view crops the banner further
for k in res: res[k]["focus"] = FOCUS_X.get(k, 50); res[k]["focusY"] = FOCUS_Y.get(k, 50)
json.dump(res, open(MEDIA, "w"), indent=1)
print(len(os.listdir(out)), "files", round(total/1e6,2), "MB")
