# PPHF website: "The Thread" redesign

A second, bolder redesign of pphfglobal.org, built from the same content as `Finntrado/pphf-redesign` with a completely different design.
Design direction: **[DESIGN.md](DESIGN.md)** · Facts still needed from PPHF: **[TODO.md](TODO.md)**

The static pages of pphfglobal.org, rebuilt with [Eleventy](https://www.11ty.dev/).
WordPress remains the CMS for dated content (blogs, events, press, vacancies, RFPs, gallery); the site renders a synced snapshot of it — see *Media & Opportunities* below.


## Run it

Requires Node 18+.

```bash
npm install
npm run serve      # dev server with live reload → http://localhost:8080
npm test           # clean build + verification suite
```

`npm run build` writes the deployable site to `_site/` (it deletes `_site/` first).

## Where things live

| What | Where |
|---|---|
| **All page words** (homepage, donate, appeal, about, every one-off page) | `src/_data/copy/*.yml`, one file per page; a page names its file with `copyKey:` |
| Site-wide settings (contact details, socials, certifications, WordPress URL, form endpoint) | `src/_data/site.json` |
| Navigation (header + footer) | `src/_data/nav.json` |
| Homepage lists | `src/_data/testimonials.json`, `partners.json`, `decade.json` (timeline and focus areas), `home.json` (videos, partners intro) |
| Team, reports, publications, videos, PPHF@10 | `src/_data/*.json` |
| Thematic area pages | `src/themes/*.md` |
| Project pages (ongoing & past) | `src/projects/*.md` — `status: ongoing` or `past`, `order` sets listing order |
| One-off page templates (design only) | `src/pages/*.njk` |
| Styles | `src/assets/css/`: `tokens` (colours, type, spacing) → `fonts` → `base` → `chrome` (ribbon, header, dock, drawer, page head, closer, footer) → `components` → `home` → `pages` → `media`. Bundled, pruned per page and inlined at build time. |
| Media & Opportunities content | `data/media/*.json` (synced from WordPress — see below) |
| Behaviour | `src/js/main.js` (every page, bundled with Lenis by esbuild) and `src/js/motion.js` (homepage scroll set pieces with GSAP ScrollTrigger, loaded on first interaction; enable on any page with `motion: true` in front matter): menus, bottom-sheet drawer, Hindi switch, the scroll-drawn thread, route steps, hero prints, cause-index peek, voices deck, drag rails, counters, donate and contact forms, video, filters |
| Images | `src/assets/img/` |

### Common edits

- **Add a project:** copy any file in `src/projects/`, change the front matter (title, status, order, permalink, summary, hero, facts, docs) and the body. It appears in the right listing automatically.
- **Move a project from ongoing to past:** change `status: ongoing` → `status: past`.
- **Add an image:** put it in `src/assets/img/` and reference it by filename, e.g. `hero: my-photo.webp`. (Original pphfglobal.org image URLs also work; they're mapped via `scripts/image-map.json`.)
- **Change any wording:** edit the page's file in `src/_data/copy/`. The homepage is `copy/home.yml`, sections in page order.
- **Turn on online donations:** put the payment link in `src/_data/copy/donate.yml` → `paymentUrl`. The form then sends donors there with amount, frequency and cause as query parameters.
- **Homepage stories** come from the newest synced Blogs & News posts automatically.

## Checks

`npm test` runs `scripts/verify.mjs`, which fails the build if any expected page is missing, any internal link/image is broken, an image lacks `alt`, a page doesn't have exactly one (non-empty) `<h1>` or has an empty `<title>`, or template code leaked into the output.

## Hosting

Any static host works (Vercel, Netlify, Cloudflare Pages, or a plain upload of `_site/`).
Build command `npm run build`, publish directory `_site`. `_site/_redirects` is understood by Netlify and Cloudflare Pages; on other hosts recreate those redirects in the host's config.

## Media & Opportunities (newsroom)

WordPress stays the CMS for dated content. `scripts/sync_media.py` pulls it through the WP REST API into a clean snapshot that the site renders with **one shared template**:

| What | Source in WordPress | Snapshot | Pages |
|---|---|---|---|
| Blogs & News, Press, Events | posts in categories Blog / Press / Events | `data/media/posts.json` | `/{slug}/` (same URLs as WordPress) |
| RFP / RFQ / EOI notices | pages linked from *Request For Proposal* | `data/media/rfps.json` | `/{slug}/` |
| Vacancies | accordion on the *Vacancies* page | `data/media/vacancies.json` | `/vacancies/{slug}/` |
| Gallery | *images* page, grouped by caption | `data/media/gallery.json` | `/gallery/{album}/` |

```bash
python scripts/sync_media.py   # refresh the snapshot (images are downloaded once, as 400/720/1280px WebP)
npm test                       # rebuild + verify
```

- **One item template:** `src/_includes/layouts/media-item.njk` renders every individual page; `src/media/items.njk` paginates over `newsroom.items`. Each kind (news · press · event · gallery · rfp · vacancy) gets its own hero meta, "At a glance" facts, calls to action and structured data (BlogPosting / NewsArticle / ImageGallery / JobPosting / WebPage + BreadcrumbList). A new kind only needs a `kind` value and its facts in `src/_data/newsroom.js`. A hand-written page can use the template too: `layout: layouts/media-item.njk` with an `item:` object in front matter.
- **Landing pages** share `layouts/media-landing.njk` (header, stats, section switcher): `/media/` (newsroom hub), `/blogs-and-news/` and `/press/` (12 per page), `/events/`, `/gallery/`, `/videos/`, `/publications/`, `/reports/`, `/vacancies/`, `/request-for-proposal/` (status/category filters + search).
- **Cards:** `partials/media-card.njk` — `mediaCard(item, variant)` and `noticeRow(item)`.
- **Vacancy status:** the sync reads each role's *last date to apply* from its text ("Last date of receiving applications is…", "…to career@pphfglobal.org by …", "Application Deadline: …"). A role is **Open** through that date (India time) and **Closed** after it; closed roles stay listed for reference without an Apply button. A posting with no date is treated as closed. To correct one, add it to `data/media/overrides.json`, e.g. `"vacancies": { "<slug>": { "deadline": "2026-12-15" } }` or `{ "status": "open" }`. The Apply button uses the email address named in the posting.
- **Editor fields WordPress doesn't hold** (vacancy `datePosted`, RFP `deadline`/`status` corrections) go in `data/media/overrides.json`, keyed by slug. A vacancy only emits Google *JobPosting* data once it has `datePosted`.
- RFP and vacancy status is computed at build time from the deadline, and the browser also flips anything past its date to *Closed* (`data-closes`, `main.js`), so a page never shows an expired role as open. Still **rebuild daily** (e.g. a Vercel deploy hook on a schedule) so counts, filters and search results stay exact.
- Also generated: `/feed.xml` (RSS), `lastmod` in `/sitemap.xml`.

## Speed & SEO (how pages reach Lighthouse 100)

- **No render-blocking requests.** All CSS is bundled + minified with esbuild at build time and inlined; each page keeps only the rules its HTML uses (`scripts/prune-css.js`). Classes added by JavaScript must start with `is-` (or be added to the safelist there).
- **Self-hosted fonts:** Fraunces (roman and italic), Hanken Grotesk and Kalam, Latin-subset and weight-limited with fontTools (about 106 KB in total; three files preloaded), with metric-matched fallbacks so nothing shifts.
- **Images:** every media image has width/height, `srcset` (400/720/1280 WebP) and correct `sizes`; the hero/lead image is preloaded with `fetchpriority="high"`; everything else is lazy. Covers: `python scripts/covers.py` (240/400px thumbs + self-hosted YouTube posters).
- **JS:** `main.js` is one deferred, minified file (about 38 KB). `motion.js` (GSAP) loads only on pages with `motion: true`, after the first scroll or touch; there are no third-party scripts until a visitor presses play on a video.
- **Caching/security headers** live in `vercel.json` (1-year immutable for `/assets/`).
- **Every page:** unique title + description, canonical, Open Graph/Twitter cards, Organization + WebSite JSON-LD; `npm test` fails on a missing description/canonical, invalid JSON-LD, or a media image without dimensions.
- ⚠️ `vercel.json` sends `X-Robots-Tag: noindex` on the preview. **Remove that header when the site goes live**, or Lighthouse SEO (and Google) will treat every page as blocked.

## Phase 2: WordPress seam

All links to WordPress-owned content and all PDFs are built from `site.wpBase` (`src/_data/site.json`).
When WordPress moves (e.g. to `https://cms.pphfglobal.org`) and this site takes over `pphfglobal.org`:

1. Set `wpBase` to the WordPress URL and rebuild.
2. `_redirects` then automatically forwards any non-static path (old blog posts, `/wp-content/…`) to WordPress.
3. Next step: replace the static "In Focus" snapshot with a build-time fetch from the WP REST API (`/wp-json/wp/v2/posts`), and add listing pages for blogs/events/press.

## Contact form

Set `forms.contactEndpoint` in `site.json` (e.g. a Formspree URL or a WordPress form REST endpoint). Until then, submitting opens the visitor's email app with the message pre-filled to connect@pphfglobal.org.

## Scripts

- `scripts/import_images.py` — one-off: downloaded and optimised images from the live site (re-runnable).
- `scripts/import_content.py` — one-off: generated `src/projects/*.md` from the scraped live pages. **Don't re-run** after hand edits — it overwrites them.
- `scripts/qa-harness.html` — dev-only page for previewing at fixed widths (`npm run qa` copies it into `_site`; a clean build removes it).

## Image system (keep it consistent)

- **Portraits** are cut out and framed identically by `scripts/portraits.py` (local background removal with rembg, model downloads once) and shown on one shared backdrop. After adding a new person's photo to `src/assets/img/` and `team.json`, add the filename to `scripts/_portraits.json` and run `python scripts/portraits.py`. Without a processed portrait the site falls back to the original photo.
- **Photographs** (project, theme, campaign images) get one gentle shared grade and 800/1600px sizes from `scripts/photos.py`. Run `python scripts/photos.py` after adding a project or theme image; templates use `{% photo src, alt, sizes %}`, which falls back to the original if no graded version exists.
- Originals are never modified; derivatives live in `src/assets/img/portraits/` and `src/assets/img/photos/`.

## Language switch (हिन्दी)

The EN / हिं switch loads Google's website translator **only when a visitor asks for Hindi**, so nobody else pays for it. The choice is stored in the standard `googtrans` cookie and carries across pages; switching back reloads the page in English. Machine translation is approximate. For pages that matter most (Donate, the appeal), a reviewed Hindi version would be better later.

## Deploying

The Vercel project builds from this repo's `main` branch (build `npm run build`, output `_site`). `vercel.json` sends `X-Robots-Tag: noindex` on staging. **Remove that header when the site goes live.**
