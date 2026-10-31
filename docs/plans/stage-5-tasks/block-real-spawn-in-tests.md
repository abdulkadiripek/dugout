---
id: block-real-spawn-in-tests
goal: Make it impossible for the test suite to start the real claude or codex CLI by accident, by having spawnReal refuse those commands when running under vitest.
files_to_read:
  - "AGENTS.md"
  - "packages/cli/src/providers/spawn.ts"
  - "packages/cli/src/providers/spawn.test.ts"
constraints:
  - "Only edit packages/cli/src/providers/spawn.ts and spawn.test.ts. Every existing test must keep passing unchanged."
  - "No new dependencies. No any. No comments unless explaining a non-obvious why."
  - "Do not run any claude or codex command (the new test must not start one either; assert on the thrown error only)."
acceptance:
  - "spawnReal throws an Error before spawning anything when process.env.VITEST is set and the command's basename is exactly claude or codex. The message says real provider processes are blocked under vitest and that a spawn must be injected."
  - "Other commands (sh, node, git) are unaffected under vitest, and outside vitest (VITEST unset, set temporarily inside the test and restored in a finally block) spawnReal keeps its previous behavior for every command; test the unset case with a harmless command such as sh, never with claude or codex."
  - "A test proves the guard by calling spawnReal with command claude and with /usr/bin/codex (full path, basename match) and expecting the throw, with no child process created."
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 1
review: false
providers: [codex, claude]
---
