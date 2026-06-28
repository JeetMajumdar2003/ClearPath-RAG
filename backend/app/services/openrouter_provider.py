"""OpenRouter implementation of :class:`AIProvider`.

OpenRouter exposes an OpenAI-compatible REST API at ``https://openrouter.ai/api/v1``,
so the same request/response shape works for both ``/embeddings`` and ``/chat/completions``.

Default model choices (override via env):

* ``OPENROUTER_CHAT_MODEL`` — any free chat model works, e.g.
  ``meta-llama/llama-3.3-70b-instruct:free``,
  ``google/gemini-2.0-flash-exp:free``,
  ``qwen/qwen-2.5-72b-instruct:free``.
* ``OPENROUTER_EMBED_MODEL`` — defaults to the free
  ``nvidia/llama-nemotron-embed-vl-1b-v2:free`` model.
"""
from __future__ import annotations

import time
from typing import List

import httpx
import structlog

from .ai_provider import AIProvider

log = structlog.get_logger(__name__)


class OpenRouterProvider(AIProvider):
    """OpenRouter-backed implementation (works for both free and paid models)."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://openrouter.ai/api/v1",
        embed_model: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free",
        chat_model: str = "nvidia/nemotron-3-super-120b-a12b:free",
        app_referer: str = "http://localhost:5173",
        app_title: str = "ClearPath RAG",
        timeout: float = 60.0,
        max_retries: int = 3,
        embed_dimensions: int = 1536,
    ) -> None:
        if not api_key:
            raise ValueError("OpenRouter API key is required")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.embed_model = embed_model
        self.chat_model = chat_model
        self._embed_dimensions = embed_dimensions
        self.max_retries = max_retries
        self._client = httpx.Client(
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": app_referer,
                "X-Title": app_title,
            },
        )

    # ------------------------------------------------------------------ embeddings
    def embed(self, text: str) -> List[float]:
        return self.embed_batch([text])[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        last_exc: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                resp = self._client.post(
                    f"{self.base_url}/embeddings",
                    json={"model": self.embed_model, "input": texts},
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                # OpenRouter returns the embeddings in ``index`` order.
                data.sort(key=lambda x: x["index"])
                return [item["embedding"] for item in data]
            except Exception as exc:  # noqa: BLE001 — log + retry
                last_exc = exc
                log.warning(
                    "openrouter_embed_attempt_failed",
                    attempt=attempt + 1,
                    max_attempts=self.max_retries,
                    error=str(exc),
                )
                time.sleep(2 ** attempt)
        raise RuntimeError(
            f"OpenRouter embeddings failed after {self.max_retries} attempts: {last_exc}"
        ) from last_exc

    # ------------------------------------------------------------------ chat
    def chat(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> str:
        last_exc: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                resp = self._client.post(
                    f"{self.base_url}/chat/completions",
                    json={
                        "model": self.chat_model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    },
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                log.warning(
                    "openrouter_chat_attempt_failed",
                    attempt=attempt + 1,
                    max_attempts=self.max_retries,
                    error=str(exc),
                )
                time.sleep(2 ** attempt)
        raise RuntimeError(
            f"OpenRouter chat failed after {self.max_retries} attempts: {last_exc}"
        ) from last_exc

    # ------------------------------------------------------------------ identity
    @property
    def name(self) -> str:
        return f"openrouter:{self.chat_model}"

    @property
    def name_embed(self) -> str:
        return f"openrouter:{self.embed_model}"

    @property
    def embed_dimensions(self) -> int:
        return self._embed_dimensions

    def __repr__(self) -> str:  # pragma: no cover
        return f"OpenRouterProvider(chat={self.chat_model!r}, embed={self.embed_model!r})"
