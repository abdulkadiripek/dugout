# Ajan Panosu (agent-board)

A small, local TypeScript tool that lets one orchestrator agent (Claude Opus) hand coding tasks to other agents and shows what happened.

- **Delegate:** `panosu delegate task.md` runs a task package in its own git worktree. Order: Codex (`gpt-6-astra`) first; if Codex hits its limit, fall back to Claude Sonnet.
- **Verify:** the task's `verify` command runs after every attempt; failures are fed back to the same provider up to `max_retries`.
- **Cross-review:** the other provider reviews the diff and returns structured JSON.
- **Observe:** a web board (retrospective first) reads the event log and git diffs; it never controls anything in v1.

Bring-your-own-subscription: only official CLIs (`claude`, `codex`) run as child processes. No token extraction, no credential reading.

## Status

Stages 1-4 of 6 are implemented: core, `panosu delegate` / `list` / `eval`, real Codex and Claude adapters, the read-only API, and the React board (`pnpm demo`). Stage 5 (dogfood) is under way; Stage 6 (portfolio polish) waits for the maintainer's license, name and remote decisions. Stages and decisions: `docs/architecture.md`, `docs/adr/`.

## Commands

These work from the repo root:

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm demo        # board with fixture data, no model calls
```

Runtime: Node + pnpm (installed). `tmux` and `bun` are not installed and not required.

## Architecture boundaries

```
packages/core    # schemas (zod), adapter interface, fallback, verify loop. Depends on nothing else here.
packages/cli     # `panosu` command. Depends on core.
packages/server  # Hono API, read-only. Depends on core.
packages/web     # React + Vite UI. Talks to server over HTTP only; never imports server or cli. May `import type` from core.
```

- `core` has no I/O side effects at import time and does not spawn processes directly; spawning lives behind the adapter interface.
- The event log is the single source of truth for the board: `~/.ajan-panosu/events/<task-id>.jsonl` (outside the repo). Never read `~/.claude/projects/**` or `~/.codex/**` transcripts for board data.

## Hard rules

1. **Real model calls cost subscription quota.** Never run `claude -p`, `codex exec` or any real-provider mode on your own initiative. Default provider is `fake`. A real call needs explicit approval from the maintainer, the cheapest model, one turn.
2. **Do not assert unverified CLI behavior.** What has and has not been observed for `claude`/`codex` (output shapes, exit codes, rate-limit messages) is recorded in `docs/contracts/provider-adapter.md`. For anything not listed there, observe with one cheap approved call, save a sanitized sample under `fixtures/providers/`, then write code. When spawning `codex exec`, always close stdin (`< /dev/null`) or it hangs.
3. **Self-harm paths (never):**
   - kill processes by pattern (`pkill`, `killall`); only terminate PIDs this program started
   - write to `~/.claude/`, `~/.codex/` or any live user data; read-only, and never auth files
   - run experiments against real user data; use a temp dir or fixtures
   - run agent tasks in the main working tree; one worktree per task
4. Never commit secrets, `.env*`, local settings, absolute home paths or personal data. The repo is public.
5. Contracts first: change `docs/contracts/*` (and the matching zod schema and fixtures) before changing behavior that depends on them.
6. If a request conflicts with an ADR in `docs/adr/`, stop and say so; do not silently deviate. Decisions change through a new ADR.
7. When unsure about a product decision, ask. Do not guess.

## Conventions

- TypeScript `strict`, `noUncheckedIndexedAccess`. No `any` without a comment explaining why.
- Schemas are zod; types are inferred from them, never duplicated by hand.
- No comments by default. Add one only for a non-obvious why.
- Prefer deleting complexity over preserving it. Smallest model that makes behavior unsurprising.
- Money/limits: do not hardcode provider limits; they are observed, not assumed.
- Commits: small, English, imperative. No AI attribution lines in commits or PRs.
- Add a dependency only with a stated reason; keep the dependency list short.

## Definition of done

1. Acceptance criteria of the task package are covered by tests that fail without the change.
2. `pnpm lint && pnpm typecheck && pnpm test` pass (when the workspace exists).
3. Contracts and fixtures updated if behavior they describe changed.
4. No real model call was made unless explicitly approved.
5. Report: what changed, what was not done, what is unverified. Do not claim verification you did not run.

## If you are an implementer agent

You receive a task package (`docs/contracts/task-package.md`) and nothing else from the orchestrator. Read `files_to_read`, respect `constraints`, satisfy `acceptance`, and make `verify` pass. If the package is ambiguous or contradicts the repo, say so instead of guessing. Do not edit files outside the task's scope.

## Where to look

| Need | File |
|---|---|
| Why this exists, non-goals | `docs/PRD.md` |
| Components, data flow, stages | `docs/architecture.md` |
| Vocabulary (task, attempt, run, verdict) | `docs/glossary.md` |
| Event types and fields | `docs/contracts/events.md` |
| Task package format | `docs/contracts/task-package.md` |
| Provider adapter interface, exit reasons | `docs/contracts/provider-adapter.md` |
| CLI commands, output, exit codes | `docs/contracts/cli.md` |
| How the orchestrator delegates and reads results | `docs/orchestrator-guide.md` |
| Board API | `docs/contracts/api.md` |
| Review JSON | `docs/contracts/review-result.md` |
| Example event logs | `fixtures/events/*.jsonl` |
| Past decisions and rejected options | `docs/adr/` |
| UI direction and screens | `docs/design.md` |
| Current stage plan | `docs/plans/stage-1.md`, `stage-2.md` |
| Model comparison tasks | `evals/README.md` |

Read only what the task needs.
