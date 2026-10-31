# ADR 0008: Review embeds the diff; only observed failures are classified

Status: accepted (2026-10-31)

## Context
Cross-review must work the same for Codex and Claude. Early observation showed Codex unable to read workspace files under `-s read-only`, and giving a reviewer tools means giving it write risk. Separately, nobody can know how each CLI reports a rate limit, an auth problem or a crash until it happens.

## Decision
- The reviewer gets the diff (`git diff --cached <baseRef>`, truncated to a byte budget with a visible marker) inside its prompt and no tools. Its answer is JSON; the adapter derives `verdict` from the issues itself because a model contradicted the rule once (`changes_requested` with only a minor issue).
- If a reviewer throws or returns invalid output, `runTask` still writes `review.finished` with a single `blocker` issue "review unavailable: <reason>"; the task ends `needs_review`. The log never ends without `task.finished` because a reviewer failed.
- Failure modes are classified only after a real one was seen. Codex's usage limit was observed (an `error` / `turn.failed` event whose message contains "usage limit", exit code 1) and maps to `rate_limit`. Claude's limit shape and every `auth` failure were not observed and surface as `crash`, which falls back all the same. Shapes are recorded in `docs/contracts/provider-adapter.md` with sanitized samples in `fixtures/providers/`.
- A task package may carry a `setup` command, run once in the worktree before the first attempt; a failing setup ends the task `failed` without attempts.

## Alternatives considered
- Reviewer with read tools in the worktree: depends on each CLI's sandbox and adds write risk.
- Guessing rate-limit and auth messages up front: violates the rule against asserting unverified CLI behavior.

## Consequences
The reviewer sees only the diff and the acceptance list, so the orchestrator still reads the diff before merging (`docs/orchestrator-guide.md`). A provider limit during review is visible and safe, but it needs a human look. Live behavior of both reviewers was observed (see the fixtures `real-codex-claude.jsonl` and `real-review-unavailable.jsonl`).
