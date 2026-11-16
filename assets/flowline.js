/* ==========================================================================
   RAG, CAG and KAG: stage-by-stage flow diagrams (pages 08 and 09)
   --------------------------------------------------------------------------
     const F = FlowLine({ root, timeline: T, diagrams: [
       { el, links: [["a", "b"], ...], show: (step) => bool, folded: (step) => bool },
     ] });

   Diagram nodes are .fnode elements with an id and
     data-from="3"     the step the stage first appears
     data-cur="3,9"    steps where it is the stage at work (data-show syntax)
     data-done="3"     the step whose output it produces (defaults to data-from)
     <span class="out">facts</span>   the small output tag it keeps afterwards
   Each step's big panel is a .fstage with data-show="N". Inside it, items with
   data-s="name" appear when the step's script calls F.show("name", at).

   In render(step, prev):  F.render(step, forward)  then, if stepping forward,
   play the stage with F.show / F.out / F.work / F.fly / F.at.
   ========================================================================== */

(function () {
  "use strict";

  function matches(spec, step) {
    if (!spec) return false;
    return spec.split(",").some((part) => {
      part = part.trim();
      if (part.endsWith("+")) return step >= Number(part.slice(0, -1));
      if (part.includes("-")) { const [a, b] = part.split("-").map(Number); return step >= a && step <= b; }
      return step === Number(part);
    });
  }

  window.FlowLine = function ({ root, timeline: T, diagrams }) {
    const $ = (id) => document.getElementById(id);
    let step = 0;

    /* ---------- links between stages ---------- */
    function layout() {
      diagrams.forEach((d) => {
        const svg = d.el.querySelector(".fl-links");
        const box = d.el.getBoundingClientRect();
        if (!box.width) return;
        const r = (id) => { const b = $(id).getBoundingClientRect(); return { l: b.left - box.left, r: b.right - box.left, t: b.top - box.top, b: b.bottom - box.top, cx: b.left - box.left + b.width / 2, cy: b.top - box.top + b.height / 2 }; };
        svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
        svg.innerHTML = d.links.map(([a, b]) => {
          const A = r(a), B = r(b);
          let path, head;
          if (B.l > A.r - 4) {
            // forwards: right side of A to left side of B
            const x1 = A.r + 2, y1 = A.cy, x2 = B.l - 9, y2 = B.cy, mx = (x1 + x2) / 2;
            path = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
            head = `${x2 + 8},${y2} ${x2},${y2 - 5} ${x2},${y2 + 5}`;
          } else {
            // B sits below and to the left: leave from A's bottom, enter B's top
            const x1 = A.cx, y1 = A.b + 2, x2 = B.cx, y2 = B.t - 9;
            path = `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
            head = `${x2},${y2 + 8} ${x2 - 5},${y2} ${x2 + 5},${y2}`;
          }
          return `<path class="fl-link" data-to="${b}" data-from="${a}" pathLength="1" d="${path}"/><polygon class="fl-head" data-to="${b}" data-from="${a}" points="${head}"/>`;
        }).join("");
        paintLinks();
      });
    }
    function paintLinks() {
      root.querySelectorAll(".fl-link, .fl-head").forEach((el) => {
        const to = $(el.dataset.to), from = $(el.dataset.from);
        el.style.setProperty("--lc", getComputedStyle(to).getPropertyValue("--nc"));
        el.classList.toggle("on", to.classList.contains("on") && from.classList.contains("on"));
        el.classList.toggle("hot", to.classList.contains("cur"));
      });
    }
    new ResizeObserver(() => layout()).observe(root);

    /* ---------- the state of a step ---------- */
    function render(s, forward) {
      step = s;
      root.classList.toggle("nodelay", !forward);
      T.clear();
      diagrams.forEach((d) => {
        d.el.classList.toggle("off", !d.show(s));
        d.el.classList.toggle("folded", !!(d.folded && d.folded(s)));
      });
      root.querySelectorAll(".fnode").forEach((n) => {
        const from = Number(n.dataset.from), done = Number(n.dataset.done || n.dataset.from);
        n.classList.toggle("on", from <= s);
        n.classList.toggle("cur", matches(n.dataset.cur, s));
        n.classList.remove("work");
        const out = n.querySelector(".out");
        if (out) out.classList.toggle("on", done < s || (done === s && !forward));
      });
      root.querySelectorAll(".fstage [data-s]").forEach((el) => el.classList.toggle("on", !forward));
      layout();
    }

    /* ---------- what a step's script uses ---------- */
    const at = (t, fn) => T.at(t, fn);
    // show items named `name` in the current stage panel (several names: "a b")
    function show(names, t = 0) {
      T.at(t, () => names.split(" ").forEach((nm) =>
        root.querySelectorAll(`.fstage.is-on [data-s="${nm}"]`).forEach((el) => el.classList.add("on"))));
    }
    const out = (id, t = 0) => T.at(t, () => { const o = $(id).querySelector(".out"); if (o) o.classList.add("on"); });
    function work(id, t0, t1) {
      T.at(t0, () => $(id).classList.add("work"));
      if (t1 !== undefined) T.at(t1, () => $(id).classList.remove("work"));
    }
    // the output tag of one stage travels into another
    function fly(from, to, label, t = 0, cls = "") {
      T.at(t, () => {
        const src = $(from).querySelector(".out.on") || $(from);
        window.Flow && Flow.fly(root, src, $(to), label, { cls, ms: 850 });
      });
    }

    return { render, layout, at, show, out, work, fly, get step() { return step; } };
  };
})();
