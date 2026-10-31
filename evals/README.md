# Golden task set

Small tasks with known answers, used to compare providers and models with data instead of impressions. The model scorecard is fed from these runs.

Layout per task (`evals/tasks/NN-<name>/`):

| Path | Purpose |
|---|---|
| `task.md` | The task package given to the implementer. Its `verify` runs the visible and the hidden tests. |
| `seed/` | Starting code. Copied into a fresh temp git repo and committed before the run. |
| `check/` | Hidden acceptance tests. Copied over the worktree **only when verifying**, never shown to the implementer. |
| `solution/` | Reference solution files, overlaid on `seed/` by tests to prove the check is satisfiable. Never given to an implementer. |

Runnable tasks use only Node built-ins (`node --test` with TypeScript type stripping; needs Node 24 or newer) so no install or network is needed. A task is **valid** when the seed fails its check and the seed with `solution/` passes it (tested in `packages/cli`).

Status: tasks 01, 02, 03, 05, 07 are runnable. 04 (needs `tsc` inside the seed), 06 (needs React and network) and 08 (the ambiguity report cannot be checked automatically) are **pending**; their `task.md` files are drafts.

`dugout eval <task|all>` (see `docs/contracts/cli.md`) runs the tasks through the normal delegate flow in a temp repo per task.

## Tasks

| # | Name | Tests whether the model can... |
|---|---|---|
| 01 | slugify | implement a small pure function from examples |
| 02 | fix-off-by-one | locate and fix a bug from a failing test |
| 03 | extract-function | refactor without changing behavior |
| 04 | fix-type-error | resolve a TypeScript error without `any` |
| 05 | add-tests | write meaningful tests for untested code |
| 06 | react-badge | build a small typed React component |
| 07 | rename-across-files | change a shared name consistently in two files |
| 08 | ambiguous-request | notice ambiguity and report it instead of guessing |

## Rules

- Every real run needs the maintainer's approval (it spends subscription quota); default is `fake`.
- Same package, same seed, same hidden check for every provider.
- Results are events like any other task; the scorecard reads them.
- Task 08 passes only if the implementer reports the ambiguity and changes nothing it cannot justify.
