"""Azure OpenAI implementation of :class:`AIProvider`.

Uses the Azure OpenAI REST API directly from Python (so it can be used together
with the local SQL Server deployment, no Azure SQL required).

This is the Python equivalent of the legacy ``AI_GENERATE_EMBEDDINGS`` +
``sp_invoke_external_rest_endpoint`` calls that used to happen inside SQL Server.
The legacy SQL-Server-driven path is still available via ``AI_PROVIDER=azure`` —
this class is only used when you choose the ``azure_python`` mode (or when you
have an Azure OpenAI resource and want to call it from Python against a local DB).
"""
from __future__ import annotations

import time
from typing import List

import httpx
import structlog

from .ai_provider import AIProvider

log = structlog.get_logger(__name__)


class AzureOpenAIProvider(AIProvider):
    """Thin REST wrapper around Azure OpenAI's ``/embeddings`` and ``/chat/completions``."""

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        embeddings_api_version: str,
        chat_api_version: str,
        embed_deployment: str,
        chat_deployment: str,
        embed_dimensions: int = 1536,
        timeout: float = 60.0,
        max_retries: int = 3,
    ) -> None:
        if not endpoint or not api_key:
            raise ValueError("Azure OpenAI endpoint and api_key are required")
        self.endpoint = endpoint.rstrip("/")
        self.embeddings_api_version = embeddings_api_version
        self.chat_api_version = chat_api_version
        self.embed_deployment = embed_deployment
        self.chat_deployment = chat_deployment
        self._embed_dimensions = embed_dimensions
        self.max_retries = max_retries
        self._client = httpx.Client(
            timeout=timeout,
            headers={"api-key": api_key, "Content-Type": "application/json"},
        )

    # ------------------------------------------------------------------ embeddings
    def embed(self, text: str) -> List[float]:
        return self.embed_batch([text])[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        url = (
            f"{self.endpoint}/openai/deployments/{self.embed_deployment}"
            f"/embeddings?api-version={self.embeddings_api_version}"
        )
        last_exc: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                resp = self._client.post(url, json={"input": texts})
                resp.raise_for_status()
                return [item["embedding"] for item in resp.json()["data"]]
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                log.warning(
                    "azure_embed_attempt_failed",
                    attempt=attempt + 1,
                    max_attempts=self.max_retries,
                    error=str(exc),
                )
                time.sleep(2 ** attempt)
        raise RuntimeError(
            f"Azure OpenAI embeddings failed after {self.max_retries} attempts: {last_exc}"
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
        url = (
            f"{self.endpoint}/openai/deployments/{self.chat_deployment}"
            f"/chat/completions?api-version={self.chat_api_version}"
        )
        last_exc: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                resp = self._client.post(
                    url,
                    json={
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
                    "azure_chat_attempt_failed",
                    attempt=attempt + 1,
                    max_attempts=self.max_retries,
                    error=str(exc),
                )
                time.sleep(2 ** attempt)
        raise RuntimeError(
            f"Azure OpenAI chat failed after {self.max_retries} attempts: {last_exc}"
        ) from last_exc

    # ------------------------------------------------------------------ identity
    @property
    def name(self) -> str:
        return f"azure:{self.chat_deployment}"

    @property
    def name_embed(self) -> str:
        return f"azure:{self.embed_deployment}"

    @property
    def embed_dimensions(self) -> int:
        return self._embed_dimensions

    def __repr__(self) -> str:  # pragma: no cover
        return f"AzureOpenAIProvider(chat={self.chat_deployment!r}, embed={self.embed_deployment!r})"
