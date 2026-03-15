"""Retrieval bridge for FAISS + snippet mapping created in Phase 1."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


class RetrievalService:
    def __init__(
        self,
        index_path: str,
        mapping_path: str,
        model_name: str = "all-MiniLM-L6-v2",
    ):
        if not Path(index_path).exists():
            raise FileNotFoundError(f"Index file not found: {index_path}")
        if not Path(mapping_path).exists():
            raise FileNotFoundError(f"Mapping file not found: {mapping_path}")

        self.index = faiss.read_index(index_path)

        import pickle

        with open(mapping_path, "rb") as f:
            mapping = pickle.load(f)
        if not isinstance(mapping, list):
            raise ValueError("Mapping payload is invalid; expected a list of snippets.")
        self.mapping: List[str] = mapping
        self.embedder = SentenceTransformer(model_name)

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        query_emb = self.embedder.encode([query], convert_to_numpy=True).astype("float32")
        distances, indices = self.index.search(query_emb, k=max(1, int(top_k)))

        out: List[Dict[str, Any]] = []
        for rank, (dist, idx) in enumerate(zip(distances[0], indices[0]), start=1):
            if idx < 0 or idx >= len(self.mapping):
                continue
            score = 1.0 / (1.0 + float(dist))
            out.append(
                {
                    "text": self.mapping[idx],
                    "score": float(score),
                    "rank": rank,
                    "idx": int(idx),
                }
            )
        return out


def retrieve(service: RetrievalService, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    return service.retrieve(query=query, top_k=top_k)


def retrieve_by_embedding(
    service: RetrievalService,
    embedding: np.ndarray,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    emb = np.asarray(embedding, dtype="float32")
    if emb.ndim == 1:
        emb = emb.reshape(1, -1)
    distances, indices = service.index.search(emb, k=max(1, int(top_k)))

    out: List[Dict[str, Any]] = []
    for rank, (dist, idx) in enumerate(zip(distances[0], indices[0]), start=1):
        if idx < 0 or idx >= len(service.mapping):
            continue
        score = 1.0 / (1.0 + float(dist))
        out.append(
            {
                "text": service.mapping[idx],
                "score": float(score),
                "rank": rank,
                "idx": int(idx),
            }
        )
    return out
