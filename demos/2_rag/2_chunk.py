"""Step 2: CHUNK. Split each clean document into small pieces that can be searched.

Strategy: split by section heading first (so a chunk never mixes two topics),
then pack lines into chunks of at most MAX_CHARS, repeating the last line of
the previous chunk (OVERLAP) so a fact on a boundary is not cut in half.
Output: output/chunks.json
"""

import json

from common import CHUNKS, CLEAN, need

MAX_CHARS = 300
OVERLAP = 1  # lines repeated from the previous chunk

need(CLEAN, "1_clean.py")
chunks = []
for path in sorted(CLEAN.glob("*.md")):
    title, section, lines = path.stem, "", []
    sections = []
    for line in path.read_text(encoding="utf-8").splitlines() + ["## "]:
        if line.startswith("#"):
            if lines:
                sections.append((section, lines))
            if line.startswith("# "):
                title = line[2:]
            section, lines = line.lstrip("# "), []
        elif line.strip():
            lines.append(line)

    for section, lines in sections:
        current = []
        for line in lines:
            if current and len(" ".join(current + [line])) > MAX_CHARS:
                chunks.append((path.name, title, section, current))
                current = current[-OVERLAP:]
            current.append(line)
        chunks.append((path.name, title, section, current))

records, counter = [], {}
for source, title, section, lines in chunks:
    n = counter[source] = counter.get(source, -1) + 1  # chunk number inside its document
    records.append({"id": f"{source.removesuffix('.md')}-{n}", "source": source,
                    "section": f"{title} > {section}", "text": "\n".join(lines)})
CHUNKS.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")

for r in records:
    preview = r["text"].replace("\n", " | ")
    print(f"{r['id']:20} {len(r['text']):4} chars  [{r['section']}]\n{'':20} {preview[:110]}")
print(f"\n{len(records)} chunks saved to {CHUNKS}")
