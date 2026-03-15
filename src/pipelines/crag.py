"""
CRAG (Corrective RAG): assess retrieval confidence; use or correct retrieval based on it, then generate.
Do not remove or rename this file.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from src.generation import generate_answer
from src.retrieval import retrieve


def _format_context(chunks: List[Dict[str, Any]]) -> str:
    return "\n\n".join(f"[{i+1}] {c.get('text', '')}" for i, c in enumerate(chunks))


def _attach_citations(answer: str, chunks: List[Dict[str, Any]]) -> str:
    """Attach IEEE-style references to the answer.

    Format (IEEE):
        [n] "Snippet text." CRAG Web Search Corpus, entry <rank>. Similarity: <score>.
    """
    if not chunks:
        return (
            f"{answer}\n\n"
            "References:\n"
            "[1] Retrieval confidence judged insufficient; answer is based on model "
            "internal knowledge and may not be factually verified."
        )

    # Inline-cite in the answer body if the LLM did not already include markers.
    inline_markers = " ".join(f"[{i+1}]" for i in range(len(chunks)))
    if "[1]" not in answer:
        answer = f"{answer} {inline_markers}"

    refs: List[str] = []
    for i, c in enumerate(chunks):
        text = c.get("text", "").strip()
        # Truncate to ≤200 chars; add ellipsis if cut.
        if len(text) > 200:
            text = text[:197] + "..."
        score = c.get("score", 0.0)
        rank = c.get("rank", i + 1)
        refs.append(
            f"[{i+1}] \"{text}\" "
            f"CRAG Web Search Corpus, entry {rank}. "
            f"Similarity score: {score:.4f}."
        )

    return f"{answer}\n\nReferences:\n" + "\n".join(refs)


def run(query: str, retrieval_service, top_k: int, generator) -> Tuple[List[Dict[str, Any]], str]:
    retrieved = retrieve(retrieval_service, query, top_k=top_k)
    verdict = generator.judge_retrieval(query, retrieved)

    if verdict == "CORRECT":
        chosen = retrieved
        base_answer = generate_answer(query, _format_context(chosen), generator)
    else:
        chosen = []
        base_answer = (
            "Retrieved context was insufficient or ambiguous. "
            "Providing a cautious answer from internal knowledge. "
            + generate_answer(query, "", generator)
        )

    final_answer = _attach_citations(base_answer, chosen)
    if retrieved:
        retrieved[0]["confidence"] = 1.0 if verdict == "CORRECT" else (0.5 if verdict == "AMBIGUOUS" else 0.0)
    return retrieved, final_answer
