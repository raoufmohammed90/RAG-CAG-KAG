# RAG vs CAG vs KAG

An animated teaching deck plus live demos for three ways to give a language model knowledge:
**CAG** (cache-augmented generation), **RAG** (retrieval-augmented generation) and **KAG / GraphRAG** (knowledge graphs).

## Deck

Open [index.html](index.html) in a browser. The slides are plain HTML, CSS and JavaScript; shared code is in [assets/](assets/).

| # | Topic |
|---|-------|
| 01 | The context window |
| 02 | Prompt caching |
| 03–04 | CAG and its limits |
| 05–07 | Building RAG, RAG and its limits |
| 08–11 | KAG, GraphRAG, how they compare, graph limits |
| 12 | Side-by-side comparison |

## Demos

[demos/](demos/) holds Jupyter notebooks and plain Python scripts that run all three approaches on the same fictional company data. See [demos/README.md](demos/README.md) for setup. You need an `ANTHROPIC_API_KEY` to get real answers; without one, the demos print the prompt instead.
