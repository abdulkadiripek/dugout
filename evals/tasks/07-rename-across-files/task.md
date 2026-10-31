---
id: eval-rename-across-files
goal: Rename `fetchUser` to `loadUser` everywhere it is used.
files_to_read:
  - src/api.ts
  - src/profile.ts
constraints:
  - Do not rename unrelated identifiers that merely contain "fetch".
  - Public behavior must not change.
acceptance:
  - No reference to `fetchUser` remains.
  - All tests pass.
verify: pnpm test
max_retries: 1
review: false
---
