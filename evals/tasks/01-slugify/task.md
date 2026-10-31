---
id: eval-slugify
goal: "Implement `slugify(input: string): string` in `src/slugify.ts`."
files_to_read:
  - src/slugify.ts
  - src/slugify.test.ts
constraints:
  - No new dependencies.
  - Pure function, no side effects.
acceptance:
  - slugify("Hello World") returns "hello-world".
  - Consecutive separators and punctuation collapse to a single "-".
  - Leading and trailing separators are removed.
  - Non-ASCII letters are transliterated or dropped, never throw.
  - The result contains only the characters a-z, 0-9 and "-", with "-" only between alphanumeric runs (an input with no usable characters returns "").
verify: node --test
max_retries: 1
review: false
providers: [codex, claude]
---
