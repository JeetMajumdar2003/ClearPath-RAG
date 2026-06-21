name: Security advisory
description: Report a security vulnerability privately. Do NOT file public bugs for security issues.
title: "[Security] "
labels: ["security", "triage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ⚠️ Please **do not** disclose the vulnerability publicly until we have acknowledged
        and shipped a fix. See [SECURITY.md](../SECURITY.md) for the full disclosure policy.

  - type: textarea
    id: summary
    attributes:
      label: Vulnerability summary
      description: One-paragraph description of the issue and its impact.
    validations:
      required: true

  - type: textarea
    id: repro
    attributes:
      label: Reproduction steps
      description: How to reproduce the issue, including any payloads.
    validations:
      required: true

  - type: textarea
    id: impact
    attributes:
      label: Impact
      description: What can an attacker do? What data is exposed? Is authentication required?
    validations:
      required: true

  - type: input
    id: env
    attributes:
      label: Affected versions / commit SHA
      placeholder: "v1.2.0 @ a1b2c3d, main @ d4e5f6g"
    validations:
      required: true

  - type: textarea
    id: mitigation
    attributes:
      label: Suggested mitigation or fix
      description: Optional. If you have a patch idea or workaround, share it.
    validations:
      required: false
