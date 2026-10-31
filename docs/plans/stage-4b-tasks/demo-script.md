---
id: demo-script
goal: Add `pnpm demo`: one command that starts the read-only API on the fixture event logs and the web dev server, prints the URL, and shuts both down cleanly, with no model calls.
files_to_read:
  - "AGENTS.md"
  - "package.json"
  - "packages/server/src/bin.ts"
  - "packages/server/src/server.ts"
  - "packages/web/vite.config.ts"
  - "scripts/scan-repo.mjs"
  - "scripts/scan-repo.test.mjs"
constraints:
  - "Only add scripts/demo.mjs and scripts/demo.test.mjs. Do not touch package.json (the `demo` script already exists), docs or packages."
  - "Node built-ins only. Start only two child processes, both by absolute path of this repo's own built/dev entry points (node packages/server/dist/bin.js and the vite binary from packages/web/node_modules/.bin), never via a shell string. Signal only those two PIDs (SIGTERM, then SIGKILL after 2 s); never pkill/killall."
  - "Events dir is `fixtures/events` of this repo, read-only; never touch ~/.ajan-panosu, ~/.claude or ~/.codex. The API binds 127.0.0.1 only (that is the server's behavior; do not change the server)."
  - "Do not run any claude or codex command. No model calls."
acceptance:
  - "`node scripts/demo.mjs [--api-port 4317] [--web-port 5173] [--check]`: builds nothing itself but exits 3 with a clear message when packages/server/dist/bin.js is missing (tell the user to run pnpm build); starts the API with --events-dir fixtures/events, starts vite with PANOSU_API pointing at that API, waits until both answer (poll with a deadline, 20 s), prints `demo ready: http://127.0.0.1:<web-port>` and keeps running until SIGINT/SIGTERM, then stops both children and exits 0."
  - "`--check` mode: after both are ready, fetches `/api/tasks` through the web dev server's proxy and prints `demo check ok: <n> tasks`, then shuts down and exits 0 (exit 1 if the request fails or returns zero tasks)."
  - "If a requested port is busy, pick the next free port and print the actual URLs; `--api-port 0 --web-port 0` style automatic selection must work for tests."
  - "scripts/demo.test.mjs (vitest-compatible) runs `--check` with automatic ports against the real fixtures (needs `pnpm build`, which the vitest global setup performs via tsc -b; the web build is not required for the dev server) and asserts the output, exit code 0 and that no child process remains afterwards (check the PIDs the script reports on a debug line `child pids: <a> <b>`). Test timeout 60 s."
verify: pnpm lint && pnpm typecheck && pnpm test && node scripts/scan-repo.mjs
max_retries: 2
review: false
providers: [codex, claude]
---

Keep it small and readable (about 100 lines). Log child output only on failure.
