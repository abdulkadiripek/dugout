---
id: board-live
goal: "Add a live mode to scripts/demo.mjs so that `pnpm board` opens the board on the user's real event logs."
files_to_read:
  - "AGENTS.md"
  - "scripts/demo.mjs"
  - "scripts/demo.test.mjs"
  - "packages/server/src/bin.ts"
  - "docs/getting-started.md"
constraints:
  - "Only edit scripts/demo.mjs and scripts/demo.test.mjs. Do not touch package.json (the `board` script already exists), docs, packages or fixtures."
  - "Node built-ins only. Start only the two existing children (API and vite) plus, for --open, one detached browser-opener process; signal only the two PIDs the script started, never the opener, never pkill/killall. No model calls. Never write anything under the home directory."
  - "Do not run any claude or codex command. Leave no process of yours running after your tests."
acceptance:
  - "New flags for node scripts/demo.mjs: `--live` (events dir defaults to ~/.dugout/events via os.homedir(); repo defaults to the git root of the current directory, or `--repo <dir>`), `--events-dir <dir>` (overrides the events dir in any mode), and `--open` (after both servers answer, open the printed web URL with `xdg-open` on Linux or `open` on macOS, detached, stdio ignored, errors ignored and never fatal; skipped under --check). Without --live and --events-dir the behavior is exactly today's (fixtures, repo = this repo)."
  - "In live mode the script prints, after the usual ready line, `events: <dir>` with the home directory shown as `~`, and a hint line `stop with Ctrl+C`. A missing events dir is not an error (the API returns an empty list)."
  - "`--check` works in live mode; tests: a live-mode `--check` run with `--events-dir` pointing to a temp dir that holds a copy of one fixture log prints `demo check ok: 1 tasks` and leaves no child PID alive; `--open` is never executed in tests (test only that the flag is accepted together with --check and that no opener is spawned then). All existing tests keep passing."
verify: "pnpm lint && pnpm typecheck && pnpm test && node scripts/scan-repo.mjs"
max_retries: 1
review: false
providers: [codex, claude]
---
