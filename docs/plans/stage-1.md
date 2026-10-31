# Stage 1 plan: scaffold + core (no model calls)

## Goal
A pnpm TypeScript workspace where `core` defines the schemas, the adapter interface, a scripted `fake` provider, the fallback chain and the verify/retry loop, all covered by tests that use the fixtures. Nothing spawns a real model.

## Read first
- `AGENTS.md`
- `docs/architecture.md`, `docs/glossary.md`
- `docs/contracts/events.md`, `task-package.md`, `provider-adapter.md`, `review-result.md`
- `fixtures/events/*.jsonl`
- `docs/adr/0001-typescript-monorepo.md`

## Deliverables
1. Workspace: `packages/{core,cli,server,web}` as empty-but-buildable packages (only `core` has code), root `tsconfig` with `strict` and `noUncheckedIndexedAccess`, vitest, a lint tool.
2. Lint choice (oxlint vs eslint) with a short note in `docs/adr/0007-lint-tool.md`. Package-boundary rule enforced by lint or `dependency-cruiser` (web must not import server/cli; core imports nothing from the repo).
3. zod schemas in `core`: event (discriminated union on `type`), task package, review result. Types inferred.
4. Adapter interface per `provider-adapter.md`; `fake` provider with scenarios `success`, `fail`, `rate_limit`, `crash`.
5. Fallback chain: provider order from the package; `rate_limit`/`auth`/`crash` → next provider; all failed → task `failed`.
6. Verify/retry loop: `verify` injected as a function (no real shell in core tests); failures feed `outputTail` back; stops at `max_retries`.
7. Status derivation (`passed`/`needs_review`/`failed`) exactly as in `events.md`.
8. CI workflow: lint + typecheck + test + build.
9. `.claude/settings.json` typecheck hook (already present) becomes active once a `tsconfig.json` exists; confirm it works.

## Acceptance (each must be a test)
- Every line of every `fixtures/events/*.jsonl` parses with the event schema; `seq` is contiguous; each log ends with one `task.finished`.
- Rate-limit scenario on `codex` slot produces `fallback.triggered` then a `claude` attempt, matching `fixtures/events/fallback.jsonl` structurally.
- A failing `verify` triggers a retry with the same provider, up to `max_retries`, then `failed`.
- `review: false` skips review; `changes_requested` yields `needs_review`.
- Invalid task packages (missing `acceptance`, path escaping the repo) are rejected with readable errors.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass on a clean clone.

## Out of scope
Real `claude`/`codex` calls, git worktrees, writing log files, the CLI command itself, server and UI code.

## Open decisions to settle in this stage
- Lint tool; boundary enforcement tool.
- zod version and how schemas are exported to other packages.

## Suggested order
workspace → schemas + fixture test → adapter interface + fake → fallback → verify/retry → status derivation → CI.
