"""Unit coverage for AI provider wiring."""

import pytest

from app.core.config import settings
from app.services.azure_provider import AzureOpenAIProvider
from app.services.openrouter_provider import OpenRouterProvider
from app.services import provider_factory


def test_openrouter_provider_uses_configured_models_and_headers(monkeypatch):
    provider_factory.get_ai_provider.cache_clear()
    monkeypatch.setattr(settings, "ai_provider", "openrouter", raising=False)
    monkeypatch.setattr(settings, "openrouter_api_key", "test-openrouter-key", raising=False)
    monkeypatch.setattr(settings, "openrouter_base_url", "https://openrouter.ai/api/v1", raising=False)
    monkeypatch.setattr(
        settings,
        "openrouter_embed_model",
        "nvidia/llama-nemotron-embed-vl-1b-v2:free",
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "openrouter_chat_model",
        "nvidia/nemotron-3-super-120b-a12b:free",
        raising=False,
    )
    monkeypatch.setattr(settings, "openrouter_embedding_dimensions", 1536, raising=False)
    monkeypatch.setattr(settings, "openrouter_app_name", "ClearPath RAG", raising=False)
    monkeypatch.setattr(settings, "openrouter_http_referer", "http://localhost:5173", raising=False)

    provider = provider_factory.get_ai_provider()

    assert isinstance(provider, OpenRouterProvider)
    assert provider.base_url == "https://openrouter.ai/api/v1"
    assert provider.embed_model == "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    assert provider.chat_model == "nvidia/nemotron-3-super-120b-a12b:free"
    assert provider.embed_dimensions == 1536
    assert provider._client.headers["HTTP-Referer"] == "http://localhost:5173"
    assert provider._client.headers["X-Title"] == "ClearPath RAG"


def test_legacy_azure_mode_does_not_create_python_provider(monkeypatch):
    provider_factory.get_ai_provider.cache_clear()
    monkeypatch.setattr(settings, "ai_provider", "azure", raising=False)

    with pytest.raises(RuntimeError, match="legacy Azure SQL"):
        provider_factory.get_ai_provider()


def test_azure_python_provider_uses_separate_api_versions():
    provider = AzureOpenAIProvider(
        endpoint="https://example.openai.azure.com",
        api_key="test-key",
        embeddings_api_version="2023-05-15",
        chat_api_version="2025-01-01-preview",
        embed_deployment="text-embedding-3-small",
        chat_deployment="gpt-4o",
    )
    calls: list[tuple[str, dict]] = []

    class _Response:
        def __init__(self, payload):
            self._payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self._payload

    class _Client:
        def post(self, url, json):
            calls.append((url, json))
            if url.endswith("/embeddings?api-version=2023-05-15"):
                return _Response({"data": [{"embedding": [0.1, 0.2]}]})
            if url.endswith("/chat/completions?api-version=2025-01-01-preview"):
                return _Response({"choices": [{"message": {"content": "ok"}}]})
            raise AssertionError(f"unexpected URL: {url}")

    provider._client = _Client()

    assert provider.embed("hello") == [0.1, 0.2]
    assert provider.chat("system", "user") == "ok"
    assert calls[0][0] == (
        "https://example.openai.azure.com/openai/deployments/"
        "text-embedding-3-small/embeddings?api-version=2023-05-15"
    )
    assert calls[1][0] == (
        "https://example.openai.azure.com/openai/deployments/"
        "gpt-4o/chat/completions?api-version=2025-01-01-preview"
    )
