"""Normalise every portrait on the site into one consistent system.

For each source photo: remove the background (rembg, BiRefNet), find the head from the
alpha matte, then place the subject on a transparent 800x800 canvas so that every head has
the same width and sits at the same height. The page supplies one shared backdrop in CSS.

Output: src/assets/img/portraits/<source-stem>.webp  (WebP with alpha)
Usage:  python scripts/portraits.py            (skips files already done)
        python scripts/portraits.py --force
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "src" / "assets" / "img"
OUT = IMG / "portraits"
SIZE = 800
HEAD_W = 0.30      # head width as a share of the canvas
HEAD_TOP = 0.14    # head top as a share of the canvas height


def head_metrics(alpha: np.ndarray):
    mask = alpha > 128
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    top, bottom = rows[0], rows[-1]
    h = bottom - top + 1
    # The head occupies roughly the first sixth of a head-and-shoulders silhouette.
    band = mask[top + int(h * 0.06): top + max(int(h * 0.20), int(h * 0.06) + 2)]
    widths = band.sum(axis=1)
    head_w = float(np.median(widths[widths > 0])) if (widths > 0).any() else float(cols[-1] - cols[0])
    ys, xs = np.nonzero(band)
    cx = float(xs.mean()) if len(xs) else float((cols[0] + cols[-1]) / 2)
    return top, bottom, head_w, cx


def normalise(src: Path, session) -> Image.Image:
    im = Image.open(src).convert("RGB")
    if max(im.size) < 700:  # upscale small sources before matting for cleaner edges
        k = 700 / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    cut = remove(im, session=session, post_process_mask=True)
    alpha = np.array(cut.getchannel("A"))
    top, bottom, head_w, cx = head_metrics(alpha)
    scale = (SIZE * HEAD_W) / head_w
    # If the source silhouette is cut off at the bottom edge, make sure that edge lands
    # below the canvas so no subject ends mid-frame.
    touches_bottom = (alpha[-3:] > 128).any()
    if touches_bottom:
        needed = (SIZE - SIZE * HEAD_TOP) / max(1, (cut.height - top))
        scale = max(scale, needed * 1.01)
    scaled = cut.resize((round(cut.width * scale), round(cut.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    x = round(SIZE / 2 - cx * scale)
    y = round(SIZE * HEAD_TOP - top * scale)
    canvas.alpha_composite(scaled, (x, y)) if x >= 0 and y >= 0 else canvas.paste(scaled, (x, y), scaled)
    # Soften the matte edge a touch so cut-outs sit naturally on the backdrop.
    a = canvas.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    canvas.putalpha(a)
    return canvas


def main():
    force = "--force" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    files = json.loads((ROOT / "scripts" / "_portraits.json").read_text())
    session = new_session("birefnet-general-lite")
    for name in files:
        dst = OUT / (Path(name).stem + ".webp")
        if dst.exists() and not force:
            continue
        try:
            normalise(IMG / name, session).save(dst, "WEBP", quality=86, method=6)
            print("ok  ", name)
        except Exception as e:  # noqa: BLE001
            print("FAIL", name, e)


if __name__ == "__main__":
    main()
