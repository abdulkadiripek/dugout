# Stage 2 plan: CLI `panosu delegate` (still no model calls)

## Goal
`panosu delegate task.md` runs a task package end-to-end with the `fake` provider: validates the package, creates a git worktree, runs attempts with fallback and retry, runs verify in the worktree, runs cross-review (fake), writes the event log, and prints a short result for the orchestrator.

## Prerequisite
Stage 1 merged: schemas, adapter interface, fake provider, fallback and verify loop in `core`.

## Read first
- `AGENTS.md`
- `docs/contracts/events.md`, `task-package.md`, `provider-adapter.md`
- `docs/adr/0002-cli-delegation.md`, `0006-worktree-per-task.md`
- `docs/architecture.md` (flow and storage)

## Deliverables
1. `panosu delegate <task.md> [--providers fake] [--events-dir <dir>]`: parse frontmatter, validate, run.
2. Worktree creation and cleanup helpers (real `git worktree` against a temp repo in tests).
3. Verify runner that executes the package's `verify` command in the worktree with a timeout and captures the output tail.
4. Event writer: append-only JSONL, `seq` assigned by the writer, `schemaVersion: 1`, atomic enough that a crash leaves a valid prefix.
5. Orchestrator-facing output: one short block with `status`, attempts, providers, review verdict + issue counts, log path. No diff, no transcript.
6. `panosu list`: recent tasks from the events directory.
7. Exit codes: 0 `passed`, 1 `needs_review`, 2 `failed`, 3 invalid package / usage.

## Acceptance (each must be a test)
- Delegating a valid package with the `fake` `success` scenario yields a log structurally equal to `fixtures/events/success.jsonl` (ignoring ids and timestamps).
- `rate_limit` scenario yields the fallback log shape; failing verify yields the retry log shape.
- The worktree exists during the run, is on branch `panosu/<task-id>`, and the main working tree is untouched.
- Killing the process mid-run leaves a log without `task.finished`; `panosu list` shows it as `interrupted`.
- The output never contains file contents or absolute home paths.
- Invalid package exits 3 and writes no log.

## Out of scope
Real adapters, eval harness, server, UI, merge of worktree branches.

## Notes
- Use a temp events dir in tests; never touch `~/.ajan-panosu` from tests.
- Only terminate processes this program spawned.
