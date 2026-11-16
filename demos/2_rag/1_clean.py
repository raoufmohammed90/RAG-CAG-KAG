"""Step 1: CLEAN. Turn raw files (HTML, PDF text exports, Markdown) into plain text.

Removes what would pollute the chunks: HTML tags, menus, cookie banners, footers,
page headers, words broken across lines, extra spaces and duplicate lines.
Output: output/clean/<document>.md   (open them side by side with data/)
"""

import re
from html import unescape

from common import CLEAN, DATA

# Lines that repeat on every page or carry no knowledge.
BOILERPLATE = [
    r"^CONFIDENTIAL\b",          # page header of the PDF export
    r"^IT HANDBOOK\s+Page \d+",  # page numbers
    r"^> Last edited by",        # wiki edit stamp
]


def html_to_text(raw: str, stats: dict) -> str:
    # Drop whole blocks that are page furniture, not content.
    raw, n = re.subn(r"<(head|script|style|nav|footer)\b.*?</\1>", "", raw, flags=re.S)
    raw, m = re.subn(r'<(div|p) class="(cookie-banner|meta)".*?</\1>', "", raw, flags=re.S)
    stats["page blocks"] = n + m
    stats["HTML tags"] = len(re.findall(r"<[^>]+>", raw))
    # Keep the structure: headings become Markdown headings, paragraphs become lines.
    raw = re.sub(r"<h1[^>]*>", "\n# ", raw)
    raw = re.sub(r"<h2[^>]*>", "\n## ", raw)
    raw = re.sub(r"<(p|li|br)[^>]*>", "\n", raw)
    raw = re.sub(r"<[^>]+>", "", raw)                # remove every remaining tag
    return unescape(raw).replace("\xa0", " ")        # &nbsp; &#39; ... -> real characters


def pdf_text_to_text(raw: str, stats: dict) -> str:
    raw, stats["broken words fixed"] = re.subn(r"-\n(\w)", r"\1", raw)  # "re-\nturned" -> "returned"
    out, prev_blank, first = [], True, True
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            out.append("")
        elif prev_blank and len(line) < 40 and not line.endswith("."):
            out.append(("# " if first else "## ") + line)  # a short line after a gap is a title
            first = False
        elif out and out[-1] and not out[-1].startswith("#") and not out[-1].endswith("."):
            out[-1] += " " + line  # the previous line did not finish its sentence: join
            stats["wrapped lines joined"] = stats.get("wrapped lines joined", 0) + 1
        else:
            out.append(line)
        prev_blank = not line
    return "\n".join(out)


def clean(path) -> tuple[str, dict]:
    raw = path.read_text(encoding="utf-8")
    stats = {"page headers / edit stamps": 0, "duplicate lines": 0}

    kept = []
    for line in raw.splitlines():
        if any(re.match(p, line.strip()) for p in BOILERPLATE):
            stats["page headers / edit stamps"] += 1
        else:
            kept.append(line)
    text = "\n".join(kept)

    if path.suffix == ".html":
        text = html_to_text(text, stats)
    elif path.suffix == ".txt":
        text = pdf_text_to_text(text, stats)

    lines, seen = [], set()
    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip()   # collapse spaces and tabs
        if not line:
            continue
        if line in seen:                            # copy-paste duplicates
            stats["duplicate lines"] += 1
            continue
        seen.add(line)
        lines.append(("\n" if line.startswith("#") and lines else "") + line)
    return "\n".join(lines) + "\n", stats


CLEAN.mkdir(parents=True, exist_ok=True)
for path in sorted(DATA.iterdir()):
    if path.suffix not in (".html", ".txt", ".md"):
        continue  # graph.csv belongs to the KAG demo
    text, stats = clean(path)
    target = CLEAN / (path.stem + ".md")
    target.write_text(text, encoding="utf-8")
    raw_len = path.stat().st_size
    cleaned = ", ".join(f"{n} {what}" for what, n in stats.items() if n) or "nothing, already clean"
    print(f"{path.name:20} {raw_len:5,} -> {len(text):5,} chars ({1 - len(text) / raw_len:.0%} removed)   {cleaned}")

print(f"\nClean documents are in {CLEAN}")
