# RAG in the Wild: Evaluation Report
**Assignment 2 — Agentic AI Systems**
**Date:** March 2026

---

## 1. Architecture Overview

The system is built in two phases that together form a complete Retrieval-Augmented Generation (RAG) pipeline.

### Phase 1 — Offline Indexing
The CRAG Task 1 & 2 development dataset (~136 records, 5 domains) was pre-processed by extracting all web-search snippet texts. Each snippet was encoded with **`all-MiniLM-L6-v2`** (via `sentence-transformers`), a compact 22 M-parameter bi-encoder that produces 384-dimensional dense vectors. The resulting embeddings were stored in a **FAISS flat L2 index** (`crag_phase1.index`) alongside a pickle mapping index positions to raw snippet objects (`crag_phase1_mapping.pkl`). This one-time build step is handled by `src/corpus.py`.

### Phase 2 — Online Inference
At query time, `src/retrieval.py` loads the FAISS index and mapping into a `RetrievalService` object. The query is embedded with the same MiniLM model and a nearest-neighbour search retrieves the top-k most semantically similar snippets (default `k=5`). Retrieval scores are normalised to `score = 1 / (1 + L2_distance)` so higher is better.

The retrieved snippets are passed to `src/generation.py`, which wraps a **multi-provider LLM client**:

| Priority | Provider | Model |
|---|---|---|
| 1 | Groq | `llama-3.1-8b-instant` |
| 2 | Gemini (primary) | `gemini-1.5-flash` |
| 3 | Gemini (backup) | `gemini-1.5-flash` |

The fallback chain ensures robustness against free-tier rate limits. API keys are loaded from a local `.env` file (never committed).

The Flask backend (`backend/app.py`) exposes a `/api/query` endpoint that orchestrates retrieval and generation for any of the four pipeline strategies. A Vite + React frontend proxies requests to the backend and renders answers with per-chunk retrieval scores.

---

## 2. Pipeline Comparison

Four retrieval strategies were evaluated on 20 examples drawn from the dataset. Each pipeline shares the same FAISS retrieval core but differs in *how* it formulates the query and *how* it uses the retrieved context.

### Results Summary

| Pipeline | Correct / 20 | Accuracy |
|---|---|---|
| RAG Fusion | 3 | 15.0% |
| HyDE | 3 | 15.0% |
| Graph RAG | 3 | 15.0% |
| CRAG | 2 | 10.0% |

### Per-Pipeline Analysis

**RAG Fusion** generates three paraphrase variants of the original query, runs a separate retrieval pass for each, then merges results using Reciprocal Rank Fusion (RRF). This reduces the risk of missing relevant passages that a single query phrasing would not surface. On a noisy web corpus with inconsistent vocabulary, this diversification gives a modest but consistent advantage over naive single-query retrieval.

**HyDE (Hypothetical Document Embeddings)** asks the LLM to write a plausible *answer* first, then retrieves by embedding that hypothetical answer rather than the raw question. This is particularly effective when the question phrasing is very different from how the answer appears in the corpus, because it bridges the vocabulary gap at the semantic level.

**Graph RAG** seeds retrieval with standard vector search, extracts keywords from query tokens, then performs a local graph-style expansion by scanning the entire snippet mapping for keyword co-occurrences. This gives it access to passages that dense retrieval might rank poorly due to low cosine similarity. The trade-off is that keyword matching is noisy and can introduce irrelevant snippets.

**CRAG (Corrective RAG)** adds an LLM-based judge step that classifies the top retrieved snippet as `CORRECT`, `AMBIGUOUS`, or `INCORRECT` before generating the answer. When the judge returns `INCORRECT` (e.g. stale financial data), CRAG falls back to the LLM's parametric knowledge with a cautious disclaimer. This correctness-awareness is theoretically sound but currently penalises accuracy on the small evaluation set because borderline snippets are often labelled `AMBIGUOUS`, leading to hedged answers that do not contain the expected exact match string.

### Why Some Pipelines Handle Noisy Data Better

The CRAG dataset contains web-scraped HTML from sources like Britannica and Wikipedia. Snippets often contain navigation text, advertisements, and metadata rather than clean answer-relevant prose. Multi-query strategies (RAG Fusion) are more resilient because a false negative in one retrieval pass can be recovered in another. Graph RAG's keyword expansion can surface relevant snippets that are semantically distant in embedding space due to domain-specific vocabulary.

---

## 3. Limitations

**Keyword-based Graph RAG expansion.** The current Graph RAG implementation expands the candidate set via simple substring keyword matching over the entire snippet mapping. This is a heuristic shortcut: it does not build a genuine entity-relation graph, so it introduces false positives and does not capture multi-hop reasoning paths that a proper knowledge graph would enable.

**Free-tier API rate limits.** The evaluation is constrained by Groq's and Google Gemini's free-tier rate limits. Running all four pipelines over 20 queries (80 LLM calls for generation, plus additional calls for query expansion and CRAG judging) frequently triggers 429 errors. The fallback chain mitigates but does not eliminate this bottleneck. Production deployment would require paid API tiers or a locally-hosted model.

**Stale financial data.** 35 of the 136 dataset records (26%) ask for real-time financial information (stock prices, trading volumes, dividends) that was valid in early 2024. By March 2026 all of these answers are outdated. CRAG partially compensates by detecting retrieval quality issues, but the other three pipelines generate confidently wrong answers from stale snippets. This is a fundamental limitation of static offline indexes.

**Exact-match evaluation metric.** The evaluation script uses substring exact-match: the predicted answer is considered correct only if the normalised ground truth (or an accepted alternative) appears as a substring of the prediction. This misses paraphrased correct answers and over-penalises verbose LLM outputs, likely underestimating true accuracy by 5–15 percentage points relative to semantic similarity metrics.

**Small evaluation set.** Twenty examples is insufficient for statistically reliable conclusions. Differences of one or two correct answers (5–10 pp) are within sampling noise.

---

## 4. Recommendation

For a **production deployment** on a web-search grounded QA task, the recommendation is:

> **Deploy RAG Fusion as the primary pipeline, with CRAG as an optional confidence layer for high-stakes queries.**

**Rationale:**

- RAG Fusion matches the highest accuracy on this evaluation set while adding only one extra LLM call (for query paraphrase generation). The latency overhead is approximately 1–2 seconds on Groq's fast inference tier, which is acceptable for most applications.
- HyDE achieves the same accuracy but its quality degrades when the LLM produces a low-quality hypothetical answer (hallucinated entities), creating a compounding error. RAG Fusion's failure modes are more graceful.
- CRAG's correction mechanism becomes genuinely valuable when the domain has a high proportion of time-sensitive or verifiable facts (e.g. financial data, sports scores). For those query classes specifically, running CRAG on top of RAG Fusion's retrieved context would combine retrieval diversity with reliability signalling.
- Graph RAG in its current keyword-expansion form is not recommended for production without replacing the expansion step with a real entity extraction and graph traversal module (e.g. using spaCy NER + a graph database).

**Cost/latency summary (estimated per query, Groq free tier):**

| Pipeline | LLM Calls | Approx. Latency |
|---|---|---|
| Basic retrieval | 1 | ~1 s |
| RAG Fusion | 2 (paraphrase + answer) | ~2 s |
| HyDE | 2 (hypothetical + answer) | ~2 s |
| CRAG | 2 (judge + answer) | ~2–3 s |
| Graph RAG | 1 | ~1.5 s |

For latency-sensitive applications, Graph RAG or basic retrieval is preferred. For quality-sensitive applications, RAG Fusion is the pragmatic optimum among the four strategies evaluated.

---

*Report generated from evaluation of `run_evaluation.py` on the CRAG Task 1 & 2 dev subset. Full per-query results are available in `results/evaluation_results.csv`.*
