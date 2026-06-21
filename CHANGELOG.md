# Changelog

All notable changes to ClearPath RAG are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Releases are tagged on `main`. For upgrade instructions between versions,
> see [`README.md`](README.md) and [`docs/`](docs/).

---

## [Unreleased]

### Added

- GitHub community health files: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
  `SECURITY.md`, `SUPPORT.md`, `TROUBLESHOOTING.md`, `CHANGELOG.md`.
- GitHub issue templates (bug report, feature request, security advisory,
  question) and a PR template under `.github/ISSUE_TEMPLATE/` and
  `.github/PULL_REQUEST_TEMPLATE.md`.
- CI workflows: `.github/workflows/ci.yml` (backend pytest + frontend
  lint/build + docker build) and `.github/workflows/lint.yml` (Prettier +
  markdownlint).
- Dependabot configuration (`.github/dependabot.yml`) covering `pip`,
  `npm`, and GitHub Actions ecosystems.
- `CODEOWNERS` for automatic reviewer assignment.
- Code-style config: `.editorconfig`, `.prettierrc.json`, `.prettierignore`,
  root and per-service `.dockerignore` files.
- Per-service `.gitignore` files (`backend/.gitignore`, `frontend/.gitignore`)
  to keep virtualenvs, build output, and editor cruft out of git.

### Changed

- Root `.gitignore` expanded with `.env.*`, OS, IDE, Docker volume, and lab
  directory exclusions.

---

## [1.0.0] — 2026-06-20

### Added

- Initial public release of ClearPath RAG.
- FastAPI backend with JWT auth, role-based access control, bcrypt password
  hashing, and `slowapi` rate limiting on `/rag/query`.
- Two-database topology: Azure SQL (`ClinicalCases`, embeddings, full-text
  catalog, vector index, stored procedures) + PostgreSQL (`users`,
  `query_logs`, `rag_config`).
- Hybrid retrieval (cosine vector + full-text) fused with Reciprocal Rank
  Fusion, configurable from the admin Settings page.
- GPT-4o grounded generation via `sp_invoke_external_rest_endpoint`.
- React 19 + Vite + TypeScript SPA with TanStack Query, React Router,
  Recharts, Radix UI, and Tailwind CSS v4.
- Pages: Landing, Login, Register, Dashboard, RAG Console, Chat, Search
  Explorer, Logs, Analytics, Settings.
- Ten numbered Azure SQL migration scripts under `sql/`.
- Docker Compose stack: `postgres`, `backend`, `frontend`.
- Pytest suite (in-memory SQLite + mocked Azure SQL).
- Sample data: 207 fictional clinical cases (`data/ClinicalCases.csv`) and
  pre-computed 1536-dim embeddings (`data/ClinicalCaseEmbeddings.csv`).
- Documentation: `README.md`, `docs/architecture.md`, `docs/api.md`,
  `sql/README.md`, `backend/tests/README.md`, and the seven Microsoft
  workshop walkthroughs under `lab/`.

[Unreleased]: ../../compare/main...HEAD
[1.0.0]: ../../releases/tag/v1.0.0
