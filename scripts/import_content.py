"""Generate src/projects/*.md from the scraped project pages in ../_source/text.

One-off importer (re-runnable; overwrites). After import, the Markdown files are the
source of truth and can be edited by hand.

Usage:  python scripts/import_content.py
"""
import json, re, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEXT = ROOT.parent / "_source" / "text"
OUT = ROOT / "src" / "projects"
INDEX = json.loads((ROOT.parent / "_source" / "index.json").read_text())
IMAGE_MAP = json.loads((ROOT / "scripts" / "image-map.json").read_text())

# Permalink overrides (everything else: original path, lower-cased)
PERMALINK = {
    "mamatv": "/mamatv/",
    "samarth-project-kolkata": "/our-programs/samarth-project-kolkata/",
}
FACT_KEYS = {"geography": "geography", "reach": "reach", "outcomes": "outcomes", "expected outcomes": "outcomes"}


def norm(u):
    return "https:" + u if u.startswith("//") else u


def yq(s):
    """YAML-safe double-quoted scalar."""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def listing(fname, status):
    """Parse an Ongoing/Past listing page -> [(slug, title, summary, order)]."""
    t = (TEXT / fname).read_text(encoding="utf-8")
    items = []
    for m in re.finditer(r'^### ([^\n]+)\n\[LINK "(.*?)" => (\S+)\]', t, re.M | re.S):
        title, text, url = m.group(1).strip(), " ".join(m.group(2).split()), m.group(3)
        desc = text
        if desc.lower().startswith(title.lower()):
            desc = desc[len(title):]
        desc = re.sub(r"\s*Read more >\s*$", "", desc).strip()
        # resolve to a scraped slug
        slug = None
        for k, v in INDEX.items():
            if v["url"].rstrip("/").lower() == url.rstrip("/").lower() or v["final"].rstrip("/").lower() == url.rstrip("/").lower():
                slug = k
        if slug is None:
            last = urllib.parse.unquote(url.rstrip("/").split("/")[-1]).lower()
            slug = "mamatv" if "mamatv" in last else last
        items.append({"slug": slug, "title": title, "summary": desc, "status": status, "order": len(items) + 1})
    return items


def unwrap(lines):
    """Re-join lines that were hard-wrapped mid-sentence in the source (PDF copy/paste)."""
    out = []
    for ln in lines:
        s = ln.rstrip()
        prev = out[-1] if out else ""
        if (s and prev and not prev.startswith(("#", "[", "- ")) and not s.startswith(("#", "[", "- "))
                and not re.search(r"[.:;!?)”\"]$", prev) and s[:1].islower()):
            out[-1] = prev + " " + s.strip()
        else:
            out.append(s)
    return out


def parse_page(slug):
    raw = (TEXT / f"{slug}.md").read_text(encoding="utf-8")
    new_format = "## Project Description" in raw
    lines = unwrap(raw.split("\n")[4:])
    heading, hero, facts, docs, body = None, None, {}, [], []
    section = None          # current "## X" heading (lower)
    seen_desc = False       # past the facts block?
    facts_done = set()
    pending_doc_img = None
    i = 0
    while i < len(lines):
        ln = lines[i].rstrip()
        i += 1
        if not ln.strip() or ln.strip() in {"ROWS"} or ln.startswith(".") or ln.endswith(" END"):
            continue
        ln = re.sub(r"\s*\{[^{}]*=>[^{}]*\}\s*$", "", ln)  # strip inline link annotations
        m = re.match(r"^(#{1,6}) (.+)$", ln)
        if m:
            level, text = len(m.group(1)), m.group(2).strip()
            key = text.lower().rstrip(":")
            if section and section.startswith("fact:"):
                facts_done.add(section[5:])
            if heading is None and level <= 2:
                heading = text
                continue
            if text == heading:
                continue
            if key in FACT_KEYS:
                fk = FACT_KEYS[key]
                if fk in facts_done:      # duplicated sidebar copy: skip until next non-fact heading
                    section = "skip"
                    continue
                section = "fact:" + fk
                facts.setdefault(fk, [])
                continue
            if key in {"relevant documents", "related reports"}:
                section = "docs"
                continue
            if level == 2 and pending_doc_img and pending_doc_img.get("href") and key not in {"relevant documents", "related reports"}:
                docs.append(pending_doc_img)
                pending_doc_img = None
            section = None if level == 2 else section
            if section == "docs" and level >= 3:
                if pending_doc_img:
                    pending_doc_img["title"] = text
                    docs.append(pending_doc_img)
                    pending_doc_img = None
                continue
            seen_desc = True
            body.append("")
            body.append(("## " if level <= 2 else "### ") + text)
            body.append("")
            continue
        if section == "skip":
            continue
        img = re.match(r'^\[IMG (\S+) alt="([^"]*)"(?: link=(\S+))?\]$', ln)
        if img:
            src, alt, link = norm(img.group(1)), img.group(2), img.group(3)
            if hero is None and not seen_desc and section is None and not link:
                hero = src
                continue
            if section == "docs" or link:
                if pending_doc_img and pending_doc_img.get("href"):
                    docs.append(pending_doc_img)
                pending_doc_img = {"image": src, "href": link, "title": alt}
                if section != "docs":
                    section = "docs"
                continue
            if src in IMAGE_MAP and "210x300" not in src:
                body.append("")
                body.append(f'<img class="prose-img" src="{{{{ "{src}" | img }}}}" alt="{alt}" loading="lazy">')
                body.append("")
            continue
        lk = re.match(r'^\[LINK "(.*?)" => (\S+)\]$', ln)
        if lk:
            if section == "docs" and pending_doc_img:
                pending_doc_img["href"] = pending_doc_img["href"] or lk.group(2)
                docs.append(pending_doc_img)
                pending_doc_img = None
            continue
        if section == "docs":
            if pending_doc_img and ln.strip() not in {"Download", "No Comments"} and not re.match(r"^[A-Z][a-z]+ \d{1,2}, \d{4}$", ln.strip()):
                pending_doc_img["title"] = ln.strip()
            continue
        if section and section.startswith("fact:"):
            facts[section[5:]].append(ln.lstrip("- ").strip())
            if not new_format and not ln.startswith("- "):
                facts_done.add(section[5:])
                section = None
            continue
        # Older free-form pages: "Geography: X" / "Number of People Impacted"
        g2 = re.match(r"^Geography\s*:\s*(.+?)\s+Number of People Impacted\s*:?\s*$", ln)
        if g2 and "geography" not in facts:
            facts["geography"] = [g2.group(1).strip()]
            facts["reach"] = []
            while i < len(lines) and lines[i].startswith("- "):
                facts["reach"].append(lines[i][2:].strip())
                i += 1
            continue
        g = re.match(r"^Geography\s*:\s*(.+)$", ln)
        if g and "geography" not in facts:
            facts["geography"] = [g.group(1).strip()]
            continue
        n = re.match(r"^Number of People Impacted\s*:?\s*(.*)$", ln)
        if n and "reach" not in facts:
            val = n.group(1).strip()
            if not val and i < len(lines):
                val = lines[i].strip()
                i += 1
            facts["reach"] = [val]
            continue
        seen_desc = True
        label = ln.strip()
        if re.match(r"^[A-Z][A-Za-z ’'&-]{2,40}:$", label) or (
                len(label) <= 40 and len(label.split()) <= 5 and "," not in label
                and re.match(r"^[A-Z][A-Za-z ’'&-]+$", label)):     # "Program Details:" style labels
            body.extend(["", "### " + ln.strip().rstrip(":"), ""])
        elif ln.startswith("- "):
            body.append(ln)
        else:
            body.extend(["", ln.strip(), ""])
    if pending_doc_img and pending_doc_img.get("href"):
        docs.append(pending_doc_img)
    md = re.sub(r"\n{3,}", "\n\n", "\n".join(body)).strip() + "\n"
    return heading, hero, facts, docs, md


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    items = listing("Ongoing-Projects.md", "ongoing") + listing("past-projects.md", "past")
    for it in items:
        slug = it["slug"]
        heading, hero, facts, docs, md = parse_page(slug)
        permalink = PERMALINK.get(slug) or "/" + slug.lower().strip("/") + "/"
        fm = ["---", f"title: {yq(it['title'])}", f"heading: {yq(heading or it['title'])}",
              f"status: {it['status']}", f"order: {it['order']}", f"permalink: {permalink}",
              f"summary: {yq(it['summary'])}"]
        if hero:
            fm.append(f"hero: {yq(hero)}")
        if facts:
            fm.append("facts:")
            for k in ("geography", "reach", "outcomes"):
                if k in facts and facts[k]:
                    fm.append(f"  {k}:")
                    fm += [f"    - {yq(v)}" for v in facts[k] if v]
        if docs:
            fm.append("docs:")
            for d in docs:
                fm.append(f"  - title: {yq(d.get('title') or 'Download')}")
                fm.append(f"    href: {yq(d['href'])}")
                if d.get("image"):
                    fm.append(f"    image: {yq(d['image'])}")
        fm.append("---")
        (OUT / f"{slug}.md").write_text("\n".join(fm) + "\n" + md, encoding="utf-8")
        print(f"{it['status']:7} {slug:60} facts={list(facts)} docs={len(docs)} hero={'y' if hero else 'n'}")
    print(len(items), "projects")


if __name__ == "__main__":
    main()
