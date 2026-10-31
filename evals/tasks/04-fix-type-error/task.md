---
id: eval-fix-type-error
goal: Make the project typecheck by fixing the type error in the config loader.
files_to_read:
  - src/config.ts
constraints:
  - Do not use `any`, `as unknown as`, or `@ts-ignore`.
  - Runtime behavior for valid input must not change.
acceptance:
  - `pnpm typecheck` passes.
  - Invalid config input is rejected with an error instead of being silently accepted.
verify: pnpm typecheck && pnpm test
max_retries: 1
review: true
---
