# Glossary

Use these words exactly; do not invent synonyms.

| Term | Meaning |
|---|---|
| **Orchestrator** | The Claude Opus session that decomposes work and writes task packages. Stays thin. |
| **Implementer** | A provider executing a task package inside a worktree. Sees only the package. |
| **Provider** | A coding-agent backend behind an adapter: `codex`, `claude`, or `fake`. |
| **Adapter** | The code that runs one provider and normalizes its output to events and an exit reason. |
| **Task package** | The Markdown+frontmatter file that fully specifies one task (`docs/contracts/task-package.md`). |
| **Task** | One execution of a task package. Identified by `taskId`. |
| **Attempt** | One provider run within a task. Numbered from 1. Reason: `initial`, `retry` (same provider after failed verify) or `fallback` (next provider). |
| **Verify** | The package's shell command run in the worktree after an attempt. |
| **Fallback** | Switching to the next provider because of `rate_limit`, `auth` or `crash`. |
| **Retry** | Re-running the same provider with the failed verify output after a failed verify. |
| **Cross-review** | Review of the final diff by a different provider than the implementer. |
| **Verdict** | Review outcome: `approve` or `changes_requested`. |
| **Status** | Final task outcome: `passed`, `needs_review`, `failed` (plus `interrupted` for a log with no end). |
| **Event** | One JSON line in a task's log (`docs/contracts/events.md`). |
| **Worktree** | The task's own `git worktree` under `.worktrees/`. |
| **Scorecard** | Per-provider/model statistics derived from event logs. |
| **Golden task** | A small task with a known answer used to compare providers (`evals/`). |
| **Fixture** | Hand-written or sanitized sample data used by tests and the demo. |
