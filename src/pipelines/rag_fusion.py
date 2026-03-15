"""
RAG Fusion: multiple queries, retrieve from global index for each, merge ranked lists (e.g. RRF), generate answer.
Do not remove or rename this file.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Tuple

from src.generation import generate_answer
from src.retrieval import retrieve


def _rrf_merge(ranked_lists: List[List[Dict[str, Any]]], k: int = 60) -> List[Dict[str, Any]]:
	scores = defaultdict(float)
	payload: Dict[str, Dict[str, Any]] = {}

	for one_list in ranked_lists:
		for rank, item in enumerate(one_list, start=1):
			key = item.get("text", "")
			if not key:
				continue
			scores[key] += 1.0 / (k + rank)
			payload[key] = item

	merged: List[Dict[str, Any]] = []
	for key, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
		row = dict(payload[key])
		row["fusion_score"] = float(score)
		merged.append(row)
	return merged


def _format_context(chunks: List[Dict[str, Any]]) -> str:
	return "\n\n".join(f"[{i+1}] {c.get('text', '')}" for i, c in enumerate(chunks))


def run(query: str, retrieval_service, top_k: int, generator) -> Tuple[List[Dict[str, Any]], str]:
	variants = generator.generate_query_variants(query, n=3)
	ranked_lists = [retrieve(retrieval_service, v, top_k=top_k) for v in variants]
	fused = _rrf_merge(ranked_lists)

	final_chunks: List[Dict[str, Any]] = []
	seen = set()
	for item in fused:
		txt = item.get("text", "")
		if txt in seen:
			continue
		seen.add(txt)
		final_chunks.append(item)
		if len(final_chunks) >= 5:
			break

	answer = generate_answer(query, _format_context(final_chunks), generator)
	return final_chunks, answer
