---
id: core-summary-scorecard
goal: Add pure functions and zod payload schemas to packages/core that summarize an event log into a TaskSummary and compute the scorecard, exactly as specified in docs/contracts/api.md, and make `panosu list` use the shared summary logic.
files_to_read:
  - AGENTS.md
  - docs/contracts/api.md
  - docs/contracts/cli.md
  - docs/contracts/events.md
  - packages/core/src/index.ts
  - packages/core/src/events.ts
  - packages/core/src/event-log.ts
  - packages/cli/src/list.ts
  - packages/cli/src/list.test.ts
  - fixtures/events/real-codex-claude.jsonl
constraints:
  - Edit only packages/core/src (new files plus index.ts) and packages/cli/src/list.ts / list.test.ts. Do not touch package.json, lockfile, tsconfig, other packages or docs. Existing tests must keep passing; `panosu list` output must not change.
  - core stays free of I/O, clock and randomness. No new dependencies. No any. No comments unless explaining a non-obvious why. ESM NodeNext, relative imports end in .js.
  - Types come from zod via z.infer. Do not run any claude or codex command.
acceptance:
  - core exports zod schemas and inferred types for TaskSummary, ImplementerRow, ReviewerRow and the scorecard response, matching api.md.
  - `summarizeLog(lines: string[], fileName: string)` returns a TaskSummary for raw JSONL lines (parsing and validation inside, since unreadable detection needs the raw lines): readable logs get the derived fields; bad JSON, schema failure (including unknown schemaVersion) and non-contiguous seq give status `unreadable` with a one-line `reason` naming the first problem and its line number. A valid log without task.finished is `interrupted` with durationMs null. A log whose seq is valid but whose lifecycle is otherwise odd is still summarized (do not use checkEventLog to reject).
  - `computeScorecard(summaries with events)` implements the definitions in api.md exactly (design the input type so it takes the parsed events of each readable task plus the counts of excluded ones). Tests with hand-computed expectations built from small inline event arrays covering: a first-try pass, a pass after a retry, a fallback task credited to the last provider, a failed task, two models of the same provider, reviewer rows with issue counts, rounding to 4 decimals, sorting, interrupted and unreadable exclusion, and an empty input.
  - Tests also run summarizeLog over every file in fixtures/events and assert the expected status of each fixture (success passed, retry passed, fallback passed, review-issues needs_review, failed failed, all-failed failed, setup-failed failed, real-codex-claude passed) and the token sums for real-codex-claude (36519 input, 119 output).
  - `panosu list` is refactored to use summarizeLog for status, attempts and providers; its tests pass unchanged (its output format is the same).
  - index.ts exports everything new.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Suggested files: packages/core/src/summary.ts, scorecard.ts, api-schemas.ts, each with a test. Keep functions short and readable; the maintainer must be able to explain every line.
