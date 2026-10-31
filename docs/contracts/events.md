# Contract: event log

One JSON object per line in `~/.ajan-panosu/events/<task-id>.jsonl`, appended in order. The board and the model scorecard are derived only from these files and from git diffs. Examples: `fixtures/events/*.jsonl`.

## Envelope (every event)

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | `1` | Bumped on breaking change; readers must reject unknown versions. |
| `seq` | integer, from 0, +1 per event | Ordering; gaps mean a corrupt log. |
| `ts` | ISO 8601 UTC string | When the event was written. |
| `taskId` | string | `<package id>-<short random>`; also the log file name. |
| `type` | string | One of the types below. |

Type-specific fields are flat next to the envelope.

## Types

| `type` | Extra fields |
|---|---|
| `task.created` | `package` (the validated task package object) |
| `worktree.created` | `path`, `branch`, `baseRef` |
| `attempt.started` | `attempt` (int from 1), `reason` (`initial` \| `retry` \| `fallback`), `provider`, `model` |
| `provider.tool` | `attempt`, `name`, `summary` (short; never file contents) |
| `provider.message` | `attempt`, `text` (truncated to 500 chars) |
| `provider.usage` | `attempt`, `inputTokens`, `outputTokens` (omit if the provider does not report them) |
| `attempt.finished` | `attempt`, `status` (`completed` \| `failed`), `exitReason`, `durationMs` |
| `fallback.triggered` | `from`, `to`, `reason` (`rate_limit` \| `auth` \| `crash`) |
| `setup.finished` | `passed`, `exitCode`, `durationMs`, `outputTail` (optional: only when the package has a `setup` command; follows `worktree.created`) |
| `verify.started` | `attempt`, `command` |
| `verify.finished` | `attempt`, `passed`, `exitCode`, `durationMs`, `outputTail` (last ~30 lines) |
| `review.started` | `provider`, `model` |
| `review.finished` | `provider`, `model`, `result` (see `review-result.md`) |
| `task.finished` | `status`, `attempts`, `providers` (implementers only: distinct providers that ran an attempt, in order of first use; the reviewer is recorded in `review.*`), `diffStat` (`files`, `additions`, `deletions`), `durationMs` |

`exitReason` values: see `provider-adapter.md`.

## Lifecycle rules

- A log starts with `task.created` and ends with exactly one `task.finished`. If `setup.finished` has `passed: false`, the task ends `failed` with zero attempts and no `attempt.*` events.
- `attempt.started` / `attempt.finished` always pair. A retry is a new attempt with the same provider (`reason: retry`); a fallback is a new attempt with a different provider (`reason: fallback`), preceded by `fallback.triggered`.
- `verify.*` runs once after each attempt whose `exitReason` is `ok`.
- `review.*` runs once, after the last passing `verify`, only if `package.review` is true. If the reviewer throws or returns invalid output, `runTask` still writes `review.finished` with verdict `changes_requested` and a single `blocker` issue `{ file: ".", message: "review unavailable: <reason>" }`; the task ends `needs_review`.
- `task.finished.status`:
  - `passed`: `verify` passed and (review off, or verdict `approve`)
  - `needs_review`: `verify` passed but review verdict is `changes_requested`
  - `failed`: `verify` still failing after `max_retries`, or every provider failed

## Retry and failure accounting

- `max_retries` counts attempts with `reason: retry`, **per provider**. A `fallback` attempt is not a retry and gets its own retry budget.
- A retry is triggered by a failed `verify`, or by an attempt that ended `timeout` or `invalid_output`. The failed verify's `outputTail` (or the exit reason) is fed back to the same provider.
- `rate_limit`, `auth`, `crash` never consume retries; they trigger fallback to the next provider in `package.providers`.
- When a provider's retry budget is exhausted while `verify` still fails, the task ends `failed`. Failing tests are not a provider outage, so there is no fallback in this case.
- The same holds when the budget is exhausted on `timeout` or `invalid_output`: the task ends `failed`, no fallback.
- When no provider is left after fallbacks, the task ends `failed`. In that case no `fallback.triggered` is written for the missing provider (see `all-failed.jsonl`).
- A fallback attempt gets the original prompt, without feedback from the previous provider's attempts.
- `runTask` in `core` emits `worktree.created` itself, from the `worktree` dependency it is given (the caller creates the worktree). `diffStat` and model names also come in as dependencies; `core` never runs git or reads config.
- Examples: `retry.jsonl` (retry then pass), `failed.jsonl` (budget exhausted), `all-failed.jsonl` (no provider left).

## Reviewer selection

The reviewer is the first provider in `package.providers` that differs from the provider of the last attempt. If there is no different provider (single-provider list, or `fake` only), the same provider reviews. The model comes from config (`provider-adapter.md`).

## Structural equality (for tests)

Two logs are structurally equal when, after dropping all `provider.tool`, `provider.message` and `provider.usage` events from both (what a provider did inside an attempt varies; the scripted `fake` cannot reproduce it), the remaining events match event by event on `type` and these fields: `attempt`, `reason`, `provider`, `status`, `exitReason`, `from`, `to`, `passed`, `exitCode`, `verdict`, `attempts`, `providers`. `ts`, `taskId`, `seq` values, durations, token counts, `outputTail` text, paths and review prose are ignored.

## Privacy

Events must not contain secrets, file contents, prompts, or absolute home paths. The CLI enforces the last part: before a line is written, the event writer replaces the user's home directory (a path prefix match on `/`-boundaries) with `~` in every string value of the event, including `outputTail` and `provider.message` text (found while dogfooding: test runners print the working directory). Tool summaries are names and relative paths only. The log directory is outside the repo and never committed.
