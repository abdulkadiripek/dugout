---
id: provider-adapters
goal: Implement the Codex and Claude provider adapters (implement and review modes) in packages/cli/src/providers behind an injected spawn seam, tested by replaying the recorded real samples in fixtures/providers.
files_to_read:
  - AGENTS.md
  - docs/contracts/provider-adapter.md
  - docs/contracts/review-result.md
  - docs/contracts/events.md
  - docs/plans/stage-3.md
  - fixtures/providers/claude/stream-json-implement.sample.jsonl
  - fixtures/providers/claude/print-json-review.sample.json
  - fixtures/providers/codex/exec-json-tools.sample.jsonl
  - fixtures/providers/codex/exec-json-review.sample.jsonl
  - fixtures/providers/codex/exec-json-schema-error.sample.jsonl
  - fixtures/providers/codex/review-output.schema.json
  - packages/cli/src/verify-runner.ts
  - packages/cli/src/index.ts
  - packages/core/src/adapter.ts
  - packages/core/src/review.ts
  - packages/core/src/index.ts
constraints:
  - Only add or edit files under packages/cli/src/providers, plus one line added to packages/cli/src/index.ts to export them. Do not touch package.json, lockfile, tsconfig, other packages, fixtures or docs.
  - No new dependencies. Node built-ins and "@dugout/core" only. No any. No comments unless explaining a non-obvious why. ESM NodeNext, relative imports end in .js.
  - Behavior must follow docs/contracts/provider-adapter.md exactly, including the observed command lines. Do not invent flags, event types or exit codes that are not in the contract or the samples. In particular rate_limit and auth are NOT detected in this stage: a failing run is `crash`; a rate_limit_event is ignored.
  - Spawned processes: stdin ignored, own process group (detached), only that group is ever signalled (SIGTERM, then SIGKILL after 2 s). Never use pkill or killall.
  - Tests must not start claude or codex. They use the spawn seam with scripted processes built from the recorded samples, plus real child processes of `sh`/`node` only for the spawn-seam test itself. Temp dirs only under os.tmpdir(); never touch ~/.dugout, ~/.claude, ~/.codex or the repo you run in.
  - Do not run any claude or codex command.
acceptance:
  - spawn.ts exports the seam: `SpawnedProcess = { lines: AsyncIterable<string>; stderr(): string; exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>; killGroup(signal: NodeJS.Signals): void }` and `SpawnFn = (command: string, args: string[], opts: { cwd: string }) => SpawnedProcess`, plus `spawnReal: SpawnFn` (child_process.spawn, detached, stdin ignored, stdout split into lines, stderr buffered up to 64 KB). A test with real `sh` processes covers: lines split correctly across chunks, exit code, stderr capture, and killGroup terminating a `sleep 30` and its child.
  - review-prompt.ts exports `reviewJsonSchema` (the schema in fixtures/providers/codex/review-output.schema.json, as a typed constant), `buildReviewPrompt({ goal, acceptance, diff })`, `truncateDiff(diff, maxBytes)` (default budget 60000 bytes; when truncated the result ends with a line `[diff truncated: <n> bytes omitted]`, cutting on a line boundary) and `defaultGetDiff(cwd, baseRef)` running `git diff --cached <baseRef>` with execFile. Tests: prompt contains goal, every acceptance item and the diff; truncation marker and byte accounting; a diff within budget is untouched.
  - codex.ts exports `createCodexAdapter(opts)` with opts `{ spawn?: SpawnFn; attemptTimeoutMs?: number (default 600000); getDiff?: (cwd, baseRef) => Promise<string>; context: () => { goal: string; acceptance: string[] } }`. run() spawns exactly `codex exec --json -m <model> -s workspace-write -C <cwd> <prompt>`; maps `item.completed` command_execution to provider.tool (name "command", summary = first line of the command with the cwd prefix removed, at most 80 chars), file_change to provider.tool (name "edit", summary = the changed paths relative to cwd, joined by ", ", at most 200 chars; absolute paths outside cwd shown as "(outside worktree)"), agent_message to provider.message (text truncated to 500 chars), turn.completed to provider.usage (inputTokens = input_tokens, outputTokens = output_tokens) and into AttemptResult.usage. Result: exit code 0 and a turn.completed seen gives `ok`; a `turn.failed` or `error` event, a non-zero exit code or death by signal gives `crash`; exit 0 without turn.completed gives `invalid_output`; exceeding attemptTimeoutMs or an aborted input.signal kills the process group and gives `timeout` (a timeout wins over what the process printed afterwards). durationMs is measured with performance.now(). Replaying fixtures/providers/codex/exec-json-tools.sample.jsonl yields ok, a command tool event, an edit tool event whose summary is the relative path, a message and usage. Replaying exec-json-schema-error.sample.jsonl with exit code 1 yields crash.
  - codex.ts review(): obtains the diff with getDiff (default defaultGetDiff), spawns `codex exec --json -m <model> -s read-only -C <cwd> --skip-git-repo-check --ephemeral --output-schema <file> <prompt>` where <file> is a temp file holding reviewJsonSchema written by the adapter and removed afterwards (also on failure), takes the last `agent_message` text, JSON.parses it and returns normalizeReview(...). Any failure (crash, invalid JSON, timeout, normalizeReview error) throws an Error with a short readable message that contains no diff text. Replaying exec-json-review.sample.jsonl returns approve (the model's declared changes_requested with only a minor issue is recomputed) with one minor issue and no `line` null leak.
  - claude.ts exports `createClaudeAdapter(opts)` with the same opts. run() spawns exactly `claude -p <prompt> --model <model> --output-format stream-json --verbose --no-session-persistence --permission-mode acceptEdits --allowedTools Write Edit Read` (prompt before the variadic flag), cwd = input.cwd; maps assistant `tool_use` content items to provider.tool (name = lowercased tool name, summary = file_path input relative to cwd, or "" when absent), assistant `text` items to provider.message (500 chars), the final `result` event to provider.usage and AttemptResult.usage (inputTokens = input_tokens + cache_read_input_tokens + cache_creation_input_tokens, outputTokens = output_tokens). Result: a `result` event with subtype "success" and is_error false and exit code 0 gives `ok`; is_error true, other subtype, non-zero exit or signal gives `crash`; exit 0 without a result event gives `invalid_output`; timeout/abort as in codex. rate_limit_event and system events are ignored. Replaying fixtures/providers/claude/stream-json-implement.sample.jsonl yields ok, a "write" tool event with a relative summary, a message and usage.
  - claude.ts review(): spawns `claude -p <prompt> --model <model> --output-format json --json-schema <reviewJsonSchema as JSON> --no-session-persistence --tools ""` (prompt first), collects stdout lines into one JSON document, uses `structured_output` when it is an object and otherwise JSON.parses `result`, then normalizeReview. is_error true or any failure throws as in codex. Replaying fixtures/providers/claude/print-json-review.sample.json (split into lines as it is on disk) returns changes_requested with two major issues.
  - Both adapters: `name` is "codex" / "claude"; the prompt passed to the CLI is exactly input.prompt for run() and buildReviewPrompt(...) for review(); no secrets or environment are logged; events from the CLI that are not mapped are dropped silently.
  - Timeout tests use the seam with a scripted process that never exits and a tiny attemptTimeoutMs, and assert killGroup was called with SIGTERM and the result is `timeout`.
  - index.ts additionally exports createCodexAdapter, createClaudeAdapter, spawnReal and the types.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Layout: packages/cli/src/providers/{spawn,review-prompt,codex,claude}.ts, each with a *.test.ts, plus a small test-only helper that builds a scripted SpawnedProcess from lines, an exit code and an optional "never exits" flag. Tests read the sample files from the repo using a path resolved from import.meta.url. Keep each adapter one readable file; share only what is truly shared (the seam, prompt, timeout/kill logic can live in spawn.ts or a small helper).
