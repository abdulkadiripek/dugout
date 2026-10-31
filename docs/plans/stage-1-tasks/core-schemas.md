---
id: core-schemas
goal: Implement the zod schemas for events, task packages and review results in packages/core, with parseTaskPackage, and tests that validate every fixture event log.
files_to_read:
  - AGENTS.md
  - docs/contracts/events.md
  - docs/contracts/task-package.md
  - docs/contracts/review-result.md
  - docs/contracts/provider-adapter.md
  - fixtures/events/success.jsonl
  - fixtures/events/fallback.jsonl
  - packages/core/package.json
  - packages/core/tsconfig.json
  - packages/core/src/index.ts
constraints:
  - Only edit files under packages/core/src. Do not touch package.json, lockfile, tsconfig, other packages or docs.
  - Dependencies are zod and yaml only (already installed in packages/core). Add nothing.
  - Types are inferred from the zod schemas with z.infer; never write a duplicate hand-written type.
  - No any. No comments unless explaining a non-obvious why.
  - Source files must not read files, spawn processes, touch the clock or import anything outside packages/core. Only test files may read fixtures from the repo (use node:fs and a path resolved from import.meta.url).
  - ESM with NodeNext resolution; relative imports end in .js.
  - Do not run any claude or codex command.
acceptance:
  - eventSchema is a zod discriminated union on `type` covering every event type in events.md, with the envelope fields (schemaVersion literal 1, seq, ts, taskId). Unknown schemaVersion and unknown type are rejected.
  - Every line of every fixtures/events/*.jsonl parses with eventSchema (test enumerates the directory, so new fixtures are covered).
  - A log checker `checkEventLog(events)` returns a list of problems; the fixtures yield none. It detects non-contiguous seq, a first event that is not task.created, a missing or duplicated task.finished, and attempt.started without a matching attempt.finished. Each rule has a failing-input test.
  - taskPackageSchema and parseTaskPackage(markdown) implement task-package.md including defaults (max_retries 2, review true, providers ["codex","claude"]). Missing acceptance, empty verify, absolute paths, `..` segments and backslashes in files_to_read are rejected with readable messages naming the field.
  - parseTaskPackage parses the example package in task-package.md (copy it into a test as a string).
  - reviewResultSchema implements review-result.md, including the rule that verdict must be changes_requested when any issue is blocker or major, and approve otherwise.
  - index.ts exports the schemas, inferred types, parseTaskPackage and checkEventLog.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Event payload field names are exactly those in events.md (camelCase, e.g. `durationMs`, `outputTail`). The embedded `package` field of task.created uses the task package schema as written in task-package.md (snake_case: files_to_read, max_retries). Check the fixtures for the exact shapes before finalizing the schema; the fixtures are authoritative for field presence.

Put each schema family in its own file under packages/core/src (events, task-package, review, event-log) with a *.test.ts next to it.
