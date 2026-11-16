"""Step 6: AUGMENT + GENERATE. Put the retrieved chunks in the prompt and ask Claude.

Run:  python 6_ask.py "Can I roll over unused vacation days?"
"""

import sys

from common import CHROMA, HERE, need, retrieve

sys.path.append(str(HERE.parent))
from llm import ask  # noqa: E402

need(CHROMA, "4_store.py")
question = sys.argv[1] if len(sys.argv) > 1 else "Can I roll over unused vacation days?"

hits = retrieve(question)
context = "\n\n".join(f"[{meta['section']}]\n{text}" for _, meta, text in hits)
system = ("Answer the employee's question using only the context below. "
          "If the context is not enough, say what is missing.\n\nContext:\n" + context)
ask(system, question)
