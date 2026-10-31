---
id: core-setup-review
goal: Extend packages/core with the optional setup step, the review-failure rule and a verdict-deriving review normalizer, all as specified in the contracts, with tests and fixtures.
files_to_read:
  - AGENTS.md
  - docs/contracts/events.md
  - docs/contracts/task-package.md
  - docs/contracts/review-result.md
  - docs/plans/stage-3.md
  - packages/core/src/index.ts
  - packages/core/src/events.ts
  - packages/core/src/task-package.ts
  - packages/core/src/review.ts
  - packages/core/src/run-task.ts
  - packages/core/src/run-task.test.ts
  - packages/core/src/event-log.ts
  - packages/core/src/fake.ts
constraints:
  - Only add or edit files under packages/core/src and fixtures/events. Do not touch package.json, lockfile, tsconfig, other packages or docs. Existing behavior and every existing test must keep passing; the six existing fixtures must not change.
  - No new dependencies. No any. No comments unless explaining a non-obvious why. ESM NodeNext, relative imports end in .js.
  - core stays free of I/O, clock and randomness; new work arrives through deps.
  - Do not run any claude or codex command.
acceptance:
  - taskPackageSchema accepts an optional non-empty `setup` string (absent by default; empty string rejected with a message naming the field). parseTaskPackage round-trips it. Existing packages without it behave as before.
  - eventSchema has a `setup.finished` event (passed, exitCode, durationMs, outputTail) as in events.md. checkEventLog also reports: a setup.finished with passed false that is followed by any attempt.started; and a setup.finished before worktree.created.
  - RunTaskDeps gets an optional `setup?(cwd: string, command: string): Promise<VerifyOutcome>`. When pkg.setup is set and deps.setup is provided, runTask calls it with deps.worktree.path after emitting worktree.created and before the first attempt, and emits setup.finished (outputTail kept to the last 30 lines). If setup fails the task ends: task.finished with status failed, attempts 0, providers [], diffStat from deps.diffStat(), and no attempt/verify/review events. If pkg.setup is set but deps.setup is missing, runTask throws an Error saying so before emitting anything. When pkg.setup is unset, behavior and events are identical to today.
  - Review failure: if the reviewer adapter's review() throws, or its result fails reviewResultSchema, runTask still emits review.finished with verdict changes_requested and one issue `{ file: ".", severity: "blocker", message: "review unavailable: <reason>" }` where reason is the error message (single line, at most 200 chars), and the task ends needs_review. Missing adapter for the reviewer still throws as today.
  - A new exported function normalizeReview(raw: unknown): ReviewResult accepts the loosely typed JSON an LLM returned: issues with `line` null or absent are accepted (null dropped), severity and file are validated, the model's own `verdict` is ignored and recomputed (changes_requested iff any issue is blocker or major, otherwise approve), `summary` must be a string. Anything else throws an Error with a readable message. It must accept the real samples: the `result` JSON string in fixtures/providers/claude/print-json-review.sample.json (parse its `structured_output`) and the last agent message text in fixtures/providers/codex/exec-json-review.sample.jsonl (an item.completed agent_message whose text is JSON) — one test each, reading the files from the repo in the test only.
  - New tests for every point above, including: setup passes and is logged between worktree.created and the first attempt (event order); setup failure; missing deps.setup; reviewer throws; reviewer returns an invalid object; normalizeReview deriving approve from a model-declared changes_requested with only minor issues, and changes_requested from a declared approve with a major issue.
  - Add fixtures/events/setup-failed.jsonl (a task whose setup fails; structurally valid, passes checkEventLog, parses with eventSchema, and a runTask test using fake adapters and a failing deps.setup is structurally equal to it) and extend the existing fixture-driven test that enumerates fixtures/events so the new file is covered.
  - index.ts exports normalizeReview and any new types.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Keep run-task.ts readable: extract small private helpers (runSetup, runReview) rather than growing the main loop. The fixture for setup-failed should use realistic ids and timestamps in the style of the existing fixtures (see fixtures/events/all-failed.jsonl) and a package with a setup command such as `pnpm install --offline --frozen-lockfile`.
