# Orchestrator guide: delegating with `panosu`

For the orchestrator agent (Claude Opus in this project). Goal: spend the orchestrator's context on decisions, not on code. The implementer never sees this conversation, so everything it needs goes into a task package.

## When to delegate
Delegate when the work is a bounded change with a command that proves it (tests, typecheck, a script). Do not delegate when the outcome cannot be checked by a command, when the request is ambiguous (ask the maintainer first), or when it needs the maintainer's product decision.

## Write the package
Format and fields: `docs/contracts/task-package.md`. Rules of thumb:
- `goal`: the outcome, one or two sentences. No implementation steps.
- `files_to_read`: exact files, short. `constraints`: what must not change.
- `acceptance`: each item checkable by a command or a test; if you cannot write one, the task is not ready.
- `verify`: one command, exit 0 means done. `setup`: only when the worktree needs preparation (for example `pnpm install --offline --frozen-lockfile`).
- Set `max_retries` (default 2) and `providers` (default `[codex, claude]`; Codex first, Claude as fallback).
- The frontmatter is YAML. Items that start with a backtick or contain `: ` break it (found while dogfooding). Wrap every list item in double quotes (escape inner quotes), or write them as JSON strings. `panosu delegate` rejects an invalid package with exit 3 before creating anything.
- Commit the package before running if it lives in the repo: the worktree is created from the committed `baseRef`.

## Run
```
panosu delegate task.md [--events-dir <dir>] [--repo <dir>]
```
Real runs spend subscription quota. Fake mode (`--scenario success`) costs nothing and is for testing the flow. `panosu eval` needs an explicit `--providers` or `--scenario`.

## Read the result
Stdout is one short block (`cli.md`): status, attempts, providers, review verdict with issue counts, log path. Exit code: 0 passed, 1 needs_review, 2 failed, 3 invalid input, 130 interrupted. You never receive the diff or the transcript.
- `passed`: the verify command passed and the reviewer approved. Still read the diff before merging (`git diff <baseRef>...panosu/<task-id>`), because the reviewer saw only the diff and the acceptance list.
- `needs_review`: verify passed but the reviewer asked for changes (or the review was unavailable: the issue says so). Read the issues in the log, then either fix with a new package or accept consciously.
- `failed`: verify never passed within the retry budget, or every provider failed. Read the last `verify.finished` output tail and `fallback.triggered` events in the log before deciding; do not just retry the same package.
- `panosu list` shows recent tasks; a task without `task.finished` is `interrupted`.

## After the run
The result is a commit on branch `panosu/<task-id>` in `.worktrees/<task-id>`. Nothing is merged for you. The maintainer approves merges; explain the diff (what and why) when asking. Remove worktrees only on request.

## Provider limits
If Codex reports its usage limit, the run falls back to Claude Sonnet by itself (visible as `fallback.triggered`). If both are exhausted the task fails with `all providers failed`; wait for the reset time shown to the maintainer rather than retrying in a loop.

## Hard limits for the orchestrator
Never run `claude -p` or `codex exec` directly for implementation, never write into `~/.claude` or `~/.codex`, never kill processes by pattern, never run agents in the main working tree. See `AGENTS.md`.
