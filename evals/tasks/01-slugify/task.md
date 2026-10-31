---
id: eval-slugify
goal: Implement `slugify(input: string): string` in `src/slugify.ts`.
files_to_read:
  - src/slugify.ts
constraints:
  - No new dependencies.
  - Pure function, no side effects.
acceptance:
  - slugify("Hello World") returns "hello-world".
  - Consecutive separators and punctuation collapse to a single "-".
  - Leading and trailing separators are removed.
  - Non-ASCII letters are transliterated or dropped, never throw.
verify: pnpm test
max_retries: 1
review: false
---
