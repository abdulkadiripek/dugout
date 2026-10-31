# Contract: `panosu` CLI

The orchestrator calls this through its shell (ADR 0002). Behavior lives in `packages/cli`; orchestration logic lives in `core` (`runTask`).

## Commands

```
panosu delegate <task.md> [--providers <list>] [--scenario <name>] [--events-dir <dir>] [--repo <dir>]
panosu list [--events-dir <dir>] [--limit <n>]
```

| Flag | Meaning | Default |
|---|---|---|
| `--providers` | Comma list overriding `providers` of the package. In Stage 2 only `fake` is accepted. | the package's list |
| `--scenario` | Named scripted outcome for the `fake` provider: `success`, `retry`, `fallback`, `review-issues`, `failed`, `all-failed`. | `success` |
| `--events-dir` | Where event logs are written and read. | `~/.ajan-panosu/events` |
| `--repo` | Repository to create the worktree in. | the git root of the current directory |
| `--limit` | Number of tasks `list` prints, newest first. | `20` |

Real providers (`codex`, `claude`) are refused with exit code 3 until their adapters exist (Stage 3); the message says so.

## `delegate` steps

1. Read and validate the package with `parseTaskPackage`. On failure: print a readable error naming the field, exit 3, write no log and create no worktree.
2. `baseRef` = the current branch name of the repo (the commit hash if HEAD is detached). Uncommitted changes in the main working tree are not part of the worktree; say nothing about them.
3. Task id = `<package id>-<4 hex chars>`. Create the worktree `.worktrees/<task-id>` on branch `panosu/<task-id>` from `baseRef`.
4. Call `runTask` (see `events.md`), appending each event to `<events-dir>/<task-id>.jsonl` as it is emitted.
5. Before every `verify`, stage everything in the worktree (`git add -A`) so the diff against `baseRef` includes new files. `diffStat` is computed from `git diff --cached --numstat <baseRef>`.
6. After `task.finished`, if anything is staged, commit it on the task branch with a fixed identity (`panosu <panosu@localhost>`) and message `panosu: <task id>`. The worktree is left in place. Merging is never done by the CLI.

## Verify runner

Runs `package.verify` with `sh -c` in the worktree; stdout and stderr are merged; `outputTail` is the last 30 lines. Default timeout 10 minutes; a timeout counts as a failed verify with `exitCode` 124. Only the process it started (and its process group) is ever signalled.

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
| 3 | invalid package, bad usage, or unsupported provider |

## `list`

One line per task, newest first: `<task-id>  <status>  <attempts> attempts  <providers>`. A log without `task.finished` is `interrupted`. A log that does not parse (bad line, unknown `schemaVersion`, non-contiguous `seq`) is listed as `unreadable` with the reason; it never aborts the listing.

## Config

`~/.ajan-panosu/config.json` is optional and read-only for the CLI. Keys and defaults are in `provider-adapter.md`. A missing file means defaults; an invalid file is exit 3 with a readable error.
