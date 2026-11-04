"""Consistent photo pipeline: one gentle, uniform grade + responsive sizes.

For every photograph used as a project, theme, hero or campaign image:
  * even out exposure (soft auto-levels, blended — never clipped or stylised)
  * neutralise colour casts (partial grey-world white balance)
  * nudge saturation toward a shared target so dim and vivid photos sit together
  * emit 800w and 1600w WebP derivatives for srcset

Output: src/assets/img/photos/<stem>-800.webp, <stem>-1600.webp
Usage:  python scripts/photos.py [--force]
"""
import json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "src" / "assets" / "img"
OUT = IMG / "photos"
WIDTHS = (800, 1600)
MAP = json.loads((ROOT / "scripts" / "image-map.json").read_text(encoding="utf-8"))


def local(name: str) -> str:
    name = "https:" + name if name.startswith("//") else name
    return MAP.get(name, name)


def collect() -> list[str]:
    names: set[str] = set()
    for f in (ROOT / "src" / "projects").glob("*.md"):
        m = re.search(r'^hero: "([^"]+)"', f.read_text(encoding="utf-8"), re.M)
        if m:
            names.add(local(m.group(1)))
    for f in (ROOT / "src" / "themes").glob("*.md"):
        names |= set(re.findall(r"^image2?: (\S+)", f.read_text(encoding="utf-8"), re.M))
    decade = json.loads((ROOT / "src" / "_data" / "decade.json").read_text(encoding="utf-8"))
    names |= {x["image"] for x in decade["milestones"] + decade["focus"]}
    names |= {"g8a5473-scaled.webp", "flood-photo-1.webp", "flood-photo-2.webp", "flood-photo-3.webp",
              "strategy-2030-pphf.webp", "strategy-2030-crop.webp", "blog-and-news-photo.webp", "blog-and-news-1.webp", "blog-and-news-3.webp",
              "maternal-child-adolescent-health-1.webp", "z.webp", "xz.webp", "zxc.webp"}
    return sorted(n for n in names if (IMG / n).exists())


def grade(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    # 1. Soft auto-levels: 50% blend with a 0.5%-cutoff autocontrast.
    im = Image.blend(im, ImageOps.autocontrast(im, cutoff=0.5), 0.5)
    # 2. Partial grey-world white balance (35%) to remove strong casts.
    a = np.asarray(im).astype(np.float32)
    means = a.reshape(-1, 3).mean(axis=0)
    gain = means.mean() / np.maximum(means, 1)
    gain = 1 + (gain - 1) * 0.35
    a = np.clip(a * gain, 0, 255)
    im = Image.fromarray(a.astype(np.uint8))
    # 3. Saturation toward a shared target (HSV S mean ~ 0.36), limited to +/-15%.
    s_mean = np.asarray(im.convert("HSV"))[..., 1].mean() / 255
    factor = float(np.clip(0.36 / max(s_mean, 0.05), 0.85, 1.15))
    im = ImageEnhance.Color(im).enhance(factor)
    return im


def main():
    force = "--force" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    names = collect()
    for n in names:
        stem = Path(n).stem
        if not force and all((OUT / f"{stem}-{w}.webp").exists() for w in WIDTHS):
            continue
        graded = grade(Image.open(IMG / n))
        for w in WIDTHS:
            im = graded if graded.width <= w else graded.resize((w, round(graded.height * w / graded.width)), Image.LANCZOS)
            im.save(OUT / f"{stem}-{w}.webp", "WEBP", quality=80, method=6)
    (ROOT / "scripts" / "photo-list.json").write_text(json.dumps(names, indent=1))
    print(len(names), "photos graded")


if __name__ == "__main__":
    main()
