# ADR 0004: Opus orchestrates, Codex implements first, Sonnet is the fallback

Status: accepted (2026-10-31)

## Context
The maintainer has a Claude Pro subscription (tight limits) and a Codex subscription. Most token cost is re-reading context on every call, so an expensive orchestrator doing implementation is wasteful.

## Decision
Claude Opus is always the orchestrator and stays thin. Implementation goes to Codex first (default model: see ADR 0010). When the Codex adapter reports `rate_limit`, `auth` or `crash`, the next provider (Claude Sonnet) takes over. The other provider performs cross-review.

## Alternatives considered
- Everything on Claude: simplest, exhausts the Pro limit fastest.
- Everything on Codex: loses the independent reviewer and the fallback.

## Consequences
Whether `claude -p` draws from the same quota as interactive sessions is unverified. Real rate-limit signals for both CLIs are unknown until observed; detection is only guaranteed for the `fake` provider at first. Model names come from configuration, not hardcoded constants.
