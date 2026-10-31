# ADR 0003: Own event format; no dependence on transcripts

Status: accepted (2026-10-31)

## Context
Claude Code stores session transcripts as JSONL under `~/.claude/projects/`, and Codex keeps local state under `~/.codex/`. Both formats are undocumented and change between versions.

## Decision
The board is driven only by our own versioned event log (`docs/contracts/events.md`) written by the delegate CLI, plus git diffs. Provider output (stream-json / `--json`) is converted to our events inside adapters.

## Alternatives considered
- Parse transcripts directly: gives history of sessions we did not start, but breaks silently on format changes and risks reading sensitive content.
- Hooks in every Claude session: broader coverage, but entangles with other tooling and is out of scope for v1.

## Consequences
Only delegated tasks appear on the board. Adapters are the single place that must follow CLI output changes. Events never contain file contents or prompts.
