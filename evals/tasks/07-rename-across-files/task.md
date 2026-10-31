---
id: eval-rename-across-files
goal: Rename `fetchUser` to `loadUser` everywhere it is used.
files_to_read:
  - src/api.ts
  - src/profile.ts
  - src/profile.test.ts
constraints:
  - Do not rename unrelated identifiers that merely contain "fetch" or "fetchUser", such as fetchUserCount and fetchPosts.
  - Public behavior must not change.
acceptance:
  - "`src/api.ts` exports `loadUser` and no longer exports `fetchUser`."
  - No reference to the identifier `fetchUser` remains in `src/api.ts` or `src/profile.ts` (fetchUserCount and fetchPosts keep their names).
  - All tests pass.
verify: node --test
max_retries: 1
review: false
providers: [codex, claude]
---
