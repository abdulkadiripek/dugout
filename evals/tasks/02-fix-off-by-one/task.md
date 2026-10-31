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
  - paginate(items, page, size) uses 1-based pages, never returns more than size items and never drops or repeats items across pages.
  - A page number past the last page returns an empty array, and the input array is not modified.
verify: node --test
max_retries: 1
review: false
providers: [codex, claude]
---
