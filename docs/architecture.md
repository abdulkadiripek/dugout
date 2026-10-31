# Architecture

## Flow

```
Orchestrator (Claude Opus session)
   │  writes task.md (task package), calls: dugout delegate task.md
   ▼
dugout CLI ── create git worktree ── .worktrees/<task-id>
   │
   ├─ attempt loop
   │    provider adapter (codex → claude → fake)  ── rate_limit/auth/crash → next provider
   │    verify command in worktree ── fail → feed tail back, retry (≤ max_retries)
   │
   ├─ cross-review by the *other* provider → review result JSON
   │
   └─ append events → ~/.dugout/events/<task-id>.jsonl
                                  │
Board: Hono API (read-only) ──────┘  + git diff of the worktree
   └─ React UI: task list · task detail · model scorecard
```

The orchestrator receives only: final `status`, attempts, providers used, review verdict and issue counts, and a log path. It never receives diffs or provider transcripts.

## Packages and boundaries

| Package | Responsibility | May depend on |
|---|---|---|
| `packages/core` | zod schemas (event, task package, review), adapter interface, fallback chain, verify/retry loop, scorecard math | nothing in the repo |
| `packages/cli` | `dugout delegate`, `dugout list`, worktree handling, log writing | core |
| `packages/server` | read-only Hono API over the event logs and git | core |
| `packages/web` | React + Vite UI | server over HTTP only; `import type` from core is allowed (types only, no runtime import) |

Process spawning happens only inside provider adapters and the verify runner, never in `core` import paths.

## Key decisions

See `docs/adr/`: TypeScript monorepo (0001), CLI delegation (0002), own event format (0003), Opus → Codex → Sonnet (0004), retrospective first (0005), worktree per task (0006), lint tool (0007), review embeds the diff and observed failures only (0008), board UI (0009).

## Stages

1. Scaffold + core with `fake` provider. Done.
2. CLI: delegate, worktree, verify loop, event writing, end-to-end with `fake`. Done.
3. Real adapters (Claude, Codex), cross-review, `dugout eval` with five runnable golden tasks. Done (real rate-limit and review-unavailable paths observed live).
4. Board: read-only API, scorecard math, React UI, `pnpm demo`. Done.
5. Orchestrator integration: `docs/orchestrator-guide.md`, dogfood on this repo. Two real runs done; a successful Codex-first run with a live cross-review awaits Codex quota.
6. Portfolio polish: README and screenshots done, secret scan in CI done. Open and owned by the maintainer: license, repository name, public remote, git history cleanup (`docs/release-checklist.md`).
7. Later: live streaming (SSE), controls (stop/retry/approve), MCP wrapper, Beyin receipts.

## Storage

- Events: `~/.dugout/events/<task-id>.jsonl` (append-only, outside the repo).
- Worktrees: `.worktrees/<task-id>` (git-ignored); removed on request, not automatically.
- No database in v1. The scorecard is computed by scanning logs.

## Failure handling

- A crash mid-task leaves a log without `task.finished`; the board shows it as `interrupted`.
- Only PIDs spawned by this program are ever signalled.
- Unknown `schemaVersion` in a log: skip and show a warning, never guess.
