# Contract: review result

Returned by a provider's cross-review of a task diff. Must be valid JSON matching this shape; anything else is `invalid_output`. Codex can enforce it with `--output-schema`.

```json
{
  "verdict": "approve" | "changes_requested",
  "summary": "one or two sentences",
  "issues": [
    { "file": "packages/core/src/text.ts", "line": 12, "severity": "blocker" | "major" | "minor" | "nit", "message": "what is wrong and why" }
  ]
}
```

Rules:
- Adapters derive `verdict` from `issues` with the rule below and ignore the model's own `verdict` (observed: a model answered `changes_requested` with only a `minor` issue). The schema still rejects a final result whose verdict disagrees with its issues.
- `verdict` is `changes_requested` if any issue is `blocker` or `major`; otherwise `approve` (minor/nit issues may accompany an approval).
- `file` is repo-relative; `line` is optional for file-level issues.
- The reviewer sees the diff and `acceptance`, not the implementer's reasoning.
- The orchestrator receives only `verdict`, `summary` and issue counts by severity, not the full diff.
