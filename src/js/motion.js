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

  /* ① Hero: the second photograph in the headline flies out of the words into the big slot of a
        mosaic; the impact figures and more programme photographs land around it. */
  const hero = $("[data-xhero]");
  if (hero) {
    const pin = $(".xhero__pin", hero);
    const stage = $("[data-xhero-stage]", hero);
    const pill = $("[data-xhero-pill]", hero);
    const copy = $("[data-xhero-copy]", hero);
    const hole = $("[data-xhero-hole]", hero);
    const tiles = $$("[data-xhero-tile]", hero);
    const flyer = document.createElement("figure");
    flyer.className = "xhero__flyer"; flyer.setAttribute("aria-hidden", "true");
    const fimg = $("img", hole).cloneNode(); fimg.loading = "eager"; fimg.alt = "";
    flyer.append(fimg);
    pin.append(flyer);
    const setChrome = () => root.style.setProperty("--top-chrome", Math.round(hero.getBoundingClientRect().top + window.scrollY) + "px");
    setChrome();
    const boxOf = (el) => {
      const r = el.getBoundingClientRect(), s = pin.getBoundingClientRect();
      return { top: r.top - s.top, left: r.left - s.left, width: r.width, height: r.height };
    };
    const from = () => boxOf(pill);
    const to = () => boxOf(hole);
    gsap.set(flyer, { ...from(), borderRadius: from().height / 2, opacity: 0 });
    gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: hero, start: "top top", end: "+=200%", pin, scrub: 0.7, invalidateOnRefresh: true, onRefreshInit: setChrome,
        onUpdate: (self) => stage.classList.toggle("is-live", self.progress > 0.85) },
    })
      .fromTo(flyer, { opacity: 0 }, { opacity: 1, duration: 0.01 }, 0)
      .fromTo(flyer, { top: () => from().top, left: () => from().left, width: () => from().width, height: () => from().height, borderRadius: () => from().height / 2 },
        { top: () => to().top, left: () => to().left, width: () => to().width, height: () => to().height, borderRadius: 22, ease: "power2.inOut", duration: 1 }, 0)
      .to(copy, { opacity: 0, y: -40, filter: "blur(6px)", ease: "power1.in", duration: 0.45 }, 0.05)
      .fromTo(tiles, { opacity: 0, scale: 0.86, y: 40 }, { opacity: 1, scale: 1, y: 0, stagger: { each: 0.08, from: "random" }, duration: 0.4, ease: "power2.out" }, 0.55)
      .to({}, { duration: 0.3 });
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
      // Draw the wave at the real width (no stretching, so the dash maths stays exact)
      const n = Math.max(4, Math.round(W / 170)), step = W / n;
      let d = `M0 30 C ${step * 0.35} 16 ${step * 0.65} 16 ${step} 30`;
      for (let k = 2; k <= n; k++) d += ` S ${step * (k - 0.35)} ${k % 2 ? 16 : 44} ${step * k} 30`;
      line.setAttribute("viewBox", `0 0 ${W} 60`);
      path.setAttribute("d", d);
      const L = path.getTotalLength();
      table = Array.from({ length: 241 }, (_, i) => { const pt = path.getPointAtLength((L * i) / 240); return [pt.x / W, pt.y]; });
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

  if (document.readyState === "complete") requestAnimationFrame(() => ScrollTrigger.refresh());
  else window.addEventListener("load", () => ScrollTrigger.refresh());
})();
