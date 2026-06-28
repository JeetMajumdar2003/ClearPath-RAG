"""Abstract AI provider — every concrete provider (OpenRouter, Azure OpenAI)
must implement this interface so the rest of the app can stay provider-agnostic.

The switch between providers is controlled by the ``AI_PROVIDER`` env var
and resolved lazily by ``app.services.provider_factory.get_ai_provider``.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List


class AIProvider(ABC):
    """Provider-agnostic interface for embedding + chat calls."""

    # ------------------------------------------------------------------ text -> vector
    @abstractmethod
    def embed(self, text: str) -> List[float]:
        """Return a single embedding for ``text``."""

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Return one embedding per input, in the same order as ``texts``."""

    # ------------------------------------------------------------------ chat completion
    @abstractmethod
    def chat(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> str:
        """Return the assistant's reply for the given system + user prompt."""

    # ------------------------------------------------------------------ identity
    @property
    @abstractmethod
    def name(self) -> str:
        """Short human-readable identifier for logs (e.g. ``openrouter:llama-3.3-70b:free``)."""

    @property
    @abstractmethod
    def embed_dimensions(self) -> int:
        """Dimensionality of the embedding vectors this provider returns."""
