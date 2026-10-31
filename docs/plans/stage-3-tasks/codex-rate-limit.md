---
id: codex-rate-limit
goal: Make the Codex adapter report exitReason rate_limit when Codex stops with the observed usage-limit error, as specified in docs/contracts/provider-adapter.md, covered by a test that replays the recorded sample.
files_to_read:
  - AGENTS.md
  - docs/contracts/provider-adapter.md
  - fixtures/providers/codex/exec-json-usage-limit.sample.jsonl
  - fixtures/providers/codex/exec-json-schema-error.sample.jsonl
  - packages/cli/src/providers/codex.ts
  - packages/cli/src/providers/codex.test.ts
  - packages/cli/src/providers/test-helper.ts
constraints:
  - Only edit packages/cli/src/providers/codex.ts and packages/cli/src/providers/codex.test.ts. Do not touch anything else; existing tests must keep passing unchanged.
  - Follow the contract exactly: only `error` / `turn.failed` messages containing "usage limit" (case-insensitive) map to rate_limit; every other failure stays crash (the schema-error sample must still give crash). Do not parse the reset time, do not detect auth.
  - No new dependencies. No any. No comments unless explaining a non-obvious why.
  - Do not run any claude or codex command.
acceptance:
  - Replaying exec-json-usage-limit.sample.jsonl with exit code 1 makes run() return exitReason rate_limit; the same lines with exit code 0 and no turn.completed do not (invalid_output as before), and exec-json-schema-error.sample.jsonl still gives crash.
  - review() on a usage-limit failure throws an Error whose message says the Codex usage limit was hit (so the review-unavailable blocker is readable) and contains no URL.
  - A usage-limit message in a provider.message / agent_message text (not in an error event) does not trigger rate_limit.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---
