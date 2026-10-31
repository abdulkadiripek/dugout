# Stage 3 plan: real adapters, review, eval harness

## Goal
`panosu delegate task.md` (without `--scenario`) runs Codex first and Claude Sonnet as fallback against a real worktree, then cross-reviews with the other provider. Every provider behavior used is observed first; everything else stays labeled unverified. An eval harness can run the golden tasks, with fake providers in tests.

## Prerequisite
Stages 1-2 merged. Authorization: the maintainer approved self-approved continuation for all stages on 2026-10-31, including the cheap observation calls below. Rule 1 still holds: cheapest model, one turn, no loops.

## Read first
`AGENTS.md`, `docs/contracts/provider-adapter.md`, `events.md`, `cli.md`, `review-result.md`, `fixtures/providers/**`, `evals/README.md`.

## Decisions (do not reopen)
- **Review embeds the diff in the prompt.** The adapter runs `git diff --cached <baseRef>` itself (truncated to a fixed byte budget with a visible marker) and gives the reviewer no tools: no sandbox dependence, no write risk, same input for both providers.
- **Only observed failure modes are classified.** Non-zero exit, killed by signal and unparsable output map to `crash` and `invalid_output`; `timeout` comes from the adapter's own timer. `rate_limit` and `auth` are **not** detected until a real one is observed; until then they surface as `crash`, which also falls back. The contract states this.
- **Review failure never breaks the log.** If a reviewer throws or returns invalid output, `runTask` emits `review.finished` with verdict `changes_requested` and one `blocker` issue `review unavailable: <reason>`; the task ends `needs_review`. Contract first in `events.md`.
- **Setup step.** A worktree has no `node_modules`. The task package gets an optional `setup` command (run once in the worktree before the first attempt). `runTask` gets an optional `deps.setup`; it emits `setup.finished` (`passed`, `exitCode`, `durationMs`, `outputTail`) after `worktree.created`. A failed setup ends the task `failed` with zero attempts. Contract first in `task-package.md` and `events.md`.
- Adapters live in `packages/cli/src/providers/`, spawn through an injected `spawn` seam so tests replay recorded output. `core` stays free of I/O.

## Steps
1. **Observe (max 3 real calls, cheapest models, throwaway worktrees)**
   - O1 `claude -p` as implementer: `--output-format stream-json --verbose --no-session-persistence`, edit permissions limited with `--permission-mode` / `--allowedTools`; task: create one file. Save a sanitized sample; record event shapes, tool-use items, exit code, whether anything is written outside the worktree.
   - O2 `claude -p --json-schema` as reviewer with the diff in the prompt and no tools.
   - O3 `codex exec --output-schema` as reviewer with the diff in the prompt (`-s read-only`, cheapest model).
   - Update `provider-adapter.md` and `fixtures/providers/` before any adapter code (rule 5).
2. **Contracts**: `setup`, `setup.finished`, review-failure rule, observed flags.
3. **Core changes** (Codex task): setup seam, review-failure handling, schema + fixtures for `setup.finished`.
4. **Adapters** (Codex task): `codex.ts`, `claude.ts`, review prompt builder, process-group kill on timeout/abort, usage mapping, tests replaying the recorded samples.
5. **CLI wiring** (Codex task): real providers when no fake mode; `setup` run through the verify runner; config models.
6. **Eval seeds and hidden checks** for the 8 golden tasks (Codex task), then **`panosu eval`** (Codex task) running the same flow in fake mode in tests.
7. **One live smoke**: a trivial task through `panosu delegate` with the cheapest models (2 calls). Not part of the test suite.

## Acceptance
- Adapter tests replay recorded samples: tool, message and usage events mapped; `ok`, `crash`, `invalid_output`, `timeout` produced as specified; a timeout kills the whole process group.
- Review embeds the diff; truncation marker tested; invalid reviewer output yields the `review unavailable` blocker and `needs_review`.
- `setup` failure ends the task `failed` with no attempts; success is logged.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass on a clean clone.
- Live smoke result documented, including what stayed unverified (rate limit, auth).

## Out of scope
Server, UI, live eval runs of all golden tasks (they cost quota; run later on request), merging worktree branches, MCP.
