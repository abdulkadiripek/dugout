# Architecture

## Flow

```
Orchestrator (Claude Opus session)
   │  writes task.md (task package), calls: panosu delegate task.md
   ▼
panosu CLI ── create git worktree ── .worktrees/<task-id>
   │
   ├─ attempt loop
   │    provider adapter (codex → claude → fake)  ── rate_limit/auth/crash → next provider
   │    verify command in worktree ── fail → feed tail back, retry (≤ max_retries)
   │
   ├─ cross-review by the *other* provider → review result JSON
   │
   └─ append events → ~/.ajan-panosu/events/<task-id>.jsonl
                                  │
Board: Hono API (read-only) ──────┘  + git diff of the worktree
   └─ React UI: task list · task detail · model scorecard
```

The orchestrator receives only: final `status`, attempts, providers used, review verdict and issue counts, and a log path. It never receives diffs or provider transcripts.

## Packages and boundaries

| Package | Responsibility | May depend on |
|---|---|---|
| `packages/core` | zod schemas (event, task package, review), adapter interface, fallback chain, verify/retry loop, scorecard math | nothing in the repo |
| `packages/cli` | `panosu delegate`, `panosu list`, worktree handling, log writing | core |
| `packages/server` | read-only Hono API over the event logs and git | core |
| `packages/web` | React + Vite UI | server over HTTP only |

Process spawning happens only inside provider adapters and the verify runner, never in `core` import paths.

## Key decisions

See `docs/adr/`: TypeScript monorepo (0001), CLI delegation (0002), own event format (0003), Opus → Codex → Sonnet (0004), retrospective first (0005), worktree per task (0006).

## Stages

1. Scaffold + core with `fake` provider (no model calls). Plan: `docs/plans/stage-1.md`.
2. CLI: delegate, worktree, verify loop, event writing, end-to-end with `fake`. Plan: `docs/plans/stage-2.md`.
3. Real adapters (Claude, Codex) after one cheap observed call each; cross-review; eval harness.
4. Board v1: task list, detail, diff, scorecard, `pnpm demo`.
5. Orchestrator integration: instructions for Opus to delegate via task packages; dogfood on this repo.
6. Portfolio polish: README, screenshots, secret scan, license, public remote.
7. Later: live streaming (SSE), controls (stop/retry/approve), MCP wrapper, Beyin receipts.

## Storage

- Events: `~/.ajan-panosu/events/<task-id>.jsonl` (append-only, outside the repo).
- Worktrees: `.worktrees/<task-id>` (git-ignored); removed on request, not automatically.
- No database in v1. The scorecard is computed by scanning logs.

## Failure handling

- A crash mid-task leaves a log without `task.finished`; the board shows it as `interrupted`.
- Only PIDs spawned by this program are ever signalled.
- Unknown `schemaVersion` in a log: skip and show a warning, never guess.
