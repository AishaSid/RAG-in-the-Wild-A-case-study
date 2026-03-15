"""
Graph RAG: graph-augmented retrieval over the corpus (e.g. entity/relation graph or similarity graph), then generate.
Do not remove or rename this file.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set, Tuple

from src.generation import generate_answer
from src.retrieval import retrieve


def _keywords(text: str) -> Set[str]:
	words = re.findall(r"[a-zA-Z][a-zA-Z0-9]{3,}", text.lower())
	stop = {
		"that",
		"this",
		"with",
		"from",
		"about",
		"which",
		"have",
		"were",
		"their",
		"into",
		"also",
		"more",
		"than",
		"when",
		"where",
		"what",
	}
	return {w for w in words if w not in stop}


def _format_context(chunks: List[Dict[str, Any]]) -> str:
	return "\n\n".join(f"[{i+1}] {c.get('text', '')}" for i, c in enumerate(chunks))


def run(query: str, retrieval_service, top_k: int, generator) -> Tuple[List[Dict[str, Any]], str]:
	vector_hits = retrieve(retrieval_service, query, top_k=max(top_k, 5))
	terms = _keywords(query)

	related: List[Dict[str, Any]] = []
	if terms:
		for idx, text in enumerate(retrieval_service.mapping):
			lt = text.lower()
			matched = sum(1 for t in terms if t in lt)
			if matched > 0:
				related.append(
					{
						"text": text,
						"score": 0.15 + (0.05 * matched),
						"rank": 999,
						"idx": idx,
					}
				)
			if len(related) >= 15:
				break

	pool = vector_hits + related
	by_text: Dict[str, Dict[str, Any]] = {}
	for item in pool:
		key = item.get("text", "")
		if not key:
			continue
		if key not in by_text or float(item.get("score", 0.0)) > float(by_text[key].get("score", 0.0)):
			by_text[key] = item

	results = sorted(by_text.values(), key=lambda x: float(x.get("score", 0.0)), reverse=True)[:5]
	answer = generate_answer(query, _format_context(results), generator)
	return results, answer
