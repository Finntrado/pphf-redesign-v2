"""Small WebP thumbnails (400px wide) for publication / report covers shown in card grids.

Reads covers from src/_data/publications.json and reports.json, writes
src/assets/img/covers/<stem>-240|400.webp. Templates use {{ cover | cover }} which falls
back to the original image when no thumbnail exists.  Usage: python scripts/covers.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "src" / "assets" / "img"
OUT = IMG / "covers"
MAP = json.loads((ROOT / "scripts" / "image-map.json").read_text(encoding="utf-8"))
W = 400

def local(u: str) -> str:
    u = "https:" + u if u.startswith("//") else u
    return MAP.get(u, u)

covers = [p["cover"] for p in json.loads((ROOT / "src/_data/publications.json").read_text())]
rep = json.loads((ROOT / "src/_data/reports.json").read_text())
covers += [r["cover"] for k in ("annual", "program") for r in rep.get(k, []) if r.get("cover")]
OUT.mkdir(exist_ok=True)
for c in dict.fromkeys(covers):
    name = local(c)
    src = IMG / name
    if not src.exists():
        print("missing", c); continue
    base = Image.open(src).convert("RGB")
    for tw in (240, W):
        w, h = base.size
        im = base.resize((tw, round(h * tw / w)), Image.LANCZOS) if w > tw else base
        dest = OUT / (Path(name).stem + f"-{tw}.webp")
        im.save(dest, "WEBP", quality=75, method=6)
    print(dest.name, im.size)

# ---- YouTube poster frames, self-hosted (long cache, sized, WebP): src/assets/img/yt/<id>-320|640.webp
import io
import requests
YT = IMG / "yt"
YT.mkdir(exist_ok=True)
for v in json.loads((ROOT / "src/_data/videos.json").read_text()):
    vid = v["id"]
    if (YT / f"{vid}-640.webp").exists():
        continue
    for q in ("maxresdefault", "sddefault", "hqdefault"):
        r = requests.get(f"https://i.ytimg.com/vi/{vid}/{q}.jpg", timeout=30)
        if r.ok and len(r.content) > 2000:
            break
    im = Image.open(io.BytesIO(r.content)).convert("RGB")
    w, h = im.size
    th = round(w * 9 / 16)  # crop letterboxing to 16:9
    im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
    for tw in (320, 640):
        im.resize((tw, round(tw * 9 / 16)), Image.LANCZOS).save(YT / f"{vid}-{tw}.webp", "WEBP", quality=72, method=6)
    print("yt", vid, q)
