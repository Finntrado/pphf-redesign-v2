# PPHF — Design direction ("The Thread")

## The idea

The organisation is called **People to People**. Health here doesn't arrive by parcel. It's passed along by hand: a donor to PPHF, PPHF to a district health team, a trained health worker to an ASHA, an ASHA to a mother in a village in Balangir. The site is built around that chain.

One **orange thread** runs through the site. It's a single hand-drawn line that draws itself as you scroll, links one section to the next, and ends at the person the work is for. It's the brand's orange (the colour of the CTA), so the eye learns that orange means "this is where you come in".

Under it sits a **field register** feel: the ruled ledgers, rubber stamps, pinned photographs and margin notes of public-health work on the ground in India, set on a clean white page so the photographs, the navy and the orange do the talking. Trust signals (ISO, Fitch grading, 80G) are shown as stamps, because in India a stamp is what makes a document count.

### Three words
**Compassionate · grounded · clear**

- *Compassionate*: people first. Real photographs from PPHF's own programmes, first-person voices, nothing glossy.
- *Grounded*: a register, a ledger, a stamp. Numbers set like entries, proof before persuasion, every claim traceable to a document.
- *Clear*: a clean white page, generous space, one accent colour. Nothing competes with the people in the photographs.

## Who it's for, and in what order (homepage)

First priority is a **prospective donor or CSR partner**. Second is **anyone who wants to understand the organisation**, so the homepage carries everything essential about PPHF too.

The order follows the path a giver's mind takes: *feel → act now → believe → understand → choose → give*.

1. **Hero: who, what, where, in one breath.** "Health, passed from people to people." Real field photographs pinned like a relay. The two actions (Donate · Partner with us) and a trust line (Section 8 · 80G · ISO 9001:2015 · Fitch-graded) sit above the fold. *Emotion plus credibility in the first screen.*
2. **The urgent appeal: Bihar floods.** Specific numbers (48.70 lakh people, 15 districts) and one button. *Urgency is the strongest trigger, so it comes early, but after we've said who we are.*
3. **Proof in numbers.** 35.5 million lives · 80+ partnerships · 27+ states & UTs · since 2016. Big ledger figures that count up. *Scale reassures: "these people can deliver".*
4. **How your support travels (the thread).** A scroll-drawn route: You → PPHF → the health system (skills, technical support) → the community (support systems, access) → a person. Built from PPHF's own strategic approach and its three key areas. *Answers "where does my money actually go?", the #1 donor objection.*
5. **Where it goes: six thematic areas.** An index of large serif names with photographs that follow the cursor (a tap-to-open list on phones). *Lets a donor find the cause they care about.*
6. **Voices.** The real testimonials (a flood-affected resident, a patient, a CHO, a CSR head), as a deck of field cards you can flip through. *Social proof from beneficiaries and funders both.*
7. **Why give through PPHF.** "What sets us apart" set as a ledger: 90% private funding, 90% of funds go to programmes, ISO, M&E. Certifications stamp themselves onto the page, with links to the 80G/12AA/CSR-1 documents and the annual report. *Removes the risk.*
8. **Ten years.** The PPHF@10 timeline as a draggable strip. *Longevity equals reliability.*
9. **Partners who believe in us.** A slow logo marquee. *"People like me already trust them."*
10. **Ways to give.** One big Donate panel, then Partner (CSR), Corporate volunteering, PULSE Fund and Internship as ruled rows. *The ask, with a door for every kind of visitor.*
11. **From the field.** In Focus stories and three films. *Shows it's alive and current.*
12. **PPHF at a glance.** Vision, mission and values; registration; leadership quote; offices; documents. *For the second audience: everything they'd look for, on the homepage.*
13. **Closing line and footer.**

## Typography

- **Fraunces** (variable, soft optical axis): display and headings. Warm and slightly old-world, with human italics for emphasis ("people *to* people"). Self-hosted, Latin subset, weight axis only, roman and italic.
- **Hanken Grotesk** (variable): body and UI. Quiet, legible, slightly humanist.
- **Kalam** (by the Indian Type Foundry): handwritten margin notes only, never for body text. Used in small doses like a field worker's annotations ("35.5M and counting", "you are here").
- All three are self-hosted and preloaded with metric-matched fallbacks (`size-adjust`), so nothing shifts when they load.

Scale: display `clamp(2.6rem, 7.2vw, 6rem)` at 400 weight with tight leading (0.98); h2 `clamp(2rem, 4.4vw, 3.4rem)`; body 17–18px/1.6; labels are 12–13px uppercase sans with +0.08em tracking.

## Colour

Brand colours sampled from pphfglobal.org on a clean white page (changed from a warm cream after review).

| Token | Value | Role |
|---|---|---|
| `--paper` | `#FFFFFF` | Page background |
| `--paper-2` | `#F2F4F8` | Inset sheets (cool grey) |
| `--paper-3` | `#E3E7EF` | Placeholders, deeper panels |
| `--ink` | `#14213D` | Body text |
| `--navy` | `#002060` | Brand navy: headings, night sheets |
| `--night` | `#001640` | Darkest sheet (appeal, footer) |
| `--thread` | `#FF5B00` | Brand orange: the thread, primary CTA, nothing else |
| `--thread-ink` | `#C2410C` | Orange for small text on paper (AA) |
| `--leaf` | `#4CA146` → text `#2F7A2A` | Proof: checks, "verified", certifications |
| `--rose` | `#E01483` → text `#B0106A` | Human moments: quotes, voices |
| `--muted` | `#5B6175` | Secondary text |

Rules: orange is the thread and the CTA, never decoration. Navy text sits on orange buttons (white on orange fails AA at normal sizes). Dark "night" sheets are used two or three times per page at most.

## Layout

- **Narrow and contained**, like Origin: content max 1120px; reading measure about 640px; generous vertical rhythm.
- **Sheets**: big sections are rounded "sheets" of paper (radius 28px; 20px on phones) inset 10–16px from the viewport edge, stacked on the page. Some stick and stack as you scroll on the homepage.
- **Asymmetry on purpose**: no rows of three identical cards. Lists are ledgers (ruled, numbered), indices (big type plus a hover image), decks (stacked cards), or a lead item with ruled rows.
- **Phone first**: a floating **bottom dock** (Donate · Menu · हिन्दी) within thumb reach, like Zero's dock. On desktop, a compact top bar keeps the logo, navigation and Donate.

## Motion (revised after review: set pieces, not fade-ins)

Built with GSAP ScrollTrigger and Lenis smooth scrolling. The GSAP bundle (`motion.js`) loads only on the homepage, and only on the visitor's first scroll, touch or key press, so it never slows the first paint.

1. **Hero:** two photographs sit inside the headline. On scroll the second grows from its pill until it fills the screen, the headline dissolves, and the four impact figures rise over the photograph one at a time.
2. **Flood appeal:** floodwater (with a moving wave edge) rises through the section as you scroll. The words stay readable as dark-on-white above the waterline and white-on-navy below it.
3. **Journey:** the section pins and travels sideways. A marker rides the orange thread, the line draws behind it, and each stop's number lights up as the marker reaches it. On phones it becomes a vertical route.
4. **Causes:** six photo panels. The one you point at, focus or tap opens; on phones they scroll sideways.
5. **Voices:** the section pins on one testimonial at a time, and its words light up as you scroll.
6. **Trust:** an evidence bento where every claim links to its document.
7. **PPHF@10:** a large year turns over as each milestone passes the middle of the screen.
8. **Partners:** a 3D drum of logos that spins faster while you scroll.

With reduced motion, or if the script can't start, every section falls back to a plain static layout with all content visible.

## Language

English content. A **हिन्दी** switch translates the whole page with Google's website translator, which is **loaded only when someone asks for it** (no cost to page speed for everyone else). The choice is remembered across pages.

## Imagery

Only PPHF's own photographs and documents. Photos get one warm, consistent grade. Portraits keep the shared cut-out treatment, set on a cool grey backdrop. No stock, no emoji, no icon-in-a-circle triplets. Icons are a small hand-drawn-feeling line set at 1.75px stroke.

## Hard no's honoured

No gradient hero. No "Welcome to…". No three-identical-card rows. No emoji icons. No stock people. No invented testimonials or figures. Missing facts (payment link, bank details, per-amount outcomes) are visible `TODO` markers listed in `TODO.md`.
