---
id: cli-real-providers
goal: Wire the real Codex and Claude adapters and the package setup step into `panosu delegate` as specified in docs/contracts/cli.md, tested end to end with a scripted spawn seam and never with real CLIs.
files_to_read:
  - AGENTS.md
  - docs/contracts/cli.md
  - docs/contracts/provider-adapter.md
  - docs/contracts/events.md
  - docs/plans/stage-3.md
  - packages/cli/src/delegate.ts
  - packages/cli/src/cli.ts
  - packages/cli/src/delegate.test.ts
  - packages/cli/src/test-helpers.ts
  - packages/cli/src/index.ts
  - packages/cli/src/providers/index.ts
  - packages/cli/src/providers/shared.ts
  - packages/cli/src/providers/codex.ts
  - packages/cli/src/providers/claude.ts
  - packages/cli/src/providers/test-helper.ts
  - packages/core/src/run-task.ts
  - fixtures/providers/codex/exec-json-tools.sample.jsonl
  - fixtures/providers/codex/exec-json-review.sample.jsonl
  - fixtures/providers/claude/stream-json-implement.sample.jsonl
  - fixtures/providers/claude/print-json-review.sample.json
constraints:
  - Only add or edit files under packages/cli/src. Do not touch package.json, lockfile, tsconfig, other packages, fixtures or docs. Existing behavior (fake mode, list, exit codes, signal handling) and every existing test must keep passing.
  - No new dependencies. No any. No comments unless explaining a non-obvious why. ESM NodeNext, relative imports end in .js.
  - Tests must never start claude or codex. Inject a scripted SpawnFn through `deps`. Temp dirs only; never touch ~/.ajan-panosu, ~/.claude, ~/.codex or the repo you run in. Only signal processes the code under test spawned.
  - Do not run any claude or codex command.
acceptance:
  - main/delegate accept an optional `spawn?: SpawnFn` in their deps argument (default spawnReal) used by both adapters. Nothing else changes in the public signatures.
  - delegate without fake mode builds adapters only for the package's providers: codex via createCodexAdapter, claude via createClaudeAdapter (fake via the existing scenario path), each with `context: () => ({ goal: pkg.goal, acceptance: pkg.acceptance })` and attemptTimeoutMs from config if the config has it (otherwise the adapter default); the `--providers` override accepts codex, claude or fake lists and rejects unknown names and fake mixed with others with exit 3 and a readable message. The earlier "real providers are not supported until Stage 3" error is removed. The repo-relative cwd wrapper from Stage 2 applies to the real adapters too.
  - `setup`: when pkg.setup is set, delegate passes deps.setup = stage nothing, run runVerifyCommand(resolved worktree path, command, { timeoutMs: config.verifyTimeoutMs, signal }) and return its outcome (same abort handling as verify). Packages without setup are unaffected.
  - Scripted end-to-end tests (real temp git repo, real verify and setup commands, scripted spawn that replays the recorded samples and, for implement runs, also writes a file into the cwd it is given to simulate the model's work):
    1. providers codex,claude: codex implement succeeds (sample lines, exit 0), the real verify passes, claude reviews (print-json-review sample → two major issues → changes_requested): exit 1, status needs_review, log valid per checkEventLog, log contains setup.finished only when the package has setup, the file the fake "model" wrote is committed on the task branch, main working tree clean.
    2. codex implement exits 1 (replaying exec-json-schema-error.sample.jsonl): events show attempt.finished crash, fallback.triggered codex→claude, a claude attempt that succeeds, review by codex (exec-json-review sample → approve): exit 0, providers codex,claude.
    3. Both implementers crash: exit 2, log valid, no review.
    4. A reviewer that returns garbage: exit 1 with the review unavailable blocker in the log.
    5. setup failing (`exit 3`): exit 2, zero attempts, no spawn call made at all (assert on the scripted spawn), log valid; setup passing runs once before the first attempt (order checked through events).
    6. The spawned commands: assert the exact argv for codex implement, codex review, claude implement and claude review against provider-adapter.md (model names from config defaults; prompt arguments compared by position, not content).
    7. `--providers claude,fake` and `--providers nonsense` exit 3; fake mode (`--scenario success`) still never calls spawn.
  - The printed output block and exit codes are unchanged; no diff or transcript text appears in stdout or stderr.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Prefer extending delegate.ts with small helpers (buildAdapters, buildSetup) over rewriting it. Put the new end-to-end tests in a new file (for example real-providers.test.ts) reusing the existing temp-repo helpers. The scripted spawn can reuse packages/cli/src/providers/test-helper.ts if it fits.
