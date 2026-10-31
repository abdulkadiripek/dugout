---
id: eval-add-tests
goal: Add tests for `src/stats.ts` that would catch realistic regressions.
files_to_read:
  - src/stats.ts
constraints:
  - Do not modify `src/stats.ts`.
  - Tests must not depend on execution order or the current time.
acceptance:
  - Tests cover normal input, an empty list, a single element and invalid input.
  - The hidden mutation check (deliberately broken variants of `stats.ts`) fails at least 80% of the variants.
verify: pnpm test
max_retries: 1
review: true
---
