"""Generation helpers for all RAG pipelines."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Dict, List


def _load_local_env() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return

    with open(env_path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


class Generator:
    def __init__(self, model_name: str = "llama-3.1-8b-instant"):
        _load_local_env()
        self.model_name = model_name
        self._groq_clients: List[Any] = []
        self._gemini_models: List[Any] = []
        self._provider_order = self._build_provider_order()

        self._setup_groq_clients()
        self._setup_gemini_clients()

    def _build_provider_order(self) -> List[str]:
        preferred = (os.getenv("LLM_PROVIDER") or "auto").strip().lower()
        if preferred == "groq":
            return ["groq", "gemini"]
        if preferred == "gemini":
            return ["gemini", "groq"]

        if self.model_name.lower().startswith("gemini"):
            return ["gemini", "groq"]
        return ["groq", "gemini"]

    def _setup_groq_clients(self) -> None:
        keys = [
            os.getenv("GROQ_API_KEY"),
            os.getenv("GROQ_API_KEY_BACKUP"),
            os.getenv("GROQ_API_KEY_BACKUP_2"),
        ]
        keys = [key for key in keys if key]
        if not keys:
            return

        try:
            from openai import OpenAI

            for key in keys:
                self._groq_clients.append(OpenAI(api_key=key, base_url="https://api.groq.com/openai/v1"))
        except Exception:
            self._groq_clients = []

    def _setup_gemini_clients(self) -> None:
        keys = [
            os.getenv("GEMINI_API_KEY"),
            os.getenv("GEMINI_API_KEY_BACKUP"),
            os.getenv("GEMINI_API_KEY_BACKUP_2"),
        ]
        keys = [key for key in keys if key]
        if not keys:
            return

        try:
            module_name = "google.generativeai"
            genai = __import__(module_name, fromlist=["GenerativeModel"])

            for key in keys:
                self._gemini_models.append((genai, key))
        except Exception:
            self._gemini_models = []

    def _call_groq(self, prompt: str, temperature: float, max_tokens: int) -> str:
        model_name = os.getenv("GROQ_MODEL") or self.model_name
        for client in self._groq_clients:
            try:
                out = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": "You are a helpful factual assistant."},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                text = (out.choices[0].message.content or "").strip()
                if text:
                    return text
            except Exception:
                continue
        return ""

    def _call_gemini(self, prompt: str, temperature: float, max_tokens: int) -> str:
        model_name = os.getenv("GEMINI_MODEL") or (self.model_name if self.model_name.lower().startswith("gemini") else "gemini-1.5-flash")
        for genai, key in self._gemini_models:
            try:
                genai.configure(api_key=key)
                model = genai.GenerativeModel(model_name)
                out = model.generate_content(
                    prompt,
                    generation_config={
                        "temperature": temperature,
                        "max_output_tokens": max_tokens,
                    },
                )
                text = getattr(out, "text", "") or ""
                text = text.strip()
                if text:
                    return text
            except Exception:
                continue
        return ""

    def _call_llm(self, prompt: str, temperature: float = 0.2, max_tokens: int = 250) -> str:
        for provider in self._provider_order:
            if provider == "groq":
                text = self._call_groq(prompt, temperature, max_tokens)
                if text:
                    return text
            elif provider == "gemini":
                text = self._call_gemini(prompt, temperature, max_tokens)
                if text:
                    return text
        return ""

    def _fallback_answer(self, query: str, context: str) -> str:
        if not context.strip():
            return "I am not sure based on the retrieved context."
        q_tokens = set(re.findall(r"[a-zA-Z0-9]+", query.lower()))
        lines = [line.strip() for line in context.splitlines() if line.strip()]
        best = ""
        best_score = -1
        for line in lines:
            words = set(re.findall(r"[a-zA-Z0-9]+", line.lower()))
            s = len(q_tokens & words)
            if s > best_score:
                best_score = s
                best = line
        return best[:500] if best else context[:500]

    def generate_answer(self, query: str, context: str) -> str:
        prompt = f"Based on the following context: {context}, answer the question: {query}."
        text = self._call_llm(prompt, temperature=0.1, max_tokens=260)
        if text:
            return text
        return self._fallback_answer(query, context)

    def generate_hypothetical_answer(self, query: str) -> str:
        prompt = (
            "Write a short hypothetical answer passage (2-4 sentences) that would likely "
            f"contain the facts needed to answer this question: {query}"
        )
        out = self._call_llm(prompt, temperature=0.3, max_tokens=180)
        return out or f"Likely answer passage for: {query}"

    def generate_query_variants(self, query: str, n: int = 3) -> List[str]:
        prompt = f"Generate {n} retrieval-focused rewrites for: {query}. Return one per line."
        out = self._call_llm(prompt, temperature=0.4, max_tokens=120)
        if not out:
            return [
                f"{query}",
                f"{query} facts",
                f"{query} key details",
            ][:n]
        lines = [ln.strip(" -\t") for ln in out.splitlines() if ln.strip()]
        merged = []
        seen = set()
        for item in [query] + lines:
            key = item.lower()
            if key not in seen:
                seen.add(key)
                merged.append(item)
        return merged[:n]

    def judge_retrieval(self, query: str, retrieved: List[Dict[str, Any]]) -> str:
        if not retrieved:
            return "INCORRECT"

        context = "\n".join(f"[{i+1}] {r.get('text', '')[:300]}" for i, r in enumerate(retrieved[:3]))
        prompt = (
            "You are a retrieval judge. Label retrieved context for the query as exactly one of: "
            "CORRECT, AMBIGUOUS, INCORRECT.\n"
            f"Query: {query}\n"
            f"Retrieved:\n{context}\n"
            "Return one word only."
        )
        out = self._call_llm(prompt, temperature=0.0, max_tokens=10).upper()
        if "CORRECT" in out:
            return "CORRECT"
        if "AMBIGUOUS" in out:
            return "AMBIGUOUS"
        if "INCORRECT" in out:
            return "INCORRECT"

        # Score fallback for reliability without API.
        top = float(retrieved[0].get("score", 0.0))
        if top >= 0.55:
            return "CORRECT"
        if top >= 0.40:
            return "AMBIGUOUS"
        return "INCORRECT"


def generate_answer(query: str, context: str, generator: Generator | None = None) -> str:
    helper = generator or Generator()
    return helper.generate_answer(query=query, context=context)
