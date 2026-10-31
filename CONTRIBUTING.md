# Contributing to Dugout

Thanks for looking. This is a small project maintained in spare time, so the rules are simple.

## Issues
Bug reports, questions and ideas are welcome as GitHub issues. A good report has: what you ran, what you expected, what happened, and the relevant lines of the event log (`~/.dugout/events/<task-id>.jsonl`; paths under your home are already shown as `~`). Please check that the log contains nothing private before pasting it.

## Pull requests
Pull requests are welcome but not guaranteed to be merged or reviewed quickly. For anything bigger than a small fix, open an issue first so we can agree on the direction. A pull request should:

- keep the scope small and explain the why;
- pass `pnpm lint && pnpm typecheck && pnpm test && pnpm build` and `node scripts/scan-repo.mjs`;
- come with tests that fail without the change;
- follow `AGENTS.md` (conventions, hard rules) and update the contracts in `docs/contracts/` first when behavior they describe changes.

## Hard rules
- Tests never start the real `claude` or `codex` CLI (`spawnReal` blocks it under vitest); real runs cost subscription quota and are opt-in.
- Do not assert behavior of the official CLIs that has not been observed; record observations with a sanitized sample under `fixtures/providers/`.
- No secrets, personal paths or personal data in commits, fixtures or logs.

## Quick start for development
```
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm demo
```
