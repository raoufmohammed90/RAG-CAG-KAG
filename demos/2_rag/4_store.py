"""Step 4: STORE. Save every chunk with its vector and metadata in a vector database.

Uses Chroma, an open-source vector database that runs locally and saves to disk.
Each row = id + vector + original text + metadata (source file, section).
Output: output/chroma/
"""

import json

from common import CHUNKS, COLLECTION, EMBEDDINGS, collection, need

need(EMBEDDINGS, "3_embed.py")
chunks = json.loads(CHUNKS.read_text(encoding="utf-8"))
vectors = {e["id"]: e["vector"] for e in json.loads(EMBEDDINGS.read_text(encoding="utf-8"))}

client, col = collection()
client.delete_collection(COLLECTION)  # rebuild from scratch on every run
client, col = collection()

col.add(
    ids=[c["id"] for c in chunks],
    embeddings=[vectors[c["id"]] for c in chunks],
    documents=[c["text"] for c in chunks],
    metadatas=[{"source": c["source"], "section": c["section"]} for c in chunks],
)
print(f"Vector database '{COLLECTION}' now holds {col.count()} rows.\n")

row = col.get(ids=[chunks[0]["id"]], include=["embeddings", "documents", "metadatas"])
print("One row, as stored:")
print(f"  id:       {row['ids'][0]}")
print(f"  metadata: {row['metadatas'][0]}")
print(f"  document: {row['documents'][0][:70]}...")
print(f"  vector:   [{', '.join(f'{x:.3f}' for x in row['embeddings'][0][:6])}, ... ] "
      f"({len(row['embeddings'][0])} numbers)")
