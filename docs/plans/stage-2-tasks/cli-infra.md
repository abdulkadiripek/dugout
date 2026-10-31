---
id: cli-infra
goal: Add the I/O building blocks of the panosu CLI to packages/cli — config loading, an append-only event writer, a verify runner and git worktree helpers — each with tests against temp directories and a real temp git repo.
files_to_read:
  - AGENTS.md
  - docs/contracts/cli.md
  - docs/contracts/events.md
  - docs/contracts/provider-adapter.md
  - docs/adr/0006-worktree-per-task.md
  - packages/cli/package.json
  - packages/cli/tsconfig.json
  - packages/cli/src/index.ts
  - packages/core/src/index.ts
  - packages/core/src/events.ts
  - packages/core/src/adapter.ts
constraints:
  - Only add or edit files under packages/cli/src. Do not touch package.json, lockfile, tsconfig, vitest config, core, other packages or docs.
  - No new dependencies. Use node:fs, node:path, node:os, node:child_process only (plus @panosu/core and zod, which core already provides; import zod only if packages/cli/package.json lists it, otherwise validate with core's exported schemas or plain checks).
  - Import from "@panosu/core" only through its package entry, never by relative path into packages/core.
  - No any. No comments unless explaining a non-obvious why. ESM NodeNext, relative imports end in .js.
  - Tests must use temp directories created with fs.mkdtempSync under os.tmpdir() and remove them afterwards. Never touch ~/.ajan-panosu, ~/.claude, ~/.codex or the repository you run in.
  - Spawn git and sh with execFile/spawn argument arrays, never a shell string built from input. Only signal processes this code spawned.
  - Do not run any claude or codex command.
acceptance:
  - config.ts exports loadConfig(file?: string): returns { models: { implement: Record<ProviderName,string>, review: Record<ProviderName,string> }, verifyTimeoutMs: number }. Defaults: implement codex "gpt-6-astra", claude "claude-sonnet-5-5", fake "fake"; review codex "gpt-6.1-sol", claude "claude-sonnet-5-5", fake "fake"; verifyTimeoutMs 600000. The file shape is { "models": { "<provider>": { "implement"?: string, "review"?: string } }, "verifyTimeoutMs"?: number } and overrides merge onto defaults per key. With no argument the file is ~/.ajan-panosu/config.json (via os.homedir()). A missing file gives the defaults without error; invalid JSON or a value of the wrong type throws a ConfigError (exported class) whose message names the key. Tests cover defaults, partial override, missing file, invalid JSON and a wrong type, using temp files.
  - event-writer.ts exports createEventWriter(dir, taskId) returning { path, emit(event: Event): void }. It creates dir recursively, refuses to start if <dir>/<taskId>.jsonl already exists (throws), validates each event with eventSchema before writing (invalid event throws and writes nothing), and appends exactly one line `JSON + "\n"` per event with a single synchronous append so a crash leaves only complete lines. Tests: lines round-trip through eventSchema, existing file is refused, invalid event writes nothing, the directory is created, and every fixture in fixtures/events, re-emitted event by event through the writer, reads back line by line to JSON that deep-equals the fixture's lines.
  - verify-runner.ts exports runVerifyCommand(cwd, command, opts: { timeoutMs: number; signal?: AbortSignal }): Promise<VerifyOutcome> (type from @panosu/core). It runs `sh -c <command>` in cwd with stdout and stderr merged in output order, detached into its own process group. outputTail is the last 30 lines. Exit code 0 gives passed true. On timeout it sends SIGTERM to the process group, then SIGKILL after 2 seconds if still alive, and returns passed false, exitCode 124, durationMs measured, with a final output line saying the command timed out. An aborted signal does the same kill sequence and returns exitCode 130. Tests: pass, fail with exit code, merged stderr, tail truncation to 30 lines with 100 lines of output, timeout with `sleep 30` (use a short timeoutMs) leaving no child process alive afterwards (check by writing the shell's PID chain or by confirming a marker file is not created after the timeout), abort signal.
  - worktree.ts exports: findRepoRoot(cwd): Promise<string> (git rev-parse --show-toplevel; throws a readable Error outside a repo), currentBase(repo): Promise<string> (branch name, or the commit hash when HEAD is detached), createWorktree(repo, taskId, baseRef): Promise<{ path: string; branch: string; baseRef: string }> where path is the repo-relative string `.worktrees/<taskId>` and branch is `panosu/<taskId>` (runs `git worktree add -b <branch> <path> <baseRef>`), removeWorktree(repo, taskId): Promise<void> (git worktree remove --force; the branch is kept), stageAll(worktreeDir): Promise<void>, diffStat(worktreeDir, baseRef): Promise<{ files: number; additions: number; deletions: number }> (from `git diff --cached --numstat <baseRef>`; binary files shown as `-` count as a file with 0 additions and 0 deletions), and commitAll(worktreeDir, message): Promise<boolean> (commits staged changes with `git -c user.name=panosu -c user.email=panosu@localhost commit -m <message>`; returns false and makes no commit when nothing is staged). Tests use a real temp git repo created in the test (git init -b main, one initial commit made with the same -c identity flags): worktree created on the right branch and path, main working tree untouched (git status clean, no new files), a new file plus a modified file show up in diffStat after stageAll, commitAll commits once and returns false the second time, currentBase on a detached HEAD returns a hash, findRepoRoot outside a repo throws, removeWorktree removes the directory but keeps the branch.
  - index.ts exports all of the above (functions, ConfigError and types).
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

One file per concern with its test next to it: config.ts, event-writer.ts, verify-runner.ts, worktree.ts. `pnpm test` first runs `tsc -b` for the whole workspace (vitest global setup), so type errors in any package fail the run. If the workspace-write sandbox prevents git or temp-dir use in tests, say exactly which command failed instead of weakening the tests.
