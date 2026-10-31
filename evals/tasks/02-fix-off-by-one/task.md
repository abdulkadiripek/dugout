---
id: eval-fix-off-by-one
goal: Fix the pagination bug so the last page returns the remaining items.
files_to_read:
  - src/paginate.ts
  - src/paginate.test.ts
constraints:
  - Do not change the function signature.
  - Do not edit existing tests.
acceptance:
  - All existing tests pass.
  - paginate(items, page, size) never returns more than size items and never drops or repeats items across pages.
verify: pnpm test
max_retries: 1
review: false
---
