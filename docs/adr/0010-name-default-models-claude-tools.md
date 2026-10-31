# ADR 0010: Name, default models and Claude tool permissions

Status: accepted (2026-10-31)

## Context
Before publishing, the project needed a public name, sensible defaults for other users' subscriptions, and a position on how much a Claude implementer may run.

## Decision
- **Name: Dugout** (the manager's shelter at a ballpark: the orchestrator watches from the dugout, sends players in, substitutes when one runs out of steam, keeps the scoreboard). Command `dugout` (`dugout-serve` for the API), packages `@dugout/*`, task branches `dugout/<task-id>`, data in `~/.dugout`. A web and registry search found no AI-agent product with this name; unrelated projects with the name exist (container dev-environment wrappers, an old MongoDB log tool).
- **Default models:** Codex implementation and review use `gpt-6.1-sol`. The larger `gpt-6-astra` consumed far more tokens in practice and stays available through config.
- **Claude tool permissions:** the implementer gets `Write Edit Read` by default. Extra patterns (for example `Bash(pnpm *)`) are an explicit opt-in through `claude.allowedTools` in `~/.dugout/config.json`, because the Claude side has no sandbox and `--permission-mode acceptEdits` already allows basic filesystem commands in the working directory (observed, see `docs/contracts/provider-adapter.md`).
- **License:** MIT.

## Alternatives considered
- Keeping the Turkish name: fine for the author's context, harder for an international audience.
- Giving Claude `Bash(pnpm *)` by default: faster runs, but it widens what a model can execute for every user; the speed-up is one config line away.

## Consequences
Everything user-facing and in the contracts uses the new name; earlier ADRs keep their text. Users who want maximum speed enable Bash patterns knowingly.
