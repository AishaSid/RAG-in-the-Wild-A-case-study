"""Phase 1 corpus indexing using sentence-transformers + FAISS (CPU)."""

from __future__ import annotations

import pickle
from pathlib import Path
from typing import List, Tuple

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

from data_loader import load_crag_data


def build_index(
    dataset_path: str,
    index_save_path: str,
    mapping_save_path: str,
    batch_size: int = 32,
) -> Tuple[faiss.IndexFlatL2, List[str]]:
    """Build and persist a FAISS index plus snippet mapping."""
    all_snippets: List[str] = []
    for row in load_crag_data(dataset_path):
        all_snippets.extend(row["snippets"])

    unique_snippets = list(dict.fromkeys(all_snippets))
    if not unique_snippets:
        raise ValueError("No snippets were found in the dataset.")

    model = SentenceTransformer("all-MiniLM-L6-v2")

    embedding_batches = []
    for i in tqdm(range(0, len(unique_snippets), batch_size), desc="Encoding snippets"):
        batch = unique_snippets[i : i + batch_size]
        batch_embeddings = model.encode(batch, convert_to_numpy=True, show_progress_bar=False)
        embedding_batches.append(batch_embeddings)

    embeddings = np.vstack(embedding_batches).astype("float32")
    dim = embeddings.shape[1]

    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)

    faiss.write_index(index, index_save_path)
    with open(mapping_save_path, "wb") as f:
        pickle.dump(unique_snippets, f)

    return index, unique_snippets


def load_index(index_path: str, mapping_path: str) -> Tuple[faiss.IndexFlatL2, List[str]]:
    """Load FAISS index and text mapping from disk."""
    if not Path(index_path).exists():
        raise FileNotFoundError(f"Index file not found: {index_path}")
    if not Path(mapping_path).exists():
        raise FileNotFoundError(f"Mapping file not found: {mapping_path}")

    index = faiss.read_index(index_path)
    with open(mapping_path, "rb") as f:
        mapping = pickle.load(f)

    if not isinstance(mapping, list):
        raise ValueError("Mapping payload is invalid; expected a list of snippets.")
    return index, mapping


if __name__ == "__main__":
    _root = Path(__file__).resolve().parent.parent
    dataset_path = str(_root / "dataset" / "crag_task_1_and_2_dev_v4_subset_1.jsonl")
    index_path = str(_root / "crag_phase1.index")
    mapping_path = str(_root / "crag_phase1_mapping.pkl")

    print("Building Phase 1 index...")
    build_index(dataset_path, index_path, mapping_path)

    print("Loading index and mapping...")
    index, mapping = load_index(index_path, mapping_path)

    model = SentenceTransformer("all-MiniLM-L6-v2")
    query = "Who directed Inception?"
    query_embedding = model.encode([query], convert_to_numpy=True).astype("float32")

    distances, indices = index.search(query_embedding, k=3)

    print("\nTop 3 retrieved snippets:")
    for rank, (dist, idx) in enumerate(zip(distances[0], indices[0]), start=1):
        if idx < 0 or idx >= len(mapping):
            continue
        similarity = 1.0 / (1.0 + float(dist))
        print(f"{rank}. similarity={similarity:.6f}")
        print(f"   {mapping[idx]}\n")
