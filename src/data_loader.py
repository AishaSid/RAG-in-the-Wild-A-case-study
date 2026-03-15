"""Data loading helpers for CRAG Phase 1."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Generator, List


def _iter_json_objects(path: Path) -> Generator[dict, None, None]:
    """Yield JSON objects from a stream containing one or many JSON objects.

    Supports:
    - JSONL (one object per line),
    - pretty-printed multi-line JSON objects,
    - concatenated JSON objects separated by whitespace/newlines.
    """
    decoder = json.JSONDecoder()
    buffer = ""

    with open(path, "r", encoding="utf-8") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            buffer += chunk

            while True:
                stripped = buffer.lstrip()
                if not stripped:
                    buffer = ""
                    break
                try:
                    obj, idx = decoder.raw_decode(stripped)
                except json.JSONDecodeError:
                    # Likely an incomplete trailing object; read more data.
                    break

                yield obj
                buffer = stripped[idx:]

    # Parse any remaining buffered content.
    tail = buffer.lstrip()
    while tail:
        obj, idx = decoder.raw_decode(tail)
        yield obj
        tail = tail[idx:].lstrip()


def load_crag_data(file_path: str) -> Generator[Dict[str, object], None, None]:
    """Yield CRAG rows with query, answer, and page snippets.

    Each yielded item has:
    - query: str
    - answer: str
    - snippets: List[str]
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    for row in _iter_json_objects(path):
        search_results = row.get("search_results") or []
        snippets: List[str] = []
        for result in search_results:
            snippet = (result or {}).get("page_snippet") or ""
            snippet = snippet.strip()
            if snippet:
                snippets.append(snippet)

        yield {
            "query": row.get("query", ""),
            "answer": row.get("answer", ""),
            "snippets": snippets,
        }
