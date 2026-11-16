"""Step 5: RETRIEVE. Embed the question and find the nearest chunks in the vector database.

Run:  python 5_retrieve.py "Can I roll over unused vacation days?"
"""

import sys

from common import CHROMA, TOP_K, need, retrieve

need(CHROMA, "4_store.py")
question = sys.argv[1] if len(sys.argv) > 1 else "Can I roll over unused vacation days?"

print(f"Question: {question}\nTop {TOP_K} chunks by meaning:\n")
for rank, (score, meta, text) in enumerate(retrieve(question), 1):
    print(f"#{rank}  similarity {score:.2f}   [{meta['section']}]")
    print("    " + text.replace("\n", "\n    ") + "\n")
