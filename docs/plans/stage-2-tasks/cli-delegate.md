---
id: cli-delegate
goal: Implement the `panosu delegate` and `panosu list` commands in packages/cli exactly as specified in docs/contracts/cli.md, wiring the existing helpers to core's runTask in fake mode, with end-to-end tests including process-kill behavior.
files_to_read:
  - AGENTS.md
  - docs/contracts/cli.md
  - docs/contracts/events.md
  - docs/contracts/task-package.md
  - docs/plans/stage-2.md
  - packages/cli/package.json
  - packages/cli/src/index.ts
  - packages/cli/src/config.ts
  - packages/cli/src/event-writer.ts
  - packages/cli/src/verify-runner.ts
  - packages/cli/src/worktree.ts
  - packages/core/src/index.ts
  - packages/core/src/run-task.ts
  - packages/core/src/fake.ts
  - packages/core/src/adapter.ts
  - fixtures/events/success.jsonl
  - fixtures/events/fallback.jsonl
  - fixtures/events/retry.jsonl
  - fixtures/events/review-issues.jsonl
  - fixtures/events/failed.jsonl
  - fixtures/events/all-failed.jsonl
constraints:
  - Only add or edit files under packages/cli/src. Do not touch packages/cli/package.json (its bin entry already points at dist/bin.js), other packages, the lockfile, tsconfig, the vitest config or docs.
  - No new dependencies. Parse arguments with node:util parseArgs.
  - Follow docs/contracts/cli.md exactly: flags, steps, output block, exit codes, scenario semantics. If it is ambiguous or contradicts the helpers, stop and say so in your final message instead of guessing.
  - Import core only through "@panosu/core". No any. No comments unless explaining a non-obvious why. ESM NodeNext, relative imports end in .js.
  - Tests use temp directories (mkdtemp under os.tmpdir()) for the repo, the events dir and everything else; never touch ~/.ajan-panosu, ~/.claude, ~/.codex or the repository you run in. Each test repo is created with `git init -b main` plus one commit made with `-c user.name=t -c user.email=t@localhost`.
  - Only signal processes the code under test spawned. Tests that spawn the CLI must clean up every process they started, including a verify command's process group, even when an assertion fails (try/finally). Never use pkill or killall.
  - Do not run any claude or codex command. Real providers are not implemented in this stage.
acceptance:
  - cli.ts exports main(argv: string[], io: { stdout(text: string): void; stderr(text: string): void; cwd: string; homedir?: string }, deps?: { newId?(): string; now?(): Date }): Promise<number> returning the exit code, and bin.ts is the executable entry (`#!/usr/bin/env node`) that calls main with process.argv.slice(2) and sets process.exitCode. SIGINT and SIGTERM handling lives in bin.ts/delegate as the contract describes.
  - scenarios.ts defines the four named scenarios of the contract and builds a FakeScenarioSpec for a package's provider list (position i maps to providers[i]); a scenario needing more positions than providers gives a readable error.
  - delegate.ts implements the delegate steps: validate the package file (missing file, parse error, schema error, providers other than fake without fake mode: exit 3 with a readable message on stderr, no log, no worktree); ensure `.worktrees/` is in the repo's info/exclude (use `git rev-parse --git-path info/exclude`, append once); baseRef via currentBase; task id `<package id>-<newId()>` where the default newId is 4 random hex chars; createWorktree; fake adapters from createFakeScenario wrapped so that a repo-relative cwd is resolved against the repo root; runVerify = stageAll then runVerifyCommand with config.verifyTimeoutMs in the resolved worktree path; diffStat from the helpers; runTask with the event writer's emit; after task.finished, commitAll with message `panosu: <task id>`; print the output block from the contract with `~` replacing the home directory prefix; return 0, 1 or 2 by status.
  - Output contains exactly the contract's block: no diff, no file contents, no absolute home path (the log path is printed with ~ when under the home directory; with a temp events dir it is printed as is).
  - list.ts implements `panosu list` per the contract: newest first by the task.created timestamp, `limit`, statuses passed/needs_review/failed/interrupted/unreadable (with reason; bad JSON line, schema failure including unknown schemaVersion, and non-contiguous seq are unreadable), never aborts on one bad file, ignores files that are not .jsonl, an empty or missing events dir prints nothing and returns 0.
  - Tests (cli.test.ts, delegate.test.ts, list.test.ts, scenarios.test.ts, and an e2e file for processes), using real temp git repos:
    1. `--scenario success` with a package (providers codex,claude, verify `true`, review true) yields exit 0 and an event log structurallyEqual (import from @panosu/core) to fixtures/events/success.jsonl; each event also passes eventSchema and checkEventLog finds no problems.
    2. `--scenario fallback` yields exit 0 and a log structurallyEqual to fixtures/events/fallback.jsonl.
    3. A package whose verify fails once then passes (for example `test -f ok || { touch ok; exit 1; }` evaluated in the worktree) with `--scenario success` yields a log structurallyEqual to retry.jsonl; a package whose verify always fails with max_retries 2 yields exit 2 and a log structurallyEqual to failed.jsonl; `--scenario all-failed` yields exit 2 and a log structurallyEqual to all-failed.jsonl; `--scenario review-issues` yields exit 1 and a log structurallyEqual to review-issues.jsonl. For each, build the package from the corresponding fixture's task.created package but replace verify with the command needed and keep its providers, max_retries and review values.
    4. The worktree directory exists after the run at `.worktrees/<task-id>` on branch `panosu/<task-id>`; the main working tree stays clean (`git status --porcelain` empty); a file the verify command creates in the worktree is committed on the task branch (the branch has one commit ahead of main) and is not present in the main working tree.
    5. Invalid packages (missing acceptance; path escaping files_to_read; nonexistent file) exit 3, write no log file and create no worktree; real providers without fake mode exit 3 with a message that mentions Stage 3; a scenario needing two positions with `--providers fake` exits 3.
    6. Kill test: spawn the built CLI (`node packages/cli/dist/bin.js delegate ...`, path resolved from the test file location; the vitest global setup has already run `tsc -b`) in its own process group with a package whose verify is `echo $$ > <pidfile>; sleep 30`; wait (poll, with a deadline) until the log contains verify.started and the pidfile exists; SIGKILL the CLI process; assert the log has no task.finished and `list` shows the task as `interrupted`; then kill the verify process group using the pid from the pidfile (negative pid) in a finally block and confirm it is gone.
    7. Signal test: same setup but send SIGTERM to the CLI; assert it exits with code 130, the log has no task.finished, and the process group of the pidfile's pid is gone (the CLI stopped it), killing it in a finally block if it is not.
    8. The printed output never contains the home directory path of the test run: run with io.homedir pointing at a temp directory that contains the events dir, and assert the log line starts with `~/`.
    9. list tests: ordering, limit, interrupted, unreadable with each reason, bad file does not abort, non-jsonl ignored, empty dir.
  - index.ts additionally exports main.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Suggested files: scenarios.ts, delegate.ts, list.ts, cli.ts, bin.ts with tests next to them (an e2e.test.ts for the two process tests). Keep delegate.ts readable: parse, set up, run, report as separate small functions. Subprocess tests need a few seconds; give them explicit vitest timeouts (for example 30 seconds). If the workspace-write sandbox blocks something your tests need (git, spawning, signals), say exactly which command failed instead of weakening the tests.
