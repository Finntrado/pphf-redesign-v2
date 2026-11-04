// Verification suite for the built site in _site/.
// Checks: page inventory, internal links + assets resolve, no template leftovers.
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("_site");
const SRC = path.resolve("src");

// One-off pages that must exist (collection pages are discovered from src/ below).
const EXPECTED = [
  "/", "/about/", "/team/", "/technical-capacity/", "/dd-documents/", "/contact/",
  "/our-work/", "/signature-programs-2/", "/ongoing-projects/", "/past-projects/", "/outreach/",
  "/reports/", "/annual-reports/", "/publications/", "/videos/",
  "/pphf-annual-report-2022-23/", "/pphf-annual-report-2023-24/",
  "/pphf-annual-report-2024-25/", "/pphf-annual-report-2025-26/",
  "/partnership/", "/aastha/", "/partnership/deesha/", "/pphf-pulse-fund/",
  "/internship/", "/pphf-corporate-volunteering-program/",
  "/flood-relief-appeal-2026/", "/a-decade-of-catalysing-change/", "/404.html",
  // Media & Opportunities landing pages (individual items are checked against data/media below)
  "/media/", "/blogs-and-news/", "/blogs-and-news/page/2/", "/press/", "/events/", "/gallery/",
  "/vacancies/", "/request-for-proposal/", "/feed.xml", "/sitemap.xml",
];

const failures = [];
const fail = (msg) => failures.push(msg);

if (!fs.existsSync(OUT)) {
  console.error("✗ _site/ does not exist — run `npm run build` first.");
  process.exit(1);
}

// Discover collection permalinks from front matter.
for (const dir of ["projects", "themes"]) {
  const d = path.join(SRC, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).filter((f) => f.endsWith(".md"))) {
    const m = fs.readFileSync(path.join(d, f), "utf8").match(/^permalink:\s*["']?([^"'\n]+)["']?/m);
    if (m) EXPECTED.push(m[1].trim());
    else fail(`${dir}/${f}: missing permalink`);
  }
}

// Every synced media item must have its page (one template renders them all).
{
  const read = (f) => JSON.parse(fs.readFileSync(path.resolve("data/media", f + ".json"), "utf8"));
  for (const p of read("posts")) EXPECTED.push(`/${p.slug}/`);
  for (const r of read("rfps")) EXPECTED.push(r.id ? `/${r.slug}/` : `/request-for-proposal/${r.slug}/`);
  for (const v of read("vacancies")) EXPECTED.push(`/vacancies/${v.slug}/`);
  for (const a of read("gallery")) EXPECTED.push(`/gallery/${a.slug}/`);
}

const toFile = (url) => {
  let p = decodeURI(url.split("#")[0].split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  return path.join(OUT, p);
};

for (const url of EXPECTED) if (!fs.existsSync(toFile(url))) fail(`missing page ${url}`);

// Redirect sources count as valid link targets.
const redirects = new Set();
const rf = path.join(OUT, "_redirects");
if (fs.existsSync(rf)) {
  for (const line of fs.readFileSync(rf, "utf8").split("\n")) {
    const src = line.trim().split(/\s+/)[0];
    if (src && !src.startsWith("#")) redirects.add(src);
  }
}

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

const htmlFiles = walk(OUT).filter((f) => f.endsWith(".html") && !path.basename(f).startsWith("__"));
const LEFTOVERS = [/\{\{/, /\{%/, />\s*undefined\s*</, /="undefined"/, /\[object Object\]/, />NaN</];
let linkCount = 0;

for (const file of htmlFiles) {
  const rel = "/" + path.relative(OUT, file).replace(/\\/g, "/");
  const html = fs.readFileSync(file, "utf8");
  for (const re of LEFTOVERS) if (re.test(html)) fail(`${rel}: template leftover ${re}`);
  if (!/<title>[^<]+<\/title>/.test(html)) fail(`${rel}: missing <title>`);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail(`${rel}: expected exactly one <h1>`);
  if (/<h1[^>]*>\s*<\/h1>/.test(html)) fail(`${rel}: empty <h1>`);
  if (/<title>\s*(\| PPHF)?\s*<\/title>/.test(html)) fail(`${rel}: empty <title>`);
  // SEO basics: description, canonical, valid structured data
  if (!/<meta name="description" content="[^"]{30,}"/.test(html)) fail(`${rel}: missing/short meta description`);
  if (!/<link rel="canonical" href="https:\/\/[^"]+"/.test(html)) fail(`${rel}: missing canonical`);
  for (const [, ld] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(ld); } catch (e) { fail(`${rel}: invalid JSON-LD (${e.message})`); }
  }
  for (const tag of ["div", "section", "ul", "ol", "a"]) {
    const open = (html.match(new RegExp("<" + tag + "[\\s>]", "g")) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (open !== close) fail(`${rel}: unbalanced <${tag}> (${open} open, ${close} close)`);
  }
  for (const [, attr, url] of html.matchAll(/\s(href|src|poster|data-src)="(\/[^"]*)"/g)) {
    if (url.startsWith("//")) continue;
    linkCount++;
    const clean = decodeURI(url.split("#")[0].split("?")[0]);
    if (redirects.has(clean)) continue;
    if (!fs.existsSync(toFile(url))) fail(`${rel}: broken ${attr} → ${url}`);
  }
  for (const [, srcset] of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    for (const part of srcset.split(",")) {
      const u = part.trim().split(/\s+/)[0];
      if (u.startsWith("/") && !fs.existsSync(toFile(u))) fail(`${rel}: broken srcset → ${u}`);
    }
  }
  for (const [, tag] of html.matchAll(/(<img\b[^>]*>)/g)) {
    if (!/\salt="/.test(tag)) fail(`${rel}: <img> without alt ${tag.slice(0, 80)}`);
    // Media images must reserve their space (no layout shift)
    if (/\/assets\/img\/(media|covers)\//.test(tag) && !/\swidth="\d+"[\s\S]*\sheight="\d+"/.test(tag)) fail(`${rel}: media <img> without width/height ${tag.slice(0, 80)}`);
  }
}

console.log(`Checked ${EXPECTED.length} expected pages, ${htmlFiles.length} HTML files, ${linkCount} internal links.`);
if (failures.length) {
  console.error(`✗ ${failures.length} failure(s):`);
  for (const f of [...new Set(failures)].slice(0, 200)) console.error("  - " + f);
  process.exit(1);
}
console.log("✓ All checks passed.");
