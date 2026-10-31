# ADR 0002: Delegate through a CLI, not MCP

Status: accepted (2026-10-31)

## Context
The orchestrator (Claude Code) must hand tasks to other agents. Options: a shell command, or an MCP tool. Codex has no MCP server mode (`codex mcp` only manages external servers).

## Decision
`dugout delegate <task.md>` is a plain CLI the orchestrator calls through its shell. The CLI is deterministic code: fallback, verify and review logic live there, not in the orchestrator's prompt.

## Alternatives considered
- MCP server exposing a `delegate` tool: nicer integration, but tool definitions occupy the orchestrator's context permanently and add a layer before the core works.
- Orchestrator calls `codex`/`claude` directly: pushes fallback and verify logic into prompts, which drift and burn tokens.

## Consequences
Easy to test without any model. An MCP wrapper can be added later on top of the same core without changing behavior. The orchestrator needs a short instruction on how to write task packages (Stage 5).
