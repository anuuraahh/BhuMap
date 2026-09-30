/* BhuMap · the layered data model: five isometric sheets drawn from the same village */
(() => {
  const d = document, host = d.querySelector("[data-stack]");
  if (!host || !window.BhuMapVillage) return;
  const { V, W, H, drawOrtho, drawParcels, path } = window.BhuMapVillage;
  const S = 520;                                        // each sheet is a square crop of the village
  const crop = { x: 330, y: 150, s: 720 };
  const sheet = (fn) => {
    const c = d.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
    const k = S / crop.s; x.setTransform(k, 0, 0, k, -crop.x * k, -crop.y * k); fn(x, k); return c.toDataURL("image/webp", .86);
  };
  const peg = (x, px, py, s, col) => { x.save(); x.translate(px, py); x.fillStyle = col; x.strokeStyle = "#fff"; x.lineWidth = 3 * s; x.beginPath(); x.moveTo(0, -11 * s); x.lineTo(11 * s, 0); x.lineTo(0, 11 * s); x.lineTo(-11 * s, 0); x.closePath(); x.fill(); x.stroke(); x.restore(); };
  const imgs = [
    /* 1 raw drone frames: overlapping photos, a little uneven */
    sheet((x, k) => {
      x.fillStyle = "#e9e0cb"; x.fillRect(crop.x, crop.y, crop.s, crop.s);
      const fw = 240, fh = 180;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
        const fx = crop.x - 30 + c * 205 + (r % 2) * 20, fy = crop.y - 20 + r * 150;
        x.save(); x.beginPath(); x.rect(fx, fy, fw, fh); x.clip(); drawOrtho(x);
        x.fillStyle = `rgba(255,245,220,${.08 + ((r * 4 + c) % 3) * .06})`; x.fillRect(fx, fy, fw, fh); x.restore();
        x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = 3 / k; x.strokeRect(fx, fy, fw, fh);
      }
    }),
    /* 2 orthomosaic */
    sheet((x) => { drawOrtho(x); }),
    /* 3 rover control points */
    sheet((x, k) => {
      x.fillStyle = "rgba(251,248,241,.3)"; x.fillRect(crop.x, crop.y, crop.s, crop.s);
      V.cells.forEach((c) => (c.split || []).forEach((ln) => ln.forEach((q) => peg(x, q[0], q[1], 1 / k * 1.3, "#d9622b"))));
      V.cells.forEach((c) => c.q.forEach((q, i) => { if (i) return; x.strokeStyle = "#2f6b3a"; x.lineWidth = 2.5 / k; x.beginPath(); x.moveTo(q[0] - 12 / k, q[1]); x.lineTo(q[0] + 12 / k, q[1]); x.moveTo(q[0], q[1] - 12 / k); x.lineTo(q[0], q[1] + 12 / k); x.stroke(); }));
    }),
    /* 4 parcel polygons */
    sheet((x, k) => {
      x.fillStyle = "rgba(251,248,241,.35)"; x.fillRect(crop.x, crop.y, crop.s, crop.s);
      V.parcels.forEach((p) => { path(x, p.poly); x.fillStyle = p.split ? "rgba(217,98,43,.14)" : "rgba(47,107,58,.12)"; x.fill(); });
      drawParcels(x, 1, true, k * .75);
    }),
    /* 5 land records, linked by parcel ID */
    sheet((x, k) => {
      x.fillStyle = "rgba(251,248,241,.8)"; x.fillRect(crop.x, crop.y, crop.s, crop.s);
      const cards = V.parcels.filter((p) => p.cx > crop.x + 60 && p.cx < crop.x + crop.s - 60 && p.cy > crop.y + 60 && p.cy < crop.y + crop.s - 60).slice(0, 9);
      cards.forEach((p, i) => {
        const w = 120, h = 74;
        x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(p.cx - w / 2 + 6, p.cy - h / 2 + 6, w, h);
        x.fillStyle = "#fffdf8"; x.strokeStyle = "#1e2a20"; x.lineWidth = 2.4 / k; x.fillRect(p.cx - w / 2, p.cy - h / 2, w, h); x.strokeRect(p.cx - w / 2, p.cy - h / 2, w, h);
        x.fillStyle = ["#2f6b3a", "#3d7c9c", "#d9622b"][i % 3]; x.fillRect(p.cx - w / 2, p.cy - h / 2, w, 16);
        x.fillStyle = "#1e2a20"; x.font = "600 20px IBM Plex Mono, monospace"; x.textAlign = "left"; x.fillText(p.id, p.cx - w / 2 + 10, p.cy + 8);
        x.fillStyle = "#c9b994"; x.fillRect(p.cx - w / 2 + 10, p.cy + 18, w - 30, 5);
      });
    }),
  ];
  /* isometric sheets, stacked */
  const NS = "http://www.w3.org/2000/svg", GAP = 96, n = imgs.length;
  const svg = d.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 640 " + (310 + GAP * (n - 1))); svg.setAttribute("class", "stack-svg"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Five stacked map layers: drone imagery, orthomosaic, rover control points, parcel polygons, and the linked land records");
  const cols = ["#8a8f7c", "#3d7c9c", "#d9622b", "#2f6b3a", "#1e2a20"];
  const groups = [];
  imgs.forEach((src, i) => {
    const lvl = n - 1 - i;                                   // bottom sheet = raw imagery
    const g = d.createElementNS(NS, "g"); g.setAttribute("class", "ly"); g.dataset.i = i;
    g.style.transform = "translateY(0px)";
    const inner = d.createElementNS(NS, "g");
    inner.setAttribute("transform", `translate(320 ${40 + lvl * GAP}) matrix(0.866 0.5 -0.866 0.5 0 0) scale(${250 / S})`);
    const shadow = d.createElementNS(NS, "rect"); shadow.setAttribute("x", 14); shadow.setAttribute("y", 14); shadow.setAttribute("width", S); shadow.setAttribute("height", S); shadow.setAttribute("fill", "rgba(60,45,20,.14)");
    const img = d.createElementNS(NS, "image"); img.setAttribute("href", src); img.setAttribute("width", S); img.setAttribute("height", S);
    const edge = d.createElementNS(NS, "rect"); edge.setAttribute("width", S); edge.setAttribute("height", S); edge.setAttribute("fill", "none"); edge.setAttribute("stroke", cols[i]); edge.setAttribute("stroke-width", 6);
    inner.append(shadow, img, edge); g.appendChild(inner);
    const tag = d.createElementNS(NS, "text"); tag.setAttribute("x", 600); tag.setAttribute("y", 40 + lvl * GAP + 125); tag.setAttribute("text-anchor", "end"); tag.setAttribute("font-family", "IBM Plex Mono, monospace"); tag.setAttribute("font-size", 13); tag.setAttribute("font-weight", 600); tag.setAttribute("fill", cols[i]); tag.textContent = `0${i + 1}`;
    g.appendChild(tag);
    groups.push(g);
  });
  groups.forEach((g) => svg.appendChild(g));                      // bottom sheet first, so each layer sits on the one below
  host.appendChild(svg);
  const btns = [...d.querySelectorAll("[data-layer]")];
  const focus = (i) => {
    groups.forEach((g, k) => { g.classList.toggle("dim", i !== null && k !== i); g.style.transform = `translateY(${i === null ? 0 : k === i ? -26 : k < i ? -8 : 8}px)`; });
    btns.forEach((b) => b.classList.toggle("on", +b.dataset.layer === i));
  };
  btns.forEach((b) => { const i = +b.dataset.layer; b.addEventListener("mouseenter", () => focus(i)); b.addEventListener("focus", () => focus(i)); b.addEventListener("click", () => focus(i)); });
  d.querySelector(".layer-list")?.addEventListener("mouseleave", () => focus(null));
  groups.forEach((g, i) => { g.addEventListener("mouseenter", () => focus(i)); g.addEventListener("mouseleave", () => focus(null)); });
})();
