name: Feature request
description: Suggest a new feature or improvement to ClearPath RAG.
title: "[Feature] "
labels: ["enhancement", "triage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        Tell us what you would like to see and why. The more context you can share
        about your workflow and the problem you are trying to solve, the better.

  - type: textarea
    id: problem
    attributes:
      label: Problem or motivation
      description: What pain point does this address? Who benefits and how?
    validations:
      required: true

  - type: textarea
    id: proposal
    attributes:
      label: Proposed solution
      description: Describe the change you would like to see. Mention specific endpoints, files, or UI screens if relevant.
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: Any other approaches you thought about and why you prefer the proposal above.
    validations:
      required: false

  - type: textarea
    id: scope
    attributes:
      label: Scope and impact
      description: Backend only? Frontend only? Database schema change? New dependency? Affects auth / rate limits?
    validations:
      required: false

  - type: checkboxes
    id: contrib
    attributes:
      label: Contribution
      options:
        - label: I am willing to submit a pull request for this feature.
        - label: I have read the [Contributing guide](CONTRIBUTING.md).
