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

## Verification status of real providers (update when observed)

| Provider | Invocation (planned) | Verified? |
|---|---|---|
| `fake` | in-process, scripted scenarios: `success`, `fail`, `rate_limit`, `crash` | n/a |
| `claude` | `claude -p --model <m> --output-format stream-json` | **No.** Event schema, exit code and message on limit are unknown. |
| `codex` | `codex exec --json -m <m> --output-schema <file> -C <cwd>` | **No.** `--json` schema, exit codes and limit behavior unknown; flags exist per `--help`. |

Rule: a real adapter may only be written after one cheap approved call has been observed and a sanitized sample saved to `fixtures/providers/<provider>/`. Rate-limit detection stays "unknown" until a real limit is seen; until then it is implemented only for `fake`.
