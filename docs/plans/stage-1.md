# Stage 1 plan: scaffold + core (no model calls)

## Goal
A pnpm TypeScript workspace where `core` defines the schemas, the adapter interface, a scripted `fake` provider, the fallback chain and the verify/retry loop, all covered by tests that use the fixtures. Nothing spawns a real model.

## Read first
- `AGENTS.md`
- `docs/architecture.md`, `docs/glossary.md`
- `docs/contracts/events.md`, `task-package.md`, `provider-adapter.md`, `review-result.md`
- `fixtures/events/*.jsonl`
- `docs/adr/0001-typescript-monorepo.md`, `0004-opus-codex-sonnet.md`, `0006-worktree-per-task.md`

(`docs/adr/0007-lint-tool.md` does not exist yet; creating it is deliverable 2.)

## Decisions already made (do not reopen)
- **Pure core with injected seams.** `core` exposes `runTask(pkg, deps)` where `deps = { now(): Date, newId(): string, adapters, runVerify(cwd, command): Promise<VerifyOutcome>, diffStat(): Promise<DiffStat>, models: { implement, review }, emit(event): void, worktree: { path, branch, baseRef } }`. `core` never writes files, spawns processes or reads the clock itself; `emit` is a sink callback, so tests collect events in an array. `runTask` emits `worktree.created` from the `worktree` dep (the caller, i.e. the CLI in Stage 2, creates the worktree); Stage 1 tests supply a stub.
- **Task package parsing:** `parseTaskPackage(markdown)` in `core`, frontmatter via the `yaml` package (the one allowed runtime dependency besides `zod`).
- **Retry/fallback/failure rules and reviewer selection:** exactly as in `docs/contracts/events.md`. Config defaults and `fake` scenario shape: `docs/contracts/provider-adapter.md`.
- **Toolchain:** Node 26 is installed locally; declare `"engines": { "node": ">=22" }`. CI: `ubuntu-latest`, Node 22, pnpm via corepack. `pnpm build` = `tsc -b` over the packages (the `web` package builds with Vite only from Stage 4; until then it is an empty typecheck-only package).
- **"Structurally equal"** is defined in `events.md`; write the comparison as a test helper.

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
- Every line of every `fixtures/events/*.jsonl` parses with the event schema; `seq` is contiguous; each log starts with `task.created` and ends with one `task.finished`; attempts pair up.
- `runTask` with the matching `fake` scenario produces a log structurally equal (as defined in `events.md`) to each of `success`, `retry`, `fallback`, `review-issues`, `failed` and `all-failed`.
- Rate-limit scenario on the `codex` slot produces `fallback.triggered` then a `claude` attempt with its own retry budget.
- A failing `verify` triggers a retry with the same provider, up to `max_retries`, then `failed` (no fallback).
- `timeout` and `invalid_output` attempts consume retries; `rate_limit`, `auth`, `crash` never do.
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
