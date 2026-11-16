"""KAG hello world: Knowledge-Augmented Generation (graph-based retrieval).

Idea: store the knowledge as a graph of facts (subject -> relation -> object).
Find the entities named in the question, then FOLLOW the links hop by hop to
collect connected facts that no single document states together.

Real KAG (for example OpenSPG KAG) also has the LLM build the graph from documents
and plan the hops as a logical form. Here the graph is written by hand in
data/graph.csv and the walk is a plain breadth-first search, so the core idea stays visible.

Run:  python 3_kag.py
      python 3_kag.py "Who approves Lina's leave carry-over?"
"""

import csv
import sys
from collections import deque
from pathlib import Path

from llm import ask

sys.stdout.reconfigure(encoding="utf-8")
MAX_HOPS = 2

# 1. BUILD THE GRAPH: every row of graph.csv is an edge we can walk in both directions.
with open(Path(__file__).parent / "data" / "graph.csv", encoding="utf-8") as f:
    triples = [(row["subject"], row["relation"], row["object"]) for row in csv.DictReader(f)]
print(f"Loaded {len(triples)} facts from data/graph.csv")

graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((s, r, o))
    graph.setdefault(o, []).append((s, r, o))

# 2. LINK THE QUESTION TO THE GRAPH: find entities the question mentions
#    (a first name or a key word is enough, e.g. "Omar" or "carry-over").
question = sys.argv[1] if len(sys.argv) > 1 else "Who approves Omar's leave carry-over?"
q = question.lower()
start = [node for node in graph
         if any(len(word) > 3 and word in q for word in node.lower().split())]
print("Entities found in the question:", start)

# 3. TRAVERSE: walk outward from those entities, up to MAX_HOPS links away.
facts, seen, queue = [], set(start), deque((node, 0) for node in start)
while queue:
    node, hops = queue.popleft()
    if hops == MAX_HOPS:
        continue
    for s, r, o in graph[node]:
        if (s, r, o) not in facts:
            facts.append((s, r, o))
            print(f"  hop {hops + 1}: {s} --{r}--> {o}")
        for nxt in (s, o):
            if nxt not in seen:
                seen.add(nxt)
                queue.append((nxt, hops + 1))

# 4. AUGMENT + GENERATE: give the model the connected facts and ask it to reason over them.
context = "\n".join(f"- {s} | {r} | {o}" for s, r, o in facts)
system = ("Answer using only these facts from the company knowledge graph. "
          "Chain the facts together and show the path you followed.\n\nFacts:\n" + context)
ask(system, question)
