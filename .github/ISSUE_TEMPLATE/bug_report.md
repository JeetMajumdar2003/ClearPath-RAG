name: Bug report
description: Report a defect in ClearPath RAG (backend API, frontend UI, SQL stored procedures, or RAG pipeline).
title: "[Bug] "
labels: ["bug", "triage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to file a bug. Please fill in the sections below
        so we can reproduce and fix it quickly.

  - type: input
    id: env
    attributes:
      label: Environment
      description: How are you running ClearPath? (Docker Compose, local Python venv, Azure deployment)
      placeholder: "docker compose up --build on Windows 11 / Docker 27"
    validations:
      required: true

  - type: dropdown
    id: component
    attributes:
      label: Component
      description: Where did the bug appear?
      options:
        - Backend (FastAPI)
        - Frontend (React)
        - Azure SQL stored procedure
        - RAG pipeline (retrieval or generation)
        - Authentication / authorization
        - Rate limiting / health check
        - Docker / deployment
        - Documentation
        - Other
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: App version / commit SHA
      description: Output of `git rev-parse HEAD` or the image tag you are running.
      placeholder: "main @ a1b2c3d"
    validations:
      required: false

  - type: textarea
    id: reproduce
    attributes:
      label: Steps to reproduce
      description: Minimal, ordered steps that reliably produce the bug.
      placeholder: |
        1. Run `docker compose up --build`
        2. Navigate to http://localhost:5173/login
        3. Sign in with admin@clearpath.local / Admin123!
        4. Go to /app/rag and submit "chest pain radiating to left arm"
        5. Observe 502 error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
      description: What did you expect to happen?
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual behavior
      description: What actually happened? Include the full error message or stack trace.
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Relevant logs
      description: Paste the backend / frontend / docker compose log lines here. Wrap in ``` for formatting.
    validations:
      required: false

  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Screenshots, network traces, browser console output, or anything else relevant.
    validations:
      required: false

  - type: checkboxes
    id: checks
    attributes:
      label: Pre-submission checklist
      options:
        - label: I searched existing issues and this is not a duplicate.
        - label: I have read the [Troubleshooting guide](TROUBLESHOOTING.md) and my issue is not listed there.
        - label: I have reproduced this with the latest `main` branch.
