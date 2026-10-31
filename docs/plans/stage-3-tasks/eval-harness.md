---
id: eval-harness
goal: Implement `panosu eval` in packages/cli exactly as specified in the "eval" section of docs/contracts/cli.md, tested with fake providers and a scripted spawn that applies each task's reference solution.
files_to_read:
  - AGENTS.md
  - docs/contracts/cli.md
  - evals/README.md
  - packages/cli/src/delegate.ts
  - packages/cli/src/cli.ts
  - packages/cli/src/list.ts
  - packages/cli/src/worktree.ts
  - packages/cli/src/evals.test.ts
  - packages/cli/src/real-providers.test.ts
  - packages/cli/src/test-helpers.ts
  - packages/cli/src/providers/test-helper.ts
  - evals/tasks/01-slugify/task.md
constraints:
  - Only add or edit files under packages/cli/src. Do not touch evals/, docs, package.json, lockfile, tsconfig or other packages. Existing behavior and every existing test must keep passing.
  - No new dependencies. No any. No comments unless explaining a non-obvious why. ESM NodeNext, relative imports end in .js.
  - Tests never start claude or codex: use fake mode and an injected scripted SpawnFn. Temp dirs only under os.tmpdir(); never touch ~/.ajan-panosu, ~/.claude, ~/.codex or the repo you run in. Only signal processes the code under test spawned.
  - Reuse delegate rather than duplicating it: add a narrow optional hook to delegate's options/deps for "files to overlay during verify" (the check/ directory) instead of copying delegate's body.
  - Do not run any claude or codex command.
acceptance:
  - `panosu eval` is wired in cli.ts with the flags and the quota guard of the contract (no --providers and no --scenario: exit 3, message mentions quota; nothing is created).
  - Task selection by number, name, directory name and `all` works; `all` skips directories without seed/ or check/ (tasks 04, 06, 08 today); an unknown task is exit 3.
  - Per task, a temp repo is created from seed/ and committed; the delegate flow runs with it; the printed lines and the `passed n/total` summary match the contract; temp dirs are removed unless --keep (then the path is printed with ~ substitution rules unchanged).
  - Hidden check overlay: the check/ files are present while verify runs and absent afterwards; they never appear in the task branch commit, the staged diff or diffStat; an overlay file that would overwrite an existing worktree file makes that task fail with a stderr message, without aborting the other tasks.
  - Tests (new file eval.test.ts, using the real evals/tasks directory resolved from the test file, copied or read-only): (1) fake mode `--scenario success` on `all` gives 5 tasks, all `failed` (the model changed nothing), `passed 0/5`, exit 0, and the five logs pass checkEventLog; (2) with a scripted spawn acting as the codex implementer that copies the task's solution/ files over its cwd (cwd given to spawn is the worktree), providers codex,claude with review off... use each task's own `review` setting, whose reviewer output can be scripted with a valid approve JSON, `all` gives `passed 5/5`; (3) the task branch commit contains the solution but none of the check/ files, for one task; (4) overlay collision case; (5) --keep prints a path and leaves the directory, otherwise it is gone; (6) unknown task, missing guard, selection forms.
  - Exit codes and output blocks of delegate/list are unchanged.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Suggested files: eval.ts (selection, temp repo creation, loop, summary), changes in delegate.ts limited to the hook, cli.ts wiring, eval.test.ts. Keep eval.ts small and readable.
