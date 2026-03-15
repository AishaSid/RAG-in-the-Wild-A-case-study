from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple

from flask import Flask, jsonify, request

from src.data_loader import load_examples
from src.generation import Generator
from src.pipelines import crag, graph_rag, hyde, rag_fusion
from src.retrieval import RetrievalService
from src.corpus import build_index

app = Flask(__name__)

_STATE: Dict[str, Any] = {
    "cfg": None,
    "generator": None,
    "retrieval_service": None,
    "top_k": 3,
    "dataset_path": "dataset/crag_task_1_and_2_dev_v4_subset_1.jsonl",
}


def _load_simple_yaml(path: str) -> Dict[str, Any]:
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


def _ensure_state() -> None:
    if _STATE["retrieval_service"] is not None:
        return

    cfg_path = Path("config/config.yaml")
    if not cfg_path.exists():
        cfg_path = Path("config/config.example.yaml")

    cfg = _load_simple_yaml(str(cfg_path))
    dataset_path = cfg.get("dataset_path", "dataset/crag_task_1_and_2_dev_v4_subset_1.jsonl")
    generation_model = cfg.get("generation_model", "llama-3.1-8b-instant")
    top_k = int(cfg.get("top_k", 5))
    index_path = cfg.get("index_path", "crag_phase1.index")
    mapping_path = cfg.get("mapping_path", "crag_phase1_mapping.pkl")

    root = Path(__file__).resolve().parent.parent
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

    _STATE.update(
        {
            "cfg": cfg,
            "generator": generator,
            "retrieval_service": retrieval_service,
            "top_k": top_k,
            "dataset_path": dataset_path_abs,
        }
    )


def _run_pipeline(pipeline: str, query: str) -> Tuple[List[Dict[str, Any]], str, Dict[str, Any]]:
    retrieval_service = _STATE["retrieval_service"]
    generator = _STATE["generator"]
    top_k = _STATE["top_k"]

    extras: Dict[str, Any] = {}
    if pipeline == "rag_fusion":
        retrieved, answer = rag_fusion.run(query, retrieval_service, top_k, generator)
    elif pipeline == "hyde":
        hypothetical_doc, retrieved, answer = hyde.run(query, retrieval_service, top_k, generator)
        extras["hypothetical_doc"] = hypothetical_doc
    elif pipeline == "crag":
        retrieved, answer = crag.run(query, retrieval_service, top_k, generator)
    elif pipeline == "graph_rag":
        retrieved, answer = graph_rag.run(query, retrieval_service, top_k, generator)
    else:
        raise ValueError("pipeline must be one of: rag_fusion, hyde, crag, graph_rag")

    return retrieved, answer, extras


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/sample-queries")
def sample_queries():
    _ensure_state()
    limit_raw = request.args.get("limit", "20")
    limit = int(limit_raw) if limit_raw.isdigit() else 20
    samples = []
    for ex in load_examples(file_path=_STATE["dataset_path"], limit=limit):
        q = ex.get("query", "").strip()
        if q:
            samples.append(q)
    return jsonify({"samples": samples})


@app.post("/api/query")
def run_query():
    _ensure_state()

    payload = request.get_json(silent=True) or {}
    query = (payload.get("query") or "").strip()
    pipeline = (payload.get("pipeline") or "rag_fusion").strip()

    if not query:
        return jsonify({"error": "query is required"}), 400

    try:
        retrieved, answer, extras = _run_pipeline(pipeline, query)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(
        {
            "query": query,
            "pipeline": pipeline,
            "answer": answer,
            "retrieved": retrieved,
            "top_score": float(retrieved[0].get("score", 0.0)) if retrieved else 0.0,
            "confidence": float(retrieved[0].get("confidence", 0.0)) if retrieved else None,
            **extras,
        }
    )


@app.post("/ask")
def ask():
    _ensure_state()

    payload = request.get_json(silent=True) or {}
    query = (payload.get("query") or "").strip()
    pipeline = (payload.get("pipeline_type") or "rag_fusion").strip()

    if not query:
        return jsonify({"error": "query is required"}), 400

    try:
        retrieved, answer, extras = _run_pipeline(pipeline, query)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(
        {
            "query": query,
            "pipeline_type": pipeline,
            "answer": answer,
            "retrieved_chunks": [
                {
                    "text": r.get("text", ""),
                    "similarity_score": float(r.get("score", 0.0)),
                }
                for r in retrieved
            ],
            "top_similarity_score": float(retrieved[0].get("score", 0.0)) if retrieved else 0.0,
            **extras,
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
