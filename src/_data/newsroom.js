// Newsroom data: the WordPress snapshot (data/media/*.json, written by scripts/sync_media.py)
// normalised into one shape that every media template understands.
//
// Every item has: kind, kindLabel, section {label, href}, url, title, description, date, image,
// html, facts [{label, value}], docs [{title, href}], related [items], prev/next.
import fs from "node:fs";

const read = (f, fallback) => {
  const p = `./data/media/${f}.json`;
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback;
};

const images = read("images", {});
const overrides = read("overrides", { vacancies: {}, rfps: {} });

const SECTIONS = {
  news: { label: "Blogs & News", href: "/blogs-and-news/" },
  press: { label: "Press", href: "/press/" },
  event: { label: "Events", href: "/events/" },
  gallery: { label: "Gallery", href: "/gallery/" },
  rfp: { label: "RFP / EOI", href: "/request-for-proposal/" },
  vacancy: { label: "Vacancies", href: "/vacancies/" },
};
const KIND_LABEL = { news: "Blog", press: "Press", event: "Event", gallery: "Album", rfp: "Notice", vacancy: "Vacancy" };

// Body images are stored as <img data-media="stem" alt="..."> — expand to sized, lazy, responsive WebP.
const imgTag = (stem, alt = "") => {
  const i = images[stem];
  if (!i) return "";
  const set = (i.sizes || [720]).map((w) => `/assets/img/media/${stem}-${w}.webp ${Math.min(w, i.w)}w`).join(", ");
  const big = (i.sizes || [720]).at(-1);
  return `<img src="/assets/img/media/${stem}-${big}.webp" srcset="${set}" sizes="(max-width: 860px) 100vw, 760px" width="${i.w}" height="${i.h}" alt="${alt}" loading="lazy" decoding="async">`;
};
const expand = (html = "") =>
  html.replace(/<img data-media="([^"]+)" alt="([^"]*)"\s*\/?>/g, (_, s, a) => imgTag(s, a))
    .replace(/<img alt="([^"]*)" data-media="([^"]+)"\s*\/?>/g, (_, a, s) => imgTag(s, a));

// Build date in India (deadlines are inclusive: a role closing today is still open today).
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// ---------- Posts (news, press, events)
const posts = read("posts", []).map((p) => ({
  ...p,
  kindLabel: KIND_LABEL[p.kind],
  section: SECTIONS[p.kind],
  url: `/${p.slug}/`,
  html: expand(p.html),
  year: p.date.slice(0, 4),
  facts: [
    { label: "Published", date: p.date },
    ...(p.topics.length ? [{ label: "Programme", value: p.topics.join(", ") }] : []),
    { label: "Reading time", value: `${p.readMinutes} min` },
  ],
}));

// ---------- RFP / RFQ / EOI notices
const rfps = read("rfps", []).map((r) => {
  const o = overrides.rfps?.[r.slug] || {};
  const x = { ...r, ...o };
  const status = x.status || (x.deadline ? (x.deadline >= today ? "open" : "closed") : "archived");
  const url = x.id ? `/${x.slug}/` : `/request-for-proposal/${x.slug}/`;
  return {
    ...x,
    kind: "rfp",
    kindLabel: x.category === "EOI" ? "Expression of Interest" : x.category === "RFA" ? "Request for Applications" : "Request for Proposal",
    section: SECTIONS.rfp,
    url,
    status,
    statusLabel: { open: "Open", closed: "Closed", archived: "Archived" }[status],
    html: expand(x.html),
    year: (x.date || "").slice(0, 4) || null,
    facts: [
      ...(x.ref ? [{ label: "Reference", value: x.ref, mono: true }] : []),
      { label: "Category", value: x.category },
      ...(x.date ? [{ label: "Published", date: x.date }] : []),
      ...(x.deadline ? [{ label: "Submission deadline", date: x.deadline }] : []),
      { label: "Status", value: { open: "Open for submissions", closed: "Closed", archived: "Archived" }[status] },
      { label: "Queries", value: x.contact, href: `mailto:${x.contact}` },
    ],
  };
});

// ---------- Vacancies
const vacancies = read("vacancies", []).map((v) => {
  const o = overrides.vacancies?.[v.slug] || {};
  const x = { ...v, ...o };
  // Status from the last date to apply (read from the job text by sync_media.py, or set in overrides.json).
  // No date in the posting → closed, unless an editor sets "status": "open" or a "deadline" in overrides.
  const deadline = x.validThrough || x.deadline || null;
  const status = x.status || (deadline && deadline >= today ? "open" : "closed");
  // Apply to the address the posting itself names (career@ for most recent roles), else the general inbox.
  const emails = [...new Set((x.html.match(/[\w.+-]+@pphfglobal\.org/g) || []))];
  const applyEmail = x.applyEmail || emails.find((e) => /^career/.test(e)) || emails[0] || "connect@pphfglobal.org";
  return {
    ...x,
    kind: "vacancy",
    kindLabel: x.employment || "Full-time",
    section: SECTIONS.vacancy,
    url: `/vacancies/${x.slug}/`,
    deadline,
    applyEmail,
    status,
    statusLabel: status === "open" ? "Open" : "Closed",
    html: expand(x.html),
    facts: [
      { label: "Location", value: x.location },
      { label: "Employment", value: x.employment },
      ...(x.positions ? [{ label: "Positions", value: x.positions }] : []),
      ...(x.reportsTo ? [{ label: "Reports to", value: x.reportsTo }] : []),
      ...(x.datePosted ? [{ label: "Posted", date: x.datePosted }] : []),
      deadline ? { label: status === "open" ? "Apply by" : "Applications closed", date: deadline } : { label: "Last date to apply", value: x.rolling ? "Not stated (open until filled)" : "Not stated" },
      { label: "Status", value: status === "open" ? "Open — accepting applications" : "Closed" },
    ],
  };
});

// ---------- Gallery albums
const gallery = read("gallery", []).map((a) => ({
  ...a,
  kind: "gallery",
  kindLabel: KIND_LABEL.gallery,
  section: SECTIONS.gallery,
  url: `/gallery/${a.slug}/`,
  image: a.photos[0],
  description: `${a.photos.length} photographs from ${a.subject}${a.date ? ", " + new Date(a.date).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : ""} — PPHF in the field.`,
  facts: [
    { label: "Photographs", value: a.photos.length },
    ...(a.date ? [{ label: "Date", date: a.date, month: true }] : []),
  ],
}));

// ---------- Related + prev/next (within the same listing)
const link = (list, pick) => list.forEach((it, i) => {
  it.prev = list[i + 1] ? { title: list[i + 1].title, url: list[i + 1].url } : null; // older
  it.next = list[i - 1] ? { title: list[i - 1].title, url: list[i - 1].url } : null; // newer
  it.related = pick(it, i).slice(0, 3).map(({ html, related, prev, next, photos, ...rest }) => rest);
});
const byKind = (k) => posts.filter((p) => p.kind === k);
const news = posts.filter((p) => p.channels.includes("blog"));
const press = posts.filter((p) => p.channels.includes("press"));
const events = byKind("event");

link(posts, (it) => {
  const pool = posts.filter((p) => p !== it && p.kind === it.kind);
  const sameTopic = pool.filter((p) => p.topics.some((t) => it.topics.includes(t)));
  const near = pool.sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(it.date)) - Math.abs(Date.parse(b.date) - Date.parse(it.date)));
  return [...new Set([...sameTopic.slice(0, 2), ...near])].slice(0, 3).sort((a, b) => b.date.localeCompare(a.date));
});
link(rfps, (it) => rfps.filter((r) => r !== it && r.category === it.category).sort((a, b) => (b.status === "open") - (a.status === "open")));
// Open roles first, then most recent closing date
vacancies.sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || (b.deadline || "0").localeCompare(a.deadline || "0"));
link(vacancies, (it) => {
  const pool = vacancies.filter((v) => v !== it);
  const open = pool.filter((v) => v.status === "open");
  return [...new Set([...open, ...pool.filter((v) => v.location === it.location || v.title === it.title), ...pool])];
});
link(gallery, (it) => gallery.filter((g) => g !== it));

const years = (list) => [...new Set(list.map((x) => x.year).filter(Boolean))].sort().reverse();
const count = (list, key) => Object.entries(list.reduce((m, x) => ((m[x[key]] = (m[x[key]] || 0) + 1), m), {}))
  .sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));

export default {
  sections: SECTIONS,
  // Every individual page rendered by layouts/media-item.njk (one template, all kinds)
  items: [...posts, ...rfps, ...vacancies, ...gallery],
  syncedAt: read("sync", {}).syncedAt,
  posts, news, press, events,
  rfps: [...rfps].sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || (b.date || "").localeCompare(a.date || "")),
  rfpCategories: count(rfps, "category"),
  rfpOpen: rfps.filter((r) => r.status === "open").length,
  vacancies,
  vacancyOpen: vacancies.filter((v) => v.status === "open").length,
  vacancyLocations: count(vacancies, "location"),
  gallery,
  photoCount: gallery.reduce((n, a) => n + a.photos.length, 0),
  years: { news: years(news), press: years(press), events: years(events) },
};
