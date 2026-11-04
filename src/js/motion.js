// Scroll set pieces for the homepage (loaded only on pages with `motion: true`).
// Everything here is enhancement: without it (or with reduced motion) the page is fully laid out.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.registerPlugin(ScrollTrigger);
  const root = document.documentElement;
  const lenis = window.lenis;
  if (lenis) lenis.on("scroll", ScrollTrigger.update);
  root.classList.add("has-motion");
  window.__motionReady = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const mm = gsap.matchMedia();

  /* ① Hero: the second photograph in the headline grows until it fills the screen;
        then the impact figures arrive over it, one after another. */
  const hero = $("[data-xhero]");
  if (hero) {
    const pin = $(".xhero__pin", hero);
    const stage = $("[data-xhero-stage]", hero);
    const pill = $("[data-xhero-pill]", hero);
    const copy = $("[data-xhero-copy]", hero);
    const label = $(".xhero__facts > .label", stage);
    const stats = $$("[data-xhero-stat]", stage);
    const caption = $(".xhero__caption", stage);
    const setChrome = () => root.style.setProperty("--top-chrome", `${Math.round(hero.getBoundingClientRect().top + window.scrollY)}px`);
    setChrome();
    const shade = $(".xhero__shade", stage);
    // The stage starts exactly over the inline photograph (same image, same framing) and grows to fill the pinned frame.
    const pillBox = () => {
      const p = pill.getBoundingClientRect(), s = pin.getBoundingClientRect();
      return { top: p.top - s.top, left: p.left - s.left, width: p.width, height: p.height, borderRadius: p.height / 2 };
    };
    gsap.set(stage, { right: "auto", bottom: "auto", clipPath: "none", opacity: 0, ...pillBox() });
    gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: hero, start: "top top", end: "+=240%", pin, scrub: 0.7, invalidateOnRefresh: true, onRefreshInit: setChrome },
    })
      .fromTo(stage, { opacity: 0, ...pillBox() }, { opacity: 1, duration: 0.02 }, 0)
      .fromTo(stage, { top: () => pillBox().top, left: () => pillBox().left, width: () => pillBox().width, height: () => pillBox().height, borderRadius: () => pillBox().borderRadius },
        { top: 0, left: 0, width: () => pin.clientWidth, height: () => pin.clientHeight, borderRadius: 0, ease: "power2.inOut", duration: 1 }, 0)
      .fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.45)
      .to(copy, { opacity: 0, scale: 0.92, filter: "blur(6px)", ease: "power1.in", duration: 0.5 }, 0.08)
      .fromTo(label, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.2 }, 0.95)
      .fromTo(stats, { opacity: 0, y: 50 }, { opacity: 1, y: 0, stagger: 0.22, duration: 0.3, ease: "power2.out" }, 1.05)
      .fromTo(caption, { opacity: 0 }, { opacity: 1, duration: 0.2 }, ">-0.05")
      .to({}, { duration: 0.35 });
  }

  /* ② Flood appeal: the water level rises through the section. */
  $$("[data-flood]").forEach((sec) => {
    gsap.fromTo(sec, { "--lvl": "100%" }, {
      "--lvl": "0%", ease: "none",
      scrollTrigger: { trigger: sec, start: "top 85%", end: "bottom 80%", scrub: 0.5 },
    });
  });

  /* ③ Journey: on wide screens the section pins and travels sideways; the thread draws
        up to a marker that rides the line, and each stop lights up as the marker reaches it. */
  mm.add("(min-width: 1000px)", () => {
    const sec = $("[data-journey]");
    if (!sec) return;
    const pinEl = $(".journey__pin", sec);
    const mover = $("[data-journey-mover]", sec);
    const line = $(".journey__line", sec);
    const path = $("[data-journey-path]", sec);
    const dot = $("[data-journey-dot]", sec);
    const stops = $$(".stop", sec);
    let W = 0, table = [];
    const measure = () => {
      W = mover.scrollWidth;
      mover.style.setProperty("--track-w", `${W}px`);
      // look-up table of the line's y for a given x (the path is drawn in a 1000×60 box, stretched to W×60)
      const L = path.getTotalLength();
      table = Array.from({ length: 241 }, (_, i) => { const pt = path.getPointAtLength((L * i) / 240); return [pt.x / 1000, pt.y]; });
    };
    const yAt = (t) => { for (let i = 1; i < table.length; i++) if (table[i][0] >= t) { const [x0, y0] = table[i - 1], [x1, y1] = table[i]; return y0 + ((y1 - y0) * (t - x0)) / ((x1 - x0) || 1); } return 30; };
    const dist = () => Math.max(0, W - window.innerWidth + 80);
    measure();
    const st = ScrollTrigger.create({
      trigger: sec, start: "top top", end: () => `+=${dist()}`, pin: pinEl, scrub: 0.8, invalidateOnRefresh: true,
      onRefreshInit: measure,
      animation: gsap.to(mover, { x: () => -dist(), ease: "none" }),
      onUpdate: (self) => {
        const x = -dist() * self.progress;
        const head = Math.min(W, Math.max(0, -x + window.innerWidth * 0.42));
        const t = head / W;
        line.style.setProperty("--p", t.toFixed(4));
        dot.style.setProperty("--tx", `${head}px`);
        dot.style.setProperty("--ty", `${-8 + yAt(t)}px`);
        stops.forEach((s) => s.classList.toggle("is-on", s.offsetLeft <= head + 4));
      },
    });
    return () => { st.kill(); gsap.set(mover, { clearProps: "transform" }); stops.forEach((s) => s.classList.remove("is-on")); };
  });

  /* ⑤ Voices: the section pins; each testimonial's words light up as you scroll, then the next one comes in. */
  const voices = $("[data-voices]");
  if (voices) {
    const items = $$("[data-voice]", voices);
    const counter = $("[data-voice-n]", voices);
    const words = items.map((li) => {
      const q = $("[data-words]", li);
      const parts = q.textContent.split(/(\s+)/);
      q.innerHTML = parts.map((w) => (/^\s+$/.test(w) ? w : `<span class="w">${w.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`)).join("");
      return $$(".w", q);
    });
    let cur = 0;
    ScrollTrigger.create({
      trigger: voices, start: "top top", end: `+=${items.length * 85}%`, pin: $(".voices__pin", voices), scrub: true,
      onUpdate: (self) => {
        const p = self.progress * items.length;
        const i = Math.min(items.length - 1, Math.floor(p));
        const local = Math.min(1, (p - i) * 1.35);
        if (i !== cur) { items[cur].classList.remove("is-current"); items[i].classList.add("is-current"); cur = i; counter.textContent = String(i + 1).padStart(2, "0"); }
        const ws = words[i], lit = Math.round(local * ws.length);
        ws.forEach((w, k) => w.classList.toggle("is-lit", k < lit));
        words.forEach((other, j) => { if (j < i) other.forEach((w) => w.classList.add("is-lit")); });
      },
    });
  }

  /* ⑦ Decade: the big year turns over as each milestone reaches the middle of the screen. */
  const decade = $("[data-decade]");
  if (decade) {
    const yearEl = $("[data-decade-year]", decade);
    const items = $$("[data-decade-item]", decade);
    const set = (it) => { items.forEach((x) => x.classList.toggle("is-on", x === it)); yearEl.textContent = it.dataset.year.replace("–", "–"); };
    items.forEach((it) => ScrollTrigger.create({ trigger: it, start: "top 60%", end: "bottom 60%", onToggle: (self) => self.isActive && set(it) }));
    set(items[0]);
  }

  /* ⑧ Partners: the drum turns slowly on its own, and faster while you scroll. */
  const ring = $("[data-drum-ring]");
  if (ring) {
    let angle = 0, boost = 0, visible = false;
    ScrollTrigger.create({ trigger: ring, start: "top bottom", end: "bottom top", onToggle: (s) => (visible = s.isActive), onUpdate: (s) => (boost += s.getVelocity() / 900) });
    gsap.ticker.add((_, dt) => {
      if (!visible) return;
      boost *= 0.92;
      angle -= (dt / 1000) * 5 + boost * 0.05;
      ring.style.setProperty("--ry", `${angle.toFixed(2)}deg`);
    });
  }

  /* Headings: lines rise into place the first time they're seen. */
  $$(".page-home .sec-head h2, .page-home .journey__head h2, .page-home .decade__side h2").forEach((h) => {
    gsap.from(h, { yPercent: 40, opacity: 0, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: h, start: "top 88%" } });
  });

  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
