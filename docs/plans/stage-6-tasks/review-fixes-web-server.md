---
id: review-fixes-web-server
goal: "Fix three verified defects found by an independent review: the list Enter shortcut stealing Enter from focused controls, stale detail state across task ids, and the missing Host check on the API."
files_to_read:
  - "AGENTS.md"
  - "docs/contracts/api.md"
  - "packages/web/src/screens/ListScreen.tsx"
  - "packages/web/src/screens/ListScreen.test.tsx"
  - "packages/web/src/App.tsx"
  - "packages/web/src/app.test.ts"
  - "packages/web/src/screens/DetailScreen.tsx"
  - "packages/server/src/app.ts"
  - "packages/server/src/app.test.ts"
  - "packages/server/src/server.test.ts"
constraints:
  - "Only edit packages/web/src/screens/ListScreen.tsx, App.tsx, their tests, and packages/server/src/app.ts with its tests. Do not touch docs, other files, package.json or the lockfile. Existing tests must keep passing."
  - "No new dependencies. No any. No comments unless explaining a non-obvious why. Do not run any claude or codex command. Your new tests must fail without your fix. Temp dirs only; never touch ~/.dugout, ~/.claude or ~/.codex."
acceptance:
  - "List keys: the Enter shortcut opens the first task only when focus is on the document body or the main landmark (not on a link, button, [role=button], input, select, textarea or any element inside the header or filters); j/k/arrows keep working from the body or a row. Tests with real keyboard events in jsdom: Enter on a focused filter button toggles the filter and does not navigate; Enter on the Scorecard nav link is not intercepted (default not prevented); Enter with focus on body still opens the first card."
  - "App renders DetailScreen with key={id} so state never carries over between task ids; test that navigating from one task id to another shows the loading state, not the previous task's goal, and that a collapsible opened on task A is closed on task B."
  - "API Host check: a Hono middleware in createApp rejects requests whose Host header hostname is not exactly 127.0.0.1, localhost or [::1] (any port, case-insensitive; a missing Host header is allowed only when the request URL itself is on one of those hosts, as in app.request tests) with 403 and JSON { error: \"forbidden host\" }. Tests: allowed hosts with and without ports, evil.example, 127.0.0.1.evil.example, localhost.evil.example, and a real server test (port 0) sending a spoofed Host header via node http and expecting 403."
verify: "pnpm lint && pnpm typecheck && pnpm test && pnpm build && node scripts/scan-repo.mjs"
max_retries: 1
review: false
providers: [codex, claude]
---
