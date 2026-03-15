# RAG in the Wild: A Case Study

A case study implementing and comparing advanced RAG pipelines (RAG Fusion, HyDE, CRAG, and Graph RAG) on the CRAG dataset, with evaluation metrics and an interactive web demo.

## Tech Stack

- Python (retrieval, pipelines, evaluation, Flask API)
- React + Vite (frontend)
- FAISS + sentence-transformers (global corpus retrieval)

## Pipelines

- RAG Fusion
- HyDE
- CRAG
- Graph RAG

## Quick Start

1. Install dependencies:

```bash
pip install -r requirements.txt
cd frontend
npm install
cd ..
```

2. Configure:

- Copy `config/config.example.yaml` to `config/config.yaml`
- Set dataset/model values (`dataset_path`, `generation_model`, `top_k`)
- Use Groq/Gemini or another free/local provider (no OpenAI key)

3. Run backend:

```bash
python backend/app.py
```

4. Run frontend:

```bash
cd frontend
npm run dev
```

5. Run evaluation:

```bash
python run_evaluation.py
```

Evaluation output is saved to `results/evaluation_results.csv`.

## Dataset

- CRAG Task 1 & 2 dev dataset
- Place `crag_task_1_and_2_dev_v4.jsonl` in `dataset/`
- Schema: `docs/dataset.md`

---

## Report

Full implementation notes, pipeline analysis, and evaluation results:

**[View Report →](report.md)**

## Notes

- Full assignment details: `ASSIGNMENT.md`
- Keep folder structure unchanged
