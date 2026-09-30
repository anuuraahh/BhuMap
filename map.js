/* BhuMap · the village maps
   One made-up village (seeded, so it looks the same every visit), drawn three ways:
   - the hero survey: an RTK drone flies the village, the orthomosaic fills in behind it,
     parcels trace themselves and the rover checks the doubtful corners
   - the compare slider: the old chain-and-tape record vs the BhuMap parcels
   Everything is plain canvas 2D; nothing is loaded from outside. */
(() => {
  const d = document;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const W = 1600, H = 1000;                 // world units (≈ metres × 0.8 across a small village)

  /* ---------- seeded random ---------- */
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const lp = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

  /* ---------- build the village ---------- */
  function village(seed = 26010) {
    const R = rng(seed);
    const COLS = 9, ROWS = 7, x0 = -120, y0 = -90, cw = (W + 240) / COLS, ch = (H + 180) / ROWS;
    const P = [];
    for (let r = 0; r <= ROWS; r++) {
      P[r] = [];
      for (let c = 0; c <= COLS; c++) {
        const edge = r === 0 || c === 0 || r === ROWS || c === COLS;
        const j = edge ? .08 : .26;
        P[r][c] = [x0 + c * cw + (R() - .5) * cw * j * 2, y0 + r * ch + (R() - .5) * ch * j * 2 + (c * 9)];
      }
    }
    const ROAD_ROW = 3, CANAL_COL = 6;
    const town = new Set(["3,2", "2,2", "3,3"]);     // cells that are the village settlement (abadi)
    const tank = [4, 7];                              // cell that holds the village tank
    const crops = [
      { c: "#8fae5a", r: "#6f9142" }, { c: "#a9bf6a", r: "#8aa34d" }, { c: "#d8bf6d", r: "#b99f4c" },
      { c: "#c9ac62", r: "#a88c45" }, { c: "#7ea356", r: "#5f8740" }, { c: "#b8a27a", r: "#9a8460" },
      { c: "#9dbb6e", r: "#7c9c50" }, { c: "#e0c77a", r: "#c2a85a" },
    ];
    const cells = [], parcels = [];
    let sy = 180;                                     // survey numbers start here
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const q = [P[r][c], P[r][c + 1], P[r + 1][c + 1], P[r + 1][c]];
      const key = `${r},${c}`;
      const cell = { r, c, q, no: sy++, town: town.has(key), tank: r === tank[0] && c === tank[1] };
      cells.push(cell);
      if (cell.town || cell.tank) continue;
      /* inheritance splits: the old record has one parcel here, the land today has 2–3 strips */
      const wdt = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), hgt = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]);
      const n = R() < .58 ? (R() < .35 ? 3 : 2) : 1;
      const cuts = [0]; for (let i = 1; i < n; i++) cuts.push(i / n + (R() - .5) * .16); cuts.push(1);
      for (let i = 0; i < n; i++) {
        const a = cuts[i], b = cuts[i + 1];
        const poly = wdt > hgt
          ? [lp(q[0], q[1], a), lp(q[0], q[1], b), lp(q[3], q[2], b), lp(q[3], q[2], a)]
          : [lp(q[0], q[3], a), lp(q[1], q[2], a), lp(q[1], q[2], b), lp(q[0], q[3], b)];
        const crop = crops[Math.floor(R() * crops.length)];
        const ang = (wdt > hgt ? Math.PI / 2 : 0) + (R() - .5) * .25;
        parcels.push({ poly, cell, id: n > 1 ? `${cell.no}/${i + 1}` : `${cell.no}`, split: n > 1, crop, ang, cx: poly.reduce((s, p) => s + p[0], 0) / 4, cy: poly.reduce((s, p) => s + p[1], 0) / 4 });
      }
      if (n > 1) cell.split = cuts.slice(1, -1).map((t) => wdt > hgt ? [lp(q[0], q[1], t), lp(q[3], q[2], t)] : [lp(q[0], q[3], t), lp(q[1], q[2], t)]);
    }
    const road = P[ROAD_ROW].map((p) => [p[0], p[1]]);
    const canal = P.map((row) => [row[CANAL_COL][0], row[CANAL_COL][1]]);
    /* houses in the settlement */
    const houses = [];
    cells.filter((c) => c.town).forEach((c) => {
      for (let i = 0; i < 26; i++) {
        const u = .12 + R() * .76, v = .12 + R() * .76;
        const p = lp(lp(c.q[0], c.q[1], u), lp(c.q[3], c.q[2], u), v);
        houses.push({ x: p[0], y: p[1], w: 16 + R() * 20, h: 12 + R() * 14, a: (R() - .5) * .4, roof: ["#b5643f", "#c7a07a", "#9c9387", "#a8573a", "#d3c6ad"][Math.floor(R() * 5)] });
      }
    });
    const tankCell = cells.find((c) => c.tank);
    const tankPoly = []; { const cx = tankCell.q.reduce((s, p) => s + p[0], 0) / 4, cy = tankCell.q.reduce((s, p) => s + p[1], 0) / 4; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rr = 70 + R() * 26; tankPoly.push([cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr]); } }
    const trees = [];
    canal.forEach((p, i) => { if (i === canal.length - 1) return; const q = canal[i + 1]; for (let k = 0; k < 7; k++) { const t = R(); trees.push([lerp(p[0], q[0], t) + 18 + R() * 10, lerp(p[1], q[1], t), 7 + R() * 7]); } });
    tankPoly.forEach((p, i) => { if (i % 2) trees.push([p[0] + (R() - .5) * 30, p[1] + (R() - .5) * 30, 8 + R() * 6]); });
    cells.filter((c) => c.town).forEach((c) => { for (let i = 0; i < 10; i++) { const p = lp(lp(c.q[0], c.q[1], R()), lp(c.q[3], c.q[2], R()), R()); trees.push([p[0], p[1], 8 + R() * 8]); } });
    /* rover stops: the new split corners nearest the middle of the map */
    const stops = [];
    cells.filter((c) => c.split).forEach((c) => c.split.forEach((ln) => stops.push(ln[0], ln[1])));
    stops.sort((a, b) => Math.hypot(a[0] - W * .52, a[1] - H * .5) - Math.hypot(b[0] - W * .52, b[1] - H * .5));
    const rover = stops.filter((p) => p[0] > 120 && p[0] < W - 120 && p[1] > 100 && p[1] < H - 100).slice(0, 5);
    rover.sort((a, b) => a[0] - b[0]);
    return { cells, parcels, road, canal, houses, tankPoly, trees, rover, R };
  }
  const V = village();

  /* ---------- drawing helpers ---------- */
  const path = (ctx, poly) => { ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
  const line = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
  const smooth = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const m = lp(pts[i], pts[i + 1], .5); ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } const e = pts[pts.length - 1]; ctx.lineTo(e[0], e[1]); };

  /* the orthomosaic: what the drone camera sees */
  function drawOrtho(ctx) {
    const R = rng(99);
    ctx.fillStyle = "#b9a878"; ctx.fillRect(-200, -200, W + 400, H + 400);
    V.parcels.forEach((p) => {
      ctx.save(); path(ctx, p.poly); ctx.fillStyle = p.crop.c; ctx.fill(); ctx.clip();
      ctx.strokeStyle = p.crop.r; ctx.lineWidth = 1.4; ctx.globalAlpha = .55;
      const s = Math.sin(p.ang), c = Math.cos(p.ang);
      for (let k = -700; k < 700; k += 7) { ctx.beginPath(); ctx.moveTo(p.cx + c * k - s * 700, p.cy + s * k + c * 700); ctx.lineTo(p.cx + c * k + s * 700, p.cy + s * k - c * 700); ctx.stroke(); }
      ctx.globalAlpha = .12; ctx.fillStyle = "#3b2f1a";
      for (let k = 0; k < 40; k++) ctx.fillRect(p.cx + (R() - .5) * 260, p.cy + (R() - .5) * 200, 3, 3);
      ctx.restore();
      /* bunds between fields: a thin earthen ridge */
      path(ctx, p.poly); ctx.strokeStyle = "rgba(120, 96, 58, .55)"; ctx.lineWidth = 3; ctx.stroke();
    });
    V.cells.filter((c) => c.town).forEach((c) => { path(ctx, c.q); ctx.fillStyle = "#cbbd98"; ctx.fill(); });
    V.cells.filter((c) => c.tank).forEach((c) => { path(ctx, c.q); ctx.fillStyle = "#a7a672"; ctx.fill(); });
    path(ctx, V.tankPoly); ctx.fillStyle = "#4f8fa8"; ctx.fill(); ctx.strokeStyle = "#7fb0c2"; ctx.lineWidth = 4; ctx.stroke();
    smooth(ctx, V.canal); ctx.strokeStyle = "#4f8fa8"; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.stroke();
    smooth(ctx, V.road); ctx.strokeStyle = "#9c8a66"; ctx.lineWidth = 22; ctx.stroke(); ctx.strokeStyle = "#d9cba8"; ctx.lineWidth = 16; ctx.stroke();
    V.houses.forEach((h) => { ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a); ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(-h.w / 2 + 3, -h.h / 2 + 3, h.w, h.h); ctx.fillStyle = h.roof; ctx.fillRect(-h.w / 2, -h.h / 2, h.w, h.h); ctx.restore(); });
    V.trees.forEach(([x, y, r]) => { ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.arc(x + 3, y + 3, r, 0, 7); ctx.fill(); ctx.fillStyle = "#3f6a35"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = "#5b8a47"; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .3, r * .5, 0, 7); ctx.fill(); });
  }

  /* the paper record: wobbly ink on survey paper, drawn from the old (unsplit) holdings, slightly off */
  const oldT = (p) => { const x = p[0], y = p[1]; return [x * .985 + y * .03 + 26 + Math.sin(y / 90) * 7, y * .99 - x * .018 + 22 + Math.cos(x / 110) * 6]; };
  function wobble(ctx, poly, R, closed = true) {
    ctx.beginPath(); const pts = closed ? poly.concat([poly[0]]) : poly;
    pts.forEach((p, i) => {
      const q = oldT(p);
      if (!i) { ctx.moveTo(q[0], q[1]); return; }
      const a = oldT(pts[i - 1]);
      for (let k = 1; k <= 6; k++) { const t = k / 6, m = lp(a, q, t); ctx.lineTo(m[0] + (R() - .5) * 3.2, m[1] + (R() - .5) * 3.2); }
    });
  }
  function drawRecord(ctx, strong) {
    const R = rng(7);
    ctx.fillStyle = "#efe2c4"; ctx.fillRect(-200, -200, W + 400, H + 400);
    /* stains + fold */
    [[300, 240, 180], [1250, 760, 220], [900, 180, 120]].forEach(([x, y, r]) => { const g = ctx.createRadialGradient(x, y, r * .2, x, y, r); g.addColorStop(0, "rgba(160, 110, 50, .14)"); g.addColorStop(1, "rgba(160, 110, 50, 0)"); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); });
    ctx.strokeStyle = "rgba(120, 90, 50, .18)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * .5, 0); ctx.lineTo(W * .5 + 14, H); ctx.stroke();
    ctx.strokeStyle = strong ? "#5a3b1c" : "rgba(90, 60, 30, .55)"; ctx.lineWidth = strong ? 2.2 : 1.6; ctx.lineJoin = "round";
    V.cells.forEach((c) => { wobble(ctx, c.q, R); ctx.stroke(); });
    ctx.save(); ctx.setLineDash([10, 7]); ctx.strokeStyle = strong ? "#5a3b1c" : "rgba(90,60,30,.5)";
    wobble(ctx, V.road, R, false); ctx.stroke(); ctx.lineWidth = strong ? 1.4 : 1; ctx.setLineDash([3, 5]); wobble(ctx, V.canal, R, false); ctx.stroke(); ctx.restore();
    if (strong) {
      ctx.fillStyle = "#5a3b1c"; ctx.font = "italic 600 26px Georgia, 'Times New Roman', serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      V.cells.forEach((c) => { if (c.town) return; const m = oldT([c.q.reduce((s, p) => s + p[0], 0) / 4, c.q.reduce((s, p) => s + p[1], 0) / 4]); ctx.fillText(String(c.no), m[0], m[1]); });
      const t = V.cells.find((c) => c.town); const m = oldT(t.q[2]); ctx.font = "italic 22px Georgia, serif"; ctx.fillText("Gramakantham", m[0] - 20, m[1] - 50);
    }
  }

  /* the BhuMap layer: parcel outlines, IDs and control points */
  function drawParcels(ctx, k, labels, scale) {
    ctx.lineJoin = "round";
    V.parcels.forEach((p) => {
      path(ctx, p.poly);
      ctx.strokeStyle = "rgba(255, 255, 255, .85)"; ctx.lineWidth = 4.5 / scale; ctx.stroke();
      ctx.strokeStyle = p.split ? "#d9622b" : "#1f5a2b"; ctx.lineWidth = 2.2 / scale; ctx.stroke();
    });
    if (labels) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `600 ${Math.max(15, 12 / scale)}px "IBM Plex Mono", ui-monospace, monospace`;
      V.parcels.forEach((p) => {
        const t = p.id, w = ctx.measureText(t).width + 12 / scale, h = 20 / scale * Math.max(1, scale * .9);
        ctx.fillStyle = "rgba(251, 248, 241, .92)"; ctx.fillRect(p.cx - w / 2, p.cy - h / 2, w, h);
        ctx.fillStyle = p.split ? "#b44f1f" : "#1f5a2b"; ctx.fillText(t, p.cx, p.cy + 1);
      });
    }
  }
  function drawPeg(ctx, x, y, s, ok) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = ok ? "#2f6b3a" : "#d9622b"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.moveTo(0, -9 * s); ctx.lineTo(9 * s, 0); ctx.lineTo(0, 9 * s); ctx.lineTo(-9 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* ---------- a canvas that keeps itself sized and only runs while on screen ---------- */
  function stage(el, onSize) {
    const cv = el.querySelector("canvas") || el.appendChild(d.createElement("canvas"));
    const ctx = cv.getContext("2d");
    const st = { cv, ctx, w: 1, h: 1, dpr: 1, s: 1, ox: 0, oy: 0, visible: true };
    const size = () => {
      const r = el.getBoundingClientRect(); st.dpr = Math.min(2, devicePixelRatio || 1);
      st.w = Math.max(1, Math.round(r.width)); st.h = Math.max(1, Math.round(r.height));
      cv.width = st.w * st.dpr; cv.height = st.h * st.dpr;
      st.s = Math.max(st.w / W, st.h / H) * (st.zoom || 1); st.ox = (st.w - W * st.s) / 2; st.oy = (st.h - H * st.s) / 2;
      onSize && onSize(st);
    };
    st.world = () => ctx.setTransform(st.dpr * st.s, 0, 0, st.dpr * st.s, st.dpr * st.ox, st.dpr * st.oy);
    st.screen = () => ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    st.layer = (fn) => { const c = d.createElement("canvas"); c.width = cv.width; c.height = cv.height; const x = c.getContext("2d"); x.setTransform(st.dpr * st.s, 0, 0, st.dpr * st.s, st.dpr * st.ox, st.dpr * st.oy); fn(x); return c; };
    size(); new ResizeObserver(size).observe(el);
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => es.forEach((e) => (st.visible = e.isIntersecting)), { rootMargin: "80px" }).observe(el);
    return st;
  }

  /* ==========================================================
     Hero: the survey run
     ========================================================== */
  function hero(el) {
    let ortho, record;
    const st = stage(el, (s) => { ortho = s.layer(drawOrtho); record = s.layer((c) => drawRecord(c, false)); });
    const { ctx } = st;
    const cov = el.closest(".sheet").querySelector("[data-cov]"), cnt = el.closest(".sheet").querySelector("[data-parcels]"), stat = el.closest(".sheet").querySelector("[data-stage]");
    /* flight plan: east–west passes, top to bottom, inside the visible part of the world */
    const view = () => ({ x0: -st.ox / st.s, y0: -st.oy / st.s, x1: (st.w - st.ox) / st.s, y1: (st.h - st.oy) / st.s });
    const PASSES = 5, FLY = 9.5, ROVER = 5.5, HOLD = 2.6, FADE = .9;
    const T = FLY + ROVER + HOLD + FADE;
    const total = V.parcels.length;
    let t0 = performance.now(), last = t0;
    const at = (t) => {
      const v = view(), sw = (v.y1 - v.y0) / PASSES, u = Math.min(1, t / FLY) * PASSES, k = Math.min(PASSES - 1, Math.floor(u)), f = u - k;
      const dir = k % 2 ? -1 : 1, pad = 60;
      const x = dir > 0 ? lerp(v.x0 - pad, v.x1 + pad, f) : lerp(v.x1 + pad, v.x0 - pad, f);
      return { k, f, x, y: v.y0 + sw * (k + .5), sw, dir, v, done: t >= FLY };
    };
    const frame = (now) => {
      requestAnimationFrame(frame);
      if (!st.visible) { t0 += now - last; last = now; return; }
      last = now;
      let t = reduce ? FLY + ROVER + .1 : ((now - t0) / 1000) % T;
      const D = at(t);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, st.cv.width, st.cv.height);
      ctx.drawImage(record, 0, 0);
      /* covered swaths reveal the orthomosaic */
      st.world(); ctx.save(); ctx.beginPath();
      for (let i = 0; i < D.k; i++) ctx.rect(D.v.x0 - 200, D.v.y0 + D.sw * i - 2, D.v.x1 - D.v.x0 + 400, D.sw + 4);
      if (!D.done) { const a = D.dir > 0 ? D.v.x0 - 200 : D.x, b = D.dir > 0 ? D.x : D.v.x1 + 200; ctx.rect(a, D.v.y0 + D.sw * D.k - 2, b - a, D.sw + 4); }
      else ctx.rect(D.v.x0 - 200, D.v.y0 - 2, D.v.x1 - D.v.x0 + 400, D.v.y1 - D.v.y0 + 4);
      ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ortho, 0, 0); st.world();
      /* parcels trace in once the drone has passed over them */
      let mapped = 0;
      const covered = (p) => { if (D.done) return 1; const row = Math.floor((p.cy - D.v.y0) / D.sw); if (row < D.k) return 1; if (row > D.k) return 0; return (D.dir > 0 ? D.x - p.cx : p.cx - D.x) > 60 ? 1 : 0; };
      ctx.lineJoin = "round";
      V.parcels.forEach((p) => {
        if (!covered(p)) return; mapped++;
        path(ctx, p.poly); ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 4 / st.s * .9; ctx.stroke();
        ctx.strokeStyle = p.split ? "#d9622b" : "#1f5a2b"; ctx.lineWidth = 2 / st.s * .9; ctx.stroke();
      });
      ctx.restore();
      /* rover visits the doubtful corners */
      const rt = t - FLY, stops = V.rover, per = ROVER / stops.length;
      if (rt > -1.2) stops.forEach((p, i) => { const ok = rt > per * (i + .7); ctx.globalAlpha = Math.min(1, (rt + 1.2) / .6); drawPeg(ctx, p[0], p[1], 1 / st.s * 1.1, ok); ctx.globalAlpha = 1; });
      if (rt > 0 && rt < ROVER + HOLD + FADE) {
        const i = Math.min(stops.length - 1, Math.floor(rt / per)), f = Math.min(1, (rt - i * per) / (per * .55));
        const a = i ? stops[i - 1] : [stops[0][0] - 140, stops[0][1] + 90], b = stops[i];
        const e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        const rp = rt > ROVER ? stops[stops.length - 1] : lp(a, b, e);
        const s = 1 / st.s;
        if (rt < ROVER && f >= 1) { const ring = ((rt - i * per) / per - .55) / .45; ctx.strokeStyle = `rgba(217, 98, 43, ${1 - ring})`; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.arc(b[0], b[1], (10 + ring * 34) * s, 0, 7); ctx.stroke(); }
        ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(rp[0] + 4 * s, rp[1] + 5 * s, 9 * s, 5 * s, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#1e2a20"; ctx.fillRect(rp[0] - 1.5 * s, rp[1] - 26 * s, 3 * s, 26 * s);
        ctx.fillStyle = "#3d7c9c"; ctx.beginPath(); ctx.arc(rp[0], rp[1] - 28 * s, 7 * s, 0, 7); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * s; ctx.stroke();
        if (rt < ROVER && f >= 1) {
          st.screen(); const sx = st.ox + b[0] * st.s, sy = st.oy + b[1] * st.s;
          ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace'; const txt = "±2 cm ✓", tw = ctx.measureText(txt).width + 14;
          ctx.fillStyle = "#1e2a20"; ctx.fillRect(sx + 12, sy - 30, tw, 22); ctx.fillStyle = "#f5efe2"; ctx.textBaseline = "middle"; ctx.fillText(txt, sx + 19, sy - 19); st.world();
        }
      }
      /* the drone and its camera footprint */
      if (!D.done) {
        const s = 1 / st.s;
        ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.5 * s; ctx.setLineDash([6 * s, 5 * s]);
        ctx.fillRect(D.x - D.sw * .45, D.y - D.sw * .5, D.sw * .9, D.sw); ctx.strokeRect(D.x - D.sw * .45, D.y - D.sw * .5, D.sw * .9, D.sw); ctx.setLineDash([]);
        drone(ctx, D.x, D.y, s * 1.15, D.dir, now);
      }
      /* the whole sheet fades back to paper before the next run */
      const fade = t > FLY + ROVER + HOLD ? (t - FLY - ROVER - HOLD) / FADE : 0;
      if (fade > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = fade; ctx.drawImage(record, 0, 0); ctx.globalAlpha = 1; }
      if (cov) cov.textContent = Math.round(D.done ? 100 : ((D.k + (D.dir > 0 ? (D.x - D.v.x0) : (D.v.x1 - D.x)) / (D.v.x1 - D.v.x0)) / PASSES) * 100) + "%";
      if (cnt) cnt.textContent = `${mapped}/${total}`;
      if (stat) stat.textContent = !D.done ? "drone · aerial capture" : rt < ROVER ? "rover · ground truth" : "parcels linked";
    };
    requestAnimationFrame(frame);
  }
  function drone(ctx, x, y, s, dir, now) {
    ctx.save(); ctx.translate(x + 18 * s, y + 22 * s); ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath(); ctx.ellipse(0, 0, 26 * s, 20 * s, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(dir > 0 ? 0 : Math.PI);
    ctx.strokeStyle = "#1e2a20"; ctx.lineWidth = 4 * s; ctx.lineCap = "round";
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(a * 20 * s, b * 20 * s); ctx.stroke(); });
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b], i) => {
      ctx.save(); ctx.translate(a * 20 * s, b * 20 * s);
      ctx.fillStyle = "rgba(30,42,32,.18)"; ctx.beginPath(); ctx.arc(0, 0, 12 * s, 0, 7); ctx.fill();
      ctx.rotate(now / 40 + i); ctx.fillStyle = i < 2 ? "#d9622b" : "#e8e2d3"; ctx.fillRect(-12 * s, -1.6 * s, 24 * s, 3.2 * s);
      ctx.restore();
    });
    ctx.fillStyle = "#1e2a20"; ctx.fillRect(-10 * s, -10 * s, 20 * s, 20 * s);
    ctx.fillStyle = "#3d7c9c"; ctx.beginPath(); ctx.arc(0, 0, 5 * s, 0, 7); ctx.fill();
    ctx.restore();
  }

  /* ==========================================================
     Compare: chain & tape record vs BhuMap
     ========================================================== */
  function compare(el) {
    const before = el.querySelector(".before"), after = el.querySelector(".after");
    const zoom = 1;
    let a = null, b = null;
    a = stage(before, (s) => { s.zoom = zoom; paint(); }); b = stage(after, (s) => { s.zoom = zoom; paint(); });
    function paint() {
      if (!a || !b) return;
      [a, b].forEach((s) => { s.s = Math.max(s.w / W, s.h / H); s.ox = (s.w - W * s.s) / 2; s.oy = (s.h - H * s.s) / 2; });
      a.ctx.setTransform(1, 0, 0, 1, 0, 0); a.ctx.clearRect(0, 0, a.cv.width, a.cv.height); a.world(); drawRecord(a.ctx, true);
      b.ctx.setTransform(1, 0, 0, 1, 0, 0); b.ctx.clearRect(0, 0, b.cv.width, b.cv.height); b.world(); drawOrtho(b.ctx); drawParcels(b.ctx, 1, true, b.s);
      V.cells.forEach((c) => (c.split || []).forEach((ln) => ln.forEach((q) => drawPeg(b.ctx, q[0], q[1], .8 / b.s, true))));
    }
    setTimeout(paint, 0);
    const range = el.querySelector("input[type=range]");
    const set = (v) => el.style.setProperty("--cut", v + "%");
    range.addEventListener("input", () => set(range.value));
    /* a small nudge the first time it scrolls into view, so it reads as draggable */
    if (!reduce && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (!es[0].isIntersecting) return; io.disconnect(); let t0 = null;
        const run = (n) => { if (t0 === null) t0 = n; const t = (n - t0) / 1600; if (t >= 1) { set(50); range.value = 50; return; } const v = 50 + Math.sin(t * Math.PI * 2) * 18 * (1 - t); set(v); range.value = v; requestAnimationFrame(run); };
        requestAnimationFrame(run); }, { threshold: .6 });
      io.observe(el);
    }
  }

  d.querySelectorAll("[data-survey]").forEach(hero);
  d.querySelectorAll("[data-compare]").forEach(compare);
  window.BhuMapVillage = { V, W, H, drawOrtho, drawParcels, path };
})();
