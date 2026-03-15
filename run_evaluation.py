"""
Run all 4 pipelines on the dev set (or a subset), compute accuracy per pipeline, print or save results.
Do not remove or rename this file.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, List

from src.data_loader import load_examples
from src.evaluation import evaluate_response
from src.generation import Generator
from src.pipelines import crag, graph_rag, hyde, rag_fusion
from src.retrieval import RetrievalService
from src.corpus import build_index

RESULTS_DIR = Path("results")
CSV_PATH = RESULTS_DIR / "evaluation_results.csv"


def _load_simple_yaml(path: str) -> Dict[str, Any]:
    # Minimal parser for flat key-value YAML used in this assignment config.
    cfg: Dict[str, Any] = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#") or ":" not in s:
                continue
            key, value = s.split(":", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if value.isdigit():
                cfg[key] = int(value)
            else:
                cfg[key] = value
    return cfg


def _get_config() -> Dict[str, Any]:
    cfg_path = Path("config/config.yaml")
    if not cfg_path.exists():
        cfg_path = Path("config/config.example.yaml")
    return _load_simple_yaml(str(cfg_path))


def _run_pipeline(name: str, query: str, retrieval_service, top_k: int, generator) -> Dict[str, Any]:
    if name == "rag_fusion":
        retrieved, answer = rag_fusion.run(query, retrieval_service, top_k, generator)
    elif name == "hyde":
        _hyp, retrieved, answer = hyde.run(query, retrieval_service, top_k, generator)
    elif name == "crag":
        retrieved, answer = crag.run(query, retrieval_service, top_k, generator)
    elif name == "graph_rag":
        retrieved, answer = graph_rag.run(query, retrieval_service, top_k, generator)
    else:
        raise ValueError(f"Unknown pipeline: {name}")

    top_score = float(retrieved[0].get("score", 0.0)) if retrieved else 0.0
    confidence = float(retrieved[0].get("confidence", 0.0)) if retrieved else 0.0
    return {
        "answer": answer,
        "retrieved": retrieved,
        "top_score": top_score,
        "confidence": confidence,
    }


def main() -> None:
    cfg = _get_config()
    dataset_path = cfg.get("dataset_path", "dataset/crag_task_1_and_2_dev_v4_subset_1.jsonl")
    generation_model = cfg.get("generation_model", "llama-3.1-8b-instant")
    top_k = int(cfg.get("top_k", 5))

    index_path = cfg.get("index_path", "crag_phase1.index")
    mapping_path = cfg.get("mapping_path", "crag_phase1_mapping.pkl")

    root = Path(__file__).resolve().parent
    dataset_path_abs = str((root / dataset_path).resolve()) if not Path(dataset_path).is_absolute() else dataset_path
    index_path_abs = str((root / index_path).resolve()) if not Path(index_path).is_absolute() else index_path
    mapping_path_abs = str((root / mapping_path).resolve()) if not Path(mapping_path).is_absolute() else mapping_path

    generator = Generator(model_name=generation_model)

    if not Path(index_path_abs).exists() or not Path(mapping_path_abs).exists():
        try:
            build_index(dataset_path_abs, index_path_abs, mapping_path_abs)
        except ValueError:
            fallback = str((root / "dataset" / "crag_task_1_and_2_dev_v4_subset_1.jsonl").resolve())
            build_index(fallback, index_path_abs, mapping_path_abs)
            dataset_path_abs = fallback

    retrieval_service = RetrievalService(index_path=index_path_abs, mapping_path=mapping_path_abs)

    pipelines = ["rag_fusion", "hyde", "crag", "graph_rag"]
    records = {name: {"correct": 0, "total": 0} for name in pipelines}
    csv_rows: List[Dict[str, Any]] = []

    for ex in load_examples(file_path=dataset_path_abs, limit=20):
        query = ex["query"]
        gold = ex["answer"]
        alt = ex["alt_ans"]

        for name in pipelines:
            out = _run_pipeline(name, query, retrieval_service, top_k, generator)
            ok = evaluate_response(out["answer"], gold, alt)
            records[name]["correct"] += 1 if ok else 0
            records[name]["total"] += 1
            csv_rows.append({
                "query": query,
                "pipeline": name,
                "generated_answer": out["answer"],
                "ground_truth": gold,
                "exact_match": 1 if ok else 0,
            })

    print("Evaluation Results")
    print("==================")
    for name in pipelines:
        total = records[name]["total"]
        acc = (records[name]["correct"] / total) if total else 0.0
        print(f"{name}: Accuracy={acc:.4f} ({records[name]['correct']}/{total})")

    # ── Save CSV ──
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    fieldnames = ["query", "pipeline", "generated_answer", "ground_truth", "exact_match"]
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_rows)
    print(f"\nResults saved to: {CSV_PATH}")


if __name__ == "__main__":
    main()
