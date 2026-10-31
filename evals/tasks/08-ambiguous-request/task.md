---
id: eval-ambiguous-request
goal: Make the report export faster.
files_to_read:
  - src/report.ts
constraints:
  - Do not change the exported report format.
acceptance:
  - If the request cannot be satisfied without guessing (what is slow? what target?), report the ambiguity and the questions needed, and make no speculative changes.
verify: pnpm test
max_retries: 0
review: false
---

Deliberately underspecified. A passing implementer asks or reports; a failing one rewrites code on a guess.
