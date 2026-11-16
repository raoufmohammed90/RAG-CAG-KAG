"""CAG hello world: Cache-Augmented Generation.

Idea: the knowledge is small enough, so put ALL of it in the prompt once,
cache it, and reuse the cached copy for every question.
No cleaning, chunking, embedding or search: just load the files.

Run:  python 1_cag.py
"""

import sys
from pathlib import Path

from llm import ask

sys.stdout.reconfigure(encoding="utf-8")
DATA = Path(__file__).parent / "data"

# 1. Load every document, as it is, into the system prompt.
docs = [p for p in sorted(DATA.iterdir()) if p.suffix in (".html", ".txt", ".md")]
knowledge = "\n\n".join(f"<document name='{p.name}'>\n{p.read_text(encoding='utf-8')}</document>"
                        for p in docs)
print(f"Loaded {len(docs)} documents ({len(knowledge):,} characters) into the prompt.")
system = "Answer the employee's question using only these company documents.\n\n" + knowledge

# 2. Ask several questions. The documents stay identical, so after the first call
#    they are read from the cache: look at cache_write on call 1, cache_read after.
questions = sys.argv[1:] or [
    "Can I roll over unused vacation days?",
    "Can I expense a business-class flight to London?",
    "Who approves Omar's leave carry-over?",
]
for question in questions:
    ask(system, question, cache=True)
