// PPHF site behaviour ("The Thread"). Progressive enhancement only: every page works without JS.
import Lenis from "lenis";

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const root = document.documentElement;
  if (reduceMotion) root.classList.add("no-motion");

  /* ---------- Smooth scrolling (Lenis). Off for reduced motion; motion.js syncs ScrollTrigger to it. ---------- */
  const lenis = reduceMotion ? null : new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4), anchors: { offset: -96 }, autoRaf: true });
  window.lenis = lenis;
  const onScrollFrame = (fn) => { let t = false; const run = () => { t = false; fn(); }; window.addEventListener("scroll", () => { if (!t) { t = true; requestAnimationFrame(run); } }, { passive: true }); window.addEventListener("resize", () => requestAnimationFrame(fn), { passive: true }); fn(); };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  /* ---------- Header state + phone dock tucks away while reading down, returns on scroll up ---------- */
  const header = document.querySelector("[data-header]");
  const dock = document.querySelector("[data-dock]");
  let lastY = window.scrollY;
  onScrollFrame(() => {
    const y = window.scrollY;
    header?.classList.toggle("is-scrolled", y > 8);
    if (dock) {
      const nearEnd = y + window.innerHeight > document.documentElement.scrollHeight - 40;
      dock.classList.toggle("is-tucked", y > lastY + 4 && y > 400 && !nearEnd);
      if (y < lastY - 4 || nearEnd) dock.classList.remove("is-tucked");
    }
    lastY = y;
  });

  /* ---------- Desktop mega menus ---------- */
  const toggles = [...document.querySelectorAll("[data-menu-toggle]")];
  const closeAll = (except) => toggles.forEach((t) => {
    if (t === except) return;
    t.setAttribute("aria-expanded", "false");
    document.getElementById(t.getAttribute("aria-controls")).hidden = true;
  });
  toggles.forEach((t) => {
    const menu = document.getElementById(t.getAttribute("aria-controls"));
    const item = t.closest(".nav__item");
    const open = () => { closeAll(t); t.setAttribute("aria-expanded", "true"); menu.hidden = false; };
    const close = () => { t.setAttribute("aria-expanded", "false"); menu.hidden = true; };
    t.addEventListener("click", () => (t.getAttribute("aria-expanded") === "true" ? close() : open()));
    let timer;
    item.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { clearTimeout(timer); open(); } });
    item.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { timer = setTimeout(close, 180); } });
    item.addEventListener("focusout", (e) => { if (!item.contains(e.relatedTarget)) close(); });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const o = toggles.find((t) => t.getAttribute("aria-expanded") === "true");
    if (o) { closeAll(); o.focus(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".nav")) closeAll(); });

  /* ---------- Drawer (bottom sheet) ---------- */
  const drawer = document.querySelector("[data-drawer]");
  const openBtn = document.querySelector("[data-drawer-open]");
  if (drawer && openBtn) {
    const closeBtn = drawer.querySelector("[data-drawer-close]");
    const setOpen = (on) => {
      drawer.hidden = !on;
      openBtn.setAttribute("aria-expanded", String(on));
      document.body.classList.toggle("no-scroll", on);
      if (lenis) on ? lenis.stop() : lenis.start();
      (on ? closeBtn : openBtn).focus();
    };
    openBtn.addEventListener("click", () => setOpen(true));
    closeBtn.addEventListener("click", () => setOpen(false));
    drawer.addEventListener("click", (e) => { if (e.target === drawer) setOpen(false); });
    drawer.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        const f = [...drawer.querySelectorAll("a, button, summary")].filter((el) => el.offsetParent !== null);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.matchMedia("(min-width: 1080px)").addEventListener("change", (m) => { if (m.matches && !drawer.hidden) setOpen(false); });
  }

  /* ---------- Language: Google's website translator, loaded only when someone asks for Hindi ---------- */
  const langBtns = [...document.querySelectorAll("[data-lang]")];
  const setCookie = (v) => {
    const host = location.hostname;
    const exp = v ? "" : "; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = `googtrans=${v}; path=/${exp}`;
    if (host.includes(".")) document.cookie = `googtrans=${v}; path=/; domain=.${host.split(".").slice(-2).join(".")}${exp}`;
  };
  let gtLoading = null;
  const loadTranslator = () => gtLoading || (gtLoading = new Promise((resolve) => {
    window.__gtInit = () => {
      // eslint-disable-next-line no-undef
      new google.translate.TranslateElement({ pageLanguage: "en", includedLanguages: "hi,en", autoDisplay: false }, "gt-host");
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://translate.google.com/translate_a/element.js?cb=__gtInit";
    s.async = true;
    s.onerror = () => resolve();
    document.head.append(s);
  }));
  const pickHindi = (tries = 0) => {
    const sel = document.querySelector("#gt-host select.goog-te-combo");
    if (!sel) { if (tries < 40) setTimeout(() => pickHindi(tries + 1), 150); return; }
    sel.value = "hi";
    sel.dispatchEvent(new Event("change"));
  };
  const markLang = (hi) => {
    langBtns.forEach((b) => { b.setAttribute("aria-pressed", String(hi)); b.classList.remove("is-loading"); });
    root.classList.toggle("is-hi", hi);
  };
  if (root.classList.contains("is-hi")) { markLang(true); loadTranslator(); }
  langBtns.forEach((b) => b.addEventListener("click", async () => {
    const hi = b.getAttribute("aria-pressed") !== "true";
    if (hi) {
      b.classList.add("is-loading");
      setCookie("/en/hi");
      await loadTranslator();
      pickHindi();
      markLang(true);
    } else {
      setCookie("");
      markLang(false);
      location.reload();
    }
  }));

  /* ---------- Dialogs ---------- */
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-dialog]");
    if (opener) {
      const dlg = document.getElementById(opener.dataset.dialog);
      if (dlg && dlg.showModal) { dlg.showModal(); dlg._opener = opener; }
      return;
    }
    const closer = e.target.closest("[data-dialog-close]");
    if (closer) closer.closest("dialog").close();
    if (e.target.tagName === "DIALOG") e.target.close();
  });
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("close", () => d._opener?.focus()));

  /* ---------- Reveal + one-shot "in view" classes ---------- */
  const inView = (els, cls = "is-in", opts = { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) => {
    if (reduceMotion || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add(cls)); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add(cls); io.unobserve(en.target); } }), opts);
    els.forEach((el) => io.observe(el));
  };
  inView(document.querySelectorAll(".reveal"));
  inView(document.querySelectorAll("[data-stamps]"), "is-in", { threshold: 0.3 });

  /* ---------- The thread: each line draws in step with scrolling past it ---------- */
  const threads = [...document.querySelectorAll("[data-thread]")];
  if (!reduceMotion && threads.length) {
    const vh = () => window.innerHeight;
    threads.forEach((t) => { t.style.setProperty("--p", "0"); if (t.getBoundingClientRect().top < window.innerHeight) { t.classList.add("is-intro"); setTimeout(() => t.classList.remove("is-intro"), 2200); } });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      onScrollFrame(() => {
        threads.forEach((t) => {
          const r = t.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh() + 200) return;
          // starts when its top reaches 90% of the viewport height, complete when its bottom reaches 55%
          const p = t.classList.contains("route__line")
            ? clamp01((vh() * 0.62 - r.top) / r.height) // the tip sits on the line where route steps light up
            : clamp01((vh() * 0.9 - r.top) / (r.height + vh() * 0.35));
          t.style.setProperty("--p", p.toFixed(4));
        });
      });
    }));
  }

  /* ---------- Route steps light up as the thread reaches them ---------- */
  const steps = [...document.querySelectorAll("[data-step]")];
  if (steps.length) {
    if (reduceMotion) steps.forEach((s) => s.classList.add("is-on"));
    else onScrollFrame(() => { const line = window.innerHeight * 0.62; steps.forEach((s) => s.classList.toggle("is-on", s.getBoundingClientRect().top < line)); });
  }

  /* ---------- Hero prints settle in, then drift slightly with the pointer ---------- */
  const prints = document.querySelector("[data-prints]");
  if (prints) {
    requestAnimationFrame(() => requestAnimationFrame(() => prints.classList.add("is-ready")));
    if (finePointer && !reduceMotion) {
      const cards = [...prints.querySelectorAll(".print")];
      prints.closest(".hero").addEventListener("pointermove", (e) => {
        const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
        cards.forEach((c, i) => { const k = (i + 1) * 6; c.style.setProperty("--px", `${(x * k).toFixed(1)}px`); c.style.setProperty("--py", `${(y * k).toFixed(1)}px`); });
      });
    }
  }

  /* ---------- Cause index: a photograph follows the pointer ---------- */
  document.querySelectorAll("[data-tindex]").forEach((list) => {
    const stage = list.parentElement.querySelector("[data-peek-stage]");
    if (!stage || !finePointer) return;
    const imgs = [...stage.children];
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0, lastX = 0;
    const loop = () => {
      x += (tx - x) * 0.16; y += (ty - y) * 0.16;
      stage.style.setProperty("--x", `${x}px`); stage.style.setProperty("--y", `${y}px`);
      stage.style.setProperty("--rot", `${Math.max(-8, Math.min(8, (tx - lastX) * 0.4))}deg`);
      lastX = x;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    list.addEventListener("pointermove", (e) => { tx = e.clientX + 24; ty = e.clientY - 150; if (!raf) raf = requestAnimationFrame(loop); });
    list.querySelectorAll("[data-peek]").forEach((row) => {
      row.addEventListener("pointerenter", () => { stage.classList.add("is-on"); imgs.forEach((im, i) => im.classList.toggle("is-on", String(i) === row.dataset.peek)); });
    });
    list.addEventListener("pointerleave", () => stage.classList.remove("is-on"));
  });

  /* ---------- Drag-to-scroll rails (mouse); touch and keyboard scroll natively ---------- */
  const dragRail = (el) => {
    if (!finePointer) return;
    let down = false, sx = 0, sl = 0, moved = false;
    el.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = el.scrollLeft; });
    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; el.classList.add("is-dragging"); }
      el.scrollLeft = sl - dx;
    });
    window.addEventListener("pointerup", () => { if (!down) return; down = false; el.classList.remove("is-dragging"); });
    el.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    el.addEventListener("dragstart", (e) => e.preventDefault());
  };
  document.querySelectorAll("[data-drag], [data-deck]").forEach(dragRail);

  /* ---------- Voices deck: cards fan out by distance from centre; arrows step one card ---------- */
  document.querySelectorAll("[data-deck]").forEach((deck) => {
    const cards = [...deck.children];
    const sec = deck.closest("section");
    const step = (dir) => {
      const w = cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(deck).columnGap || 24);
      deck.scrollBy({ left: dir * w, behavior: reduceMotion ? "auto" : "smooth" });
    };
    sec.querySelector("[data-deck-prev]")?.addEventListener("click", () => step(-1));
    sec.querySelector("[data-deck-next]")?.addEventListener("click", () => step(1));
    deck.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { e.preventDefault(); step(1); } if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); } });
    if (reduceMotion) return;
    const fan = () => {
      const mid = window.innerWidth / 2;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const d = Math.max(-1.6, Math.min(1.6, (r.left + r.width / 2 - mid) / r.width));
        c.style.setProperty("--rot", `${(d * 3.2 + (i % 2 ? .6 : -.6)).toFixed(2)}deg`);
        c.style.setProperty("--lift", `${(Math.abs(d) * 14).toFixed(1)}px`);
      });
    };
    deck.addEventListener("scroll", () => requestAnimationFrame(fan), { passive: true });
    window.addEventListener("resize", fan, { passive: true });
    fan();
  });

  /* ---------- Footer link groups start folded on phones ---------- */
  if (window.matchMedia("(max-width: 699.98px)").matches) document.querySelectorAll(".foot__group").forEach((d) => (d.open = false));
  document.querySelectorAll(".foot__group summary").forEach((s) => s.addEventListener("click", (e) => { if (!window.matchMedia("(max-width: 699.98px)").matches) e.preventDefault(); }));

  /* ---------- Rails with arrow buttons ---------- */
  document.querySelectorAll("[data-rail]").forEach((rail) => {
    const sec = rail.closest("section");
    const step = (d) => rail.scrollBy({ left: d * Math.min(rail.clientWidth * 0.8, 600), behavior: reduceMotion ? "auto" : "smooth" });
    sec.querySelector("[data-rail-prev]")?.addEventListener("click", () => step(-1));
    sec.querySelector("[data-rail-next]")?.addEventListener("click", () => step(1));
  });

  /* ---------- Cause story: the cause crossing the middle of the screen becomes current ---------- */
  document.querySelectorAll("[data-cstory]").forEach((box) => {
    const items = [...box.querySelectorAll("[data-citem]")];
    const imgs = [...box.querySelectorAll("[data-cimg]")];
    const count = box.querySelector("[data-ccount]");
    let cur = 0;
    const set = (i) => {
      if (i === cur) return;
      items.forEach((x, j) => x.classList.toggle("is-on", j === i));
      imgs.forEach((x, j) => { x.classList.toggle("was-on", j === cur); x.classList.toggle("is-on", j === i); });
      cur = i;
      if (count) count.textContent = String(i + 1).padStart(2, "0");
    };
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) set(items.indexOf(e.target)); }), { rootMargin: "-48% 0px -48% 0px" });
    items.forEach((x) => io.observe(x));
  });

  /* ---------- Decade: the big year turns over as each milestone crosses the middle of the screen ---------- */
  document.querySelectorAll("[data-decade]").forEach((box) => {
    const yearEl = box.querySelector("[data-decade-year]");
    const items = [...box.querySelectorAll("[data-decade-item]")];
    const set = (it) => { items.forEach((x) => x.classList.toggle("is-on", x === it)); if (yearEl) yearEl.textContent = it.dataset.year; };
    if (items[0]) set(items[0]);
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) set(e.target); }), { rootMargin: "-45% 0px -45% 0px" });
    items.forEach((x) => io.observe(x));
  });

  /* ---------- Videos: pick a film from the reel to load it on the big screen ---------- */
  document.querySelectorAll("[data-cinema]").forEach((room) => {
    const title = room.querySelector("[data-cinema-title]");
    const num = room.querySelector("[data-cinema-n]");
    const picks = [...room.querySelectorAll("[data-cinema-pick]")];
    const playIcon = room.querySelector("[data-cinema-screen] .video__play")?.innerHTML || "";
    picks.forEach((b, i) => b.addEventListener("click", () => {
      picks.forEach((x) => { x.classList.toggle("is-current", x === b); if (x === b) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current"); });
      title.textContent = b.dataset.title;
      num.textContent = String(i + 1).padStart(2, "0");
      const old = room.querySelector("[data-cinema-screen]");
      const fresh = document.createElement("button");
      fresh.type = "button"; fresh.className = "video video--big"; fresh.dataset.cinemaScreen = ""; fresh.dataset.yt = b.dataset.id;
      fresh.setAttribute("aria-label", "Play video: " + b.dataset.title);
      fresh.innerHTML = '<img src="/assets/img/yt/' + b.dataset.id + '-640.webp" alt="" width="640" height="360"><span class="video__play">' + playIcon + "</span>";
      old.replaceWith(fresh);
      fresh.click();
      if (window.matchMedia("(max-width: 999.98px)").matches) fresh.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }));
  });

  /* ---------- Scroll set pieces (GSAP) load on the first scroll, touch or key press, so they never
     compete with the first paint. Nothing moves before then anyway. If the script fails to start,
     the sections fall back to their static layout. ---------- */
  const motionSrc = document.querySelector('meta[name="pphf-motion"]')?.content;
  if (motionSrc && !reduceMotion) {
    let started = false;
    const start = () => {
      if (started) return; started = true;
      ["wheel", "touchstart", "keydown", "pointerdown", "scroll"].forEach((ev) => window.removeEventListener(ev, start));
      const sc = document.createElement("script");
      sc.src = motionSrc; sc.async = true;
      sc.onerror = () => root.classList.add("motion-failed");
      document.head.append(sc);
      setTimeout(() => { if (!window.__motionReady) root.classList.add("motion-failed"); }, 6000);
    };
    if (window.scrollY > 10 || location.hash) start();
    else ["wheel", "touchstart", "keydown", "pointerdown", "scroll"].forEach((ev) => window.addEventListener(ev, start, { passive: true }));
  }

  /* ---------- Count-up numbers ---------- */
  const counters = document.querySelectorAll("[data-count]");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const fmt = (n, dec) => n.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split(".")[1] || "").length;
      const start = performance.now(), dur = 1600;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)), dec);
        if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(target, dec);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } }), { threshold: 0.5 });
    counters.forEach((el) => io.observe(el));
  }

  /* ---------- Donate form: amount + frequency + cause → payment link, or a prefilled email until one exists ---------- */
  document.querySelectorAll("[data-donate]").forEach((form) => {
    const params = new URLSearchParams(location.search);
    const custom = form.querySelector("[data-custom-amount]");
    const summary = form.querySelector("[data-donate-summary]");
    const cause = form.querySelector("select[name=cause]");
    if (params.get("for") && cause?.querySelector(`option[value="${params.get("for")}"]`)) cause.value = params.get("for");
    if (params.get("amount")) {
      const r = form.querySelector(`input[name=amount][value="${params.get("amount")}"]`);
      if (r) r.checked = true; else if (custom) custom.value = params.get("amount");
    }
    const value = () => {
      const fd = new FormData(form);
      const amt = Number(custom?.value) > 0 ? Number(custom.value) : Number(fd.get("amount"));
      return { amt, freq: fd.get("frequency"), cause: cause ? cause.options[cause.selectedIndex].text : "" };
    };
    const render = () => {
      const v = value();
      if (summary) summary.textContent = v.amt ? `₹${v.amt.toLocaleString("en-IN")} ${v.freq === "monthly" ? "every month" : "once"} · ${v.cause}` : "Choose an amount";
    };
    custom?.addEventListener("input", () => { if (custom.value) form.querySelectorAll("input[name=amount]").forEach((r) => (r.checked = false)); render(); });
    form.querySelectorAll("input[name=amount]").forEach((r) => r.addEventListener("change", () => { if (custom) custom.value = ""; render(); }));
    form.addEventListener("change", render);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = value();
      if (!v.amt) { custom?.focus(); return; }
      const pay = form.dataset.payment;
      if (pay) {
        const u = new URL(pay);
        u.searchParams.set("amount", v.amt); u.searchParams.set("frequency", v.freq); u.searchParams.set("purpose", v.cause);
        location.href = u.toString();
        return;
      }
      const body = `I would like to donate ₹${v.amt.toLocaleString("en-IN")} (${v.freq === "monthly" ? "monthly" : "one-time"}) to: ${v.cause}.\n\nName:\nPAN (for 80G receipt):\nAddress:\nPhone:\n`;
      location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(`Donation: ₹${v.amt.toLocaleString("en-IN")} ${v.freq === "monthly" ? "monthly" : "one-time"}, ${v.cause}`)}&body=${encodeURIComponent(body)}`;
      const st = form.querySelector("[data-form-status]");
      if (st) { st.hidden = false; st.textContent = "Your email app should open with your gift details filled in. We'll reply with payment details and your receipt."; }
    });
    render();
  });

  /* ---------- Contact: choosing who to talk to sets the form's recipient and subject ---------- */
  document.querySelectorAll("[data-contact-ways]").forEach((box) => {
    const form = box.querySelector("[data-contact-form]");
    const to = box.querySelector("[data-way-to]"), subj = box.querySelector("[data-way-subject]"), role = box.querySelector("[data-way-role]");
    box.querySelectorAll('input[name="way"]').forEach((r) => r.addEventListener("change", () => {
      form.dataset.mailto = r.dataset.email; to.textContent = r.dataset.email;
      subj.value = r.dataset.subject; role.value = r.closest(".way").querySelector(".way__t").textContent;
    }));
  });

  /* ---------- Contact form ---------- */
  const form = document.querySelector("[data-contact-form]");
  if (form) {
    const status = form.querySelector("[data-form-status]");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const endpoint = form.dataset.endpoint;
      if (endpoint) {
        try {
          const res = await fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } });
          if (!res.ok) throw new Error(res.statusText);
          form.reset();
          status.textContent = "Thank you. Your message has been sent, and we'll be in touch soon.";
          status.hidden = false;
          return;
        } catch { /* fall through to mailto */ }
      }
      const body = [`Name: ${data.get("name")}`, `Email: ${data.get("email")}`, `Phone: ${data.get("phone") || "-"}`, `I am: ${data.get("role") || "-"}`, "", data.get("message")].join("\n");
      window.location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(data.get("subject") || "Website enquiry")}&body=${encodeURIComponent(body)}`;
      status.textContent = "Your email app should open with your message ready to send.";
      status.hidden = false;
    });
  }

  /* ---------- Lite YouTube ---------- */
  document.addEventListener("click", (e) => {
    const v = e.target.closest("[data-yt]");
    if (!v || v.classList.contains("is-playing")) return;
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${v.dataset.yt}?autoplay=1&rel=0`;
    iframe.title = v.getAttribute("aria-label") || "YouTube video";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    v.classList.add("is-playing");
    v.replaceChildren(iframe);
  });

  /* ---------- Brochure viewer: one page at a time, scroll-snap underneath ---------- */
  document.querySelectorAll("[data-brochure]").forEach((viewer) => {
    const track = viewer.querySelector(".brochure");
    const pages = [...track.children];
    const count = viewer.querySelector("[data-brochure-count]");
    const prev = viewer.querySelector("[data-brochure-prev]");
    const next = viewer.querySelector("[data-brochure-next]");
    const thumbs = [...viewer.querySelectorAll("[data-brochure-go]")];
    const index = [...viewer.querySelectorAll("[data-brochure-go-index]")];
    const titleEl = viewer.querySelector("[data-brochure-title]");
    let current = 0;
    const go = (i) => {
      i = Math.max(0, Math.min(pages.length - 1, i));
      track.scrollTo({ left: pages[i].offsetLeft - track.offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
    };
    const update = () => {
      const i = Math.round(track.scrollLeft / (track.scrollWidth / pages.length));
      if (i === current && count.textContent) return;
      current = Math.max(0, Math.min(pages.length - 1, i));
      count.textContent = `${current + 1} / ${pages.length}`;
      prev.disabled = current === 0;
      next.disabled = current === pages.length - 1;
      thumbs.forEach((b, j) => b.setAttribute("aria-current", String(j === current)));
      index.forEach((b, j) => b.setAttribute("aria-current", String(j === current)));
      if (titleEl) titleEl.textContent = (pages[current].querySelector("img")?.alt || "").replace(/ \(brochure page.*$/, "");
      pages.forEach((p, j) => p.querySelector("img")?.setAttribute("loading", Math.abs(j - current) <= 1 ? "eager" : "lazy"));
    };
    prev.addEventListener("click", () => go(current - 1));
    next.addEventListener("click", () => go(current + 1));
    thumbs.forEach((b, j) => b.addEventListener("click", () => go(j)));
    index.forEach((b, j) => b.addEventListener("click", () => { go(j); viewer.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); }));
    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    count.textContent = "";
    update();
    viewer.classList.add("is-ready");
  });

  /* ---------- Long lists fold on phones (content stays in the page; a button reveals it) ---------- */
  const small = window.matchMedia("(max-width: 760px)");
  document.querySelectorAll("[data-clamp]").forEach((el, n) => {
    const max = +el.dataset.clamp || 160;
    if (!el.id) el.id = `fold-${n}`;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "fold-toggle"; btn.setAttribute("aria-controls", el.id);
    el.after(btn);
    const set = (open) => {
      el.classList.toggle("is-folded", !open);
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Show less" : "Show more";
    };
    const apply = () => {
      el.classList.remove("is-folded");
      const fold = small.matches && el.scrollHeight > max + 80;
      btn.hidden = !fold;
      el.style.setProperty("--fold", `${max}px`);
      if (fold) set(false);
    };
    btn.addEventListener("click", () => set(el.classList.contains("is-folded")));
    apply();
    small.addEventListener("change", apply);
  });

  /* ---------- State filter (project listings) ---------- */
  document.querySelectorAll("[data-filter-select]").forEach((sel) => {
    const wrap = sel.closest("[data-filter-select-wrap]");
    const scope = wrap.closest(".wrap");
    const grid = scope.querySelector("[data-filter-grid]");
    const count = scope.querySelector("[data-filter-count]");
    const items = [...grid.children];
    sel.addEventListener("change", () => {
      const v = sel.value;
      items.forEach((it) => { it.hidden = v !== "all" && !(it.dataset.states || "").split(" ").includes(v); });
      const n = items.filter((it) => !it.hidden).length;
      if (count) count.textContent = `Showing ${n} of ${items.length} projects`;
    });
    wrap.hidden = false;
  });

  /* ---------- Filter chips (publications) ---------- */
  document.querySelectorAll("[data-filter-chips]").forEach((bar) => {
    const count = bar.parentElement.querySelector("[data-filter-count]");
    const grid = bar.parentElement.querySelector("[data-filter-grid]");
    if (!grid) return;
    const items = [...grid.children];
    const chips = [...bar.querySelectorAll("[data-filter]")];
    chips.forEach((c) => c.addEventListener("click", () => {
      const f = c.dataset.filter;
      chips.forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
      items.forEach((it) => { it.hidden = f !== "all" && it.dataset.type !== f; });
      if (count) count.textContent = `Showing ${items.filter((it) => !it.hidden).length} of ${items.length} publications: ${c.textContent}`;
    }));
    bar.hidden = false;
  });

  /* ---------- Deadlines: a notice or vacancy built as "open" shows as closed once its last date has passed,
     even before the next rebuild (dates compared in India time; the last date itself still counts as open). ---------- */
  const todayIN = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  document.querySelectorAll("[data-closes]").forEach((el) => {
    if (el.dataset.closes >= todayIN) return;
    const row = el.closest(".notice");
    if (row) row.dataset.status = "closed";
    (el.matches("article") ? el.querySelectorAll(".status") : [el.querySelector(".status")]).forEach((st) => {
      if (!st) return;
      st.className = "status status--closed"; st.textContent = "Closed";
    });
    if (el.matches("article")) el.classList.add("is-expired");
    else el.lastChild.textContent = el.lastChild.textContent.replace(/Apply by|Closes/, "Closed");
  });

  /* ---------- Share: copy link ---------- */
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const done = b.querySelector(".share__done");
    try { await navigator.clipboard.writeText(b.dataset.copy); if (done) done.textContent = "Link copied"; }
    catch { window.prompt("Copy this link", b.dataset.copy); }
    b.classList.add("is-done");
    setTimeout(() => { b.classList.remove("is-done"); if (done) done.textContent = ""; }, 2200);
  }));

  /* ---------- Listings (RFP / vacancies): status chips, category select, free-text search ---------- */
  document.querySelectorAll("[data-listing]").forEach((box) => {
    const items = [...box.querySelectorAll("[data-listing-items] > *")];
    const count = box.querySelector("[data-listing-count]");
    const empty = box.querySelector("[data-listing-empty]");
    const search = box.querySelector("[data-listing-search]");
    const chips = [...box.querySelectorAll("[data-listing-filter]")];
    const selects = [...box.querySelectorAll("[data-listing-select]")];
    const noun = (count?.textContent.match(/[a-z]+$/i) || ["items"])[0];
    const state = { status: "all", cat: "all", q: "" };
    const apply = () => {
      const q = state.q.trim().toLowerCase();
      let n = 0;
      items.forEach((it) => {
        const show = (state.status === "all" || it.dataset.status === state.status)
          && (state.cat === "all" || it.dataset.cat === state.cat)
          && (!q || q.split(/\s+/).every((w) => (it.dataset.text || "").includes(w)));
        it.hidden = !show;
        if (show) n++;
      });
      if (count) count.textContent = n === items.length ? `${n} ${noun}` : `Showing ${n} of ${items.length} ${noun}`;
      if (empty) empty.hidden = n > 0;
    };
    chips.forEach((c) => c.addEventListener("click", () => {
      chips.filter((x) => x.dataset.listingFilter === c.dataset.listingFilter).forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
      state[c.dataset.listingFilter] = c.dataset.value; apply();
    }));
    selects.forEach((s) => s.addEventListener("change", () => { state[s.dataset.listingSelect] = s.value; apply(); }));
    if (search) search.addEventListener("input", () => { state.q = search.value; apply(); });
    const tools = box.querySelector("[data-listing-tools]");
    if (tools) tools.hidden = false;
  });

  /* ---------- Gallery lightbox (links work without JS: they open the full image) ---------- */
  document.querySelectorAll("[data-lightbox]").forEach((grid) => {
    const dlg = document.querySelector("[data-lightbox-dialog]");
    if (!dlg || !dlg.showModal) return;
    const links = [...grid.querySelectorAll("[data-lightbox-item]")];
    const img = dlg.querySelector("img"), cap = dlg.querySelector("figcaption");
    let i = 0;
    const show = (k) => {
      i = (k + links.length) % links.length;
      const a = links[i], thumb = a.querySelector("img");
      img.src = a.href; img.alt = thumb?.alt || "";
      if (thumb) { img.width = thumb.width; img.height = thumb.height; }
      cap.textContent = `${a.dataset.caption || ""} (${i + 1} of ${links.length})`;
    };
    links.forEach((a, k) => a.addEventListener("click", (e) => { e.preventDefault(); show(k); dlg.showModal(); dlg._opener = a; }));
    dlg.querySelector("[data-lb-prev]").addEventListener("click", () => show(i - 1));
    dlg.querySelector("[data-lb-next]").addEventListener("click", () => show(i + 1));
    dlg.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(i - 1); if (e.key === "ArrowRight") show(i + 1); });
  });

  /* ---------- Sub-nav current section ---------- */
  const subLinks = [...document.querySelectorAll(".subnav a[href^='#']")];
  if (subLinks.length) {
    // The current section is the last one whose top has passed 40% of the viewport; past the end, the last stays current
    const pairs = subLinks.map((a) => [document.getElementById(a.getAttribute("href").slice(1)), a]).filter(([s]) => s);
    let ticking = false;
    const spy = () => {
      ticking = false;
      const line = window.innerHeight * 0.4;
      let cur = null;
      pairs.forEach(([s, a]) => { if (s.getBoundingClientRect().top <= line) cur = a; });
      subLinks.forEach((a) => a.classList.toggle("is-current", a === cur));
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    spy();
  }
})();
