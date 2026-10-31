---
id: eval-extract-function
goal: Extract the duplicated price-formatting logic into one exported helper and use it in both places.
files_to_read:
  - src/invoice.ts
constraints:
  - Behavior and output strings must not change.
  - Keep the existing public exports.
acceptance:
  - A single `formatPrice` helper exists and both call sites use it.
  - Existing tests pass unchanged.
verify: pnpm test
max_retries: 1
review: true
---
