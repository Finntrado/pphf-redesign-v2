import fs from "node:fs";
import markdownIt from "markdown-it";
import yaml from "js-yaml";
import * as esbuild from "esbuild";
import { imageSize } from "./scripts/image-size.js";
import { pruneFor } from "./scripts/prune-css.js";

const md = markdownIt({ html: true, typographer: false });

const imageMap = JSON.parse(fs.readFileSync("./scripts/image-map.json", "utf8"));
const site = JSON.parse(fs.readFileSync("./src/_data/site.json", "utf8"));

const normUrl = (u) => (u.startsWith("//") ? "https:" + u : u);
const photoList = new Set(JSON.parse(fs.readFileSync("./scripts/photo-list.json", "utf8")));
const toLocal = (src) => {
  const u = normUrl(src);
  if (imageMap[u]) return imageMap[u];
  if (!u.includes("://") && fs.existsSync(`./src/assets/img/${u}`)) return u;
  throw new Error(`no imported image for ${src}`);
};

export default function (eleventyConfig) {
  // Words live in YAML data files (src/_data/copy/*.yml → copy.<name>), separate from the design.
  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/static": "/" });
  eleventyConfig.addWatchTarget("src/assets/");
  eleventyConfig.addWatchTarget("data/");

  // ---------- Speed: one inlined, minified stylesheet (no render-blocking requests) + minified JS
  // Order matters: tokens → fonts → base → chrome → components → home → pages → media.
  const CSS = ["tokens", "fonts", "base", "chrome", "components", "home", "pages", "media"];
  let cssBundle = "";
  eleventyConfig.on("eleventy.before", async () => {
    const src = CSS.map((f) => fs.readFileSync(`./src/assets/css/${f}.css`, "utf8")).join("\n");
    cssBundle = (await esbuild.transform(src, { loader: "css", minify: true, target: ["chrome100", "safari15", "firefox100"] })).code.trim();
  });
  // The placeholder is swapped for the rules this page actually uses (scripts/prune-css.js).
  eleventyConfig.addShortcode("inlineCss", () => "/*__INLINE_CSS__*/");
  eleventyConfig.addTransform("inline-css", function (html) {
    if (!(this.page.outputPath || "").endsWith(".html") || !html.includes("/*__INLINE_CSS__*/")) return html;
    return html.replace("/*__INLINE_CSS__*/", () => pruneFor(cssBundle, html));
  });
  // JS: src/js/*.js are bundled + minified by esbuild into /assets/js/.
  //   main.js   — every page (menus, forms, Lenis smooth scroll, small interactions)
  //   motion.js — only pages with scroll set pieces (front matter `motion: true`): GSAP + ScrollTrigger
  eleventyConfig.addWatchTarget("src/js/");
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    await esbuild.build({
      entryPoints: ["src/js/main.js", "src/js/motion.js"].filter((f) => fs.existsSync(f)),
      bundle: true, minify: true, format: "iife", target: "es2020",
      outdir: `${dir.output}/assets/js`, legalComments: "none",
    });
  });


  // ---------- Dates (ISO in, human out). {{ "2026-09-08T14:46:26" | date }} → 8 September 2026
  const asDate = (d) => (d instanceof Date ? d : new Date(String(d).length === 10 ? d + "T00:00:00" : d));
  eleventyConfig.addFilter("date", (d, style = "long") => {
    if (!d) return "";
    const opts = { long: { day: "numeric", month: "long", year: "numeric" }, short: { day: "numeric", month: "short", year: "numeric" },
      month: { month: "long", year: "numeric" }, day: { day: "2-digit" }, mon: { month: "short" } }[style];
    return asDate(d).toLocaleDateString("en-GB", { ...opts, timeZone: "Asia/Kolkata" });
  });
  // Build date in India (YYYY-MM-DD): {{ "" | todayIN }}
  eleventyConfig.addFilter("todayIN", () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  eleventyConfig.addFilter("isoDate", (d) => (d ? asDate(d).toISOString().slice(0, 10) : ""));
  eleventyConfig.addFilter("isoDateTime", (d) => (d ? (String(d).length === 10 ? d : String(d).slice(0, 19) + "+05:30") : ""));
  eleventyConfig.addFilter("rfc822", (d) => (d ? new Date(String(d).length === 10 ? d + "T00:00:00+05:30" : String(d).slice(0, 19) + "+05:30").toUTCString() : ""));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v).replace(/</g, "\\u003c"));
  eleventyConfig.addFilter("pluck", (arr, key) => (arr || []).map((x) => x[key]));
  eleventyConfig.addFilter("where", (arr, key, value) => (arr || []).filter((x) => x[key] === value));
  eleventyConfig.addFilter("striptags", (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

  // ---------- Synced media images (scripts/sync_media.py → src/assets/img/media/<stem>-720|1280.webp)
  // {% mediaImg image, sizes, class, eager %} — image = {stem, w, h, sizes, alt}
  eleventyConfig.addShortcode("mediaImg", (im, sizes = "100vw", cls = "", eager = false) => {
    if (!im || !im.stem) return "";
    const ws = im.sizes || [720];
    const set = ws.map((w) => `/assets/img/media/${im.stem}-${w}.webp ${Math.min(w, im.w)}w`).join(", ");
    const src = `/assets/img/media/${im.stem}-${ws.at(-1)}.webp`;
    const esc = (v) => String(v || "").replace(/"/g, "&quot;");
    return `<img src="${src}" srcset="${set}" sizes="${sizes}" width="${im.w}" height="${im.h}" alt="${esc(im.alt)}"${cls ? ` class="${cls}"` : ""}${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
  });
  eleventyConfig.addFilter("mediaSrcset", (im) => (im && im.stem ? (im.sizes || [720]).map((w) => `/assets/img/media/${im.stem}-${w}.webp ${Math.min(w, im.w)}w`).join(", ") : ""));
  // Structured data for a landing page: CollectionPage with an ItemList of its entries + breadcrumbs.
  eleventyConfig.addFilter("collectionLd", (items, { base, url, name, description, crumbs = [] }) => JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": base + url, url: base + url, name, description, isPartOf: { "@id": base + "/#website" },
        mainEntity: { "@type": "ItemList", numberOfItems: (items || []).length,
          itemListElement: (items || []).map((x, i) => ({ "@type": "ListItem", position: i + 1, url: base + x.url, name: x.title })) } },
      { "@type": "BreadcrumbList", itemListElement: [{ name: "Home", url: "/" }, ...crumbs, { name, url }].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: base + c.url })) },
    ],
  }).replace(/</g, "\\u003c"));
  eleventyConfig.addFilter("galleryLd", (photos, base) => (photos || []).map((ph) => ({
    "@type": "ImageObject", contentUrl: `${base}/assets/img/media/${ph.stem}-${(ph.sizes || [720]).at(-1)}.webp`, caption: ph.alt, width: ph.w, height: ph.h })));
  eleventyConfig.addFilter("mediaSrc", (im, w = 1280) => (im && im.stem ? `/assets/img/media/${im.stem}-${(im.sizes || [720]).includes(w) ? w : (im.sizes || [720]).at(-1)}.webp` : ""));

  // Image: accepts an original pphfglobal.org URL (mapped to its imported, optimised copy)
  // or a bare filename already in src/assets/img. Unknown images fail the build.
  eleventyConfig.addFilter("img", (src) => {
    if (!src) throw new Error("img filter: empty src");
    const u = normUrl(src);
    if (imageMap[u]) return `/assets/img/${imageMap[u]}`;
    if (!u.includes("/") && fs.existsSync(`./src/assets/img/${u}`)) return `/assets/img/${u}`;
    throw new Error(`img filter: no imported image for ${src}`);
  });

  eleventyConfig.addFilter("imgSize", (src) => imageSize(`./src/assets/img/${toLocal(src)}`));
  // Cover thumbnail (scripts/covers.py) → {src, w, h}; falls back to the original image.
  eleventyConfig.addFilter("cover", (src) => {
    const name = toLocal(src);
    const thumb = `covers/${name.replace(/\.[a-z]+$/i, "")}-400.webp`;
    const file = fs.existsSync(`./src/assets/img/${thumb}`) ? thumb : name;
    const { w, h } = imageSize(`./src/assets/img/${file}`);
    const small = file.replace(/-400\.webp$/, "-240.webp");
    const srcset = small !== file && fs.existsSync(`./src/assets/img/${small}`) ? `/assets/img/${small} 240w, /assets/img/${file} ${w}w` : "";
    return { src: `/assets/img/${file}`, w, h, srcset };
  });

  // Responsive, graded photograph (see scripts/photos.py). Falls back to a plain <img> for non-photos.
  // {% photo src, alt, sizes, class, loading, priority %}
  eleventyConfig.addShortcode("photo", (src, alt = "", sizes = "100vw", cls = "", loading = "lazy", priority = false) => {
    const name = toLocal(src);
    const stem = name.replace(/\.[a-z]+$/i, "");
    const esc = (v) => String(v).replace(/"/g, "&quot;");
    const attrs = `alt="${esc(alt)}"${cls ? ` class="${cls}"` : ""} loading="${loading}" decoding="async"${priority ? ' fetchpriority="high"' : ""}`;
    if (!photoList.has(name)) return `<img src="/assets/img/${name}" ${attrs}>`;
    return `<img src="/assets/img/photos/${stem}-1600.webp" srcset="/assets/img/photos/${stem}-800.webp 800w, /assets/img/photos/${stem}-1600.webp 1600w" sizes="${sizes}" width="1600" height="1067" ${attrs}>`;
  });

  // Normalised cut-out portrait (scripts/portraits.py) or null if none exists for this source.
  const portraitOf = (src) => {
    if (!src) return null;
    const stem = toLocal(src).replace(/\.[a-z]+$/i, "");
    return fs.existsSync(`./src/assets/img/portraits/${stem}.webp`) ? `/assets/img/portraits/${stem}.webp` : null;
  };
  eleventyConfig.addFilter("portrait", portraitOf);

  // WordPress-owned URL (posts, listings, media-library PDFs). Accepts a path or a full
  // pphfglobal.org URL and re-bases it on site.wpBase so WordPress can move later.
  eleventyConfig.addFilter("wp", (p) => {
    if (!p) return p;
    const path = p.replace(/^https?:\/\/(www\.)?pphfglobal\.org/, "");
    return site.wpBase.replace(/\/$/, "") + (path.startsWith("/") ? path : "/" + path);
  });

  // Render a Markdown string from front matter / data.
  eleventyConfig.addFilter("md", (s) => (s ? md.render(String(s)) : ""));
  eleventyConfig.addFilter("mdInline", (s) => (s ? md.renderInline(String(s)) : ""));

  // Turn a "Lines\nseparated" string into an array (used by project facts).
  eleventyConfig.addFilter("lines", (s) => (s ? String(s).split(/\n+/).map((x) => x.trim()).filter(Boolean) : []));
  eleventyConfig.addFilter("youtubeId", (u) => {
    const m = String(u).match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : u;
  });
  eleventyConfig.addFilter("chunk", (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  });
  eleventyConfig.addFilter("without", (arr, url) => (arr || []).filter((x) => x.url !== url));
  eleventyConfig.addFilter("take", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("findBy", (arr, key, value) => (arr || []).find((x) => x[key] === value));
  eleventyConfig.addFilter("year", () => new Date().getFullYear());
  // First n people that have a processed portrait: [{src, name}]
  eleventyConfig.addFilter("portraitList", (people, n = 7) => people
    .map((p) => ({ name: p.name, src: p.photo ? portraitOf(p.photo) : null }))
    .filter((p) => p.src).slice(0, n));
  // Indian states/UTs named in a project's geography facts (no inference beyond the names written)
  const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh"];
  const statesOf = (geo) => { const g = (geo || []).join(" "); return STATES.filter((s) => new RegExp(`\\b${s}\\b`, "i").test(g)); };
  eleventyConfig.addFilter("projStates", (geo) => statesOf(geo).map((s) => s.toLowerCase().replace(/ /g, "-")).join(" "));
  eleventyConfig.addFilter("statesIn", (items) => {
    const c = {};
    items.forEach((p) => statesOf(p.data.facts && p.data.facts.geography).forEach((s) => (c[s] = (c[s] || 0) + 1)));
    return Object.keys(c).sort().map((s) => ({ name: s, key: s.toLowerCase().replace(/ /g, "-"), count: c[s] }));
  });
  // Split rendered HTML into editorial sections at each <h3>
  // A leading heading that only repeats the page title (H1) is dropped; empty sections stay as plain headings.
  const norm = (t) => String(t || "").replace(/<[^>]+>/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  eleventyConfig.addFilter("sectionize", (html, pageTitle) => {
    const parts = String(html).split(/(?=<h[23][\s>])/);
    const t = norm(pageTitle).slice(0, 24);
    return parts.map((sec, i) => {
      const m = sec.match(/^(<h([23])[\s\S]*?<\/h\2>)([\s\S]*)$/);
      if (!m) return sec;
      if (i <= 1 && t && norm(m[1]).slice(0, 24) === t && !m[3].trim()) return "";
      if (!m[3].trim()) return sec;
      return `<div class="proj-sec">${m[1]}<div class="proj-sec__body">${m[3]}</div></div>`;
    }).join("");
  });
  // Publication type, read from words already in the title (drives the filter chips)
  eleventyConfig.addFilter("pubType", (t) => {
    const s = t.toLowerCase();
    if (/meeting brief|stakeholder.s meet/.test(s)) return "briefs";
    if (/overview|project$|response|installation|networks|infrastructure/.test(s)) return "projects";
    if (/assessment|study|report|effects|trucking/.test(s)) return "research";
    return "policy";
  });
  // Index of the nav group owning this URL: exact match first, else the longest prefix match (one group only)
  eleventyConfig.addFilter("navGroup", (groups, url, section) => {
    if (section) return groups.findIndex((g) => g.label === section);
    let best = -1, bestLen = 0;
    groups.forEach((g, i) => (g.items || [{ href: g.href }]).forEach((it) => {
      const h = it.href || "";
      if (!h || h === "/" || it.wp) return;
      const len = url === h ? 10000 : url.startsWith(h) ? h.length : 0;
      if (len > bestLen) { best = i; bestLen = len; }
    }));
    return best;
  });

  const byOrder = (a, b) => (a.data.order ?? 999) - (b.data.order ?? 999);
  eleventyConfig.addCollection("themes", (api) => api.getFilteredByGlob("src/themes/*.md").sort(byOrder));
  eleventyConfig.addCollection("projectsOngoing", (api) =>
    api.getFilteredByGlob("src/projects/*.md").filter((p) => p.data.status === "ongoing").sort(byOrder));
  eleventyConfig.addCollection("projectsPast", (api) =>
    api.getFilteredByGlob("src/projects/*.md").filter((p) => p.data.status === "past").sort(byOrder));

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
