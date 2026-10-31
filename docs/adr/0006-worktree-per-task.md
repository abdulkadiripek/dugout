# ADR 0006: One git worktree per task

Status: accepted (2026-10-31)

## Context
Implementers edit files. Running them in the main working tree risks clobbering the maintainer's work and makes diffs and rollback unclear.

## Decision
Each task runs in `.worktrees/<task-id>` on branch `dugout/<task-id>`, created from a recorded base ref. Verify and review run there. The diff against the base ref is the unit of review. Worktrees are removed on request, never automatically.

## Alternatives considered
- Edit in place with git stash: fragile, no isolation between parallel tasks.
- Temporary copy of the repo: loses git history and is slow for large repos.

## Consequences
Parallel tasks are safe. Hooks and per-project settings may behave differently in a worktree cwd (unverified; check in Stage 3). Merging the branch is a separate, human-approved step.
