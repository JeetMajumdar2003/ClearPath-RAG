# Pull request description template for gh CLI users.
# Most PRs should still use .github/PULL_REQUEST_TEMPLATE.md via the web UI.

## What

<!-- One sentence: what does this PR do? -->

## Why

<!-- One sentence: why is it needed? -->

## How

<!-- Bullet list of the key implementation decisions. -->

## Testing

- [ ] `cd backend && pytest -v`
- [ ] `cd frontend && npm run lint && npm run build`

## Risk

<!-- Low / Medium / High + one-sentence rationale. -->

## Checklist

- [ ] Linked to an issue (`Fixes #…`)
- [ ] No secrets, PHI, or `.env` values
- [ ] Updated docs / changelog if behavior changed
