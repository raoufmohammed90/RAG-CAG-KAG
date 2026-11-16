/* ==========================================================================
   RAG, CAG and KAG: the session (one list of topics for every page)
   --------------------------------------------------------------------------
   SessionNav.ACTS      the parts of the session and their topics
   SessionNav.render(ol, { current, onEnter, onLeave, onOpen })
                        draws the top-bar timeline into an <ol>: one button per
                        part, a menu of topics under each (opens on hover,
                        keyboard focus or click). `current` is a topic number
                        such as "01"; its part and topic are marked.
   SessionNav.ready()   { "01": "01-context-window.html", ... }

   A topic with `href` is ready; the rest show as "In preparation".
   Styles live in deck.css under "session timeline".
   ========================================================================== */

(function () {
  "use strict";

  const ACTS = [
    {
      name: "Foundations", c: "var(--accent)",
      q: "How does a model see a request, process it, and what does that cost?",
      topics: [
        { n: "01", t: "The context window", d: "What the model sees, how it processes each request, and why it forgets", href: "01-context-window.html", steps: 16 },
        { n: "02", t: "Prompt caching", d: "Keeping the working values of a repeated beginning, and what that saves", href: "02-prompt-caching.html", steps: 13 },
      ],
    },
    {
      name: "CAG", full: "Cache-augmented generation", c: "var(--p-cag)", p: "cag",
      tag: "Load once, keep it",
      q: "What if all your knowledge fits in the window?",
      topics: [
        { n: "03", t: "Cache-augmented generation", d: "Load the knowledge once, cache it, and reuse it on every request", href: "03-cag.html", steps: 11 },
        { n: "04", t: "Where CAG stops working", d: "Too big for the window, changes too often, or details lost in the middle", to: ["RAG", "var(--p-rag)"], href: "04-cag-limits.html", steps: 8 },
      ],
    },
    {
      name: "RAG", full: "Retrieval-augmented generation", c: "var(--p-rag)", p: "rag",
      tag: "Search, pick, bring",
      q: "What if the knowledge doesn't fit, or keeps changing?",
      topics: [
        { n: "05", t: "Building a RAG system", d: "Files are chunked, embedded and stored with their text in a vector database", href: "05-rag-build.html", steps: 8 },
        { n: "06", t: "Retrieval-augmented generation", d: "Embed the question, find the top K chunks, and answer from their text", href: "06-rag.html", steps: 10 },
        { n: "07", t: "Where RAG stops working", d: "Retrieval problems and their fixes, then the limits that need a different approach", to: ["KAG and GraphRAG", "var(--p-kag)"], href: "07-rag-limits.html", steps: 16 },
      ],
    },
    {
      name: "KAG and GraphRAG", full: "Knowledge-augmented generation", c: "var(--p-kag)", p: "kag",
      tag: "Follow the connections",
      q: "What if the answer depends on how facts relate to each other?",
      topics: [
        { n: "08", t: "KAG", d: "Build a graph of facts with an LLM, then answer by following its edges", href: "08-kag.html", steps: 13 },
        { n: "09", t: "GraphRAG", d: "Group the graph into communities, summarise each, and answer from the summaries", href: "09-graphrag.html", steps: 13 },
        { n: "10", t: "KAG vs GraphRAG", d: "Same start, different goals: one precise path, or the big picture", href: "10-kag-vs-graphrag.html", steps: 6 },
        { n: "11", t: "Where graphs stop working", d: "Build cost, schemas, extraction errors, upkeep and slower answers", href: "11-graph-limits.html", steps: 8 },
      ],
    },
    {
      name: "Choosing", c: "var(--c-response)",
      q: "Which one, when, and in what combination?",
      topics: [
        { n: "12", t: "Comparison and decision guide", d: "The three patterns side by side, a decision flow, and how they combine", href: "12-compare.html", steps: 9 },
      ],
    },
  ];

  const range = (a) => (a.topics.length > 1 ? `${a.topics[0].n}–${a.topics[a.topics.length - 1].n}` : a.topics[0].n);

  function ready() {
    const out = {};
    ACTS.forEach((a) => a.topics.forEach((t) => { if (t.href) out[t.n] = t.href; }));
    return out;
  }

  function render(ol, { current = null, onEnter = null, onLeave = null, onOpen = null } = {}) {
    ACTS.forEach((act, i) => {
      if (i > 0) {
        const link = document.createElement("li");
        link.className = "link";
        link.setAttribute("aria-hidden", "true");
        link.style.setProperty("--from", ACTS[i - 1].c);
        link.style.setProperty("--to", act.c);
        ol.appendChild(link);
      }
      const here = act.topics.some((t) => t.n === current);
      const li = document.createElement("li");
      li.className = "tn-act" + (i === 0 ? " edge-left" : "") + (i === ACTS.length - 1 ? " edge-right" : "") + (here ? " here" : "");
      li.style.setProperty("--c", act.c);
      if (act.p) li.dataset.p = act.p;

      const topics = act.topics.map((tp) => {
        const isCurrent = tp.n === current;
        const bridge = tp.to ? `<span class="bridge" style="--b:${tp.to[1]}">Leads to ${tp.to[0]}</span>` : "";
        const state = isCurrent ? "You are here" : tp.href ? `Open, ${tp.steps} steps` : "In preparation";
        const inner = `<span class="n">${tp.n}</span><span class="t">${tp.t}<span class="d">${tp.d}</span>${bridge}</span><span class="state">${state}</span>`;
        if (isCurrent) return `<li><div class="topic current" aria-current="page">${inner}</div></li>`;
        return tp.href ? `<li><a class="topic" href="${tp.href}">${inner}</a></li>` : `<li><div class="topic todo">${inner}</div></li>`;
      }).join("");

      li.innerHTML = `
        <button type="button" class="tn-btn" aria-expanded="false"${here ? ' aria-current="step"' : ""}><i></i><b>${act.name}</b><small>${range(act)}</small></button>
        <div class="menu"><p class="menu-q">${act.q}</p><ol>${topics}</ol></div>`;
      ol.appendChild(li);
    });

    const acts = [...ol.querySelectorAll(".tn-act")];
    const close = (except) => acts.forEach((a) => {
      if (a === except) return;
      a.classList.remove("open");
      a.querySelector(".tn-btn").setAttribute("aria-expanded", "false");
    });
    acts.forEach((a) => {
      const btn = a.querySelector(".tn-btn");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = !a.classList.contains("open");
        close(a);
        a.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", String(open));
        if (open && onOpen) onOpen(a.dataset.p || null);
      });
      if (onEnter) a.addEventListener("pointerenter", () => onEnter(a.dataset.p || null));
      if (onLeave) a.addEventListener("pointerleave", () => onLeave(a.dataset.p || null));
    });
    document.addEventListener("click", () => close());
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    return { acts, close };
  }

  window.SessionNav = { ACTS, range, ready, render };
})();
