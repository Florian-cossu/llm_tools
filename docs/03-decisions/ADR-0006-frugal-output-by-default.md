---
type: decision
status: accepted
scope: repo
last_reviewed: 2026-08-31
summary: "summary: Tool outputs are filtered through mappers that keep only fields reusable in a subsequent tool call, to fit small local models."
read_when:
  - adding a field to a mapper
  - deciding what a tool should return
  - reviewing a pull request that changes tool output shape
code_refs:
  - tools/github/src/mappers/github_compact_mappers.ts
  - tools/github/src/models/
tags:
  - adr
  - tooling
  - constraints
  - mcp
---
# ADR-0006: Frugal output by default
## Context

[ADR-0004](ADR-0004-server-per-integration.md) stated that each integration should be exposed by a dedicated server that registers its related tools. Since the goal of this project is to run locally on modest machines with small models (< 8B), each token counts.

## Decision

Any tool that outputs data must use a mapper to filter only the fields that are truly essential and may be passed to another tool afterwards.

## Alternatives 

Returning a full API response and trusting the model to filter it. Rejected: a small local model has a limited context window, and every redundant token in a tool result is a token taken away from reasoning. Filtering at the tool boundary is cheaper and deterministic.

## Consequences

- Each field in a mapper must be useful to a subsequent call.
- Non-reusable identifiers and fields that can be reconstructed programmatically are banned by default (`node_id`, GitHub URLs, etc.).
- Null values take precedence over missing fields — the model must know the field exists but is empty, not wonder whether it was omitted.