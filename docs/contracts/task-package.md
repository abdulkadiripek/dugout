# Contract: task package

The only thing an implementer agent receives from the orchestrator. The implementer never sees the orchestrator's conversation, so the package must be self-sufficient. Validated by a zod schema in `packages/core` (source of truth once it exists); `panosu delegate` refuses to start if validation fails.

A task package is a Markdown file: YAML frontmatter + optional free-form body.

## Fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string, `[a-z0-9-]+` | yes | Stable task name; becomes part of the task id and branch name. |
| `goal` | string, 1-2 sentences | yes | What must be true when done. Outcome, not steps. |
| `files_to_read` | string[] | yes (may be empty) | Repo-relative paths the implementer must read first. Keep it short; exact files beat directories. |
| `constraints` | string[] | yes (may be empty) | Things that must not change or happen. |
| `acceptance` | string[] | yes, at least 1 | Observable criteria. Each should map to a test. |
| `verify` | string | yes | Shell command run in the worktree after each attempt. Exit 0 = pass. |
| `max_retries` | integer 0-5 | no, default 2 | How many times a failed `verify` is fed back to the same provider. |
| `review` | boolean | no, default true | Run cross-review after `verify` passes. |
| `providers` | ("codex" \| "claude" \| "fake")[] | no, default `["codex","claude"]` | Provider order; later ones are fallbacks on `rate_limit`, `auth` or `crash`. |

Validation rules:
- `verify` is non-empty; `acceptance` has at least one item.
- Paths in `files_to_read` are repo-relative: reject absolute paths, `..` segments and backslashes. Symlink escapes are checked by the CLI when it resolves paths, not by `core`.
- Uniqueness is not required of `id`; the task id gets a random suffix.
- Parsing: `core` exposes `parseTaskPackage(markdown: string)` (frontmatter via the `yaml` package) and a zod schema for the parsed object.

## Example

```markdown
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
providers: [fake]
---

Optional notes for the implementer. Anything it needs must be here or in `files_to_read`.
```

## How the orchestrator should write one

- State the outcome, not the implementation.
- Every `acceptance` item is checkable by a command or a test.
- Do not paste large context; list files instead.
- If you cannot write a checkable acceptance criterion, the task is not ready to delegate.
