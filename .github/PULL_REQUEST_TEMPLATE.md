# Pull Request

Thanks for contributing to ClearPath RAG! Please fill in the sections below so a
reviewer can understand the change and merge it confidently.

## Summary

<!-- One or two paragraphs: what does this PR do and why? -->

## Linked issues

<!-- Fixes #123, Closes #456, or "N/A". Use "Fixes #N" so the issue closes on merge. -->

Fixes #

## Type of change

<!-- Put an `x` in all the boxes that apply. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Database migration (under `sql/`)
- [ ] Dependency upgrade

## How has this been tested?

<!-- Be specific: pytest output, manual reproduction steps, screenshots, etc. -->

- [ ] `cd backend && pytest -v` passes locally
- [ ] `cd frontend && npm run build` passes locally
- [ ] `cd frontend && npm run lint` passes locally
- [ ] Manual testing steps described below

### Test plan

<!--
1. Step
2. Step
3. Expected result
-->

## Screenshots (UI changes only)

<!-- Drag-and-drop images or paste Markdown image links. -->

## Checklist

- [ ] My code follows the style of this project (`CONTRIBUTING.md`)
- [ ] I have performed a self-review of my own code
- [ ] I have commented hard-to-understand areas
- [ ] I have updated the documentation (`README.md` / `docs/`) accordingly
- [ ] I have added tests that prove my fix is effective or my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published downstream
- [ ] I have not committed any secrets, `.env` values, or PHI

## Deployment notes

<!--
Anything the reviewer or operator should know for rollout:
- new env vars
- new Azure RBAC roles
- alembic migrations to run
- breaking changes to the API
-->
