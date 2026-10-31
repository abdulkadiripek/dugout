# Golden task set

Small tasks with known answers, used to compare providers and models with data instead of impressions. The model scorecard is fed from these runs.

Layout per task (`evals/tasks/NN-<name>/`):

| Path | Purpose |
|---|---|
| `task.md` | The task package given to the implementer. |
| `seed/` | Starting code copied into a fresh worktree. (Written before Stage 3.) |
| `check/` | Hidden acceptance tests, copied in only when verifying. **Never shown to the implementer.** (Written before Stage 3.) |

Right now only `task.md` files exist (drafts). `seed/` and `check/` are written before the eval harness (`panosu eval`, after Stage 3).

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
