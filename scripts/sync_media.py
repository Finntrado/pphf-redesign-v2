"""Sync the Media / Opportunities content from WordPress into static JSON.

WordPress stays the CMS for dated content. This script pulls it through the
public REST API and writes a clean snapshot the Eleventy build renders with the
shared media templates (src/_includes/layouts/media-item.njk):

  data/media/posts.json      Blog & News, Press and Events posts
  data/media/rfps.json       RFP / RFQ / EOI notices (pages linked from /request-for-proposal/)
  data/media/vacancies.json  Open positions (accordion on /vacancies)
  data/media/gallery.json    Photo gallery albums (/images-2/)

Images are downloaded once and converted to WebP in two widths
(src/assets/img/media/<name>-400|720|1280.webp) so every card and hero is
sized, modern-format and served from this site.

HTML is sanitised to plain semantic markup: page-builder wrappers, inline
styles, classes, scripts and embedded <style> blocks are removed.

Usage:
  python scripts/sync_media.py            # full sync (re-uses images already downloaded)
  python scripts/sync_media.py --no-images
Editor-maintained fields (vacancy dates/status, RFP deadlines) live in
data/media/overrides.json and are never overwritten.
"""
from __future__ import annotations

import html as htmllib
import io
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Comment, NavigableString, Tag
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "media"
IMG = ROOT / "src" / "assets" / "img" / "media"
WP = "https://pphfglobal.org"
API = WP + "/wp-json/wp/v2"
UA = {"User-Agent": "PPHF-static-sync/1.0 (+https://pphfglobal.org)"}
WIDTHS = (400, 720, 1280)
CAT = {"blog": 15, "press": 16, "events": 11}
NO_IMAGES = "--no-images" in sys.argv

session = requests.Session()
session.headers.update(UA)


# ---------------------------------------------------------------- fetching
def get(url: str, **params):
    for attempt in range(4):
        try:
            r = session.get(url, params=params, timeout=40)
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            code = getattr(e.response, "status_code", 0) or 0
            if attempt == 3 or 400 <= code < 500:
                raise
            print(f"  retry {url}: {e}")
            time.sleep(2 ** attempt)


def get_all(endpoint: str, **params) -> list[dict]:
    out, page = [], 1
    while True:
        r = get(f"{API}/{endpoint}", per_page=100, page=page, **params)
        out += r.json()
        if page >= int(r.headers.get("X-WP-TotalPages", 1)):
            return out
        page += 1


# ---------------------------------------------------------------- images
def slugify(s: str, n: int = 80) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:n].strip("-") or "item"


def full_size(url: str) -> str:
    """WordPress thumbnails end in -300x200.jpg; the original drops the suffix."""
    return re.sub(r"-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp|gif)$)", "", url, flags=re.I)


_img_cache: dict[str, dict | None] = {}
INDEX_FILE = DATA / "images.json"
INDEX: dict[str, dict] = json.loads(INDEX_FILE.read_text()) if INDEX_FILE.exists() else {}


def local_image(url: str | None, alt: str = "") -> dict | None:
    """Download url once, emit 720/1280 WebP, return {stem, w, h, alt}."""
    if not url:
        return None
    url = url.replace("http://", "https://")
    if url.startswith("/"):
        url = WP + url
    if url in _img_cache:
        c = _img_cache[url]
        return dict(c, alt=alt or c["alt"]) if c else None
    stem = slugify(Path(url.split("?")[0]).stem)
    if stem in INDEX and (IMG / f"{stem}-{WIDTHS[0]}.webp").exists():
        info = INDEX[stem]
    elif NO_IMAGES:
        _img_cache[url] = None
        return None
    else:
        try:
            im = Image.open(io.BytesIO(get(url).content))
        except Exception as e:  # noqa: BLE001 — broken media library item
            print(f"  ! image {url}: {e}")
            _img_cache[url] = None
            return None
        im = im.convert("RGB")
        w, h = im.size
        IMG.mkdir(parents=True, exist_ok=True)
        made = []
        for tw in WIDTHS:
            if tw > w and made:
                continue
            tw2 = min(tw, w)
            th = round(h * tw2 / w)
            im.resize((tw2, th), Image.LANCZOS).save(IMG / f"{stem}-{tw}.webp", "WEBP", quality=72, method=6)
            made.append(tw)
        info = {"stem": stem, "w": min(w, WIDTHS[-1]), "h": round(h * min(w, WIDTHS[-1]) / w), "sizes": made}
        INDEX[stem] = info
    out = dict(info, alt=alt)
    _img_cache[url] = info
    return out


# ---------------------------------------------------------------- HTML cleaning
KEEP = {"p", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "strong", "em", "b", "i", "u", "sup", "sub",
        "blockquote", "figure", "figcaption", "img", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
        "br", "hr", "address", "code", "pre", "dl", "dt", "dd", "caption"}
DROP = {"script", "style", "noscript", "link", "meta", "title", "head", "svg", "form", "input", "button",
        "select", "textarea", "label", "nav", "iframe", "video", "audio", "source", "object", "embed"}
ATTRS = {"a": {"href"}, "img": {"src", "alt"}, "th": {"colspan", "rowspan", "scope"},
         "td": {"colspan", "rowspan"}, "ol": {"start"}}


def internal_href(href: str, local_slugs: set[str]) -> str:
    m = re.match(r"^https?://(?:www\.)?pphfglobal\.org(/[^?#]*)?(.*)$", href)
    if not m:
        return href
    path = (m.group(1) or "/").rstrip("/")
    slug = path.strip("/")
    if slug in local_slugs:
        return f"/{slug}/{m.group(2)}"
    return href.replace("http://", "https://")


def clean_html(raw: str, local_slugs: set[str] = frozenset(), youtube: list | None = None) -> str:
    raw = re.sub(r"(<br\s*/?>\s*(?:</span>\s*)?(?:<span[^>]*>\s*)?){2,}", "</p><p>", raw or "")
    soup = BeautifulSoup(raw, "html.parser")
    for c in soup.find_all(string=lambda t: isinstance(t, Comment)):
        c.extract()
    for t in soup.find_all("iframe"):
        m = re.search(r"(?:youtube(?:-nocookie)?\.com/embed/|youtu\.be/)([A-Za-z0-9_-]{11})", t.get("src", ""))
        if m and youtube is not None:
            youtube.append(m.group(1))
    for t in soup.find_all(DROP):
        t.decompose()
    for t in soup.find_all("h1"):
        t.name = "h2"
    for t in list(soup.find_all(True)):
        if t.name not in KEEP:
            t.unwrap()
            continue
        allowed = ATTRS.get(t.name, set())
        t.attrs = {k: v for k, v in t.attrs.items() if k in allowed}
    for a in soup.find_all("a"):
        href = (a.get("href") or "").strip()
        if not href or href.startswith(("javascript:", "#")) and len(href) < 2:
            a.unwrap()
            continue
        a["href"] = internal_href(href, local_slugs)
        if a["href"].startswith("http") and "pphfglobal.org" not in a["href"]:
            a["rel"] = "noopener"
    for img in soup.find_all("img"):
        src = img.get("src") or ""
        if not src or src.startswith("data:"):
            img.decompose()
            continue
        li = local_image(full_size(src), img.get("alt", ""))
        if not li:
            img.decompose()
            continue
        img.attrs = {"data-media": li["stem"], "alt": img.get("alt", "")}
    # Empty / whitespace-only blocks
    for _ in range(3):
        for t in soup.find_all(["p", "li", "strong", "em", "b", "i", "h2", "h3", "h4", "h5", "h6", "blockquote", "figure"]):
            if not t.get_text(strip=True) and not t.find("img"):
                t.decompose()
    out = str(soup)
    out = re.sub(r"<p>\s*(<br\s*/?>\s*)+", "<p>", out)
    out = re.sub(r"(<br\s*/?>\s*)+</p>", "</p>", out)
    out = re.sub(r" ", " ", out)
    out = re.sub(r"[ \t]{2,}", " ", out)
    out = re.sub(r"\n\s*\n+", "\n", out).strip()
    # Loose inline text at the top level → paragraphs
    soup = BeautifulSoup(out, "html.parser")
    block = {"p", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "figure", "table", "hr", "address", "pre", "dl"}
    run: list = []
    def flush():
        if run and "".join(str(x) for x in run).strip():
            p = soup.new_tag("p")
            run[0].insert_before(p)
            for x in run:
                p.append(x.extract())
        run.clear()
    for node in list(soup.contents):
        if isinstance(node, Tag) and node.name in block:
            flush()
        elif isinstance(node, Tag) and node.name == "br":
            flush(); node.decompose()
        else:
            run.append(node)
    flush()
    for t in soup.find_all("table"):
        wrap = soup.new_tag("div", attrs={"class": "table-wrap"})
        t.wrap(wrap)
    return str(soup).strip()


def text_of(raw: str) -> str:
    t = BeautifulSoup(raw or "", "html.parser").get_text(" ")
    t = htmllib.unescape(re.sub(r"\s+", " ", t)).strip()
    return re.sub(r"\s*(\[…\]|\[&hellip;\]|\[\.\.\.\]|…)$", "…", t)


def summary(text: str, n: int = 158) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= n:
        return text
    cut = text[:n].rsplit(" ", 1)[0].rstrip(",;:—-")
    return cut + "…"


def read_minutes(html: str) -> int:
    return max(1, round(len(text_of(html).split()) / 220))


# ---------------------------------------------------------------- posts
def sync_posts() -> list[dict]:
    cats = {c["id"]: c for c in get_all("categories")}
    raw = {}
    for name, cid in CAT.items():
        for p in get_all("posts", categories=cid, _embed="wp:featuredmedia"):
            raw[p["id"]] = p
    print(f"posts: {len(raw)}")
    slugs = {p["slug"] for p in raw.values()}
    out = []
    for p in sorted(raw.values(), key=lambda x: x["date"], reverse=True):
        ids = set(p["categories"])
        kinds = [k for k, cid in CAT.items() if cid in ids]
        kind = "event" if "events" in kinds else ("press" if kinds == ["press"] else "news")
        fm = (p.get("_embedded", {}).get("wp:featuredmedia") or [{}])[0]
        title = htmllib.unescape(BeautifulSoup(p["title"]["rendered"], "html.parser").get_text()).strip()
        yt: list[str] = []
        body = clean_html(p["content"]["rendered"], slugs, yt)
        exc = text_of(p["excerpt"]["rendered"]) or text_of(body)
        image = local_image(fm.get("source_url"), fm.get("alt_text") or title) if fm.get("source_url") else None
        if not image:  # fall back to the first image in the body
            m = re.search(r'data-media="([^"]+)"', body)
            if m:
                image = dict(INDEX[m.group(1)], alt=title)
        topics = [htmllib.unescape(cats[c]["name"]) for c in p["categories"]
                  if c in cats and c not in CAT.values() and cats[c]["slug"] not in ("uncategorized", "test")]
        out.append({
            "id": p["id"], "slug": p["slug"], "kind": kind, "channels": kinds,
            "title": title, "date": p["date"], "modified": p["modified"],
            "excerpt": summary(exc, 240), "description": summary(exc),
            "image": image, "topics": topics, "youtube": yt,
            "readMinutes": read_minutes(body), "html": body,
        })
    return out


# ---------------------------------------------------------------- RFPs
REF = re.compile(r"\b((?:PPHF|RFP|RFQ)(?:/(?:RFQ|RFP|EOI|Media))?/(?:\d{3,4}|Media)(?:/\d{2}-\d{2})?(?:/\d{1,3}(?!\d))?)", re.I)
DATE_PAT = r"(\d{1,2}(?:st|nd|rd|th)?[\s.\-/]+(?:[A-Za-z]{3,9}|\d{1,2})[\s.,\-/]+\d{4})"
DEADLINE = re.compile(r"(?:last\s+date|deadline|due\s+date|closing\s+date|submission\s+(?:date|deadline)|submitted\s+(?:on\s+or\s+)?(?:before|by))[^0-9]{0,60}" + DATE_PAT, re.I)


def parse_date(s: str) -> str | None:
    s = re.sub(r"(\d)(st|nd|rd|th)", r"\1", s).replace(",", " ")
    s = re.sub(r"[\s.\-/]+", " ", s).strip()
    s = re.sub(r"\bSept\b", "Sep", s, flags=re.I)
    for fmt in ("%d %B %Y", "%d %b %Y", "%B %d %Y", "%b %d %Y", "%d %m %Y", "%m %d %Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def rfp_category(title: str) -> str:
    t = title.lower()
    if "expression of interest" in t or re.search(r"\beoi\b", t):
        return "EOI"
    if "request for applications" in t or re.search(r"\brfa\b", t):
        return "RFA"
    if "terms of reference" in t or "scope of work" in t or "assessment" in t or "film" in t or "video" in t or "jingle" in t:
        return "Consultancy"
    if re.search(r"\brfq\b|purchase|procurement|supply|equipment|kit", t):
        return "Procurement"
    if re.search(r"renovation|civil|construction|repair|installation|toilet|hall|station|strengthening", t):
        return "Works"
    return "RFP"


def sync_rfps(post_slugs: set[str]) -> list[dict]:
    page = get(f"{API}/pages", slug="request-for-proposal").json()[0]
    soup = BeautifulSoup(page["content"]["rendered"], "html.parser")
    links = []
    for h in soup.find_all(["h2", "h3", "h4"]):
        a = h.find("a", href=True)
        if a and "pphfglobal.org/" in a["href"]:
            slug = a["href"].rstrip("/").split("/")[-1]
            if slug and slug not in [x for x, _, _ in links]:
                links.append((slug, h.get_text(" ", strip=True), a["href"]))
    print(f"rfps: {len(links)}")
    out = []
    for slug, listed, href in links:
        if re.search(r"\.pdf$", slug, re.I):  # notice published as a bare PDF
            t = re.sub(r"\s+", " ", listed)
            ref = REF.search(t)
            out.append({"id": None, "slug": slugify(Path(slug).stem, 90), "title": t, "ref": re.sub(r"\s+", "", ref.group(1)).upper() if ref else None,
                        "category": rfp_category(t), "date": None, "modified": None, "deadline": None,
                        "description": f"{t}. Download the notice for scope, eligibility and submission details.",
                        "docs": [{"title": "Notice (PDF)", "href": href}], "contact": "procurement@pphfglobal.org", "html": ""})
            continue
        res = get(f"{API}/pages", slug=slug, _fields="id,slug,date,modified,title,content").json() \
            or get(f"{API}/posts", slug=slug, _fields="id,slug,date,modified,title,content").json()
        if not res:
            print(f"  ! rfp page missing: {slug}")
            continue
        p = res[0]
        raw = p["content"]["rendered"]
        body = clean_html(raw, post_slugs)
        text = text_of(raw)
        title = htmllib.unescape(BeautifulSoup(p["title"]["rendered"], "html.parser").get_text()).strip()
        ref = REF.search(title) or REF.search(listed) or REF.search(text[:400])
        dl = DEADLINE.search(text)
        docs = []
        for a in BeautifulSoup(raw, "html.parser").find_all("a", href=True):
            if re.search(r"\.(pdf|docx?|xlsx?|zip)(\?|$)", a["href"], re.I):
                docs.append({"title": a.get_text(" ", strip=True) or Path(a["href"]).name, "href": a["href"].replace("http://", "https://")})
        emails = sorted(set(re.findall(r"[\w.+-]+@pphfglobal\.org", text)))
        clean_title = re.sub(r"\s+", " ", title)
        out.append({
            "id": p["id"], "slug": p["slug"], "title": clean_title,
            "ref": re.sub(r"\s+", "", ref.group(1)).upper() if ref else None,
            "category": rfp_category(clean_title), "date": p["date"], "modified": p["modified"],
            "deadline": parse_date(dl.group(1)) if dl else None,
            "description": summary(re.sub(r"^.*?(?=Request for|REQUEST FOR|Expression of|EXPRESSION OF|Terms of|PPHF invites|People to People)", "", text, count=1) or text),
            "docs": list({d["href"]: d for d in docs}.values()), "contact": emails[0] if emails else "procurement@pphfglobal.org",
            "html": body,
        })
    return out


# ---------------------------------------------------------------- vacancies
MONTHS = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
ANY_DATE = rf"(\d{{1,2}}(?:st|nd|rd|th)?\s+{MONTHS},?\s+\d{{4}}|{MONTHS}\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}})"
APPLY_BY = [
    re.compile(rf"(?:last\s+date|deadline|closing\s+date|apply\s+(?:by|before)|on\s+or\s+before)[^.]{{0,80}}?{ANY_DATE}", re.I),
    re.compile(rf"(?:career|connect|hr)@pphfglobal\.org\s+(?:by|before|on\s+or\s+before)\s+{ANY_DATE}", re.I),
]
ROLLING = re.compile(r"open\s+till\s+we\s+receive|until\s+(?:the\s+position\s+is\s+)?filled|till\s+the\s+position\s+is\s+filled", re.I)


def apply_deadline(text: str) -> tuple[str | None, bool]:
    """Last date to apply, read from the job text → (ISO date or None, open-until-filled?)."""
    for pat in APPLY_BY:
        m = pat.search(text)
        if m:
            d = parse_date(m.group(1))
            if d:
                return d, False
    return None, bool(ROLLING.search(text))


def intro_of(text: str) -> str:
    """Skip the boilerplate 'About PPHF / Background' paragraph of a job description."""
    m = re.search(r"(?:Role Overview|Job Summary|Position Summary|Purpose of the (?:Role|Position)|Job Purpose|Role Summary|Job Description|Scope of Work|The Role|Position Overview)\s*:?\s*(.+)", text, re.I)
    if m:
        return m.group(1)
    m = re.search(r"(?:Key )?Responsibilities\s*:?\s*(.+)", text, re.I)
    return f"Responsibilities: {m.group(1)}" if m else text

def sync_vacancies() -> list[dict]:
    page = get(f"{API}/pages", slug="vacancies").json()[0]
    soup = BeautifulSoup(page["content"]["rendered"], "html.parser")
    out, seen = [], set()
    for item in soup.select(".elementor-accordion-item"):
        t = item.select_one(".elementor-accordion-title")
        body = item.select_one(".elementor-tab-content")
        if not t or not body:
            continue
        lines = [x.strip() for x in t.get_text("\n").split("\n") if x.strip()]
        head = re.sub(r"\s+", " ", lines[0]) if lines else ""
        rest = " ".join(lines[1:])
        m = re.match(r"^(.*?)\s*Location\s*:\s*(.*)$", " ".join(lines), re.I)
        if m:
            role, loc = m.group(1).strip(" -–"), m.group(2).strip()
        else:
            role, loc = head, rest
        reports = None
        rm = re.search(r"Reports?\s+To\s*:\s*(.*)$", loc, re.I)
        if rm:
            reports, loc = rm.group(1).strip(), loc[: rm.start()].strip(" ,")
        positions = None
        pm = re.search(r"\(?(?:No\.? of positions\s*:\s*)?(\d+)\s*(?:positions?)?\)?", role + " " + loc, re.I)
        pm2 = re.search(r"No\.? of positions\s*:\s*(\d+)|\((\d+)\)|(\d+|Two|Three|Four)\s+Positions?", role + " " + loc, re.I)
        if pm2:
            positions = next(g for g in pm2.groups() if g)
            positions = {"two": "2", "three": "3", "four": "4"}.get(positions.lower(), positions)
        role = re.sub(r"\s*\((?:\d+|Three positions|Three Positions|No\.? of positions:\s*\d+)\)\s*", " ", role).strip()
        loc = re.sub(r"\(No\.? of positions\s*:\s*\d+\)", "", loc).strip(" ,.")
        if loc.count("(") > loc.count(")"):
            loc += ")"
        loc = re.sub(r"\s+", " ", loc).strip()
        html = clean_html(str(body))
        text = text_of(html)
        base = slugify(f"{role} {loc}", 70)
        slug, n = base, 2
        while slug in seen:
            slug, n = f"{base}-{n}", n + 1
        seen.add(slug)
        deadline, rolling = apply_deadline(text)
        emp = "Consultant" if re.search(r"consultant", role + text[:600], re.I) else "Full-time"
        out.append({
            "slug": slug, "title": role, "location": loc or "India", "positions": positions,
            "reportsTo": reports, "employment": emp,
            "deadline": deadline, "rolling": rolling,
            "description": summary(intro_of(text)),
            "html": html,
        })
    print(f"vacancies: {len(out)}")
    return out


# ---------------------------------------------------------------- gallery
def sync_gallery() -> list[dict]:
    page = get(f"{API}/pages", slug="images-2").json()[0]
    soup = BeautifulSoup(page["content"]["rendered"], "html.parser")
    albums: dict[str, dict] = {}
    for item in soup.select(".elementskit-single-portfolio-item"):
        img = item.find("img")
        lab = item.select_one(".elementskit-gallery-label")
        if not img:
            continue
        caption = re.sub(r"\s+", " ", lab.get_text(" ", strip=True)) if lab else "PPHF in the field"
        a = albums.setdefault(caption, {"title": caption, "slug": slugify(caption, 60), "photos": []})
        li = local_image(full_size(img["src"]), f"{caption} — photo {len(a['photos']) + 1}")
        if li:
            a["photos"].append(li)
    out = []
    for a in albums.values():
        m = re.search(r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)[ ,]+(\d{4})", a["title"])
        a["date"] = datetime.strptime(f"1 {m.group(1)[:3]} {m.group(2)}", "%d %b %Y").date().isoformat() if m else None
        a["subject"] = re.sub(r",?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ ,]+\d{4}\s*$", "", a["title"]).strip()
        out.append(a)
    print(f"gallery: {len(out)} albums, {sum(len(a['photos']) for a in out)} photos")
    return sorted(out, key=lambda a: a["date"] or "", reverse=True)


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    posts = sync_posts()
    slugs = {p["slug"] for p in posts}
    rfps = sync_rfps(slugs)
    vac = sync_vacancies()
    gal = sync_gallery()
    stamp = datetime.now().astimezone().isoformat(timespec="seconds")
    for name, data in (("posts", posts), ("rfps", rfps), ("vacancies", vac), ("gallery", gal)):
        (DATA / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    INDEX_FILE.write_text(json.dumps(dict(sorted(INDEX.items())), indent=0) + "\n")
    (DATA / "sync.json").write_text(json.dumps({"syncedAt": stamp, "source": WP}, indent=1) + "\n")
    ov = DATA / "overrides.json"
    if not ov.exists():
        ov.write_text(json.dumps({"_note": "Editor-maintained fields merged over the WordPress snapshot. Keyed by slug.",
                                  "vacancies": {}, "rfps": {}}, indent=1) + "\n")
    print("done", stamp)


if __name__ == "__main__":
    main()
