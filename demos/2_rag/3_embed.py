"""Step 3: EMBED. Turn every chunk into a vector (a list of numbers) that captures its meaning.

Uses a small open embedding model that runs locally (no API key).
Output: output/embeddings.json
"""

import json
import time

import numpy as np

from common import CHUNKS, EMBED_MODEL, EMBEDDINGS, embedder, need

need(CHUNKS, "2_chunk.py")
chunks = json.loads(CHUNKS.read_text(encoding="utf-8"))

print(f"Loading embedding model {EMBED_MODEL} ...")
model = embedder()

start = time.time()
vectors = list(model.embed([c["text"] for c in chunks]))
print(f"Embedded {len(chunks)} chunks in {time.time() - start:.1f}s. "
      f"Each vector has {len(vectors[0])} numbers.\n")

first = chunks[0]
print(f"Example: {first['id']}\n  text:   {first['text'][:70]}...\n"
      f"  vector: [{', '.join(f'{x:.3f}' for x in vectors[0][:8])}, ... ]\n")

EMBEDDINGS.write_text(json.dumps(
    [{"id": c["id"], "vector": [round(float(x), 6) for x in v]} for c, v in zip(chunks, vectors)]),
    encoding="utf-8")
print(f"Saved to {EMBEDDINGS}\n")

# Why embeddings? Similar MEANING gives close vectors, even with different words.
a, b, c = "Can I roll over unused vacation days?", \
          "Up to 5 unused leave days can be carried over into the next year.", \
          "Passwords must be at least 14 characters long."
va, vb, vc = (np.array(v) for v in model.embed([a, b, c]))
cos = lambda x, y: float(x @ y / (np.linalg.norm(x) * np.linalg.norm(y)))
print("Similarity check (1.0 = same meaning):")
print(f"  {cos(va, vb):.2f}  '{a}'  vs  '{b}'")
print(f"  {cos(va, vc):.2f}  '{a}'  vs  '{c}'")
