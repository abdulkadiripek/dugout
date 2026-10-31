---
id: adapter-fake
goal: Add the provider adapter interface and a scripted fake provider with built-in scenarios to packages/core, with tests.
files_to_read:
  - AGENTS.md
  - docs/contracts/provider-adapter.md
  - docs/contracts/events.md
  - packages/core/src/index.ts
  - packages/core/src/events.ts
  - packages/core/src/review.ts
  - packages/core/src/task-package.ts
constraints:
  - Only add or edit files under packages/core/src. Do not touch package.json, lockfile, tsconfig, other packages or docs. Existing files other than index.ts must keep their behavior and tests.
  - No new dependencies.
  - Types come from zod via z.infer where a schema exists. Reuse ExitReason, ProviderName and ReviewResult from the existing schemas; do not redefine them.
  - No any. No comments unless explaining a non-obvious why.
  - Nothing here may read files, spawn processes, read the clock or use randomness. The fake adapter is fully deterministic.
  - Do not run any claude or codex command.
acceptance:
  - adapter.ts defines AttemptInput, AttemptResult, ProviderEvent, ReviewInput, ProviderAdapter and VerifyOutcome exactly as in provider-adapter.md. ProviderEvent is the union of the provider.tool, provider.message and provider.usage events without the envelope fields (schemaVersion, seq, ts, taskId); derive it from eventSchema's types, do not retype the fields. VerifyOutcome is { passed, exitCode, durationMs, outputTail }.
  - createFakeScenario(spec) returns { adapters, runVerify }. spec maps a provider name (codex, claude, fake) to an ordered list of outcomes { exit: ExitReason, verify?: "pass" | "fail", durationMs?: number }, plus an optional review: "approve" | "changes_requested" (default approve). adapters contains a ProviderAdapter for each provider named in the spec.
  - Each call of an adapter's run() consumes the next outcome for that provider and returns { exitReason: outcome.exit, durationMs }. For exit "ok" it first yields one provider.message and one provider.usage event. Calling run() with no outcomes left throws an Error naming the provider.
  - runVerify(cwd, command) returns a VerifyOutcome from a queue of the verify values of all consumed outcomes whose exit is "ok" (in consumption order; a missing verify means "pass"). "fail" gives passed false, exitCode 1, a non-empty outputTail; "pass" gives passed true, exitCode 0. Calling it with an empty queue throws an Error.
  - review() returns a valid ReviewResult (it must pass reviewResultSchema): approve with no issues, or changes_requested with one major issue.
  - An already-aborted signal makes run() return exitReason "timeout" without consuming an outcome.
  - Built-in scenario helpers for a single provider slot: scenarios.success, scenarios.fail, scenarios.rate_limit, scenarios.crash, each returning an outcomes array (success is one ok/pass outcome; fail is one ok/fail outcome; rate_limit is one rate_limit outcome; crash is one crash outcome).
  - Tests cover each built-in scenario, outcome ordering, the empty-queue errors, the review variants and the aborted signal.
  - index.ts exports everything above.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Put the interface in packages/core/src/adapter.ts and the fake in packages/core/src/fake.ts, with fake.test.ts. The model name reported by the fake is just "fake"; model names for real providers belong to config, not here.
