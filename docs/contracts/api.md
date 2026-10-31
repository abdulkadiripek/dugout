# Contract: board API (read-only)

Served by `packages/server` (`panosu serve`), bound to `127.0.0.1` only. The API is derived solely from the event log directory and `git`. It never writes, never reads `~/.claude/**` or `~/.codex/**`, and never spawns anything except `git` for diffs. Payload schemas are zod in `packages/core`.

## Routes

| Route | Response |
|---|---|
| `GET /api/health` | `{ "ok": true }` |
| `GET /api/tasks?limit=<n>&status=<s>` | `{ "tasks": TaskSummary[] }`, newest first by `task.created.ts`; `limit` default 50, max 500; `status` filters on one status |
| `GET /api/tasks/:id` | `{ "summary": TaskSummary, "events": Event[] }`; for an unreadable log `events` is `[]` |
| `GET /api/tasks/:id/diff` | `{ "diff": string, "truncated": boolean, "bytes": number }` |
| `GET /api/scorecard` | `{ "implementers": ImplementerRow[], "reviewers": ReviewerRow[], "excluded": { "interrupted": number, "unreadable": number } }` |

Errors are JSON `{ "error": string }`: `400` for an invalid id or query (an id must match `[a-zA-Z0-9][a-zA-Z0-9_-]*`; anything else, including `..`, is 400 and never touches the file system), `404` for an unknown task or a task without a branch, `409` for the diff of an unreadable log.

## TaskSummary

`{ taskId, packageId, goal, status, reason?, providers, attempts, startedAt, durationMs, tokens: { input, output }, review: null | { verdict, counts: { blocker, major, minor, nit } }, branch, baseRef }`

- `status`: `passed | needs_review | failed | interrupted | unreadable`. Same derivation as `panosu list` (`cli.md`): `task.finished.status` when present, `interrupted` when the log is valid but has no `task.finished`, `unreadable` (with `reason`) when a line fails to parse, `schemaVersion` is unknown or `seq` is not contiguous.
- `providers`: distinct implementer providers in order of first use. `attempts`: count of `attempt.started`. `durationMs`: `task.finished.durationMs`, `null` for interrupted. `tokens`: sum of `provider.usage` over all attempts. `review`: from the last `review.finished`, else `null`. `branch` / `baseRef` from `worktree.created`.
- For an unreadable log only `taskId` (the file name), `status`, `reason` are meaningful; other fields are neutral (`""`, `[]`, `0`, `null`).

## Diff

`git diff <baseRef>...<branch>` in the repository given to the server (`--repo`), truncated to 200000 bytes on a line boundary with a final line `[diff truncated: <n> bytes omitted]` and `truncated: true`. `bytes` is the full size before truncation.

## Scorecard definitions

Rows are per `provider` + `model` as in `attempt.started` (implementers) and `review.started` (reviewers). Interrupted and unreadable logs are excluded and counted in `excluded`.

Implementer row: `{ provider, model, tasks, passed, firstTryPassRate, meanRetries, meanDurationMs, inputTokens, outputTokens }`
- `tasks`: tasks in which this provider+model ran at least one attempt.
- `passed`: of those, tasks with final status `passed` whose last attempt was by this provider+model.
- `firstTryPassRate`: tasks with final status `passed`, exactly one attempt in total, by this provider+model, divided by `tasks` (0 when `tasks` is 0).
- `meanRetries`: mean over its tasks of the number of its attempts with `reason: retry`.
- `meanDurationMs`: mean over its tasks of the summed `attempt.finished.durationMs` of its attempts.
- tokens: sums of `provider.usage` of its attempts.

Reviewer row: `{ provider, model, reviews, blocker, major, minor, nit }`: number of `review.finished` events and the issue counts they contain.

Rates and means are rounded to 4 decimals; rows are sorted by `tasks` (reviewers: `reviews`) descending, then `provider`, then `model`.
