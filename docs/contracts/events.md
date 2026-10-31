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
| `verify.started` | `attempt`, `command` |
| `verify.finished` | `attempt`, `passed`, `exitCode`, `durationMs`, `outputTail` (last ~30 lines) |
| `review.started` | `provider`, `model` |
| `review.finished` | `provider`, `model`, `result` (see `review-result.md`) |
| `task.finished` | `status`, `attempts`, `providers` (distinct, in order of first use), `diffStat` (`files`, `additions`, `deletions`), `durationMs` |

`exitReason` values: see `provider-adapter.md`.

## Lifecycle rules

- A log starts with `task.created` and ends with exactly one `task.finished`.
- `attempt.started` / `attempt.finished` always pair. A retry is a new attempt with the same provider (`reason: retry`); a fallback is a new attempt with a different provider (`reason: fallback`), preceded by `fallback.triggered`.
- `verify.*` runs once after each attempt whose `exitReason` is `ok`.
- `review.*` runs once, after the last passing `verify`, only if `package.review` is true.
- `task.finished.status`:
  - `passed`: `verify` passed and (review off, or verdict `approve`)
  - `needs_review`: `verify` passed but review verdict is `changes_requested`
  - `failed`: `verify` still failing after `max_retries`, or every provider failed

## Privacy

Events must not contain secrets, file contents, prompts, or absolute home paths. Tool summaries are names and relative paths only. The log directory is outside the repo and never committed.
