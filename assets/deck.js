/* ==========================================================================
   RAG, CAG and KAG: shared step engine
   --------------------------------------------------------------------------
   Each page calls:

     Deck.init({
       steps: [
         { group, title, tag, body, notes },   // body/notes are HTML strings
         ...
       ],
       groupColors: { "First question": "var(--c-question)" },  // optional
       render(step, prev) { ... }         // called on every change
     });

   If the page has <ol id="timeline">, the steps are drawn there as a
   vertical timeline: steps not reached yet are greyed out, the current one
   is expanded, and any step can be clicked.

   Elements with data-show="..." are shown/hidden automatically
   (see deck.css for the syntax). The step is kept in the URL (#3).

   `prev === step - 1` means the presenter moved forward one step, so the
   page should play that step's animation. Any other jump should just show
   the end state of the step.

   Keys: Right/Space/PageDown next, Left/PageUp back, Home/End,
         N notes, F full screen, T theme, I agenda, ? help
   ========================================================================== */

(function () {
  "use strict";

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  const savedTheme = store.get("deck-theme");
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  let steps = [];
  let idx = 0;
  let renderFn = null;
  let groupColors = {};
  let ui = {};

  function parseShow(spec, n) {
    return spec.split(",").some((part) => {
      part = part.trim();
      if (!part) return false;
      if (part.endsWith("+")) return n >= Number(part.slice(0, -1));
      if (part.includes("-")) {
        const [a, b] = part.split("-").map(Number);
        return n >= a && n <= b;
      }
      return n === Number(part);
    });
  }

  function buildTimeline(ol) {
    ui.items = [];
    ui.groups = [];
    let lastGroup = null;
    steps.forEach((s, i) => {
      if (s.group && s.group !== lastGroup) {
        const g = document.createElement("li");
        g.className = "tl-group";
        const count = steps.filter((x) => x.group === s.group).length;
        g.innerHTML = `${s.group} <small>${count} ${count === 1 ? "step" : "steps"}</small>`;
        if (groupColors[s.group]) g.style.setProperty("--g", groupColors[s.group]);
        g.dataset.first = i;
        ol.appendChild(g);
        ui.groups.push(g);
        lastGroup = s.group;
      }
      const li = document.createElement("li");
      li.className = "tl-item";
      if (s.group && groupColors[s.group]) li.style.setProperty("--g", groupColors[s.group]);
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.innerHTML = `
        <span class="tl-dot num">${i + 1}</span>
        <div class="tl-text">
          <div class="tl-title"><span>${s.title || ""}</span>${s.tag ? `<span class="tl-tag">${s.tag}</span>` : ""}</div>
          ${s.body ? `<div class="tl-desc"><div>${s.body}</div></div>` : ""}
        </div>`;
      li.addEventListener("click", () => go(i));
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); go(i); }
      });
      ol.appendChild(li);
      ui.items.push(li);
    });
  }

  function buildChrome() {
    const deck = document.querySelector(".deck") || document.body;
    const timeline = document.getElementById("timeline");

    const controls = document.createElement("footer");
    controls.className = "controls";
    controls.innerHTML = `
      <button type="button" data-act="prev" aria-label="Previous step">Back</button>
      <button type="button" data-act="next" aria-label="Next step">Next</button>
      <span class="step-count num" aria-live="polite"></span>
      ${timeline ? `<span class="spacer"></span>` : `<div class="progress" aria-label="Steps"></div>`}
      <span class="hint"><span><kbd>N</kbd>notes</span><span><kbd>F</kbd>full screen</span><span><kbd>?</kbd>all keys</span></span>`;
    deck.appendChild(controls);

    const notes = document.createElement("div");
    notes.className = "notes";
    notes.setAttribute("aria-label", "Speaker notes");
    notes.innerHTML = `<div class="notes-head">Speaker notes</div><div class="notes-body"></div>`;
    document.body.appendChild(notes);

    const help = document.createElement("div");
    help.className = "help";
    help.innerHTML = `
      <div class="card">
        <h2>Keyboard</h2>
        <table>
          <tr><td>Right arrow, Space, Page Down</td><td>Next step</td></tr>
          <tr><td>Left arrow, Page Up</td><td>Previous step</td></tr>
          <tr><td>Home / End</td><td>First / last step</td></tr>
          <tr><td>N</td><td>Speaker notes</td></tr>
          <tr><td>F</td><td>Full screen</td></tr>
          <tr><td>T</td><td>Dark or light theme</td></tr>
          <tr><td>I</td><td>Back to the agenda</td></tr>
        </table>
      </div>`;
    help.addEventListener("click", () => help.classList.remove("open"));
    document.body.appendChild(help);

    ui = {
      prev: controls.querySelector('[data-act="prev"]'),
      next: controls.querySelector('[data-act="next"]'),
      progress: controls.querySelector(".progress"),
      count: controls.querySelector(".step-count"),
      notes,
      notesBody: notes.querySelector(".notes-body"),
      help,
      caption: document.getElementById("caption"),
      timeline,
    };

    ui.prev.addEventListener("click", prev);
    ui.next.addEventListener("click", next);

    if (timeline) {
      buildTimeline(timeline);
      const head = document.querySelector(".tl-head") || timeline.parentElement;
      const prog = document.createElement("div");
      prog.className = "tl-progress";
      prog.innerHTML = `<div class="tl-bar"><span></span></div><span>Step <b></b> of ${steps.length}</span>`;
      head.appendChild(prog);
      ui.tlBar = prog.querySelector(".tl-bar span");
      ui.tlNum = prog.querySelector("b");
      ui.count.hidden = true;
    }

    else if (ui.progress) {
      steps.forEach((s, i) => {
        const dot = document.createElement("i");
        dot.title = s.title ? s.title.replace(/<[^>]+>/g, "") : `Step ${i + 1}`;
        dot.addEventListener("click", () => go(i));
        ui.progress.appendChild(dot);
      });
    }

    const topbar = document.querySelector(".topbar");
    if (topbar) buildTopbar(topbar);

    if (store.get("deck-notes") === "1") notes.classList.add("open");
  }

  /* top bar: brand (back to the start), this page, the session timeline, theme.
     The timeline needs assets/session.js and <body data-topic="01">. */
  function buildTopbar(topbar) {
    const agenda = topbar.querySelector("a[href='index.html']");
    if (window.SessionNav) {
      if (agenda) agenda.remove();
      const brand = document.createElement("a");
      brand.className = "brand-sm";
      brand.href = "index.html";
      brand.title = "Back to the start";
      brand.innerHTML = `<span class="r">RAG</span>, <span class="c">CAG</span> and <span class="k">KAG</span>`;
      topbar.insertBefore(brand, topbar.firstChild);

      const sec = topbar.querySelector(".sec"), name = topbar.querySelector(".name");
      if (sec && name) {
        const here = document.createElement("span");
        here.className = "here-name";
        sec.before(here);
        here.append(sec, name);
      }

      const nav = document.createElement("nav");
      nav.className = "timeline-nav";
      nav.setAttribute("aria-label", "Session");
      const ol = document.createElement("ol");
      ol.className = "tn";
      nav.appendChild(ol);
      const spacer = topbar.querySelector(".spacer");
      if (spacer) spacer.replaceWith(nav); else topbar.appendChild(nav);
      window.SessionNav.render(ol, { current: document.body.dataset.topic || null });
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-btn";
    btn.addEventListener("click", toggleTheme);
    const stillAgenda = topbar.querySelector("a[href='index.html']:not(.brand-sm)");
    topbar.insertBefore(btn, stillAgenda || null);
    ui.themeBtn = btn;
    syncThemeBtn();
  }

  function renderCaption(s) {
    if (!ui.caption) return;
    ui.caption.innerHTML = `
      ${s.title ? `<h1>${s.title}</h1>` : ""}
      ${s.body ? `<div class="body">${s.body}</div>` : ""}`;
    ui.caption.classList.remove("swap");
    void ui.caption.offsetWidth;
    ui.caption.classList.add("swap");
  }

  function apply(prevIdx) {
    const s = steps[idx] || {};
    document.body.dataset.step = idx;

    document.querySelectorAll("[data-show]").forEach((el) => {
      el.classList.toggle("is-on", parseShow(el.dataset.show, idx));
    });

    renderCaption(s);
    ui.notesBody.innerHTML = s.notes || "<em>No notes for this step.</em>";

    if (ui.items) {
      ui.items.forEach((li, i) => {
        li.classList.toggle("done", i < idx);
        li.classList.toggle("cur", i === idx);
        if (i === idx) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      });
      ui.groups.forEach((g) => g.classList.toggle("reached", Number(g.dataset.first) <= idx));
      const cur = ui.items[idx];
      if (cur) {
        clearTimeout(ui._scrollT);
        ui._scrollT = setTimeout(() => cur.scrollIntoView({ block: "center", behavior: "smooth" }), 420);
      }
      ui.tlBar.style.width = ((idx + 1) / steps.length) * 100 + "%";
      ui.tlNum.textContent = idx + 1;
    }
    if (ui.progress) {
      [...ui.progress.children].forEach((dot, i) => {
        dot.classList.toggle("done", i < idx);
        dot.classList.toggle("cur", i === idx);
      });
    }
    ui.count.textContent = `${idx + 1} / ${steps.length}`;

    const hasPrevPage = !!document.body.dataset.prev;
    const hasNextPage = !!document.body.dataset.next;
    ui.prev.disabled = idx === 0 && !hasPrevPage;
    ui.next.disabled = idx === steps.length - 1 && !hasNextPage;
    ui.next.textContent = idx === steps.length - 1 && hasNextPage ? "Next topic" : "Next";

    try { history.replaceState(null, "", "#" + (idx + 1)); } catch (e) { /* ignore */ }

    if (renderFn) renderFn(idx, prevIdx, s);
  }

  function go(i) {
    i = Math.max(0, Math.min(steps.length - 1, i));
    const prevIdx = idx;
    idx = i;
    apply(prevIdx);
  }

  function next() {
    if (idx < steps.length - 1) return go(idx + 1);
    const n = document.body.dataset.next;
    if (n) location.href = n;
  }

  function prev() {
    if (idx > 0) return go(idx - 1);
    const p = document.body.dataset.prev;
    if (p) location.href = p + (p.includes("index") ? "" : "#end");
  }

  function toggleNotes() {
    const open = ui.notes.classList.toggle("open");
    store.set("deck-notes", open ? "1" : "0");
  }

  // dark is the default (no attribute); light is data-theme="light"
  function toggleTheme() {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    store.set("deck-theme", nextTheme);
    syncThemeBtn();
  }

  function syncThemeBtn() {
    if (!ui.themeBtn) return;
    const light = document.documentElement.dataset.theme === "light";
    ui.themeBtn.innerHTML = `<i></i>${light ? "Dark theme" : "Light theme"}`;
    ui.themeBtn.setAttribute("aria-label", light ? "Switch to the dark theme" : "Switch to the light theme");
  }

  function toggleFull() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function onKey(e) {
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); next(); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); prev(); }
    else if (k === "Home") go(0);
    else if (k === "End") go(steps.length - 1);
    else if (k === "n" || k === "N") toggleNotes();
    else if (k === "f" || k === "F") toggleFull();
    else if (k === "t" || k === "T") toggleTheme();
    else if (k === "i" || k === "I") location.href = "index.html";
    else if (k === "?") ui.help.classList.toggle("open");
    else if (k === "Escape") ui.help.classList.remove("open");
  }

  function startIndex() {
    const h = location.hash.replace("#", "");
    if (h === "end") return steps.length - 1;
    const n = parseInt(h, 10);
    return Number.isFinite(n) ? n - 1 : 0;
  }

  /* ---------- helpers pages can use ---------- */

  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fmt(v) { return Math.round(v).toLocaleString("en-US"); }

  // animate a number inside an element
  function tween(el, to, { duration = 900, format = fmt } = {}) {
    if (!el) return;
    const from = Number(el.dataset.value || 0);
    el.dataset.value = to;
    cancelAnimationFrame(el._raf);
    if (reduced() || from === to || duration === 0) {
      el.textContent = format(to);
      return;
    }
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = format(from + (to - from) * e);
      if (p < 1) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
  }

  // a timeline of timeouts that can be cancelled when the step changes
  function timeline() {
    const ids = [];
    return {
      at(ms, fn) { ids.push(setTimeout(fn, reduced() ? 0 : ms)); },
      clear() { ids.forEach(clearTimeout); ids.length = 0; },
    };
  }

  window.Deck = {
    init(opts) {
      steps = opts.steps || [];
      renderFn = opts.render || null;
      groupColors = opts.groupColors || {};
      buildChrome();
      document.addEventListener("keydown", onKey);
      idx = Math.max(0, Math.min(steps.length - 1, startIndex()));
      apply(-1);
    },
    go, next, prev, tween, timeline, fmt, reduced,
    get step() { return idx; },
  };
})();
