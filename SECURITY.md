# Security Policy

ClearPath RAG is a clinical decision support platform. Security bugs are
treated with higher urgency than feature bugs. This document explains how to
report a vulnerability, how we handle disclosures, and the supported versions
that receive fixes.

---

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.** Public
issues let attackers exploit the bug before a fix ships.

Instead, report privately using one of these channels (listed in order of
preference):

1. **GitHub Security Advisories** — go to the **Security** tab of this
   repository and click **"Report a vulnerability"**. This creates a private
   advisory thread visible only to the maintainers.
2. **Email** — send details to the address published in
   [`SUPPORT.md`](SUPPORT.md). Use a subject line that starts with
   `[SECURITY]` so it is triaged promptly.

Please include (see the
[security advisory issue template](.github/ISSUE_TEMPLATE/security_advisory.md)
for the same fields):

- A clear description of the vulnerability and its impact
- Steps to reproduce, including any payloads or request samples
- The affected version(s) or commit SHA(s)
- Any known workarounds or mitigations
- Your name / handle for credit (optional)

---

## What to expect

| Step | Target time |
| --- | --- |
| Acknowledgement of your report | within **3 business days** |
| Initial triage and severity assessment | within **7 business days** |
| Patch for critical-severity issues | within **30 days** |
| Patch for high-severity issues | within **60 days** |
| Public disclosure | coordinated with the reporter after a fix is available |

We follow the
[Coordinated Vulnerability Disclosure](https://cheatsheetseries.owasp.org/cheatsheets/Vulnerability_Disclosure_Cheat_Sheet.html)
model: we will not publicly disclose a vulnerability until a fix is published,
or until 90 days have elapsed from the initial report — whichever comes first.

We are happy to credit reporters in the release notes unless you ask us not to.

---

## Supported versions

| Version | Status | Security fixes |
| --- | --- | --- |
| `main` branch | ✅ Active development | Yes |
| Tagged releases (`vX.Y.Z`) | ✅ Supported for 6 months after release | Yes |
| Older releases | ⚠️ Best effort | Only if the fix is low risk to backport |
| `lab/` directory (workshop materials) | ⚠️ Educational only | No |

---

## Security model — at a glance

ClearPath's defense in depth:

- **Authentication**: JWT (HS256), 24-hour access tokens, bcrypt password
  hashing (cost factor 12).
- **Authorization**: role-based (`admin` / `clinician`) enforced in the API
  dependency layer; admin-only routes are explicit, not implicit.
- **Transport**: TLS 1.2+ required in production. HTTPS only — see the
  production checklist in [`README.md`](README.md#production-checklist).
- **CORS**: explicit allow-list via `CORS_ORIGINS` — no wildcards in production.
- **Rate limiting**: `slowapi` limits `/rag/query` to 10/min/IP.
- **Secrets**: all credentials are injected through environment variables; the
  `.env` file is git-ignored. In production use Azure Key Vault referenced by
  managed identity.
- **SQL injection**: the only SQL the Python backend writes is via Alembic
  migrations and `pyodbc` parameter binding — no string interpolation.
- **Stored-procedure trust boundary**: the FastAPI layer trusts that
  `usp_ClearPath_RAG_Search` returns JSON-safe data; we validate and strip
  anything that looks like a SQL error message before returning it to the
  client.
- **Audit trail**: every RAG query is logged with user, parameters, latency,
  and status to `query_logs` for forensic review.

### Known security-relevant tradeoffs

- **HS256 JWT signing** — chosen for single-service deployment. Move to RS256
  with a managed-identity-issued certificate before introducing a second
  service that needs to verify tokens.
- **Per-process rate limiter (`slowapi`)** — fine for one replica. Replace
  with a Redis-backed store before scaling out horizontally.
- **No PHI in this repository** — `data/ClinicalCases.csv` is fictional seed
  data, but please keep it that way. Real clinical data must never be
  committed, even to a private fork.

---

## Security checklist for contributors

Before opening a pull request, please confirm:

- [ ] I have not added any new third-party dependency without justification.
- [ ] I have not committed any secret, API key, JWT signing key, or
  credential of any kind.
- [ ] I have not introduced `print()` calls that could leak tokens or PHI into
  stdout / logs.
- [ ] I have not weakened CORS, rate limiting, or authentication.
- [ ] New endpoints enforce role-based authorization at the dependency layer.
- [ ] New SQL follows the parameterized-binding pattern in `app/services/`.
- [ ] New env vars are listed in `.env.example` with safe placeholders.

If you are unsure whether something is a security issue, please report it as
one — it is far cheaper for us to triage a non-issue than to chase a real one.

---

## Acknowledgements

We are grateful to the security researchers and clinicians who help keep
ClearPath safe for the patients and providers who depend on it.
