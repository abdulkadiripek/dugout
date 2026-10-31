---
id: server-api
goal: Implement the read-only board API of docs/contracts/api.md in packages/server with Hono, plus the `dugout-serve` entry point, tested without a browser.
files_to_read:
  - AGENTS.md
  - docs/contracts/api.md
  - docs/contracts/cli.md
  - docs/plans/stage-4.md
  - packages/server/package.json
  - packages/server/tsconfig.json
  - packages/core/src/index.ts
  - packages/core/src/summary.ts
  - packages/core/src/scorecard.ts
  - packages/core/src/api-schemas.ts
  - packages/cli/src/list.ts
  - packages/cli/src/worktree.ts
  - packages/cli/src/test-helpers.ts
constraints:
  - Only add or edit files under packages/server/src. Do not touch package.json (hono and @hono/node-server are already installed; core is a workspace dependency), the lockfile, tsconfig, other packages or docs. Do not import from packages/cli or packages/web (package boundary); duplicate tiny helpers if needed.
  - The server is strictly read-only: no file writes of any kind, no process spawning except `git` through execFile with an argument array (never a shell string). Never read anything under ~/.claude or ~/.codex. Task ids from URLs must be validated against `[a-zA-Z0-9][a-zA-Z0-9_-]*` before any file system access. `baseRef` and `branch` come from log content: validate them (`^[A-Za-z0-9][A-Za-z0-9._/-]*$`, no `..`) and pass them to git after `--end-of-options` or equivalent so they can never be read as options; an invalid value gives 404 for the diff.
  - Bind to 127.0.0.1 only (not 0.0.0.0, not localhost wildcard). No CORS headers. No new dependencies. No any. No comments unless explaining a non-obvious why. ESM NodeNext, relative imports end in .js.
  - Tests use temp directories under os.tmpdir() only (events dir and a real temp git repo with a task branch created via git commands in the test); never touch ~/.dugout or the repo you run in. Tests use `app.request(...)` for routes and start a real server only for the bind test (port 0).
  - Do not run any claude or codex command.
acceptance:
  - app.ts exports `createApp({ eventsDir, repo })` returning a Hono app implementing every route, query parameter, status code and JSON shape of api.md, using core's summarizeLog / parseLog / computeScorecard and validating every response body against the core zod schemas in tests.
  - Behaviors with tests: list sorted newest first by task.created ts with `limit` (default 50, max 500, invalid -> 400) and `status` filter (invalid -> 400); a missing or empty events dir gives an empty list, not an error; non-.jsonl files are ignored; an unreadable log appears with status `unreadable` and a reason and does not break the listing or the scorecard (counted in `excluded`); an interrupted log (no task.finished) appears as `interrupted` and is excluded from the scorecard; `GET /api/tasks/:id` returns summary + events, 404 for an unknown id, 400 for ids like `..`, `a/b`, `a%2Fb`, `.hidden` or very long ids, and never reads outside the events dir (test with a symlink or a file one directory up); the diff route returns `git diff <baseRef>...<branch>` for a task whose branch exists in the temp repo, truncates to 200000 bytes on a line boundary with the marker line and `truncated: true`, gives 404 when the branch does not exist or baseRef/branch fail validation, 409 for an unreadable log.
  - The scorecard route equals computeScorecard over the readable finished logs of the temp events dir (use two or three of the repo's fixtures/events/*.jsonl copied into the temp dir, read from the repo in the test only).
  - server.ts exports `startServer({ port, eventsDir, repo }): Promise<{ close(): Promise<void>; address: { host: string; port: number } }>` using @hono/node-server bound to 127.0.0.1; a test starts it on port 0, asserts the bound host is 127.0.0.1, fetches /api/health and closes it. bin.ts is the `dugout-serve` entry (`#!/usr/bin/env node`): flags `--port` (default 4317), `--events-dir` (default ~/.dugout/events), `--repo` (default the git root of the current directory, or the cwd if not in a repo); prints one line `listening on http://127.0.0.1:<port>`; bad flags exit 3 with a message; SIGINT/SIGTERM close the server and exit 0.
  - A test asserts that no non-test source file under packages/server/src references fs write APIs (writeFile, appendFile, mkdir, rm, rmdir, unlink, rename, copyFile, createWriteStream, open with a write flag) and that the only child_process use is execFile with `git`.
  - index.ts exports createApp and startServer.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Suggested files: app.ts, logs.ts (reading the events dir and a log by id), diff.ts (git diff with truncation), server.ts, bin.ts, with tests next to them. Keep each file short and readable; the maintainer has to be able to explain every line, especially the id/branch validation and the git invocation.
