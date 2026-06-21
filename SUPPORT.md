# Support

Need help with ClearPath RAG? This page points you to the right channel so you
get an answer quickly.

---

## Self-service — please try these first

Most questions are already answered in the repository:

| Resource | What it covers |
| --- | --- |
| [`README.md`](README.md) | Architecture, quick start, full API reference, env vars, deployment |
| [`docs/architecture.md`](docs/architecture.md) | System architecture, two-database rationale, security model |
| [`docs/api.md`](docs/api.md) | Per-endpoint request / response shapes |
| [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) | Symptom → cause → fix for the most common issues |
| [`sql/README.md`](sql/README.md) | Running the Azure SQL migrations |
| [`backend/tests/README.md`](backend/tests/README.md) | How the test suite is structured |

---

## How to get help

Choose the channel that matches the urgency and the audience:

### 💬 Questions and "how do I…" — GitHub Discussions

Best for open-ended questions, configuration advice, and sharing what you've
built. Search first — most questions have already been asked.

👉 Open the **Discussions** tab on this repository.

### 🐛 Bugs and reproducible problems — GitHub Issues

Use the issue templates:

- [Bug report](.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature request](.github/ISSUE_TEMPLATE/feature_request.md)
- [Security advisory](.github/ISSUE_TEMPLATE/security_advisory.md) — see also
  [`SECURITY.md`](SECURITY.md)
- [General question](.github/ISSUE_TEMPLATE/question.md)

Please include the output of:

```bash
docker --version
docker compose version
node --version   # if the question is frontend-specific
python --version # if the question is backend-specific
```

and the relevant log lines (`docker compose logs backend`, browser dev tools,
SQL Server error log, etc.).

### 🔒 Security vulnerabilities — see [`SECURITY.md`](SECURITY.md)

**Do not** file security bugs as public issues. Follow the disclosure process
documented there.

### 📧 Direct contact

For private matters (security disclosure, partnership, licensing, deployment
support contracts) use the email address published in the repository's
`About` panel or the GitHub organization profile.

---

## Response times

This is an open-source project maintained by volunteers. Response times vary:

| Channel | Typical response |
| --- | --- |
| Discussions | best-effort, often within a few days |
| Bug reports (no security impact) | triage within 7 days |
| Security advisories | within 3 business days — see [`SECURITY.md`](SECURITY.md) |
| Direct email | when we can — please prefer the public channels above |

If you need a guaranteed SLA, talk to us about a commercial support contract.

---

## Clinical disclaimer

ClearPath RAG is **clinical decision support**, not a diagnostic device. Every
RAG response carries a disclaimer in the UI. Outputs are generated from a
finite dataset of fictional cases — they are a starting point for clinician
review, not a substitute for it.

> **For real patient care, always rely on your institution's clinical
> guidelines, the patient's own history, and your clinical judgement.**

If you find a case where ClearPath's output could mislead a clinician, please
file a bug — it is the most important kind of feedback this project receives.
