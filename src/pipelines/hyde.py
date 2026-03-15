"""
HyDE: generate hypothetical document, retrieve from global index by similarity to it, generate final answer.
Do not remove or rename this file.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from src.generation import generate_answer
from src.retrieval import retrieve


def _format_context(chunks: List[Dict[str, Any]]) -> str:
    return "\n\n".join(f"[{i+1}] {c.get('text', '')}" for i, c in enumerate(chunks))


def run(query: str, retrieval_service, top_k: int, generator) -> Tuple[str, List[Dict[str, Any]], str]:
    hypothetical = generator.generate_hypothetical_answer(query)
    retrieved = retrieve(retrieval_service, hypothetical, top_k=top_k)
    answer = generate_answer(query, _format_context(retrieved), generator)
    return hypothetical, retrieved, answer
