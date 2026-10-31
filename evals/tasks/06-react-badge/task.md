---
id: eval-react-badge
goal: Create a typed `StatusBadge` React component for the task statuses.
files_to_read:
  - src/StatusBadge.tsx
  - src/status.ts
constraints:
  - Props are typed from the existing `Status` union; no duplicate string literals.
  - No styling library; plain CSS classes only.
  - Must render accessible text, not color alone.
acceptance:
  - Renders a label for each of passed, needs_review, failed, interrupted.
  - Unknown status values are a type error.
  - Component tests pass.
verify: pnpm test
max_retries: 1
review: true
---
