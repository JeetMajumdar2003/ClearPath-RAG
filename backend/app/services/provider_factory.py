"""Provider factory — resolves the right :class:`AIProvider` implementation
based on the ``AI_PROVIDER`` env var.

Three modes today:

* ``openrouter`` (default) — :class:`OpenRouterProvider`.
* ``azure_python``         — :class:`AzureOpenAIProvider`. Azure OpenAI via REST from Python.
* ``azure``                — legacy SQL stored-procedure path; no Python provider.

Note: the legacy "Azure SQL does the work" mode (where stored procedures call
``sp_invoke_external_rest_endpoint`` to reach Azure OpenAI) is still supported —
it lives in :mod:`app.services.rag_service` as ``_sp_*`` helpers and is
selected when ``AI_PROVIDER=azure`` (so ``is_legacy_azure_sql_mode`` is True).
``AI_PROVIDER=azure_python`` uses the same :class:`AzureOpenAIProvider` as
``azure`` but routes through the Python pipeline instead of the stored procs.
That mode is preserved untouched so you can flip back with a single env var.
"""
from __future__ import annotations

from functools import lru_cache

import structlog

from app.core.config import settings

from .ai_provider import AIProvider
from .azure_provider import AzureOpenAIProvider
from .openrouter_provider import OpenRouterProvider

log = structlog.get_logger(__name__)


@lru_cache(maxsize=1)
def get_ai_provider() -> AIProvider:
    """Return a cached :class:`AIProvider` matching the current configuration."""

    provider = settings.ai_provider.lower().strip()

    if provider == "openrouter":
        if not settings.openrouter_api_key:
            raise RuntimeError(
                "AI_PROVIDER=openrouter but OPENROUTER_API_KEY is empty — "
                "get a free key at https://openrouter.ai/keys"
            )
        log.info(
            "ai_provider_initialized",
            provider="openrouter",
            chat_model=settings.openrouter_chat_model,
            embed_model=settings.openrouter_embed_model,
        )
        return OpenRouterProvider(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            embed_model=settings.openrouter_embed_model,
            chat_model=settings.openrouter_chat_model,
            app_referer=settings.openrouter_http_referer,
            app_title=settings.openrouter_app_name,
            embed_dimensions=settings.openrouter_embedding_dimensions,
        )

    if provider == "azure":
        raise RuntimeError(
            "AI_PROVIDER=azure uses the legacy Azure SQL stored-procedure path "
            "and does not create a Python AI provider. Use AI_PROVIDER=azure_python "
            "to call Azure OpenAI from Python."
        )

    if provider == "azure_python":
        if not settings.azure_openai_api_key or not settings.azure_openai_endpoint:
            raise RuntimeError(
                "AI_PROVIDER=azure_python but Azure OpenAI credentials are empty"
            )
        log.info(
            "ai_provider_initialized",
            provider=provider,
            chat_deployment=settings.azure_openai_chat_deployment,
            embed_deployment=settings.azure_openai_embedding_deployment,
        )
        return AzureOpenAIProvider(
            endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            embeddings_api_version=settings.azure_openai_api_version_embeddings,
            chat_api_version=settings.azure_openai_api_version_chat,
            embed_deployment=settings.azure_openai_embedding_deployment,
            chat_deployment=settings.azure_openai_chat_deployment,
            embed_dimensions=settings.embedding_vector_dimensions,
        )

    raise ValueError(
        f"Unknown AI_PROVIDER: {settings.ai_provider!r}. "
        "Supported: 'openrouter', 'azure', 'azure_python'"
    )
