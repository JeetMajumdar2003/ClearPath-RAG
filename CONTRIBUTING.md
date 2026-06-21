# Contributing to ClearPath RAG

Thanks for your interest in contributing to ClearPath RAG. This document
explains how to set up your development environment, propose changes, and submit
a pull request that we can review and merge quickly.

> **Code of Conduct**: By participating you agree to abide by our
> [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

---

## Table of contents

1. [Ways to contribute](#ways-to-contribute)
2. [Before you start](#before-you-start)
3. [Development setup](#development-setup)
4. [Project conventions](#project-conventions)
5. [Database / SQL changes](#database--sql-changes)
6. [Running the tests](#running-the-tests)
7. [Commit message conventions](#commit-message-conventions)
8. [Pull request process](#pull-request-process)
9. [Release process](#release-process)

---

## Ways to contribute

You don't have to write code to help. Equally valuable contributions include:

- **Reporting bugs** — use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).
- **Suggesting features** — use the
  [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).
- **Improving documentation** — typos, missing context, broken links, or a
  whole new `docs/` page.
- **Reviewing pull requests** — leave thoughtful comments; you don't need to be
  a maintainer.
- **Answering questions** in Discussions.

---

## Before you start

1. **Search existing issues and PRs** — someone may already be working on it.
   If a related issue exists, drop a comment before opening a new one.
2. **Open an issue first for non-trivial changes.** Anything that touches the
   public REST API, the SQL schema, authentication, or the RAG algorithm
   benefits from a design discussion before code is written.
3. **For security issues**, follow [`SECURITY.md`](SECURITY.md) instead of
   filing a public issue.

---

## Development setup

The fastest path is the same path documented in the
[README → Quick Start (Docker)](README.md#quick-start-docker). The short version:

```bash
git clone https://github.com/<owner>/clearpath-rag.git
cd clearpath-rag
cp .env.example .env
# Fill in SECRET_KEY, SQL_*, AZURE_OPENAI_* at minimum
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.scripts.seed_admin
```

For hot-reload on both processes without Docker, follow
[README → Local Development](README.md#local-development-no-docker).

### Tooling

| Tool | Version | Why |
| --- | --- | --- |
| Python | 3.12 (see `.python-version`) | Backend runtime, pinned in the Dockerfile |
| Node.js | 20 LTS (see `frontend/.nvmrc`) | Frontend runtime |
| Docker | 24+ with Compose v2 | Container orchestration |
| ODBC Driver 18 for SQL Server | latest | Required by `pyodbc` against Azure SQL |
| Git | 2.40+ | Conventional commits, hooks |

---

## Project conventions

### Backend (Python / FastAPI)

- **Style**: PEP 8 plus Black-compatible formatting (line length 100). The CI
  pipeline runs `ruff check` on `backend/app` and `backend/tests`; please run
  it locally before pushing.
- **Type hints**: required on all public functions and Pydantic models.
- **Imports**: `from __future__ import annotations` is fine but not required.
- **Logging**: use `structlog` (not `print`). One log line per business
  operation, including latency, status, and identifying IDs.
- **Errors**: raise typed exceptions, return `{ "detail": "..." }` via FastAPI
  exception handlers. Never leak stack traces to the client.
- **Tests**: every new endpoint or service method gets a pytest case. Use the
  in-memory SQLite fixture from `conftest.py` and `monkeypatch.setattr` to mock
  Azure SQL — see [`backend/tests/README.md`](backend/tests/README.md).

### Frontend (React / Vite / TypeScript)

- **Style**: TypeScript strict mode, React function components + hooks, no
  class components. ESLint config is `frontend/eslint.config.js`; run
  `npm run lint` before pushing.
- **State**: TanStack Query for server state (`@tanstack/react-query`),
  `useState` / `useReducer` for local UI state, React Context for auth.
- **Styling**: Tailwind utility classes; design tokens live in
  `frontend/src/index.css`. Avoid inline `style={...}` for anything cosmetic.
- **Icons**: `lucide-react` only — do not introduce new icon libraries.
- **Routing**: `react-router-dom` v7 — page components live under
  `frontend/src/pages/`. Use `ProtectedRoute` for authenticated pages.
- **API calls**: go through `frontend/src/lib/api.ts` so the JWT interceptor
  and 401 redirect stay consistent.

### Cross-cutting

- **Secrets**: never commit real credentials. Only `.env.example` is tracked.
- **PHI**: never commit real clinical data. The CSV in `data/` is fictional.
- **Dependencies**: prefer adding a dependency to a hacky workaround only when
  the dependency is already in the standard set of the relevant ecosystem.
  Open an issue first if you want to add a new top-level dependency.

---

## Database / SQL changes

ClearPath runs the entire RAG pipeline inside Azure SQL stored procedures. SQL
changes have higher blast radius than Python changes, so:

1. **Numbered migrations**: append the next `NNN_description.sql` file under
   [`sql/`](sql/) and add a row to the `sql/README.md` execution-order table.
2. **Idempotent**: use `IF NOT EXISTS`, `CREATE OR ALTER`, and conditional
   `INSERT`s. The workshop team re-runs scripts on existing databases.
3. **Cross-reference `.env`**: any new placeholder should be added to
   `.env.example` with a sensible default and a `###` section comment.
4. **Re-run `010_verification_queries.sql`** after your script lands; the
   results should be unchanged for existing objects and a non-zero row count
   for newly added data.
5. **Never drop a column or table without a deprecation window** — the Python
   models, the stored procedures, and any analytics queries all reference the
   same schema.

If your change requires a new external model, a new database-scoped credential,
or a new managed-identity role assignment, call this out explicitly in the PR
description so the reviewer can hand off to the platform team.

---

## Running the tests

```bash
# Backend — runs hermetically (SQLite + mocked Azure SQL)
cd backend
pytest -v

# Frontend — type-check + production build + lint
cd frontend
npm run lint
npm run build
```

Both suites run in CI on every push and PR — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Commit message conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) so the
changelog and release notes can be generated automatically. Format:

```
<type>(<scope>): <short imperative summary>

<optional body — explain the "what" and "why", not the "how">

<optional footer — "BREAKING CHANGE: ..." or "Refs #123">
```

Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`.

Examples:

```
feat(rag): add per-query embedding-type override
fix(auth): reject empty passwords with 422 not 500
docs(readme): link to TROUBLESHOOTING.md from the support section
ci(workflows): cache pip by requirements.txt hash
```

---

## Pull request process

1. **Fork and branch** off `main`. Use a descriptive branch name:
   `feat/<short-topic>`, `fix/<short-topic>`, `docs/<short-topic>`.
2. **Keep PRs focused** — one logical change per PR. Refactors that touch
   unrelated code should be split into a separate PR.
3. **Fill in the
   [pull request template](.github/PULL_REQUEST_TEMPLATE.md)** — the
   description, the linked issue, the test plan, and the checklist are how
   reviewers decide whether to merge.
4. **CI must be green** — backend tests, frontend lint, frontend build, and
   docker build must all pass. The PR template's checklist reminds you to
   verify this locally before requesting review.
5. **Address review comments** by pushing new commits to the same branch —
   don't squash mid-review. We'll squash-merge once approved.
6. **No merge commits** from `main` into your feature branch; rebase instead
   (`git fetch origin && git rebase origin/main`).
7. **After merge**, delete the source branch unless it's protected.

A reviewer from the appropriate
[CODEOWNERS](.github/CODEOWNERS) group will be auto-assigned.

---

## Release process

1. Bump versions in `backend/requirements.txt`, `frontend/package.json`, and
   the `app.version` constant surfaced via `/health`.
2. Update [`CHANGELOG.md`](CHANGELOG.md) under a new heading.
3. Tag the release: `git tag -a vX.Y.Z -m "Release X.Y.Z"` and push the tag.
4. The maintainer builds and signs container images, then drafts GitHub
   release notes from the changelog entries.

---

## Questions?

- For setup / usage questions, see [`SUPPORT.md`](SUPPORT.md).
- For bugs, open an issue using the
  [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).
- For security disclosures, see [`SECURITY.md`](SECURITY.md).

Thanks again — your contribution makes ClearPath better for clinicians and
patients everywhere.
