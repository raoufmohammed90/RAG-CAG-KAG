# RAG vs CAG vs KAG

An animated teaching deck plus live demos for three ways to give a language model knowledge:
**CAG** (cache-augmented generation), **RAG** (retrieval-augmented generation) and **KAG / GraphRAG** (knowledge graphs).

## ▶ View the deck

**[Open the deck](https://raoufmohammed90.github.io/RAG-CAG-KAG/)**, or jump to a page:

| # | Page | Source |
|---|------|--------|
| 01 | [The Context Window](https://raoufmohammed90.github.io/RAG-CAG-KAG/01-context-window.html) | [html](01-context-window.html) |
| 02 | [Prompt Caching](https://raoufmohammed90.github.io/RAG-CAG-KAG/02-prompt-caching.html) | [html](02-prompt-caching.html) |
| 03 | [Cache-Augmented Generation](https://raoufmohammed90.github.io/RAG-CAG-KAG/03-cag.html) | [html](03-cag.html) |
| 04 | [Where CAG Stops Working](https://raoufmohammed90.github.io/RAG-CAG-KAG/04-cag-limits.html) | [html](04-cag-limits.html) |
| 05 | [Building a RAG System](https://raoufmohammed90.github.io/RAG-CAG-KAG/05-rag-build.html) | [html](05-rag-build.html) |
| 06 | [Retrieval-Augmented Generation](https://raoufmohammed90.github.io/RAG-CAG-KAG/06-rag.html) | [html](06-rag.html) |
| 07 | [Where RAG Stops Working](https://raoufmohammed90.github.io/RAG-CAG-KAG/07-rag-limits.html) | [html](07-rag-limits.html) |
| 08 | [KAG](https://raoufmohammed90.github.io/RAG-CAG-KAG/08-kag.html) | [html](08-kag.html) |
| 09 | [GraphRAG](https://raoufmohammed90.github.io/RAG-CAG-KAG/09-graphrag.html) | [html](09-graphrag.html) |
| 10 | [KAG vs GraphRAG](https://raoufmohammed90.github.io/RAG-CAG-KAG/10-kag-vs-graphrag.html) | [html](10-kag-vs-graphrag.html) |
| 11 | [Where Graphs Stop Working](https://raoufmohammed90.github.io/RAG-CAG-KAG/11-graph-limits.html) | [html](11-graph-limits.html) |
| 12 | [Choosing a Pattern](https://raoufmohammed90.github.io/RAG-CAG-KAG/12-compare.html) | [html](12-compare.html) |

The pages are plain HTML, CSS and JavaScript; shared code is in [assets/](assets/). To run locally, open [index.html](index.html) in a browser.

## Demos

[demos/](demos/) holds Jupyter notebooks and plain Python scripts that run all three approaches on the same fictional company data. See [demos/README.md](demos/README.md) for setup. You need an `ANTHROPIC_API_KEY` to get real answers; without one, the demos print the prompt instead.
