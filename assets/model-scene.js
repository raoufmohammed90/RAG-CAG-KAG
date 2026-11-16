/* ==========================================================================
   RAG, CAG and KAG: the chat app, the model and the prompt cache
   --------------------------------------------------------------------------
   Shared by the topic pages that show a request going from a chat app to a
   model: context window, 4-layer network, working-values tray, prompt cache,
   request packet, streamed answer and the chat itself.

     const M = ModelScene({ limit, trayScale, kinds, timeline: Deck.timeline() });

   The page supplies the markup (same ids as 02-prompt-caching.html) and its
   own steps; this file only animates.

   A request is { rows: [[kind, tokens], ...], mark: n } where `mark` is how
   many rows sit above the cache marker. Rows are tagged when shown:
   "c" served from the cache, "w" written to the cache.
   ========================================================================== */

(function () {
  "use strict";

  window.ModelScene = function (cfg) {
    const LIMIT = cfg.limit;
    const TRAY = cfg.trayScale;
    const KIND = cfg.kinds;
    const T = cfg.timeline;
    const $ = (id) => document.getElementById(id);
    const fmt = Deck.fmt;
    const total = (list) => list.reduce((a, e) => a + e[1], 0);
    const pct = (n) => (n / LIMIT) * 100;
    const tag = (req, cached = 0, write = 0) => req.rows.map(([k, n], i) => [k, n, i < cached ? "c" : i < write ? "w" : ""]);
    const withFirst = (rows) => [...rows, ["response", 1, ""]];

    /* ---------- context window ---------- */
    // the window box is the top 86% of its column; the rest shows an overflow.
    // A big overflow shrinks the drawing (K < 1) so everything stays in the column.
    const FRAME = 86;
    let K = 1;
    const wp = (n) => (n / LIMIT) * FRAME * K;
    const at = (n) => `calc(${wp(n)}% + 2px)`;
    const cwBox = document.querySelector("#cw .cw-box");
    function fitScale(list) {
      const f = (total(list) / LIMIT) * FRAME;
      K = f > 99 ? 99 / f : 1;
      if (cwBox) cwBox.style.height = FRAME * K + "%";
      const oz = document.getElementById("over-zone");
      if (oz) oz.style.top = FRAME * K + "%";
    }
    const segLabel = (k, n) => `${KIND[k].name} ${fmt(n)}`;
    class Column {
      constructor(el) { this.el = el; this.segs = []; }
      make(k) { const s = document.createElement("div"); s.className = "seg " + k; this.el.appendChild(s); return s; }
      place() {
        fitScale(this.segs);
        let top = 0;
        this.segs.forEach(([k, n, s, f]) => {
          s.style.top = at(top);
          s.style.height = wp(n) + "%";
          s.textContent = pct(n) >= 6 ? segLabel(k, n) : "";
          s.title = segLabel(k, n);
          s.classList.toggle("hit", f === "c");
          top += n;
        });
      }
      clear() { this.el.querySelectorAll(".seg").forEach((s) => s.remove()); this.segs = []; }
      growLast(n, secs) {
        const last = this.segs[this.segs.length - 1];
        if (!last) return;
        last[1] = n;
        last[2].classList.add("slow");
        last[2].style.setProperty("--grow", secs + "s");
        this.place();
      }
      set(list, mode = "instant", grow = 1.8) {
        fitScale(mode === "append" ? [...this.segs, ...list.slice(this.segs.length)] : list);
        if (mode === "append") {
          const before = total(this.segs);
          list.slice(this.segs.length).forEach(([k, n, f]) => {
            const s = this.make(k);
            s.classList.add("slow");
            s.style.setProperty("--grow", grow + "s");
            s.style.top = at(before);
            s.style.height = "0%";
            this.segs.push([k, n, s, f]);
          });
        } else {
          this.clear();
          this.segs = list.map(([k, n, f]) => [k, n, this.make(k), f]);
          if (mode === "fill") {
            let top = 0;
            this.segs.forEach(([, n, s], i) => {
              s.style.top = at(top);
              s.style.height = "0%";
              s.style.setProperty("--d", i * 0.18 + "s");
              top += n;
            });
          }
        }
        void this.el.offsetHeight;
        this.place();
      }
      markHits(count) { this.segs.forEach((e, i) => { if (i < count) e[3] = "c"; }); this.place(); }
      dropAfter(count) {
        const gone = this.segs.slice(count);
        gone.forEach(([, , s]) => s.classList.add("leave"));
        this.segs = this.segs.slice(0, count);
        T.at(650, () => gone.forEach(([, , s]) => s.remove()));
      }
      wipe() {
        const old = this.segs;
        old.forEach(([, , s], i) => { s.style.setProperty("--d", (old.length - 1 - i) * 0.08 + "s"); s.classList.add("leave"); });
        this.segs = [];
        T.at(700, () => old.forEach(([, , s]) => s.remove()));
      }
    }
    const win = new Column($("cw"));
    const usedEl = $("used"), wu = $("wu"), overZone = $("over-zone");
    function winInfo(list, dur) {
      const n = total(list);
      Deck.tween(usedEl, n, { duration: dur });
      const over = n > LIMIT;
      win.el.classList.toggle("over", over);
      wu.classList.toggle("over", over);
      overZone.style.height = over ? wp(n - LIMIT) + 1 + "%" : "0";
    }
    function setWin(list, mode, grow) { win.set(list, mode, grow); winInfo(list, mode === "instant" ? 0 : 900); }
    function wipeWin() { win.wipe(); winInfo([], 600); }

    /* ---------- the neural network ---------- */
    const net = $("net"), svg = $("net-svg");
    const LX = [70, 138, 206, 274], NY = [30, 62, 94, 126, 158];
    (function buildNet() {
      let h = "";
      NY.forEach((y) => (h += `<line class="e e0" x1="4" y1="94" x2="${LX[0]}" y2="${y}"/>`));
      for (let l = 1; l < 4; l++)
        NY.forEach((a) => NY.forEach((b) => (h += `<line class="e e${l}" x1="${LX[l - 1]}" y1="${a}" x2="${LX[l]}" y2="${b}"/>`)));
      NY.forEach((y) => (h += `<line class="e e4" x1="${LX[3]}" y1="${y}" x2="326" y2="94"/>`));
      h += `<path class="loop" id="loop" d="M 326 106 C 326 214, 4 214, 4 106"/>`;
      h += `<text class="loop-lab" x="165" y="199">each new token goes back in</text>`;
      for (let i = 0; i < 6; i++) h += `<rect class="ft" x="0" y="89" width="10" height="10" rx="2" style="animation-delay:${i * 0.13}s"/>`;
      LX.forEach((x, l) => {
        h += `<text class="lt lt${l}" x="${x}" y="12">Layer ${l + 1}</text>`;
        NY.forEach((y) => (h += `<circle class="n n${l}" cx="${x}" cy="${y}" r="9"/>`));
      });
      svg.innerHTML = h;
    })();
    const loop = svg.querySelector("#loop");
    const feedRects = [...svg.querySelectorAll(".ft")];
    const setFeed = (kinds) => feedRects.forEach((r, i) => (r.style.fill = KIND[kinds[i % kinds.length]].color));
    const layerHot = (l, on) => svg.querySelectorAll(`.n${l}, .e${l}`).forEach((el) => el.classList.toggle("hot", on));
    const outHot = (on) => svg.querySelectorAll(".e4").forEach((el) => el.classList.toggle("hot", on));
    function coolNet() {
      svg.querySelectorAll(".hot").forEach((el) => el.classList.remove("hot"));
      net.classList.remove("writing", "busy", "feeding");
      loop.classList.remove("hot");
    }

    /* ---------- working values tray ---------- */
    const tray = $("tray"), rows = [...tray.querySelectorAll(".tsegs")], legend = $("tray-legend");
    function trayRender(list, filled, { animateCached = false, saved = false } = {}) {
      tray.classList.add("instant");
      rows.forEach((row, r) => {
        row.innerHTML = "";
        list.forEach(([k, n, f]) => {
          const s = document.createElement("div");
          let cls = "tseg " + k + (f === "w" ? " w" : "");
          if (f === "c") cls += " cached on" + (animateCached ? " fromcache" : "");
          else if (r < filled) cls += " on";
          if (f === "w" && saved && r < filled) cls += " cached";
          s.className = cls;
          s.style.width = (n ? Math.max(1.4, (n / TRAY) * 100) : 0) + "%";
          row.appendChild(s);
        });
      });
      void tray.offsetWidth;
      tray.classList.remove("instant");
      legend.innerHTML = list.map(([k, n]) =>
        `<span><i style="background:${KIND[k].color}"></i>${KIND[k].name} <b data-k="${k}">${fmt(n)}</b></span>`).join("");
    }
    function trayFillRow(r) {
      [...rows[r].children].filter((s) => !s.classList.contains("cached")).forEach((s, i) => {
        s.style.setProperty("--d", i * 0.12 + "s");
        s.classList.add("on");
      });
    }
    function trayAnswer(n, ms) {
      tray.style.setProperty("--wdur", ms + "ms");
      rows.forEach((row) => { const s = row.querySelector(".response"); if (s) s.style.width = Math.max(1.4, (n / TRAY) * 100) + "%"; });
      const b = legend.querySelector('[data-k="response"]');
      if (b) Deck.tween(b, n, { duration: ms });
    }
    const trayClear = () => { rows.forEach((r) => (r.innerHTML = "")); legend.innerHTML = ""; };
    function trayWipe() { tray.querySelectorAll(".tseg").forEach((s) => s.classList.add("leave")); T.at(600, trayClear); }
    // drop the values of everything after the first `count` rows (CAG's reset)
    function trayTruncate(count) {
      rows.forEach((row) => [...row.children].slice(count).forEach((s) => s.classList.add("leave")));
      T.at(600, () => rows.forEach((row) => [...row.children].slice(count).forEach((s) => s.remove())));
      [...legend.children].slice(count).forEach((s) => s.remove());
    }

    /* ---------- the prompt cache ---------- */
    const cacheBox = $("cache"), cacheBar = $("cache-bar"), cacheNote = $("cache-note"), ttlEl = $("ttl"), flagEl = $("cache-flag");
    let cacheList = [];
    function cacheSet(list, animate) {
      cacheList = list;
      cacheBar.innerHTML = list.map(([k, n], i) =>
        `<div class="cseg ${k}${animate ? "" : " instant on"}" style="width:${Math.max(1.4, (n / TRAY) * 100)}%;--d:${i * 0.15}s"></div>`).join("");
      if (animate) requestAnimationFrame(() => requestAnimationFrame(() => cacheBar.querySelectorAll(".cseg").forEach((s) => s.classList.add("on"))));
      cacheBox.classList.toggle("has", list.length > 0);
      cacheNote.textContent = list.length ? `first ${fmt(total(list))} tokens` : "empty";
    }
    function cacheExpire(note = "expired") {
      cacheBar.querySelectorAll(".cseg").forEach((s) => s.classList.add("leave"));
      cacheNote.textContent = note;
      cacheBox.classList.remove("has");
      cacheList = [];
      T.at(600, () => (cacheBar.innerHTML = ""));
    }
    function cacheFlash(cls) { cacheBox.classList.remove("hit", "miss"); void cacheBox.offsetWidth; cacheBox.classList.add(cls); }
    const FLAG = { hit: "Hit", miss: "No match", write: "Written" };
    function setFlag(f) { flagEl.className = "cache-flag" + (f ? " on " + f : ""); flagEl.textContent = f ? FLAG[f] : ""; }
    function setTTL(text, low) { ttlEl.textContent = text || ""; ttlEl.classList.toggle("low", !!low); }

    /* ---------- counters, status, output ---------- */
    const cNet = $("c-net"), cCache = $("c-cache"), cBill = $("c-bill"), cBase = $("c-base");
    const outTok = $("out-tok"), outbox = $("outbox"), statusEl = $("status");
    function counters([n1, n2, bill, base], dur = 0) {
      Deck.tween(cNet, n1, { duration: dur });
      Deck.tween(cCache, n2, { duration: dur });
      Deck.tween(cBill, bill, { duration: dur });
      cBase.textContent = base ? ` instead of ${fmt(base)}` : "";
    }
    function setOut(text, live) {
      outTok.textContent = text || "";
      outbox.classList.toggle("live", !!live);
      if (text) { outTok.classList.remove("pop"); void outTok.offsetWidth; outTok.classList.add("pop"); }
    }
    function setStatus([cls, text]) { statusEl.className = "status " + cls; statusEl.querySelector("span").textContent = text; }

    /* ---------- packets ---------- */
    const packet = $("packet"), stream = $("stream"), solo = $("solo");
    function packetHTML(req, title = "Request") {
      let h = `<div class="ph">${title}<span>to the model</span></div>`;
      req.rows.forEach(([k, n], i) => {
        h += `<div class="row${k === "date" ? " d" : ""}"><i style="background:${KIND[k].color}"></i>${KIND[k].name}<b>${fmt(n)}</b></div>`;
        if (req.mark && i === req.mark - 1) h += `<div class="mk">cache marker</div>`;
      });
      return h + `<div class="tot"><span>Total</span><span>${fmt(total(req.rows))} tokens</span></div>`;
    }
    function setPacket(spec, instant) {
      packet.classList.toggle("instant", !!instant);
      if (!spec) packet.classList.remove("on");
      else {
        packet.innerHTML = packetHTML(spec.req, spec.title);
        packet.classList.add("on");
        packet.classList.toggle("at-server", spec.at === "server");
      }
      if (instant) { void packet.offsetWidth; packet.classList.remove("instant"); }
    }
    function sendRequest(req, startAt, then, { fromClient = false, title } = {}) {
      if (!fromClient) {
        T.at(startAt, () => { setPacket({ req, title, at: "client" }, true); packet.classList.remove("on"); });
        T.at(startAt + 30, () => packet.classList.add("on"));
      }
      T.at(startAt + 750, () => { setPacket({ req, title, at: "server" }); setStatus(["idle", "Receiving the request"]); });
      T.at(startAt + 2000, () => { setPacket(null); then(); });
    }
    function soloBack() { solo.classList.remove("go"); void solo.offsetWidth; solo.classList.add("go"); }

    /* ---------- chat ---------- */
    const chat = $("chat"), typed = $("typed"), send = $("send");
    const msgs = [...chat.querySelectorAll(".msg")];
    msgs.forEach((m) => { if (!m.children.length) m._full = m.textContent; });
    const bubble = (id) => chat.querySelector(`[data-id="${id}"]`);
    const textOf = (id) => bubble(id)._full;
    function showChat(step) {
      msgs.forEach((m) => {
        const from = Number(m.dataset.from);
        const early = m.dataset.early ? Number(m.dataset.early) : from;
        m.hidden = step < early;
        m.classList.remove("enter");
        if (m._full) m.textContent = step < from ? m.dataset.first : m._full;
      });
    }
    function hideNew(step) {
      msgs.forEach((m) => {
        const early = m.dataset.early ? Number(m.dataset.early) : null;
        if (Number(m.dataset.from) === step) {
          if (early !== null && early < step) m.textContent = m.dataset.first;
          else m.hidden = true;
        }
        if (early === step) m.hidden = true;
      });
    }
    function revealFirst(m) {
      m.hidden = false;
      m.textContent = m.dataset.first;
      m.classList.remove("enter"); void m.offsetWidth; m.classList.add("enter");
    }
    function reveal(m, typeMs) {
      if (!m) return;
      const already = !m.hidden && m._full && m._full.startsWith(m.textContent) ? m.textContent.length : 0;
      m.hidden = false;
      if (!already) { m.classList.remove("enter"); void m.offsetWidth; m.classList.add("enter"); }
      if (typeMs && m._full) {
        const full = m._full;
        if (!already) m.textContent = "";
        const per = typeMs / Math.max(1, full.length - already);
        for (let i = already + 1; i <= full.length; i++) T.at((i - already) * per, () => { m.textContent = full.slice(0, i); });
      }
    }
    function typeInput(text, startAt, per = 36) {
      T.at(startAt, () => { typed.textContent = ""; typed.classList.add("typing"); });
      for (let i = 1; i <= text.length; i++) T.at(startAt + i * per, () => { typed.textContent = text.slice(0, i); });
      const end = startAt + text.length * per + 300;
      T.at(end, () => { typed.classList.remove("typing"); typed.textContent = ""; send.classList.add("press"); });
      T.at(end + 160, () => send.classList.remove("press"));
      return end;
    }

    /* ---------- reading: with or without the cache ----------
       opts: cached (rows served from the cache), write (rows written to it),
             firstToken, bubble, n: [network, cache, billed, base], statusEnd */
    function runReading(req, { cached = 0, write = 0, firstToken, bubble: bub, n, layerMs = 700, start = 0, statusEnd, flagMiss = true }) {
      const list = tag(req, cached, write);
      const fresh = req.rows.slice(cached);
      const nNew = total(fresh), nCached = total(req.rows.slice(0, cached));
      T.at(start, () => {
        trayRender(list, 0, { animateCached: true });
        coolNet();
        setFeed(fresh.map((r) => r[0]));
        net.classList.add("feeding");
        setOut("", false);
        if (cached) {
          cacheFlash("hit");
          setFlag("hit");
          win.markHits(cached);
          setStatus(["reading", `Cache hit: ${fmt(nCached)} tokens skipped. Reading ${fmt(nNew)} new.`]);
        } else {
          if (cacheList.length && flagMiss) { cacheFlash("miss"); setFlag("miss"); }
          setStatus(["reading", `Reading all ${fmt(nNew)} tokens, layer by layer`]);
        }
        Deck.tween(cNet, nNew, { duration: layerMs * 4 });
        Deck.tween(cCache, nCached, { duration: 500 });
        Deck.tween(cBill, 0, { duration: 0 });
        cBase.textContent = "";
      });
      for (let l = 0; l < 4; l++) {
        T.at(start + 250 + l * layerMs, () => {
          if (l > 0) layerHot(l - 1, false);
          layerHot(l, true);
          trayFillRow(l);
        });
      }
      const tEnd = start + 250 + 4 * layerMs;
      T.at(tEnd, () => {
        net.classList.remove("feeding");
        layerHot(3, false);
        if (firstToken) { outHot(true); setOut(firstToken, true); }
        if (write) {
          cacheSet(req.rows.slice(0, write), true);
          cacheFlash("hit");
          setFlag("write");
          setTTL("kept for 5:00");
          tray.querySelectorAll(".tseg.w").forEach((s) => s.classList.add("cached"));
        } else if (cached) {
          setTTL("kept for 5:00");
        }
        if (n) { Deck.tween(cBill, n[2], { duration: 700 }); cBase.textContent = n[3] ? ` instead of ${fmt(n[3])}` : ""; }
      });
      if (!firstToken) {
        T.at(tEnd + 300, () => statusEnd && setStatus(statusEnd));
        return tEnd + 300;
      }
      T.at(tEnd + 600, () => {
        outHot(false);
        const lst = withFirst(list);
        win.set(lst, "append", 0.4);
        winInfo(lst, 300);
        soloBack();
      });
      T.at(tEnd + 1550, () => { if (bub) revealFirst(bub); });
      T.at(tEnd + 1800, () => statusEnd && setStatus(statusEnd));
      return tEnd + 1800;
    }

    /* ---------- writing the answer ---------- */
    function writePass(t, tokenText, perLayer = 90) {
      T.at(t, () => { net.classList.add("writing"); loop.classList.add("hot"); });
      for (let l = 0; l < 4; l++) {
        T.at(t + 150 + l * perLayer, () => {
          if (l > 0) { layerHot(l - 1, false); rows[l - 1].classList.remove("read"); }
          layerHot(l, true);
          rows[l].classList.add("read");
        });
      }
      T.at(t + 150 + 4 * perLayer, () => {
        layerHot(3, false);
        rows[3].classList.remove("read");
        loop.classList.remove("hot");
        outHot(true);
        setOut(tokenText, true);
      });
      T.at(t + 260 + 4 * perLayer, () => outHot(false));
    }
    function runWriting(list, { slow, rest, fastMs, bubble: bub, start = 0, answer = 190 }) {
      T.at(start, () => {
        trayRender([...list, ["response", 0, ""]], 4, { saved: true });
        setStatus(["writing", "Writing the answer, one token at a time"]);
        win.growLast(answer, (slow.length * 560 + fastMs + 300) / 1000);
        winInfo([...list, ["response", answer]], slow.length * 560 + fastMs);
        stream.classList.add("on");
      });
      T.at(start + 150, () => reveal(bub, slow.length * 560 + fastMs + 200));
      let t = start + 100;
      slow.forEach((w, i) => {
        writePass(t, w);
        T.at(t + 520, () => trayAnswer(i + 2, 380));
        t += 560;
      });
      T.at(t, () => {
        net.classList.add("writing", "busy");
        loop.classList.add("hot");
        trayAnswer(answer, fastMs);
        rest.forEach((w, i) => T.at((fastMs / rest.length) * i, () => setOut(w, true)));
      });
      T.at(t + fastMs, () => {
        coolNet();
        stream.classList.remove("on");
        setOut("", false);
        setStatus(["idle", `Answer finished: ${answer} tokens`]);
      });
      return t + fastMs;
    }
    function finishAnswer(bub, ms = 900, answer = 190) {
      reveal(bub, ms);
      win.growLast(answer, ms / 1000);
      stream.classList.add("on");
      T.at(ms, () => stream.classList.remove("on"));
    }
    function forget(ttlText) {
      wipeWin();
      trayWipe();
      coolNet();
      setOut("", false);
      setFlag(null);
      if (ttlText) setTTL(ttlText);
    }

    /* ---------- the end state of a step ---------- */
    function settle(s, step) {
      showChat(step);
      typed.textContent = "";
      typed.classList.remove("typing");
      setWin(s.win || [], "instant");
      coolNet();
      rows.forEach((r) => r.classList.remove("read"));
      if (s.tray) trayRender(s.tray, 4, { saved: true }); else trayClear();
      cacheSet(s.cache || [], false);
      if (s.cacheNote) cacheNote.textContent = s.cacheNote;
      cacheBox.classList.remove("hit", "miss");
      setFlag(s.flag || null);
      setTTL(s.ttl || "");
      setOut(s.out || "", !!s.out);
      counters(s.n || [0, 0, 0, 0]);
      setStatus(s.status || ["idle", "Waiting"]);
      setPacket(s.packet || null, true);
      stream.classList.remove("on");
    }

    return {
      LIMIT, TRAY, KIND, fmt, total, tag, withFirst,
      win, setWin, wipeWin, winInfo,
      net, coolNet, setFeed, layerHot, outHot,
      tray, trayRender, trayFillRow, trayAnswer, trayClear, trayWipe, trayTruncate,
      cacheBox, cacheSet, cacheExpire, cacheFlash, setFlag, setTTL,
      counters, setOut, setStatus,
      packet, setPacket, sendRequest, stream, soloBack,
      chat, bubble, textOf, showChat, hideNew, revealFirst, reveal, typeInput,
      runReading, runWriting, finishAnswer, forget, settle,
    };
  };
})();
