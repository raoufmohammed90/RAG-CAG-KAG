# RAG vs CAG vs KAG: live demos

All three demos answer questions about one fictional company, Acme, from the same
files in [data/](data/). The only thing that changes is **how the knowledge reaches the model**.

```
demos/
  data/                    the knowledge (source files, deliberately messy)
    leave-policy.html        intranet page export: menus, cookie banner, footer
    it-handbook.txt          PDF-to-text export: page headers, words broken across lines
    expenses-policy.md       wiki page: edit stamp, extra spaces, a duplicate line
    team-directory.md        people, teams and line managers
    office-guide.md          clean Markdown
    graph.csv                the same facts as a knowledge graph (KAG only)
  notebooks/               ★ use these on stage
    1_cag.ipynb
    2_rag.ipynb              builds the pipeline step by step; writes to notebooks/rag_output/
    3_kag.ipynb
  1_cag.py, 2_rag/, 3_kag.py   the same demos as plain scripts (backup if Jupyter misbehaves)
  llm.py                   shared helper that calls Claude
```

## Before the session (once)

1. Install: `pip install -r requirements.txt`
2. API key: set it as a user environment variable, then **restart VS Code** so notebooks see it:
   `setx ANTHROPIC_API_KEY "sk-ant-..."`
   Without a key, everything still runs and prints the prompt instead of the answer.
3. Open each notebook in VS Code, pick the **Python 3.14** kernel (top right), and
   **Run All** once. That downloads the embedding model (~65 MB) so it works offline later.
   Then **Clear All Outputs** so the audience sees the results appear live.

On stage, run one cell at a time (Shift+Enter) and talk over each output.

---

## 1. CAG — `notebooks/1_cag.ipynb`

All 5 files go, as they are, into one prompt marked for caching. Three questions follow.

- No pipeline at all: no cleaning, chunking or search.
- The `Tokens:` line under each answer: `cache_write` on question 1, `cache_read` after.
- It answers "Who approves Omar's leave carry-over?" because every fact is in the prompt.
  The catch: only while the knowledge fits.

## 2. RAG — `notebooks/2_rag.ipynb`

| Section | What the audience sees |
|---|---|
| 0. Raw data | The messy HTML and PDF-text files as they really are |
| 1. Clean | A before/after table, then the clean text: menus, banners, footers and page headers are gone, "re-/turned" is one word |
| 2. Chunk | A table of 19 chunks with id, section, size and text. Change `MAX_CHARS` / `OVERLAP` live |
| 3. Embed | A chunk becomes 384 numbers. "roll over vacation" vs "leave carried over" = 0.72, vs "passwords" = 0.49. A **map** of all chunks placed by meaning |
| 4. Store | Chroma vector database: one row with id, metadata, text and vector |
| 5. Retrieve | Top 3 chunks with similarity scores, and the map with the question as a star and lines to the chunks it picked |
| 6. Generate | The chunks pasted into the prompt, and Claude's answer |
| 7. Where RAG struggles | "Who approves Omar's leave carry-over?": it finds the rule and Omar's team, but `mentions Sara? False` |

## 3. KAG — `notebooks/3_kag.ipynb`

- The graph as a table (from `data/graph.csv`), then drawn as a diagram.
- The question is linked to its entities (Omar Khalid, Leave carry-over), and a 2-hop walk
  lights up the facts it reaches. The walk from Omar and the walk from the carry-over rule
  **meet at Sara Ahmed**.
- Claude gets those facts and answers with the path. Then the same for Lina.

---

## The story across the three

| Question: "Who approves Omar's leave carry-over?" | Result |
|---|---|
| CAG | ✅ Everything is in the prompt (only while it fits) |
| RAG | ⚠️ Finds the rule and Omar's team, misses Sara: "his line manager" |
| KAG | ✅ Follows Omar → Sales team → Sara Ahmed, and shows the path |

## Simplifications to say out loud

- Embedding model: `BAAI/bge-small-en-v1.5`, running locally. Production often uses a hosted embedding API.
- Vector database: Chroma, local. Production might use pgvector, Qdrant, Pinecone and so on.
- KAG: the graph is written by hand. Real KAG (OpenSPG) has an LLM extract it from the
  documents and plan the hops.
- Model: `claude-haiku-5-5` (the smallest, cheapest current model) with medium effort. Both are set
  at the top of [llm.py](llm.py) (`MODEL` and `EFFORT`) and used by every demo.

## Backup: the same demos as scripts

```powershell
cd demos
python 1_cag.py
cd 2_rag; python 0_reset.py; python 1_clean.py; python 2_chunk.py; python 3_embed.py; python 4_store.py
python 5_retrieve.py "Can I roll over unused vacation days?"; python 6_ask.py; cd ..
python 3_kag.py
```
