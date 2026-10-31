---
id: eval-add-tests
goal: Add tests for `src/stats.ts` that would catch realistic regressions.
files_to_read:
  - src/stats.ts
constraints:
  - Do not modify `src/stats.ts`.
  - Tests must not depend on execution order or the current time.
  - Use only node:test and node:assert/strict, and import the code with `./stats.ts`.
acceptance:
  - The tests live in `src/stats.test.ts` and pass against the current `src/stats.ts`.
  - Tests cover normal input, an empty list, a single element and invalid input for mean, median and spread.
  - The hidden mutation check (deliberately broken variants of `stats.ts`) fails at least 80% of the variants when run against your tests.
verify: node --test
max_retries: 1
review: true
providers: [codex, claude]
---
