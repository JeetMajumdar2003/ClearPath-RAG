"""One-shot script: generate and persist embeddings for every case.

Replaces what the Azure SQL stored procedure (sql/005) used to do
inside the database — calls the configured :class:`AIProvider` from
Python and upserts the vectors as JSON into
:sql:`dbo.ClinicalCaseEmbeddings`.

Run::

    cd backend
    .venv\\Scripts\\Activate.ps1
    python -m app.scripts.generate_embeddings                # default FullCase
    python -m app.scripts.generate_embeddings --type SymptomsOnly
    python -m app.scripts.generate_embeddings --batch 20

The script is **idempotent** — running it again upserts rows instead of
duplicating them.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure the backend root is on sys.path when run as ``python ...``.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import structlog  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.services.embedding_service import generate_all_embeddings  # noqa: E402
from app.services.provider_factory import get_ai_provider  # noqa: E402

log = structlog.get_logger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate embeddings for every row in dbo.ClinicalCases "
        "and store them in dbo.ClinicalCaseEmbeddings.",
    )
    parser.add_argument(
        "--type",
        dest="embedding_type",
        default=settings.embedding_type_default,
        choices=["FullCase", "SymptomsOnly", "DiagnosisOnly", "TreatmentOnly", "OutcomeOnly"],
        help="Which columns to include in the embedded text (default: %(default)s).",
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=10,
        help="How many cases to embed per provider call (default: 10).",
    )
    args = parser.parse_args()

    log.info(
        "generate_embeddings_start",
        provider=settings.ai_provider,
        embedding_type=args.embedding_type,
        batch_size=args.batch,
    )

    if not settings.sql_server:
        print("ERROR: SQL_SERVER is not set in your .env file.", file=sys.stderr)
        return 1

    try:
        provider = get_ai_provider()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not initialise the AI provider: {exc}", file=sys.stderr)
        return 2

    print(f"Provider : {provider.name}")
    print(f"Embedding: {getattr(provider, 'name_embed', provider.name)}  "
          f"({provider.embed_dimensions} dims)")
    print(f"Type     : {args.embedding_type}")
    print(f"Batch    : {args.batch}")
    print()

    try:
        success, failed = generate_all_embeddings(
            provider=provider,
            embedding_type=args.embedding_type,
            batch_size=args.batch,
        )
    except Exception as exc:  # noqa: BLE001
        log.error("generate_embeddings_failed", error=str(exc))
        print(f"\nFAILED: {exc}", file=sys.stderr)
        return 3

    print()
    print(f"Done. success={success}  failed={failed}")
    return 0 if failed == 0 else 4


if __name__ == "__main__":
    raise SystemExit(main())
