"""Paths and helpers shared by the RAG pipeline steps."""

import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE.parent / "data"          # the raw source documents
OUT = HERE / "output"                # everything the pipeline produces
CLEAN = OUT / "clean"                # step 1 output
CHUNKS = OUT / "chunks.json"         # step 2 output
EMBEDDINGS = OUT / "embeddings.json" # step 3 output
CHROMA = OUT / "chroma"              # step 4 output (the vector database)

EMBED_MODEL = "BAAI/bge-small-en-v1.5"  # small local embedding model, 384 dimensions
COLLECTION = "company_docs"
TOP_K = 3

# The model is downloaded once (~65 MB) and kept here, so the demo works offline later.
MODEL_CACHE = Path(os.environ.get("LOCALAPPDATA", tempfile.gettempdir())) / "fastembed_models"

sys.stdout.reconfigure(encoding="utf-8")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")  # keep the terminal clean on stage


def embedder():
    from fastembed import TextEmbedding
    from loguru import logger
    logger.disable("fastembed")  # hides download retry chatter; a real failure still raises
    return TextEmbedding(EMBED_MODEL, cache_dir=str(MODEL_CACHE))


def collection():
    import chromadb
    client = chromadb.PersistentClient(path=str(CHROMA))
    return client, client.get_or_create_collection(
        COLLECTION, embedding_function=None, configuration={"hnsw": {"space": "cosine"}})


def retrieve(question: str, k: int = TOP_K):
    """Embed the question with the SAME model, then ask the vector DB for the nearest chunks."""
    q_vec = next(embedder().query_embed([question])).tolist()
    _, col = collection()
    res = col.query(query_embeddings=[q_vec], n_results=k,
                    include=["documents", "metadatas", "distances"])
    return [(1 - dist, meta, doc) for doc, meta, dist
            in zip(res["documents"][0], res["metadatas"][0], res["distances"][0])]


def need(path: Path, step: str):
    if not path.exists():
        sys.exit(f"Missing {path.relative_to(HERE)}. Run {step} first.")
