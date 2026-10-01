/* BhuMap · 3D drone + rover
   A tiny flat-shaded 3D renderer on canvas 2D (no libraries), so the models load instantly
   and look like the CAD renders. Drag to turn, pick a part to highlight it. */
(() => {
  const d = document, host = d.querySelector("[data-viewer]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- vector helpers ---------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  /* ---------- mesh builders: every triangle carries a colour and a part number ---------- */
  function Mesh() { this.t = []; }
  Mesh.prototype.tri = function (a, b, c, col, part) { this.t.push({ a, b, c, col: hex(col), part }); };
  Mesh.prototype.quad = function (a, b, c, e, col, part) { this.tri(a, b, c, col, part); this.tri(a, c, e, col, part); };
  /* box between two corners, optionally turned about Y */
  Mesh.prototype.box = function (c, s, col, part, ry = 0) {
    const [x, y, z] = c, [w, h, dd] = [s[0] / 2, s[1] / 2, s[2] / 2];
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const P = (dx, dy, dz) => [x + dx * cs + dz * sn, y + dy, z - dx * sn + dz * cs];
    const v = [P(-w, -h, -dd), P(w, -h, -dd), P(w, h, -dd), P(-w, h, -dd), P(-w, -h, dd), P(w, -h, dd), P(w, h, dd), P(-w, h, dd)];
    [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]].forEach((f) => this.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]], col, part));
    return this;
  };
  /* a square beam from p to q */
  Mesh.prototype.beam = function (p, q, t, col, part) {
    const dir = norm(sub(q, p)); let up = Math.abs(dir[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
    const u = mul(norm(cross(dir, up)), t / 2), v = mul(norm(cross(dir, u)), t / 2);
    const c = [add(add(p, u), v), add(sub(p, u), v), sub(sub(p, u), v), sub(add(p, u), v)];
    const e = c.map((k) => add(k, sub(q, p)));
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quad(c[i], e[i], e[j], c[j], col, part); }
    this.quad(c[3], c[2], c[1], c[0], col, part); this.quad(e[0], e[1], e[2], e[3], col, part);
    return this;
  };
  /* upright cylinder (or cone when r2 differs) */
  Mesh.prototype.cyl = function (c, r, h, col, part, seg = 18, r2 = r) {
    const [x, y, z] = c, top = [], bot = [];
    for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; bot.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); top.push([x + Math.cos(a) * r2, y + h, z + Math.sin(a) * r2]); }
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; this.quad(bot[i], top[i], top[j], bot[j], col, part); if (r2 > 0) this.tri([x, y + h, z], top[j], top[i], col, part); this.tri([x, y, z], bot[i], bot[j], col, part); }
    return this;
  };
  Mesh.prototype.sphere = function (c, r, col, part, la = 8, lo = 14) {
    const P = (i, j) => { const th = i / la * Math.PI, ph = j / lo * Math.PI * 2; return [c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.cos(th), c[2] + r * Math.sin(th) * Math.sin(ph)]; };
    for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) this.quad(P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j), col, part);
    return this;
  };

  /* ---------- the RTK survey drone ---------- */
  const DRONE_PARTS = [
    { n: "RTK GNSS + antenna", t: "Takes RTK/PPK corrections, so every photo is tagged with its position to a few centimetres and fewer ground control points are needed.", s: "cm-level position for every photo, via RTK/PPK", at: [0, 1.28, 0] },
    { n: "Mapping camera", t: "Points straight down. At 80–100 m it captures about 2–3 cm per pixel, in overlapping frames that are stitched into the orthomosaic.", s: "nadir camera for 2–3 cm/pixel at 80–100 m", at: [0, -.3, 1.0] },
    { n: "Flight controller + body", t: "The autopilot flies the pre-planned passes over the village. The hub holds the battery and the radio link.", s: "autopilot, battery and radio in the centre hub", at: [.55, .2, -.3] },
    { n: "Quad arms + motors", t: "Four arms with brushless motors and props. The target is 30+ minutes of flight, enough for one village in a single sortie.", s: "four arms, brushless motors, 30+ min flight (target)", at: [1.55, .42, 1.55] },
    { n: "Landing skids", t: "Keep the camera and antenna clear of the ground on rough field take-offs and landings.", s: "two rails keep the camera clear of the ground", at: [-.9, -.95, .0] },
  ];
  function buildDrone() {
    const m = new Mesh();
    m.box([0, .1, 0], [1.25, .48, 1.25], "#26292b", 2);                       // hub
    m.box([0, .37, 0], [1.05, .06, 1.05], "#6b7075", 2, Math.PI / 4);         // top plate
    m.box([0, .37, 0], [1.05, .061, 1.05], "#5a5f64", 2);
    m.cyl([0, .4, 0], .3, .22, "#e9e6df", 0, 20);                             // GNSS base
    m.cyl([0, .62, 0], .045, .5, "#4b5054", 0, 8);                             // mast
    m.sphere([0, 1.24, 0], .2, "#2f7ec0", 0);                                  // antenna
    const R = 1.55;
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
      m.beam([sx * .5, .22, sz * .5], [sx * R, .28, sz * R], .16, "#9aa0a6", 3);
      m.cyl([sx * R, .1, sz * R], .26, .3, "#1e2123", 3, 18);                  // motor pod
      m.cyl([sx * R, .4, sz * R], .06, .1, "#bfc3c7", 3, 8);                   // shaft
    });
    m.box([0, -.24, .62], [.36, .28, .34], "#1e2123", 1);                       // camera housing
    m.sphere([0, -.28, .84], .16, "#2f7ec0", 1, 6, 12);                          // lens
    [[.42, .42], [.42, -.42], [-.42, .42], [-.42, -.42]].forEach(([x, z]) => m.beam([x, -.14, z], [x * 1.25, -.85, z * .95], .08, "#1e2123", 4));
    m.box([.55, -.9, 0], [.1, .08, 1.8], "#1e2123", 4); m.box([-.55, -.9, 0], [.1, .08, 1.8], "#1e2123", 4);
    return m;
  }
  /* propellers turn, so they're rebuilt each frame */
  function props(t) {
    const m = new Mesh(), R = 1.55;
    [[1, 1, 0], [1, -1, 1], [-1, 1, 1], [-1, -1, 0]].forEach(([sx, sz, k], i) => {
      const a = t * (i % 2 ? -1 : 1) * 14 + i, c = [sx * R, .5, sz * R], L = .95;
      const p = [c[0] + Math.cos(a) * L, c[1], c[2] + Math.sin(a) * L], q = [c[0] - Math.cos(a) * L, c[1], c[2] - Math.sin(a) * L];
      m.beam(p, q, .06, k ? "#e07a2e" : "#d8dadc", 3);
    });
    return m;
  }

  /* ---------- the RTK field rover ---------- */
  const ROVER_PARTS = [
    { n: "GNSS antenna", t: "Receives corrections from CORS or a portable base and logs each boundary point to centimetre level.", s: "cm-level boundary points, corrected by CORS or a local base", at: [0, 2.35, 0] },
    { n: "Tablet cradle", t: "Holds the tablet with the offline verification app. The owner and the revenue official confirm the boundary and sign here.", s: "the owner-verification app, signed on site", at: [.35, 1.35, .3] },
    { n: "Battery + IMU", t: "Powers a full field day. The IMU corrects for tilt, so the point is right even when the pole leans.", s: "a full field day; tilt-compensated logging", at: [-.05, .98, -.25] },
    { n: "Bipod", t: "Holds the pole steady and hands-free over a peg while the point is logged.", s: "steady, hands-free reading at every peg", at: [.55, .35, -.5] },
    { n: "Pole + tip", t: "Fixed height from tip to antenna, so the logged point is exactly where the tip touches the ground.", s: "fixed height from the tip to the antenna", at: [0, .05, 0] },
  ];
  function buildRover() {
    const m = new Mesh(), top = 2.2;
    m.cyl([0, .12, 0], .045, top - .12, "#8d9297", 4, 10);                     // pole
    m.cyl([0, -.12, 0], .0, .24, "#2b2e31", 4, 10, .045);                       // spike
    m.cyl([0, top - .02, 0], .2, .05, "#e9e6df", 0, 20);                        // antenna ring
    m.sphere([0, top + .16, 0], .22, "#2f7ec0", 0);
    m.box([0, 1.02, -.12], [.22, .34, .14], "#2f8a4a", 2);                      // battery + IMU
    m.box([0, 1.38, -.02], [.18, .18, .14], "#26292b", 1);                      // cradle clamp
    m.box([.12, 1.36, .12], [.9, .6, .06], "#1f2326", 1, -.55);                 // tablet frame
    m.box([.12, 1.36, .135], [.8, .5, .05], "#2c5f9e", 1, -.55);                // screen
    m.box([0, 1.02, 0], [.14, .08, .14], "#26292b", 3);                         // bipod clamp
    [[.55, -.45], [-.55, -.45]].forEach(([x, z]) => { m.beam([0, 1.0, 0], [x, 0, z], .05, "#8d9297", 3); m.box([x, .02, z], [.14, .04, .14], "#26292b", 3); });
    return m;
  }

  window.BhuMap3D = { buildDrone, buildRover, props, DRONE_PARTS, ROVER_PARTS };   // reused by the video
  if (!host) return;

  /* ---------- renderer ---------- */
  const canvas = host.querySelector("canvas"), ctx = canvas.getContext("2d");
  let W = 1, H = 1, DPR = 1;
  const size = () => { const r = host.getBoundingClientRect(); DPR = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; canvas.width = W * DPR; canvas.height = H * DPR; };
  size(); new ResizeObserver(size).observe(host);
  const light = norm([-.45, .85, .55]);
  const state = { model: "drone", yaw: .75, pitch: .42, vy: 0, sel: -1, pin: -1, drag: false, idle: 0 };
  let base = buildDrone();
  const parts = () => (state.model === "drone" ? DRONE_PARTS : ROVER_PARTS);
  const labelsEl = d.querySelector("[data-parts]");
  const hint = host.querySelector(".v-hint");
  /* the popup that opens on a numbered part and stays until it's closed */
  const pop = d.createElement("div"); pop.className = "part-pop"; pop.hidden = true; pop.setAttribute("role", "dialog");
  host.appendChild(pop);
  const fillPop = () => {
    const p = parts()[state.sel]; if (!p) { pop.hidden = true; return; }
    pop.innerHTML = `<button type="button" class="px" aria-label="Close">×</button><span class="pk">${state.sel + 1}</span><b>${p.n}</b><p>${p.t}</p><small>${p.s}</small>`;
    pop.setAttribute("aria-label", p.n); pop.hidden = false;
    pop.querySelector(".px").addEventListener("click", (e) => { e.stopPropagation(); select(-1); });
  };

  function project(p, cy, sy, cp, sp, f, cx, cyy, zoff) {
    const x = p[0] * cy - p[2] * sy, z0 = p[0] * sy + p[2] * cy;
    const y = p[1] * cp + z0 * sp, z = -p[1] * sp + z0 * cp + zoff;   // camera above, looking down
    return [cx + x * f / z, cyy - y * f / z, z];
  }
  function draw(now) {
    const t = now / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    const drone = state.model === "drone";
    const mesh = drone ? { t: base.t.concat(reduce ? props(0).t : props(t).t) } : base;
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw), cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    const zoff = drone ? 12 : 10, f = Math.min(W, H) * (drone ? 2.35 : 2.25), cx = W / 2, cyy = H * (drone ? .47 : .5);
    const lift = drone ? [0, .15 + Math.sin(t * 1.6) * .05 * (reduce ? 0 : 1), 0] : [0, -1.1, 0];
    /* ground shadow */
    const gy = drone ? -1.55 : -1.12, sh = drone ? [1.9, 1.9] : [.8, .7];
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; const p = project([Math.cos(a) * sh[0], gy, Math.sin(a) * sh[1]], cy, sy, cp, sp, f, cx, cyy, zoff); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.fillStyle = "rgba(60, 45, 20, .13)"; ctx.fill();
    /* grid under the model, like a survey plane */
    ctx.strokeStyle = "rgba(120, 100, 60, .16)"; ctx.lineWidth = 1;
    for (let k = -3; k <= 3; k++) {
      [[[k * .8, gy, -2.4], [k * .8, gy, 2.4]], [[-2.4, gy, k * .8], [2.4, gy, k * .8]]].forEach(([a, b]) => { const p = project(a, cy, sy, cp, sp, f, cx, cyy, zoff), q = project(b, cy, sy, cp, sp, f, cx, cyy, zoff); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); });
    }
    /* triangles, far to near */
    const view = [];
    const camF = [sy * cp, -sp, cy * cp];                      // not needed for culling with projected winding
    for (const tr of mesh.t) {
      const a = add(tr.a, lift), b = add(tr.b, lift), c = add(tr.c, lift);
      const pa = project(a, cy, sy, cp, sp, f, cx, cyy, zoff), pb = project(b, cy, sy, cp, sp, f, cx, cyy, zoff), pc = project(c, cy, sy, cp, sp, f, cx, cyy, zoff);
      const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
      const n = norm(cross(sub(b, a), sub(c, a)));
      let lum = .52 + .48 * Math.abs(dot(n, light));
      view.push({ pa, pb, pc, z: (pa[2] + pb[2] + pc[2]) / 3, col: tr.col, part: tr.part, lum, back: area > 0 });
    }
    view.sort((u, v) => v.z - u.z);
    const sel = state.sel;
    for (const v of view) {
      let [r, g, b] = v.col; let k = v.lum;
      if (sel >= 0) { if (v.part === sel) { r = r * .45 + 217 * .55; g = g * .45 + 98 * .55; b = b * .45 + 43 * .55; k = Math.max(k, .8); } else { r = r * .55 + 236 * .45; g = g * .55 + 227 * .45; b = b * .55 + 207 * .45; } }
      const fill = `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`;
      ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(v.pa[0], v.pa[1]); ctx.lineTo(v.pb[0], v.pb[1]); ctx.lineTo(v.pc[0], v.pc[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    /* numbered markers */
    parts().forEach((p, i) => {
      const q = project(add(p.at, lift), cy, sy, cp, sp, f, cx, cyy, zoff), on = i === sel;
      ctx.beginPath(); ctx.arc(q[0], q[1], on ? 14 : 11, 0, 7); ctx.fillStyle = on ? "#d9622b" : "rgba(30,42,32,.86)"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = `600 ${on ? 12 : 11}px "IBM Plex Mono", ui-monospace, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), q[0], q[1] + .5);
      p._s = q;
    });
    const sp_ = parts()[sel];
    if (sp_ && sp_._s && !pop.hidden) {                        // keep the popup beside its number
      const pw = pop.offsetWidth, ph = pop.offsetHeight, m = 10;
      let x = sp_._s[0] + 22, y = sp_._s[1] - ph / 2;
      if (x + pw > W - m) x = sp_._s[0] - 22 - pw;
      x = Math.max(m, Math.min(W - pw - m, x)); y = Math.max(m, Math.min(H - ph - m, y));
      pop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }

  /* ---------- loop + interaction ---------- */
  let visible = true, last = performance.now();
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => (visible = es[0].isIntersecting), { rootMargin: "60px" }).observe(host);
  const loop = (now) => {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!visible) return;
    if (!state.drag) {
      state.yaw += state.vy; state.vy *= .94; state.idle += dt;
      const p = parts()[state.sel];
      if (p && Math.hypot(p.at[0], p.at[2]) > .2) {          // turn the picked part towards the viewer
        let diff = Math.atan2(-p.at[0], -p.at[2]) + .35 - state.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        state.yaw += diff * Math.min(1, dt * 4);
      } else if (state.idle > 1.5 && !reduce) state.yaw += dt * .28;
    }
    draw(now);
  };
  requestAnimationFrame(loop);
  let px = 0, py = 0;
  canvas.addEventListener("pointerdown", (e) => { state.drag = true; px = e.clientX; py = e.clientY; state.idle = 0; canvas.setPointerCapture(e.pointerId); if (hint) hint.style.opacity = 0; });
  canvas.addEventListener("pointermove", (e) => {
    if (!state.drag) {
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const over = parts().findIndex((p) => p._s && Math.hypot(p._s[0] - x, p._s[1] - y) < 16); canvas.style.cursor = over >= 0 ? "pointer" : "";
      return;
    }
    const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
    state.yaw += dx * .008; state.vy = dx * .0015; state.pitch = Math.max(-.1, Math.min(1.1, state.pitch + dy * .005)); state.idle = 0;
  });
  const up = (e) => {
    if (!state.drag) return; state.drag = false;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = parts().findIndex((p) => p._s && Math.hypot(p._s[0] - x, p._s[1] - y) < 16);
    if (hit >= 0) select(state.pin === hit ? -1 : hit);
  };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", () => (state.drag = false));

  /* ---------- part list + model switch ---------- */
  const specs = d.querySelector("[data-specs]");
  const SPECS = {
    drone: ["<b>80–100 m</b> flying height", "<b>2–3 cm/px</b> ground resolution", "<b>30+ min</b> flight (target)", "<b>RTK / PPK</b> GNSS"],
    rover: ["<b>cm-level</b> boundary points", "<b>CORS</b> or portable base", "<b>Full field day</b> battery", "<b>Tilt-compensated</b> IMU"],
  };
  function list() {
    labelsEl.innerHTML = parts().map((p, i) => `<button type="button" data-p="${i}"><span class="k">${i + 1}</span><span><b>${p.n}</b><span>${p.s}</span></span></button>`).join("");
    labelsEl.querySelectorAll("button").forEach((b) => {
      const i = +b.dataset.p;
      b.addEventListener("click", () => select(state.pin === i ? -1 : i));
      b.addEventListener("mouseenter", () => { if (matchMedia("(hover: hover)").matches) select(i, true); });
      b.addEventListener("mouseleave", () => { if (matchMedia("(hover: hover)").matches) select(state.pin, true); });
    });
    if (specs) specs.innerHTML = SPECS[state.model].map((s) => `<span>${s}</span>`).join("");
  }
  /* hovering previews a part; a click (or a tap on its number) pins it until clicked again */
  function select(i, soft) {
    if (!soft) state.pin = i;
    state.sel = i; state.idle = 0;
    labelsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.p === i));
    fillPop();
  }
  d.querySelectorAll("[data-model]").forEach((b) => b.addEventListener("click", () => {
    if (state.model === b.dataset.model) return;
    state.model = b.dataset.model; base = state.model === "drone" ? buildDrone() : buildRover();
    state.sel = -1; state.pin = -1; pop.hidden = true; state.pitch = state.model === "drone" ? .42 : .22; state.yaw = .75;
    d.querySelectorAll("[data-model]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const cap = d.querySelector("[data-model-name]"); if (cap) cap.textContent = state.model === "drone" ? "Survey drone · RTK quadcopter" : "Field rover · RTK pole";
    list();
  }));
  list();
})();
