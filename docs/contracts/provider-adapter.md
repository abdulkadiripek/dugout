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
| `claude` (implement) | `claude -p "<prompt>" --model <m> --output-format stream-json --verbose --no-session-persistence --permission-mode acceptEdits --allowedTools Write Edit Read < /dev/null` | **Yes** (one call, 2026-10-31). Limit/auth failure shapes unknown. |
| `claude` (review) | `claude -p "<prompt>" --model <m> --output-format json --json-schema '<schema>' --no-session-persistence --tools "" < /dev/null` | **Yes** (one call). |
| `codex` (implement) | `codex exec --json -m <m> -s workspace-write -C <cwd> "<prompt>" < /dev/null` | **Yes** (several calls in a worktree). Limit/auth failure shapes unknown. |
| `codex` (review) | `codex exec --json -m <m> -s read-only -C <cwd> --skip-git-repo-check --ephemeral --output-schema <file> -o <out> "<prompt>" < /dev/null` | **Yes** (one call). |

Rule: a real adapter may only be written after one cheap approved call has been observed and a sanitized sample saved to `fixtures/providers/<provider>/`. Rate-limit detection stays "unknown" until a real limit is seen; until then it is implemented only for `fake`.

### Observed: `claude -p --output-format json` (sample: `fixtures/providers/claude/print-json.sample.json`)
- Single JSON object, exit 0. Useful keys: `type: "result"`, `subtype` (`success`), `is_error`, `stop_reason`, `terminal_reason`, `result` (only the **last** assistant message), `num_turns`, `duration_ms`, `total_cost_usd`, `usage` (`input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`), `modelUsage` (per model), `permission_denials[]`, `session_id`.
- A read-only question that read ~10 docs took 15 turns, ~22 s, and ~190k total input tokens (mostly cache). `total_cost_usd` is an API-price estimate, not subscription usage.
- Tools not in `--allowedTools` are denied and listed in `permission_denials` (the run still succeeds); the adapter should treat denials as a signal, not an error.
- `usage.input_tokens` is tiny because of caching; token accounting for events must sum input + cache read + cache creation.

### Observed 2026-10-31: `claude -p` stream-json as implementer (sample: `fixtures/providers/claude/stream-json-implement.sample.jsonl`)
- Prompt must come **before** the variadic flags (`--allowedTools`, `--tools`); otherwise the flag swallows it and the CLI exits 1 with "Input must be provided either through stdin or as a prompt argument". Close stdin.
- Line-delimited JSON. Types seen: `system` (`init` with `model`, `cwd`, `permissionMode`; also `hook_started`/`hook_response` from the user's own hooks, and `thinking_tokens`), `assistant` (`message.content[]` items of type `thinking`, `tool_use` with `name` and `input`, or `text`), `user` (`tool_result`), `rate_limit_event`, and a final `result` (same shape as the `--output-format json` object: `subtype`, `is_error`, `num_turns`, `usage`, `permission_denials`, `total_cost_usd`). Exit code 0.
- `rate_limit_event.rate_limit_info`: `status` (only `"allowed"` seen), `rateLimitType`, `resetsAt` (epoch seconds), `unifiedWindows.five_hour` / `seven_day` with `utilization` (0-1) and `status`. Values of `status` other than `allowed` are **unobserved**. `apiKeySource` is `none` in `init` (subscription login).
- Writing a file in the cwd with `acceptEdits` + `--allowedTools Write Edit Read` worked; `permission_denials` was empty.
- A haiku-class model finished in 2 turns, ~5 s.

### Observed 2026-10-31: `claude -p --json-schema` as reviewer (sample: `fixtures/providers/claude/print-json-review.sample.json`)
- With the diff in the prompt and `--tools ""`, the result object has `structured_output` (parsed object) and `result` (the same JSON as a string), `is_error: false`, `num_turns` 2.

### Observed 2026-10-31: `codex exec --output-schema` as reviewer (samples: `fixtures/providers/codex/exec-json-review.sample.jsonl`, `exec-json-schema-error.sample.jsonl`, `review-output.schema.json`)
- The schema must satisfy OpenAI strict mode: **every property listed in `required`**, `additionalProperties: false`. An optional `line` is rejected: events `error` + `turn.failed` with message `Invalid schema for response_format ... Missing 'line'`, exit code 1, no `-o` file. The working schema makes `line` `["integer","null"]` and required; the adapter drops `null` lines.
- On success: `thread.started`, `turn.started`, `item.completed` (`agent_message`, text is the JSON), `turn.completed`; the `-o` file holds the same JSON. With `-s read-only` and the diff in the prompt no file access was needed.
- The model returned `verdict: "changes_requested"` with only a `minor` issue, contradicting the verdict rule of `review-result.md`. Adapters therefore **derive the verdict from the issues** (see `review-result.md`).

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
