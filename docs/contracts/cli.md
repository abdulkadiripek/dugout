# Contract: `panosu` CLI

The orchestrator calls this through its shell (ADR 0002). Behavior lives in `packages/cli`; orchestration logic lives in `core` (`runTask`).

## Commands

```
panosu delegate <task.md> [--providers <list>] [--scenario <name>] [--events-dir <dir>] [--repo <dir>]
panosu list [--events-dir <dir>] [--limit <n>]
```

| Flag | Meaning | Default |
|---|---|---|
| `--providers` | Comma list overriding `providers` of the package: `codex`, `claude` or `fake`. `fake` cannot be mixed with the others. | the package's list |
| `--scenario` | Fake mode: every provider of the package is replaced by a scripted `fake` adapter following this scenario: `success`, `fallback`, `review-issues`, `all-failed`. | none |
| `--events-dir` | Where event logs are written and read. | `~/.ajan-panosu/events` |
| `--repo` | Repository to create the worktree in. | the git root of the current directory |
| `--limit` | Number of tasks `list` prints, newest first. | `20` |

Fake mode is on when `--scenario` or `--providers fake` is given (`--providers fake` alone means scenario `success`). Without either, the package's providers run for real: `codex` and `claude` spawn the official CLIs (commands in `provider-adapter.md`) and spend subscription quota. A package listing `fake` together with another provider, without fake mode, is exit 3.

Scenarios script only the adapters (exit reasons and the review verdict); **`verify` always runs the package's real command** in the worktree. So a retry or a `failed` task comes from a verify command that fails, not from a scenario name. A scenario lists outcomes per provider position and the positions map to the package's provider list in order: `success` = position 0 always `ok`; `fallback` = position 0 `rate_limit`, position 1 `ok`; `all-failed` = position 0 `rate_limit`, position 1 `auth`; `review-issues` = like `success` with the review verdict `changes_requested`. A scenario that needs more positions than the package has providers is exit 3. "Always `ok`" means at least 6 outcomes, enough for any `max_retries`.

## `delegate` steps

1. Read and validate the package with `parseTaskPackage`. On failure: print a readable error naming the field, exit 3, write no log and create no worktree.
2. `baseRef` = the current branch name of the repo (the commit hash if HEAD is detached). Uncommitted changes in the main working tree are not part of the worktree; say nothing about them.
3. Task id = `<package id>-<4 hex chars>`. Make sure `.worktrees/` is listed in the repo's `info/exclude` (never touch tracked files or `.gitignore`). Create the worktree `.worktrees/<task-id>` on branch `panosu/<task-id>` from `baseRef`. `worktree.path` in events stays repo-relative; the CLI resolves it against the repo root before giving a `cwd` to adapters or the verify runner.
4. If the package has `setup`, `runTask` runs it once in the worktree through the same runner as `verify` (same timeout) before the first attempt; a failing setup ends the task `failed` with zero attempts (see `events.md`).
5. Call `runTask` (see `events.md`), appending each event to `<events-dir>/<task-id>.jsonl` as it is emitted.
6. Before every `verify`, stage everything in the worktree (`git add -A`) so the diff against `baseRef` includes new files. `diffStat` is computed from `git diff --cached --numstat <baseRef>`.
7. After `task.finished`, if anything is staged, commit it on the task branch with a fixed identity (`panosu <panosu@localhost>`) and message `panosu: <task id>`. The worktree is left in place. Merging is never done by the CLI.

## Verify runner

Runs `package.verify` with `sh -c` in the worktree; stdout and stderr are merged; `outputTail` is the last 30 lines. Default timeout 10 minutes; a timeout counts as a failed verify with `exitCode` 124. Only the process it started (and its process group) is ever signalled. On `SIGINT`/`SIGTERM` the CLI stops its running verify process group, writes nothing more (no `task.finished`, so `list` shows `interrupted`) and exits 130.

## Output (stdout)

Exactly this block, nothing else (no diff, no transcript, no file contents):

```
task: <task-id>
status: passed | needs_review | failed
attempts: <n>
providers: <comma list>
review: approve | changes_requested | skipped (blocker <n>, major <n>, minor <n>, nit <n>)
log: <path>
```

The `review` counts are present only when a review ran. Any absolute path under the user's home directory is printed with a leading `~`. Errors go to stderr.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | `passed` |
| 1 | `needs_review` |
| 2 | `failed` |
| 3 | invalid package, bad usage, an invalid provider combination, or a scenario that runs out of outcomes |
| 130 | interrupted by `SIGINT`/`SIGTERM` |

## `list`

One line per task, newest first: `<task-id>  <status>  <attempts> attempts  <providers>`. A log without `task.finished` is `interrupted`. A log that does not parse (bad line, unknown `schemaVersion`, non-contiguous `seq`) is listed as `unreadable` with the reason; it never aborts the listing.

## Config

`~/.ajan-panosu/config.json` is optional and read-only for the CLI. Keys and defaults are in `provider-adapter.md`. A missing file means defaults; an invalid file is exit 3 with a readable error.
