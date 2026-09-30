/* BhuMap · shared behaviour: menu, page turns, smooth section jumps, reveals, PS popup, copy email */
(() => {
  const d = document, root = d.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} },
  };
  window.__siteReady = true;

  /* ---------- phone menu ---------- */
  const nav = d.querySelector(".nav"), menu = d.querySelector(".nav-menu");
  if (nav && menu) {
    const set = (o) => { nav.classList.toggle("open", o); menu.setAttribute("aria-expanded", String(o)); };
    menu.addEventListener("click", () => set(!nav.classList.contains("open")));
    nav.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => set(false)));
    d.addEventListener("click", (e) => { if (nav.classList.contains("open") && !nav.contains(e.target)) set(false); });
    d.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
  }

  /* ---------- page turn: a sheet of survey paper covers the switch ---------- */
  const turn = d.createElement("div"); turn.className = "turn"; turn.setAttribute("aria-hidden", "true");
  turn.innerHTML = '<span>Sheet <b></b></span>';
  d.body.appendChild(turn);
  const label = turn.querySelector("b");
  const pageOf = (p) => p.replace(/index(\.html)?$/, "").replace(/\.html$/, "");
  const samePage = (u) => pageOf(u.pathname) === pageOf(location.pathname);
  if (root.classList.contains("arriving")) {
    label.textContent = store.get("bm-turn-label") || "";
    const go = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      turn.classList.add("out");
      setTimeout(() => { root.classList.remove("arriving"); turn.classList.remove("out"); }, 650);
    }));
    const fonts = d.fonts && d.fonts.ready ? Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 350))]) : Promise.resolve();
    fonts.then(() => setTimeout(go, 40));
  }
  /* warm the next page while the pointer heads for the link */
  const warmed = new Set();
  d.addEventListener("pointerover", (e) => {
    const a = e.target.closest && e.target.closest("a[href]"); if (!a || a.target) return;
    const u = new URL(a.href, location.href); if (u.origin !== location.origin || samePage(u) || warmed.has(u.pathname)) return;
    warmed.add(u.pathname); const l = d.createElement("link"); l.rel = "prefetch"; l.href = u.pathname; d.head.appendChild(l);
  }, { passive: true });
  d.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute("download")) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin) return;
    if (samePage(u)) {
      if (u.hash.length > 1) return;                       // handled by the section glide below
      e.preventDefault(); if (framed()) (d.querySelector("main") || d.body).scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }); else glideTo(0); return;   // the logo on its own page: back to the top
    }
    if (reduce) return;
    e.preventDefault();
    const name = a.dataset.sheet || a.textContent.trim().replace(/[→↗←]/g, "").trim();
    label.textContent = name; store.set("bm-turn", "1"); store.set("bm-turn-label", name);
    turn.classList.remove("out"); turn.classList.add("in");
    setTimeout(() => { location.href = u.href; }, 300);
  });
  addEventListener("pageshow", (e) => { if (e.persisted) { turn.classList.remove("in", "out"); root.classList.remove("arriving"); } });

  /* ---------- smooth section jumps that land just under the top bar ---------- */
  /* inside a preview frame that grows to the page height, the frame itself can't scroll: let the outer page do it */
  const framed = () => d.documentElement.scrollHeight <= innerHeight + 4;
  const navH = () => (nav ? nav.offsetHeight : 0);
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let glideId = 0;
  function glideTo(y) {
    const id = ++glideId, from = scrollY, dist = y - from;
    if (reduce || Math.abs(dist) < 2) { scrollTo(0, y); return; }
    const dur = Math.min(1150, Math.max(520, 380 + Math.abs(dist) * .12));
    const t0 = performance.now();
    const step = (now) => {
      if (id !== glideId) return;
      const t = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + dist * ease(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  ["wheel", "touchstart", "keydown"].forEach((ev) => addEventListener(ev, () => { glideId++; }, { passive: true }));   // the reader takes over at once
  const topOf = (el) => Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY - navH() + 1));
  d.addEventListener("click", (e) => {
    const a = e.target.closest('a[href*="#"]'); if (!a || e.defaultPrevented) return;
    const u = new URL(a.href, location.href); if (!samePage(u) || u.hash.length < 2) return;
    const el = d.getElementById(decodeURIComponent(u.hash.slice(1))); if (!el) return;
    e.preventDefault(); history.replaceState(null, "", u.hash);
    if (framed()) { el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }); return; }
    glideTo(topOf(el));
  });
  /* a new page always opens at the top (browsers, and framed previews, can carry the old scroll position over) */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (location.hash.length < 2) {
    let touched = false;
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach((ev) => addEventListener(ev, () => (touched = true), { once: true, passive: true }));
    const toTop = () => {
      if (touched) return;
      scrollTo(0, 0);
      const first = d.querySelector("main") || d.body;   // also brings a scrolled outer frame back up
      if (first && first.scrollIntoView) try { first.scrollIntoView({ block: "start", behavior: "instant" }); } catch (e) { first.scrollIntoView(true); }
    };
    toTop(); requestAnimationFrame(toTop); addEventListener("load", () => { toTop(); setTimeout(toTop, 80); }, { once: true });
  }
  /* arriving with #section from another page: land there under the paper sheet */
  if (location.hash.length > 1) {
    const el = d.getElementById(decodeURIComponent(location.hash.slice(1)));
    /* scroll-margin keeps it under the top bar, in a framed preview too */
    if (el) { const j = () => { try { el.scrollIntoView({ block: "start", behavior: "instant" }); } catch (e) { el.scrollIntoView(true); } }; j(); addEventListener("load", () => { j(); setTimeout(j, 120); }, { once: true }); }
  }

  /* ---------- reveal on scroll ---------- */
  const rv = [...d.querySelectorAll(".rv")];
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("on"); io.unobserve(x.target); } }), { rootMargin: "0px 0px -8% 0px" });
    rv.forEach((el) => { if (el.getBoundingClientRect().top > innerHeight * .9) { el.classList.add("pre"); io.observe(el); } });
  } else rv.forEach((el) => el.classList.add("on"));

  /* ---------- problem statement popup ---------- */
  /* the official SIH26010 listing (typos from the portal's "l" for "I" corrected) */
  const DESC = `<h4>Background</h4><p>Historically, land surveys in rural India were conducted using conventional chain and tape methods, many of which date back several decades or even the colonial period. Over time, multiple issues emerged such as boundary changes due to inheritance and informal partition, unrecorded land transactions, encroachments and overlapping claims, errors in cadastral maps, mismatch between textual records and spatial maps, absence of updated mutation records and inconsistent land classifications. These deficiencies have resulted in prolonged legal disputes, reduced agricultural productivity, and administrative inefficiencies. Land-related disputes reportedly account for a major share of civil litigation in India.</p>
    <h4>Detailed description</h4><p>A comprehensive survey/resurvey program is necessary to establish accurate land ownership, update cadastral maps, reduce land disputes, enable transparent land governance, support precision agriculture, improve rural planning, facilitate digital land administration and ensure effective implementation of government schemes. Modern technologies such as drone mapping, Differential GPS (DGPS), GIS platforms, satellite imagery, CORS and mobile-based field verification can significantly improve accuracy, speed, and transparency in rural land management.</p>
    <h4>Expected solution</h4><p>Technology-driven land survey and resurvey be implemented using modern survey technologies for accurate mapping of agricultural land parcels, such as drone-based aerial surveys, Real-Time Kinematic (RTK) GPS and DGPS systems, GIS-enabled cadastral mapping and geo-referenced parcel identification. Developing a unified digital land information system integrating Record of Rights (RoR), mutation records, registration databases, survey maps, ownership history and precise geo-coordinates of land parcels. This integration should enable real-time updating and verification of land ownership.</p>`;
  const TOP = [["Problem Statement ID", "26010"], ["Problem Statement Title", "Survey/Resurvey of Rural Agricultural Land in India"]];
  const BOTTOM = [["Organization", "Ministry of Rural Development"], ["Department", "Dept of Land Resources (DoLR)"], ["Category", "Hardware"], ["Theme", "Agriculture, FoodTech &amp; Rural Development"]];
  let modal = null, last = null;
  const close = () => { if (!modal) return; modal.classList.remove("on"); if (last) last.focus(); };
  const open = (from) => {
    last = from;
    if (!modal) {
      modal = d.createElement("div"); modal.className = "ps-modal"; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-label", "Problem statement SIH26010");
      modal.setAttribute("data-lenis-prevent", "");
      const row = ([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`;
      modal.innerHTML = `<div class="ps-box" tabindex="-1"><button class="x" type="button" aria-label="Close">×</button>
        <span class="tag">Smart India Hackathon 2026</span><h3>Problem statement details</h3>
        <dl>${TOP.map(row).join("")}<dt>Description</dt><dd><div class="ps-desc">${DESC}</div></dd>${BOTTOM.map(row).join("")}</dl>
        <p class="small">As published in the SIH 2026 problem statements.</p></div>`;
      d.body.appendChild(modal);
      modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest(".x")) close(); });
      d.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("on")) close(); });
    }
    modal.classList.add("on"); modal.querySelector(".ps-desc").scrollTop = 0; modal.querySelector(".ps-box").focus();
  };
  d.querySelectorAll("[data-ps]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); open(b); }));

  /* ---------- copy email ---------- */
  d.querySelectorAll(".mail").forEach((b) => b.addEventListener("click", async () => {
    const s = b.querySelector("small");
    try { await navigator.clipboard.writeText(b.dataset.email); } catch (e) {}
    if (s) { s.textContent = "copied ✓"; setTimeout(() => (s.textContent = "click to copy"), 2000); }
  }));

  /* ---------- live survey clock in the footer ---------- */
  const clk = d.querySelector("[data-clock]");
  if (clk) { const tick = () => { clk.textContent = new Date().toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" }) + " IST"; }; tick(); setInterval(tick, 1000); }
})();
