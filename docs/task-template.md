---
id: add-fake-provider
goal: Implement the `fake` provider with success, failure and rate_limit scenarios.
files_to_read:
  - packages/core/src/adapter.ts
constraints:
  - No real model calls.
  - Keep the public adapter interface unchanged.
acceptance:
  - A rate_limit scenario returns exitReason "rate_limit".
  - Unit tests cover all three scenarios.
verify: pnpm test
max_retries: 2
review: true
---

Optional free-form notes for the implementer. The implementer never sees the
orchestrator's conversation, so everything it needs must be in this file or in
`files_to_read`.

> Draft. The zod schema in `packages/core` becomes the source of truth in Stage 1.
