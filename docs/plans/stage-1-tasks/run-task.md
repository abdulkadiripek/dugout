---
id: run-task
goal: Implement runTask in packages/core (attempt loop, retry, fallback, verify, review, status derivation) and a structural-equality test helper, proven against all six fixture event logs using the fake provider.
files_to_read:
  - AGENTS.md
  - docs/contracts/events.md
  - docs/contracts/provider-adapter.md
  - docs/contracts/task-package.md
  - docs/plans/stage-1.md
  - fixtures/events/success.jsonl
  - fixtures/events/retry.jsonl
  - fixtures/events/fallback.jsonl
  - fixtures/events/review-issues.jsonl
  - fixtures/events/failed.jsonl
  - fixtures/events/all-failed.jsonl
  - packages/core/src/index.ts
  - packages/core/src/adapter.ts
  - packages/core/src/fake.ts
  - packages/core/src/events.ts
  - packages/core/src/event-log.ts
  - packages/core/src/task-package.ts
constraints:
  - Only add or edit files under packages/core/src. Do not touch package.json, lockfile, tsconfig, other packages or docs. Existing files other than index.ts must keep their behavior and tests.
  - No new dependencies.
  - Types come from zod via z.infer; reuse existing types. No any. No comments unless explaining a non-obvious why.
  - runTask never reads files, spawns processes, reads the clock or uses randomness. Everything external comes in through deps. It does not import node modules.
  - The structural-equality helper lives in a file used only by tests (for example structural.ts with structural.test.ts) and is not exported from index.ts.
  - Do not run any claude or codex command.
  - Follow docs/contracts/events.md exactly for retry and failure accounting, reviewer selection and structural equality. Where it and these notes seem to conflict, stop and say so in your final message instead of guessing.
acceptance:
  - runTask(pkg, deps) returns Promise<{ status, taskId }>. deps is { now(): Date, newId(): string, adapters: Partial<Record<ProviderName, ProviderAdapter>>, runVerify(cwd, command): Promise<VerifyOutcome>, diffStat(): Promise<{files, additions, deletions}>, models: { implement: Record<ProviderName,string>, review: Record<ProviderName,string> }, emit(event: Event): void, worktree: { path, branch, baseRef }, signal: AbortSignal }. taskId is `${pkg.id}-${deps.newId()}`.
  - Every emitted event is a full Event (schemaVersion 1, seq from 0 and +1 each, ts from deps.now().toISOString(), taskId) and passes eventSchema. For every scenario below, checkEventLog on the emitted events returns no problems.
  - Event order for a task: task.created (package = the parsed pkg), worktree.created (from deps.worktree), then attempts. An attempt is attempt.started, the provider's events (provider.tool, provider.message and provider.usage from the adapter, with attempt numbers as given), attempt.finished (status "completed" iff exitReason is "ok", durationMs from the AttemptResult), and for exitReason "ok" verify.started plus verify.finished (outputTail kept to the last 30 lines).
  - The prompt passed to run() is built from the package (goal, constraints, acceptance, files_to_read, verify command). On a retry after a failed verify it also contains that verify's outputTail; after timeout or invalid_output it states the exit reason. A fallback attempt gets the original prompt.
  - Retry: a failed verify, or an attempt ending timeout or invalid_output, starts a new attempt with reason "retry" and the same provider, while that provider's retry count is below pkg.max_retries. When the budget is exhausted the task ends failed with no fallback. Retry budgets are per provider and a fallback attempt starts with a fresh budget.
  - Fallback: rate_limit, auth and crash never consume a retry. If another provider follows in pkg.providers, emit fallback.triggered (from, to, reason) and start an attempt with reason "fallback" for it (also when that provider is not in deps.adapters: then stop with an Error naming the provider). If none follows, emit task.finished with status "failed" directly, with no fallback.triggered.
  - Review: after the last passing verify, if pkg.review is true, emit review.started and review.finished using the reviewer chosen by the rule in events.md (first provider in pkg.providers that differs from the last attempt's provider, else the same one), with models from deps.models.review, calling the adapter's review with { taskId, cwd: worktree.path, baseRef, model, signal }. verdict approve gives status "passed"; changes_requested gives "needs_review". With review false there are no review events and the status is "passed".
  - task.finished carries status, attempts (total attempt count), providers (distinct implementer providers in order of first use), diffStat from deps.diffStat() and durationMs (deps.now() at the end minus at the start). It is the last event, emitted exactly once, also for failed tasks.
  - A structural-equality helper compares two event arrays by the rules in events.md ("Structural equality"): it first drops all provider.tool, provider.message and provider.usage events from both, then compares type and the listed fields, ignoring everything else (do not change the fake provider to reproduce provider.tool events); it has its own tests including a negative case for each compared field it checks (at least type, attempt, reason, provider, exitReason, passed, verdict, providers).
  - For each of the six fixtures, a test builds the scenario with createFakeScenario that reproduces it, runs runTask with the package taken from that fixture's task.created event, and asserts structural equality with the parsed fixture: success; retry (codex ok/fail then ok/pass); fallback (codex rate_limit, claude ok/pass); review-issues (review "changes_requested"); failed (read the fixture to pick the outcomes: retry budget exhausted); all-failed (codex rate_limit, claude auth).
  - Additional tests, each asserting on emitted events: rate_limit on the codex slot followed by a failing verify on claude gives retries on claude only up to its own budget; timeout and invalid_output consume retries while rate_limit, auth and crash never do; review false skips review; a single-provider package reviews with the same provider; max_retries 0 fails on the first failed verify.
  - index.ts exports runTask and its dependency types.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Put runTask in packages/core/src/run-task.ts with run-task.test.ts. Keep the loop small and readable: one function that walks providers and attempts, small private helpers for prompt building and reviewer selection. Model names in tests may be any strings; structural equality ignores them. Use fixed, injected clock and id values in tests (for example a counter-based now()). If you find that a fixture and events.md disagree, report it rather than adapting the code to the fixture silently.
