# PPHF redesign v2: handoff for the next session

Paste this whole file into a new chat (or point the new session at `HANDOFF.md` in the repo). It describes where things stand, how the build works, what the owner liked and disliked, and the mistakes to avoid.

---

## 1. What this is

A second redesign of **pphfglobal.org**, the website of **People to People Health Foundation (PPHF)**, a Section 8 (non-profit) public-health organisation based in New Delhi (est. 2016) that works across India.

- **The goal:** a premium, donor-first website ("a $10k site, not a $200 template"). The order and persuasion are built for **donors and CSR partners** first, and for anyone who wants to learn about the organisation second. The main action is **Donate**, then **Partner with us**.
- **Content rule:** keep the same content as the original site. Copy may be made more persuasive, but whole paragraphs must not be removed and no new unproven facts added. Missing facts become visible pink `TODO` markers (listed in `TODO.md`); nothing is invented.
- **Languages:** English content. An EN / हिं switch translates the whole site via Google's website translator, loaded only on demand.

## 2. Repos, branches, hosting

| What | Where |
|---|---|
| This project | GitHub `Finntrado/pphf-redesign-v2` (private) |
| `main` | Current state: the "first-review" design plus three fixes (see §6). Auto-deploys to Vercel. |
| `backup/2026-11-05` | Identical to `main` at handoff. **The base for the next redesign.** |
| `experiment/second-review-round` | A later round the owner rejected (photo-grid hero, arched images, scrolling cause story). Kept for reference only. |
| Vercel project | `pphf-redesign-v2` (team `finntrado-s-projects`, project id `prj_HGCik5mQw7OKumXjLKpGfVH5Tl0m`). Staging: https://pphf-redesign-v2-finntrado-s-projects.vercel.app (behind Vercel login). Every push to `main` deploys. |
| The first, conservative redesign | GitHub `Finntrado/pphf-redesign`, folder `site/`, Vercel project `site`. A separate, more conservative design. **Don't modify it.** It was the content source for v2. |
| Original live site | https://pphfglobal.org (WordPress). WordPress stays the CMS for dated content. |

Session notes: the GitHub app must have access to the repo before `add_repo` works. Pushing **tags** is blocked by the cloud git proxy (branches work). Never `rm` with shell-variable or relative glob paths (a safety check blocks it); use literal absolute paths. Python heredocs containing `${...}` can trip the safety parser, so write scripts to a scratch file and run them.

## 3. Stack and build

- **Eleventy 3** (Nunjucks) static site, plain CSS, small vanilla JS. Node 22.
- `npm run build` writes `_site/`. `npm test` builds, then runs `scripts/verify.mjs`, which checks every expected page exists, there are no broken internal links or images, all images have alt text, there is exactly one non-empty `<h1>` per page, titles are non-empty, and JSON-LD is valid.
- **CSS:** `src/assets/css/` = `tokens` → `fonts` → `base` → `chrome` (ribbon, header, phone dock, drawer, page head, closing call, footer) → `components` → `home` → `pages` → `media`. Bundled and minified by esbuild, then **pruned per page** (`scripts/prune-css.js`) and inlined. ⚠️ Rules for classes that only JavaScript adds are removed unless the class starts with `is-` or is in the `SAFE` list in `prune-css.js`. **This caused a real bug once (an invisible hero element).**
- **JS:** `src/js/main.js` (every page; bundles **Lenis** smooth scroll) and `src/js/motion.js` (**GSAP + ScrollTrigger**, about 118 KB). Pages opt in to motion with front matter `motion: true`. Motion is loaded on the **first scroll, touch or keypress** (a meta tag plus a loader in `main.js`) to keep mobile Lighthouse at 95+. A `.motion-failed` fallback lays sections out statically. Everything respects `prefers-reduced-motion`.
- **Fonts** (self-hosted, Latin subset, metric-matched fallbacks): Fraunces (display serif, plus italic), Hanken Grotesk (body), Kalam (handwritten notes, used sparingly).
- **Images:** `src/assets/img/` (originals). Graded photos come from `scripts/photos.py` (`photos/*-800|1600.webp`), portrait cut-outs from `scripts/portraits.py`, and newsroom images (synced from WordPress) live in `img/media/`. Use `{% photo src, alt, sizes, class, loading, priority %}`, which also accepts original pphfglobal.org URLs via `scripts/image-map.json`. A high-resolution hero photo exists at `photos/hero-community-{900,1600,2400}.webp` (from the original G8A5473.jpg).
- **Content is separate from design:**
  - All page copy lives in `src/_data/copy/*.yml`, one file per page. Templates name their file with `copyKey:`, and `src/pages/pages.11tydata.js` maps title, heading, lead and so on.
  - Theme pages are `src/themes/*.md`; projects are `src/projects/*.md`.
  - Global data is in `src/_data/*.json` (site, nav, team, partners, testimonials, decade, videos, reports, publications).
  - The newsroom snapshot is `data/media/*.json`, refreshed with `scripts/sync_media.py`.
- **Lighthouse (mobile, local):** homepage 95–96 performance and 100 for accessibility, best practices and SEO. Inner pages 96–100. CLS 0.
- `vercel.json` sends `X-Robots-Tag: noindex` on staging; remove it at launch.

## 4. Pages (all exist and pass tests)

Home · About · Team · Technical Capacity · DD Documents · PPHF@10 (`/a-decade-of-catalysing-change/`) · Our Work (themes) · 6 theme pages · Signature Programs (brochure viewer) · Ongoing and Past Projects plus 26 project pages · Outreach · AASTHA · DEESHA · Donate (new) · Flood Relief Appeal 2026 · Partnership · Corporate Volunteering · PULSE Fund · Internship · Vacancies (plus items) · RFP/EOI (plus items) · Newsroom `/media/` · Blogs & News · Press · Events · Gallery (plus albums) · Videos · Publications · Reports · Annual Reports (plus flipbook viewers) · Contact · 404. About 400 pages in total.

**Get Involved** and **Media** pages each share one header with a sticky row of section tabs (`partials/media-head.njk`, `mediaGroup: involve | media`). Donate and the Flood Appeal have their own bespoke heads.

## 5. Current design ("The Thread")

Full rationale in `DESIGN.md`.

- **Concept:** "People to People". Health is passed hand to hand: donor → PPHF → health system → community → a person. An orange "thread" line and route motif express this. The colours, from the brand, sit on a clean **white** page (the owner rejected a warm cream background):
  - navy `#002060` / `#001640` for headings and dark sections
  - orange `#FF5B00` for the thread and the CTA only
  - green `#4CA146` for proof
  - magenta `#E01483` for human moments
  - cool grey panels `#F2F4F8`
- **Homepage order (donor psychology):**
  1. Hero: two photos set inside the headline; on scroll, one grows full-screen with the impact stats over it.
  2. Flood appeal, with water rising through the section on scroll.
  3. "How your support travels": a pinned sideways journey with a marker riding the thread.
  4. "Six ways to care": expanding vertical photo panels.
  5. Testimonials: pinned, one quote at a time, words light up.
  6. "Every rupee accounted for": a grid of evidence with stamps and documents.
  7. PPHF@10: a big year that changes as you scroll.
  8. Partners: a 3D logo drum.
  9. Ways to give.
  10. From the field: stories and films.
  11. Who we are: vision, mission, values, CEO quote, facts.
  12. Closing call joined to the footer.
- **Chrome:** an urgent flood-appeal ribbon at the top, a sticky header with mega menus, the EN/हिं switch and an orange Donate button. On phones, a floating bottom dock (Donate, Menu) and a bottom-sheet menu.

## 6. Owner feedback so far (most important section)

**Owner's brief:** go all out on creativity and motion, but stay tasteful and not "an Apple product page on every page". Give it a premium feel. Narrow, contained layouts, like useorigin.com. Smooth, interactive motion, like slush.app (but calmer). Creative scroll sections, like learnwithzero.com. Answer directly, minimal fluff. Ask questions in one batch when needed. The owner admits they don't have a big design vocabulary, so make real design decisions.

**References** (study them properly; the first attempt skipped this and the owner noticed):
- https://learnwithzero.com
- https://slush.app
- https://useorigin.com
- https://styles.refero.design: the Slush page (`/style/8b6b547f-…`) and the Origin Financial page (`/style/c60f05ff-…`)
- https://craftwork.design/inspiration/websites
- https://www.awwwards.com/websites/

**Liked:**
- the clean white background
- the sticky header
- the flood section with rising water and waves
- the 3D partner drum
- "Pick up the thread" (ways to give)
- the PPHF@10 sticky big-year section on the homepage (as a section)
- "Who we are"
- the Team page design
- combining stories and videos in one section
- the hand-drawn touches (handwritten notes)

**Disliked (round 1):**
- generic two-column hero
- "scroll animations" that were just sections shrinking slightly
- hover-to-reveal-image lists
- generic layouts that felt like a template
- bugs the owner had to find (a line crossing buttons, broken dots, overlaps)
- a newsroom that looked dated
- a plain Contact page
- a weak Videos page
- odd padding on report covers
- inconsistent Get Involved pages

**Disliked (round 2, on the current `main`):**
- **Hero:** better, but after the zoom it's a big photo with a thin strip of stats. Large but empty, lacking substance.
- **"How your support travels":** creative, but could be better.
- **"Six ways to care":** vertical panel names are hard to read and hover doesn't look good. Revamp it.
- **Testimonials:** unique, but feels empty, with blank space left and right and no media.
- **Inset sections:** sections with a slight side margin and rounded corners look bad. Either run full width with no rounding (**this is now done**) or match the content container width.
- **Partners:** the gap between the paragraph and the drum is too big.
- **"From the field":** looks like a generic blog section, and the video part isn't aesthetic.
- **CEO quote ("Who we are"):** empty space under it.
- **Footer:** remove the giant "People to People" wordmark (it is currently **back**, because of the revert).
- **About:**
  - The header image should be bigger.
  - "Our Solutions" is too text-heavy and needs graphics.
  - "What sets us apart" has an empty bottom-left.
  - Too much padding between the advisory council and team sections.
- **Team page:** the padding between sections could be smaller.
- **Technical Capacity:** thin, with one image in the same frame as About. It feels cheap.
- **DD Documents:** too much padding under the header.
- **PPHF@10:**
  - The number strip's borders look weird.
  - Stop using the tilted polaroid photo frame everywhere; be creative with images.
  - Replace the drag timeline with something creative and functional.
  - Milestones could be prettier.
  - Focus areas lack media.
  - "Next decade" has an empty right column.
- **Contact:** lacks media.
- **Overall:** too few photos and graphics, too many walls of text.

**Round 3 (`experiment/second-review-round`) tried fixes but was rejected for the look:**
- the hero photo flies into a mosaic of photos and stat tiles
- an arch image shape everywhere
- a scrolling cause story
- testimonial photos

The owner reverted to the round-2 design (kept as the base), keeping only full-width sections, the bento grid fix and the Videos reel fix.

**The next round** will be a full "go all out" redesign on top of `backup/2026-11-05`, aiming for genuinely premium, award-level visual quality. Expect a detailed prompt from the owner.

## 7. Lessons (don't repeat these)

1. **Review your own work at real size before reporting.** Record scroll frames with Playwright at 1440×900 and 390×844, look at each frame, and fix overlaps, empty areas, clipped text and layout bugs. Check every page type, not just the homepage.
2. Read the owner's references properly before designing.
3. Avoid "safe" layouts: two-column heroes, rows of identical cards, hover-reveal lists, generic blog grids.
4. Don't break existing features while editing. A big search-and-replace once deleted the Videos picker; grep afterwards.
5. JS-added classes need the prune-css safelist (§3).
6. Keep Lighthouse 90+ on mobile; lazy-load heavy motion.
7. Stay within the content rules (§1). No stock photos, fake testimonials or invented numbers.

## 8. Open TODOs (need facts from PPHF; see `TODO.md`)

- Online payment link (`copy/donate.yml` → `paymentUrl`); until then, Donate opens a pre-filled email.
- Bank and UPI details.
- 80G deduction rate and validity.
- FCRA status (foreign donations).
- Whether monthly giving is supported.
- Real "₹X does Y" amounts (none invented).
- Whether the flood appeal figures are still current.
- PULSE Fund partners (announced 15 Nov).
- A current internship role (the listed one closed in 2024).
- A contact form endpoint.
- At launch: remove `noindex` and have a Hindi speaker check the translation.

## 9. Quick start for the next session

```bash
git clone https://github.com/Finntrado/pphf-redesign-v2 && cd pphf-redesign-v2
git checkout backup/2026-11-05      # or main (identical at handoff); branch off for the new work
npm install
npm run serve                        # http://localhost:8080
npm test                             # build + verification suite
```

Push to `main` to deploy to Vercel staging.
