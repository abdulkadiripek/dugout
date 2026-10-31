# Product requirements

## Problem

A developer who works with several coding agents under personal subscriptions hits two walls:
1. **Quota and quality.** One expensive orchestrator doing everything burns the subscription limit, while a stronger implementer model sits unused.
2. **Visibility.** Once work is delegated across providers, worktrees and retries, it is hard to see what actually happened, which model did well, and what it cost.

## Users

- Primary: the maintainer, a student developer running Claude Code (Pro) and Codex (ChatGPT subscription) on one machine.
- Secondary: other developers who run official coding-agent CLIs under their own subscriptions and want a small, readable reference implementation.

## Goals

1. Orchestrator (Claude Opus) stays thin: it writes a task package and reads a short verdict.
2. Implementation goes to the strongest available model first (Codex `gpt-6-astra`) and degrades gracefully to Claude Sonnet when the limit is reached.
3. Every delegated task is verified by the task's own test command and cross-reviewed by the other provider before the orchestrator sees it.
4. Every task leaves a complete, privacy-safe event log; a local web board shows tasks, attempts, diffs and a per-model scorecard.
5. The repo is small, readable and public: a portfolio piece that teaches how such a system is built.

## Non-goals

- Not a replacement for T3 Code or OpenRig: no multi-agent team topology, no persistent "seats", no mobile app, no remote access, no accounts.
- No live control of agents in v1 (stop / retry / approve come later).
- No token or credential extraction; no unofficial endpoints.
- No cloud service, no telemetry, no database server.
- No dependence on undocumented transcript formats (`~/.claude/projects/**`, `~/.codex/**`).

## Success criteria

- A task package delegated with `panosu delegate` completes end-to-end with the `fake` provider in tests, including rate-limit fallback and verify retries.
- Real Codex and Claude runs produce valid event logs (after Stage 3).
- `pnpm demo` shows the board from fixtures with no model calls, on a fresh clone.
- Model scorecard answers "which provider passes first try more often, at what retry and token cost" from the golden task set.
- The maintainer can read and explain every non-trivial module.

## Constraints

- Local only (Linux, Node + pnpm). Official CLIs as child processes.
- Subscription quota is the scarce resource: real calls are opt-in and cheap by default.
- Public repository: no personal data, no secrets, English documentation.
