# Contract: provider adapter

All provider-specific mess (CLI flags, output parsing, limit detection) lives behind this interface. Orchestration code in `core` knows nothing about `claude` or `codex`.

## Interface (TypeScript sketch; the zod/TS source in `packages/core` is authoritative once it exists)

```ts
type ProviderName = "codex" | "claude" | "fake";

interface AttemptInput {
  taskId: string;
  attempt: number;
  cwd: string;            // the task worktree
  prompt: string;         // built from the task package (+ verify failure tail on retry)
  model?: string;
  signal: AbortSignal;
}

type ExitReason = "ok" | "rate_limit" | "auth" | "timeout" | "crash" | "invalid_output";

interface AttemptResult {
  exitReason: ExitReason;
  durationMs: number;
  usage?: { inputTokens: number; outputTokens: number };
}

interface ProviderAdapter {
  name: ProviderName;
  // Yields events of type provider.tool | provider.message | provider.usage, then returns the result.
  run(input: AttemptInput): AsyncGenerator<ProviderEvent, AttemptResult>;
  // Cross-review: reads the diff in cwd, returns a validated ReviewResult.
  review(input: { taskId: string; cwd: string; baseRef: string; model?: string; signal: AbortSignal }): Promise<ReviewResult>;
}
```

## Exit reasons and fallback

| `exitReason` | Meaning | Orchestrator reaction |
|---|---|---|
| `ok` | Provider finished normally | run `verify` |
| `rate_limit` | Subscription/usage limit reached | fallback to next provider |
| `auth` | Not logged in / expired | fallback, surface loudly |
| `timeout` | Exceeded attempt timeout | counts as failed attempt; retry or fallback |
| `crash` | Non-zero exit or killed unexpectedly | fallback |
| `invalid_output` | Output unparsable | counts as failed attempt |

## Configuration (defaults; overridable in `~/.ajan-panosu/config.json`)

| Key | Default |
|---|---|
| `models.codex` | `gpt-6-astra` (implementation), `gpt-6.1-sol` (review) |
| `models.claude` | `claude-sonnet-5-5` (implementation and review) |
| `models.fake` | `fake` |
| `attemptTimeoutMs` | `600000` |

File shape: `{ "models": { "<provider>": { "implement": "...", "review": "..." } }, "verifyTimeoutMs": 600000 }`; every key is optional and overrides the default. `verifyTimeoutMs` (default `600000`) bounds the verify runner (see `cli.md`).

Model names live only in config and fixtures, never in logic. Timeouts end an attempt with `exitReason: "timeout"`.

## `fake` provider scenarios

A scenario is a list of per-attempt outcomes per provider slot, e.g. `[{exit:"rate_limit"}]` for codex and `[{exit:"ok"}]` for claude, or `[{exit:"ok", verify:"fail"}, {exit:"ok", verify:"pass"}]` to script "fail then succeed". Built-ins: `success`, `fail`, `rate_limit`, `crash`.

## Verification status of real providers (update when observed)

| Provider | Invocation (planned) | Verified? |
|---|---|---|
| `fake` | in-process, scripted scenarios | n/a |
| `claude` | `claude -p --model <m> --output-format json` (stream-json still untested) | **Partly.** One call observed 2026-10-31, see below. Limit behavior unknown. |
| `codex` | `codex exec --json -m <m> -s read-only -C <cwd> "<prompt>" < /dev/null` | **Partly.** One call observed 2026-10-31, see below. Limit behavior unknown. |

Rule: a real adapter may only be written after one cheap approved call has been observed and a sanitized sample saved to `fixtures/providers/<provider>/`. Rate-limit detection stays "unknown" until a real limit is seen; until then it is implemented only for `fake`.

### Observed: `claude -p --output-format json` (sample: `fixtures/providers/claude/print-json.sample.json`)
- Single JSON object, exit 0. Useful keys: `type: "result"`, `subtype` (`success`), `is_error`, `stop_reason`, `terminal_reason`, `result` (only the **last** assistant message), `num_turns`, `duration_ms`, `total_cost_usd`, `usage` (`input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`), `modelUsage` (per model), `permission_denials[]`, `session_id`.
- A read-only question that read ~10 docs took 15 turns, ~22 s, and ~190k total input tokens (mostly cache). `total_cost_usd` is an API-price estimate, not subscription usage.
- Tools not in `--allowedTools` are denied and listed in `permission_denials` (the run still succeeds); the adapter should treat denials as a signal, not an error.
- `usage.input_tokens` is tiny because of caching; token accounting for events must sum input + cache read + cache creation.

### Observed: `codex exec --json` (sample: `fixtures/providers/codex/exec-json.sample.jsonl`)
- JSONL events seen: `thread.started` (`thread_id`), `turn.started`, `item.completed` (`item.type: "agent_message"`, `item.text`), `turn.completed` (`usage`: `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens`, `reasoning_output_tokens`). Tool-call item types were not seen (the model made no tool calls).
- **stdin must be closed** (`< /dev/null`). Without it `codex exec` printed "Reading additional input from stdin..." and hung until killed (280 s, 0 events). The message also appears with `/dev/null` but the run then proceeds.
- With `-m gpt-6-luna -s read-only` the model reported it could not read workspace files at all (no file-reading route), so it could not read `docs/plans/stage-1.md`. Cause unknown (sandbox on this Linux setup, or the model/tool configuration). Treat Codex-as-implementer in `read-only`/worktree as **unverified**; investigate with `-s workspace-write` in a throwaway worktree during Stage 3 before relying on it.
- `AGENTS.md` was loaded automatically at startup (the model reproduced the rules before reading any file).
- Exit code 0 on success. Limit and auth failure exit codes: unknown.

### Observed: `codex exec --json -m gpt-6-astra -s workspace-write` in a worktree (sample: `fixtures/providers/codex/exec-json-tools.sample.jsonl`)
- Observed 2026-10-31, one turn, in a throwaway worktree. The model read `AGENTS.md`, created a file and ran `pnpm typecheck` (exit 0). The `read-only` file-reading problem above did not occur with `workspace-write`; whether it comes from the sandbox mode or the model is still unknown.
- Tool items: `item.started` / `item.completed` with `item.type: "command_execution"` (`command`, `aggregated_output`, `exit_code`, `status`) and `item.type: "file_change"` (`changes[]` of `path` + `kind`, absolute paths, `status`). Map to `provider.tool` events with relative paths and no output.
- `-o <file>` wrote the last agent message to a file; the same text came as the final `item.completed` `agent_message`.
- Stderr carried only "Reading additional input from stdin..." (harmless with stdin closed).
- Sample is sanitized: thread id zeroed, `aggregated_output` omitted, paths made relative.
