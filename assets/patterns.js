/* ==========================================================================
   RAG, CAG and KAG: one short animated scene per pattern
   --------------------------------------------------------------------------
   Each scene answers a question with the same context window on the right;
   only the way knowledge gets into the window changes.

     const s = PatternScenes.create("cag" | "rag" | "kag");
     container.appendChild(s.svg);
     s.play({ onStatus(text) {}, onDone() {} });   // about 6 to 8 seconds
     s.final();                                    // jump to the last frame
     s.stop();                                     // cancel a running play

   Styles live in deck.css under "pattern scenes".
   ========================================================================== */

(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, attrs, parent, text) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  const on = (n, yes = true) => n.classList.toggle("on", yes);

  function clock() {
    const ids = [];
    return {
      at(ms, fn) { ids.push(setTimeout(fn, ms)); },
      clear() { ids.forEach(clearTimeout); ids.length = 0; },
    };
  }

  /* ---------- parts every scene shares ---------- */
  const WIN = { x: 300, y: 18, w: 72, h: 144 };

  function base(kind, title) {
    const svg = el("svg", { viewBox: "0 0 400 180", class: "ps ps-" + kind, role: "img", "aria-label": title });
    el("text", { x: WIN.x + WIN.w / 2, y: 11, class: "ps-lab", "text-anchor": "middle" }, svg, "Context window");
    el("rect", { x: WIN.x, y: WIN.y, width: WIN.w, height: WIN.h, rx: 5, class: "ps-win" }, svg);
    const sys = seg(svg, 21, 9, "sys");
    on(sys);
    return svg;
  }
  function seg(svg, y, h, cls) {
    return el("rect", { x: WIN.x + 4, y, width: WIN.w - 8, height: h, rx: 2, class: "ps-seg " + cls }, svg);
  }
  function chip(svg) {
    const g = el("g", { class: "ps-chip" }, svg);
    el("rect", { x: 14, y: 150, width: 210, height: 22, rx: 11 }, g);
    const t = el("text", { x: 27, y: 165 }, g);
    return { g, set(text) { t.textContent = text; } };
  }
  // move an element towards a point in the window and fade it
  function flyTo(node, dx, dy, scale = 1) {
    node.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  }

  /* =================== CAG: load once, keep it =================== */
  function cag() {
    const svg = base("cag", "CAG: load all knowledge once and keep it");
    const c = clock();
    el("text", { x: 14, y: 11, class: "ps-lab" }, svg, "Your documents");

    [0, 1, 2].forEach((i) => {
      el("rect", { x: 40 + i * 16, y: 26 + i * 10, width: 62, height: 80, rx: 4, class: "ps-ghost" }, svg);
    });
    const docs = [0, 1, 2].map((i) => {
      const g = el("g", { class: "ps-doc" }, svg);
      const x = 40 + i * 16, y = 26 + i * 10;
      el("rect", { x, y, width: 62, height: 80, rx: 4 }, g);
      [14, 24, 34, 44, 54].forEach((dy, j) =>
        el("line", { x1: x + 9, y1: y + dy, x2: x + (j === 4 ? 36 : 52), y2: y + dy }, g));
      return { g, x, y };
    });

    const know = seg(svg, 32, 72, "p");
    const kept = el("rect", { x: WIN.x + 1.5, y: 30, width: WIN.w - 3, height: 76, rx: 4, class: "ps-kept" }, svg);
    const keptLab = el("text", { x: WIN.x - 8, y: 64, class: "ps-side", "text-anchor": "end" }, svg, "kept for");
    const keptLab2 = el("text", { x: WIN.x - 8, y: 75, class: "ps-side", "text-anchor": "end" }, svg, "every question");
    const q = seg(svg, 107, 7, "q");
    const a = seg(svg, 116, 24, "a");
    const ch = chip(svg);
    const count = el("text", { x: 14, y: 136, class: "ps-count" }, svg, "");

    function reset() {
      c.clear();
      docs.forEach((d) => { d.g.style.transform = ""; d.g.classList.remove("gone"); });
      [know, kept, keptLab, keptLab2, q, a, ch.g].forEach((n) => on(n, false));
      know.classList.remove("ps-pulse");
      count.textContent = "";
    }
    function final() {
      reset();
      docs.forEach((d) => d.g.classList.add("gone", "instant"));
      [know, kept, keptLab, keptLab2, q, a, ch.g].forEach((n) => on(n));
      ch.set("Can I carry days over?");
      count.textContent = "Documents loaded once. Questions answered: 2";
      requestAnimationFrame(() => docs.forEach((d) => d.g.classList.remove("instant")));
    }
    function play({ onStatus = () => {}, onDone = () => {} } = {}) {
      if (reduced()) { final(); onStatus("Loaded once, reused for every question"); onDone(); return; }
      reset();
      onStatus("Load every document into the window, once");
      docs.forEach((d, i) => c.at(250 + i * 300, () => {
        flyTo(d.g, WIN.x + 10 - d.x, 40 - d.y, 0.3);
        d.g.classList.add("gone");
      }));
      c.at(700, () => on(know));
      c.at(1700, () => {
        [kept, keptLab, keptLab2].forEach((n) => on(n));
        onStatus("Keep it in the window for every question");
        count.textContent = "Documents loaded once";
      });
      c.at(2700, () => { ch.set("How many leave days do I get?"); on(ch.g); onStatus("Question 1"); });
      c.at(3050, () => on(q));
      c.at(3350, () => { on(a); onStatus("Answered from the kept knowledge"); });
      c.at(4700, () => { [ch.g, q, a].forEach((n) => on(n, false)); });
      c.at(5100, () => {
        ch.set("Can I carry days over?");
        on(ch.g);
        know.classList.add("ps-pulse");
        onStatus("Question 2: nothing is loaded again");
      });
      c.at(5400, () => on(q));
      c.at(5700, () => on(a));
      c.at(6900, () => {
        count.textContent = "Documents loaded once. Questions answered: 2";
        onStatus("Loaded once, reused for every question");
        onDone();
      });
    }
    return { svg, play, final, stop: c.clear, reset };
  }

  /* =================== RAG: search, pick, bring =================== */
  function rag() {
    const svg = base("rag", "RAG: search the documents and bring only the relevant passages");
    const c = clock();
    el("text", { x: 14, y: 11, class: "ps-lab" }, svg, "Document library, split into 40 chunks");

    const COLS = 8, ROWS = 5;
    const chunks = [];
    for (let r = 0; r < ROWS; r++)
      for (let k = 0; k < COLS; k++) {
        const x = 14 + k * 26, y = 22 + r * 21;
        chunks.push({ x, y, n: el("rect", { x, y, width: 22, height: 15, rx: 2, class: "ps-chunk" }, svg) });
      }

    const lens = el("g", { class: "ps-lens" }, svg);
    el("circle", { cx: 0, cy: 0, r: 12 }, lens);
    el("line", { x1: 8.5, y1: 8.5, x2: 17, y2: 17 }, lens);

    const slots = [32, 47, 62].map((y) => seg(svg, y, 13, "p"));
    const q = seg(svg, 78, 7, "q");
    const a = seg(svg, 87, 24, "a");
    const ch = chip(svg);
    const count = el("text", { x: 14, y: 140, class: "ps-count" }, svg, "");
    const flyers = [];

    const lensAt = (i) => { const k = chunks[i]; lens.style.transform = `translate(${k.x + 11}px, ${k.y + 7}px)`; };

    function clearRound() {
      chunks.forEach((k) => k.n.classList.remove("hit"));
      slots.forEach((s) => on(s, false));
      [q, a].forEach((n) => on(n, false));
      flyers.splice(0).forEach((f) => f.remove());
    }
    function reset() {
      c.clear();
      clearRound();
      on(lens, false);
      on(ch.g, false);
      count.textContent = "";
    }
    function bring(hits, start) {
      hits.forEach((i, j) => c.at(start + j * 120, () => {
        const k = chunks[i];
        const f = el("rect", { x: k.x, y: k.y, width: 22, height: 15, rx: 2, class: "ps-fly" }, svg);
        flyers.push(f);
        requestAnimationFrame(() => requestAnimationFrame(() => flyTo(f, WIN.x + 25 - k.x, 33 + j * 15 - k.y)));
      }));
      c.at(start + 900, () => {
        flyers.splice(0).forEach((f) => f.remove());
        hits.forEach((_, j) => on(slots[j]));
      });
    }
    function round(question, path, hits, start, label) {
      c.at(start, () => { clearRound(); ch.set(question); on(ch.g); onStatusRef("A question arrives"); });
      c.at(start + 400, () => { on(lens); lensAt(path[0]); onStatusRef(label); });
      path.forEach((i, j) => c.at(start + 500 + j * 260, () => lensAt(i)));
      const t = start + 500 + path.length * 260;
      c.at(t, () => {
        hits.forEach((i) => chunks[i].n.classList.add("hit"));
        on(lens, false);
        onStatusRef(`${hits.length} relevant passages found`);
        count.textContent = `${hits.length} of 40 chunks sent`;
      });
      bring(hits, t + 450);
      c.at(t + 1500, () => { on(q); onStatusRef("Only those passages go into the window"); });
      c.at(t + 1800, () => { on(a); });
      return t + 3000;
    }
    let onStatusRef = () => {};

    function final() {
      reset();
      ch.set("Who approves it?");
      on(ch.g);
      [4, 33].forEach((i) => chunks[i].n.classList.add("hit"));
      [slots[0], slots[1], q, a].forEach((n) => on(n));
      count.textContent = "2 of 40 chunks sent";
    }
    function play({ onStatus = () => {}, onDone = () => {} } = {}) {
      onStatusRef = onStatus;
      if (reduced()) { final(); onStatus("Each question brings its own passages"); onDone(); return; }
      reset();
      const end1 = round("Can I carry days over?", [0, 3, 10, 13, 21, 18, 26, 29], [10, 29, 22], 0, "Search the library for matching chunks");
      const end2 = round("Who approves it?", [7, 4, 25, 33], [4, 33], end1, "Next question, a new search");
      c.at(end2, () => { onStatus("Each question brings its own passages"); onDone(); });
    }
    return { svg, play, final, stop: c.clear, reset };
  }

  /* =================== KAG: follow the connections =================== */
  function kag() {
    const svg = base("kag", "KAG: follow connected facts in a knowledge graph");
    const c = clock();
    el("text", { x: 14, y: 11, class: "ps-lab" }, svg, "Knowledge graph");

    const N = {
      you:     { x: 34,  y: 98,  t: "You" },
      sales:   { x: 96,  y: 62,  t: "Sales team" },
      sara:    { x: 166, y: 96,  t: "Sara" },
      carry:   { x: 232, y: 62,  t: "Carry-over" },
      finance: { x: 168, y: 30,  t: "Finance" },
      policy:  { x: 56,  y: 30,  t: "Leave policy" },
      payroll: { x: 234, y: 120, t: "Payroll" },
    };
    const E = [
      ["you", "sales", "works in", 46, 72],
      ["sales", "sara", "managed by", 140, 72],
      ["sara", "carry", "approves", 190, 70],
      ["sales", "finance"], ["policy", "sales"], ["policy", "carry"], ["sara", "payroll"], ["finance", "carry"],
    ];
    const edges = E.map(([a, b, label, lx, ly]) => {
      const A = N[a], B = N[b];
      const line = el("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: "ps-edge" }, svg);
      const lab = label ? el("text", { x: lx, y: ly, class: "ps-elab", "text-anchor": "middle" }, svg, label) : null;
      return { line, lab };
    });
    const nodes = {};
    for (const k in N) {
      const g = el("g", { class: "ps-node" }, svg);
      el("circle", { cx: N[k].x, cy: N[k].y, r: 7 }, g);
      el("text", { x: N[k].x, y: N[k].y + 17, "text-anchor": "middle" }, g, N[k].t);
      nodes[k] = g;
    }

    const facts = [32, 42, 52].map((y) => seg(svg, y, 8, "p"));
    const q = seg(svg, 63, 7, "q");
    const a = seg(svg, 72, 24, "a");
    const ch = chip(svg);
    const count = el("text", { x: 14, y: 143, class: "ps-count" }, svg, "");

    const path = [["you"], ["sales", 0], ["sara", 1], ["carry", 2]];

    function reset() {
      c.clear();
      Object.values(nodes).forEach((g) => g.classList.remove("hit", "start"));
      edges.forEach((e) => { e.line.classList.remove("lit"); if (e.lab) on(e.lab, false); });
      [...facts, q, a, ch.g].forEach((n) => on(n, false));
      count.textContent = "";
    }
    function final() {
      reset();
      ch.set("Who approves my carry-over?");
      nodes.you.classList.add("hit", "start");
      path.slice(1).forEach(([n, e]) => { nodes[n].classList.add("hit"); edges[e].line.classList.add("lit"); on(edges[e].lab); });
      [...facts, q, a, ch.g].forEach((n) => on(n));
      count.textContent = "3 connected facts sent. Answer: Sara";
    }
    function play({ onStatus = () => {}, onDone = () => {} } = {}) {
      if (reduced()) { final(); onStatus("Connected facts, not loose passages"); onDone(); return; }
      reset();
      c.at(0, () => { ch.set("Who approves my carry-over?"); on(ch.g); onStatus("A question about how things relate"); });
      c.at(700, () => { nodes.you.classList.add("hit", "start"); onStatus("Start at the entity in the question"); });
      path.slice(1).forEach(([n, e], i) => {
        const t = 1400 + i * 850;
        c.at(t, () => {
          edges[e].line.classList.add("lit");
          on(edges[e].lab);
          onStatus(`Follow the connection: ${E[e][2]}`);
        });
        c.at(t + 350, () => { nodes[n].classList.add("hit"); on(facts[i]); });
      });
      c.at(4200, () => { on(q); onStatus("The connected facts go into the window"); count.textContent = "3 connected facts sent"; });
      c.at(4500, () => on(a));
      c.at(5800, () => { count.textContent = "3 connected facts sent. Answer: Sara"; onStatus("Connected facts, not loose passages"); onDone(); });
    }
    return { svg, play, final, stop: c.clear, reset };
  }

  window.PatternScenes = {
    create(kind) { return { cag, rag, kag }[kind](); },
  };
})();
