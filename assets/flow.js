/* ==========================================================================
   RAG, CAG and KAG: pieces shared by the RAG pages (05 and 06)
   --------------------------------------------------------------------------
   Flow.fly(host, from, to, html, {ms, delay, cls})  move a chip between boxes
   Flow.clear(host)                                  remove chips in flight
   Flow.vg(seed, near)                               a vector drawn as bars
   Flow.glyph()                                      the embedding model's icon
   Flow.map({hits})                                  48 chunks placed by meaning
   ========================================================================== */

(function () {
  "use strict";

  const rnd = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };

  /* ---------- a chip that flies from one element to another ---------- */
  function centre(host, el) {
    const h = host.getBoundingClientRect(), r = el.getBoundingClientRect();
    return [r.left - h.left + r.width / 2, r.top - h.top + r.height / 2];
  }
  function fly(host, from, to, html, { ms = 750, delay = 0, cls = "" } = {}) {
    if (!from || !to) return;
    const el = document.createElement("div");
    el.className = "flyer " + cls;
    el.innerHTML = html;
    const [x0, y0] = centre(host, from);
    el.style.left = x0 + "px";
    el.style.top = y0 + "px";
    el.style.transitionDuration = ms + "ms";
    host.appendChild(el);
    setTimeout(() => {
      if (!el.isConnected) return;
      const [x1, y1] = centre(host, to);
      el.classList.add("on");
      el.style.left = x1 + "px";
      el.style.top = y1 + "px";
    }, delay + 30);
    setTimeout(() => el.classList.add("land"), delay + ms + 30);
    setTimeout(() => el.remove(), delay + ms + 260);
  }
  const clear = (host) => host.querySelectorAll(".flyer").forEach((e) => e.remove());

  /* ---------- a vector as a row of bars ----------
     `near` gives a vector close to another one: same shape, a little noise. */
  function vg(seed, near) {
    let h = "";
    for (let i = 0; i < 12; i++) {
      let v = rnd(seed * 31 + i * 7);
      if (near !== undefined) v = Math.min(1, Math.max(0, rnd(near * 31 + i * 7) + (rnd(seed * 17 + i) - 0.5) * 0.18));
      h += `<i style="--v:${(0.18 + v * 0.82).toFixed(2)}"></i>`;
    }
    return `<span class="vg" aria-hidden="true">${h}</span>`;
  }

  /* ---------- the embedding model's icon: a small 3-4-3 network ---------- */
  function glyph() {
    const C = [[10, [12, 26, 40]], [30, [5, 19, 33, 47]], [50, [12, 26, 40]]];
    let h = "";
    for (let c = 1; c < 3; c++) C[c - 1][1].forEach((a) => C[c][1].forEach((b) => (h += `<line x1="${C[c - 1][0]}" y1="${a}" x2="${C[c][0]}" y2="${b}"/>`)));
    C.forEach(([x, ys], c) => ys.forEach((y, i) => (h += `<circle cx="${x}" cy="${y}" r="4" style="--i:${c * 4 + i}"/>`)));
    return `<svg class="eglyph" viewBox="0 0 60 52" aria-hidden="true">${h}</svg>`;
  }

  /* ---------- 48 chunks placed by meaning ----------
     Three documents, 16 chunks each. HITS are the chunks nearest the question
     on page 06: two from the leave policy and one near-miss from expenses. */
  const DOCS = [
    { name: "Leave policy", k: "var(--c-docs)", cx: 70, cy: 64, lx: 34, ly: 116 },
    { name: "Expenses policy", k: "var(--c-doc2)", cx: 236, cy: 40, lx: 236, ly: 88 },
    { name: "IT handbook", k: "var(--c-doc3)", cx: 168, cy: 104, lx: 214, ly: 130 },
  ];
  const HITS = { 3: [104, 46], 7: [98, 64], 18: [134, 34] };
  const Q = [116, 50];
  function map({ labels = true } = {}) {
    let h = "";
    if (labels) DOCS.forEach((d) => (h += `<text class="mlab" x="${d.lx}" y="${d.ly}" text-anchor="middle">${d.name}</text>`));
    for (let i = 0; i < 48; i++) {
      const d = DOCS[Math.floor(i / 16)];
      let x, y;
      if (HITS[i]) [x, y] = HITS[i];
      else {
        const a = rnd(i + 1) * Math.PI * 2, r = 7 + rnd(i + 7) * 24;
        x = d.cx + Math.cos(a) * r * 1.25;
        y = d.cy + Math.sin(a) * r * 0.62;
      }
      h += `<circle class="dot" data-i="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${d.k}" style="--d:${(i * 0.018).toFixed(3)}s"/>`;
    }
    return h;
  }

  window.Flow = { fly, clear, vg, glyph, map, DOCS, HITS, Q };
})();
