# Stage 4 plan: board backend now, UI after the design choice

## Goal
A read-only HTTP API over the event logs and task-branch diffs, and the scorecard math in `core`, both fully testable without a browser. The UI waits for the visual direction (`docs/design.md` forbids UI work before it is chosen); this stage ends with two clickable prototypes so the maintainer only has to pick.

## Prerequisite
Stages 1-3 merged. Fixtures: `fixtures/events/*.jsonl` (including the real `real-codex-claude.jsonl`).

## Decisions (do not reopen)
- Source of truth is the event log directory and git (ADR 0003). The server never reads `~/.claude/**` or `~/.codex/**`, never writes, never spawns anything except `git` for diffs.
- **Task status** shown by the API is `passed | needs_review | failed | interrupted | unreadable`, derived exactly as `cli.md` (`list`) does; the listing code is shared, not duplicated (move it into `core` as a pure function over parsed events, I/O stays in `cli`/`server`).
- **Scorecard math** is a pure function in `core`: `computeScorecard(tasks)` grouped by `provider/model` (implementers) with: tasks, passed, first-try pass rate (passed with exactly one attempt of that provider), mean retries, mean duration, input/output tokens, review issues found per severity (as reviewer). Interrupted and unreadable logs are excluded and counted separately.
- Server: Hono on `@hono/node-server`, one dependency pair with a stated reason (small, typed, Web-standard). Port from `--port` (default 4317), events dir from `--events-dir`, repo from `--repo`; binds to 127.0.0.1 only.
- Diffs: `git diff <baseRef>...panosu/<task-id>` in the repo recorded by the log's `worktree.created` (repo-relative branch), truncated to a fixed byte budget with a visible marker; never served for unreadable logs.

## Steps
1. **Contract** `docs/contracts/api.md`: routes, JSON shapes (zod in core), errors, limits.
2. **Core**: `summarizeLog(events)` (status, attempts, providers, duration, tokens, review verdict), `computeScorecard`, schemas for the API payloads; tests against all fixtures.
3. **Server**: `GET /api/tasks`, `GET /api/tasks/:id` (events + summary), `GET /api/tasks/:id/diff`, `GET /api/scorecard`, `GET /api/health`; path-traversal safe task ids; tests with temp events dirs and a real temp git repo.
4. **Entry point**: `panosu-serve` (bin of `packages/server`, plus a root script `pnpm serve`); `cli` does not depend on `server`. `pnpm demo` stays a Stage-4b item (needs the UI).
5. **Prototypes**: two self-contained static HTML prototypes of the task list, task detail and scorecard built from fixtures (dark/dense and airy/visual), under `docs/design/prototypes/`; no framework. The maintainer picks; `docs/design.md` is then completed.

## Acceptance
- `computeScorecard` and `summarizeLog` reproduce hand-computed numbers for the fixtures.
- Every route has tests, including: unknown id 404, id with `..` rejected, unreadable log reported not thrown, diff truncation, localhost-only bind.
- No route performs writes; a grep-style test asserts the server package has no `fs` write calls.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass on a clean clone.

## Out of scope
The React UI, `pnpm demo`, live streaming, any control actions.
