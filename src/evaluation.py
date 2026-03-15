"""Evaluation helpers for assignment pipelines."""

from __future__ import annotations

import re
from typing import Iterable


def _normalize(text: str) -> str:
    s = (text or "").lower()
    s = re.sub(r"\[[0-9]+\]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def evaluate_response(prediction: str, ground_truth: str, alt_ans: Iterable[str] | None = None) -> bool:
    """Return True if ground truth or any alt answer appears in prediction."""
    pred = _normalize(prediction)
    if not pred:
        return False

    candidates = [_normalize(ground_truth)]
    candidates.extend(_normalize(x) for x in (alt_ans or []))

    for c in candidates:
        if c and (c in pred or pred in c):
            return True
    return False
