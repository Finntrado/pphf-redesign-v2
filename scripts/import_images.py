"""Download and optimise every image used by the Phase-1 static pages.

Reads image URLs from ../_source/text/*.md (scraped copy of the live site),
saves optimised files into src/assets/img/ and writes scripts/image-map.json
mapping original URL -> local filename. Re-runnable: existing files are skipped.

Usage:  python scripts/import_images.py
"""
import io, json, re, sys, time
from pathlib import Path
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_TEXT = ROOT.parent / "_source" / "text"
OUT = ROOT / "src" / "assets" / "img"
MAP = ROOT / "scripts" / "image-map.json"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"}
MAX_W = 1600

# Pages whose content moves to WordPress in Phase 2 — their images aren't needed.
SKIP_PAGES = {"gallery", "images-2", "press", "events", "vacancies", "request-for-proposal", "blogs-and-news"}

EXTRA = [
    "https://pphfglobal.org/wp-content/uploads/cropped-PPHF-registered-logo.png",
    "https://pphfglobal.org/wp-content/uploads/PPHF-Logo.png",
    "https://pphfglobal.org/wp-content/uploads/PPHF-10-Year-logo_on-Black-White-BG.png",
    "https://pphfglobal.org/wp-content/uploads/2022/12/Screenshot-2023-10-03-at-4.47.08-PM.png",
    "https://pphfglobal.org/wp-content/uploads/2022/12/Screenshot-2023-10-03-at-4.46.58-PM.png",
    "https://pphfglobal.org/wp-content/uploads/2022/12/Screenshot-2023-10-03-at-4.47.15-PM.png",
    "https://pphfglobal.org/wp-content/uploads/FITECH-SOLUTION.webp",
    # In Focus (homepage) full-size thumbnails
    "https://pphfglobal.org/wp-content/uploads/Blog-and-News-Photo.jpeg",
    "https://pphfglobal.org/wp-content/uploads/Blog-and-News-1.jpeg",
    "https://pphfglobal.org/wp-content/uploads/Blog-and-News-3.webp",
]


def norm(u: str) -> str:
    u = u.strip()
    if u.startswith("//"):
        u = "https:" + u
    return u


def collect() -> list[str]:
    urls = []
    for f in sorted(SRC_TEXT.glob("*.md")):
        if f.stem in SKIP_PAGES:
            continue
        for m in re.finditer(r"\[(?:IMG|BG) (\S+)", f.read_text(encoding="utf-8")):
            u = norm(m.group(1))
            if "pphfglobal.org" in u and re.search(r"\.(png|jpe?g|webp|gif)$", u, re.I):
                urls.append(u)
    urls += EXTRA
    return list(dict.fromkeys(urls))


def local_name(url: str, taken: set[str], ext: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", Path(url).stem.lower()).strip("-")[:80] or "image"
    name, i = f"{base}.{ext}", 2
    while name in taken:
        name, i = f"{base}-{i}.{ext}", i + 1
    return name


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    mapping = json.loads(MAP.read_text()) if MAP.exists() else {}
    taken = set(mapping.values())
    urls = collect()
    ok = fail = 0
    for url in urls:
        if url in mapping and (OUT / mapping[url]).exists():
            ok += 1
            continue
        try:
            r = requests.get(url, headers=UA, timeout=60)
            r.raise_for_status()
            im = Image.open(io.BytesIO(r.content))
            im.load()
            has_alpha = im.mode in ("RGBA", "LA", "P") and (
                "transparency" in im.info or im.mode in ("RGBA", "LA"))
            if has_alpha:
                im = im.convert("RGBA")
                # Treat fully-opaque alpha as no alpha.
                if im.getchannel("A").getextrema() == (255, 255):
                    has_alpha = False
            if im.width > MAX_W:
                im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
            if has_alpha:
                name = local_name(url, taken, "png")
                im.save(OUT / name, "PNG", optimize=True)
            else:
                name = local_name(url, taken, "webp")
                im.convert("RGB").save(OUT / name, "WEBP", quality=82, method=6)
            taken.add(name)
            mapping[url] = name
            ok += 1
        except Exception as e:  # noqa: BLE001 — report and continue
            fail += 1
            print(f"FAIL {url}: {e}", file=sys.stderr)
        time.sleep(0.05)
    MAP.write_text(json.dumps(mapping, indent=1, ensure_ascii=False))
    print(f"{ok} ok, {fail} failed, {len(urls)} total")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
