---
id: eval-seeds
goal: Write seed, hidden check and reference solution for the five dependency-free golden tasks (01, 02, 03, 05, 07) and a test proving each task is valid.
files_to_read:
  - AGENTS.md
  - evals/README.md
  - evals/tasks/01-slugify/task.md
  - evals/tasks/02-fix-off-by-one/task.md
  - evals/tasks/03-extract-function/task.md
  - evals/tasks/05-add-tests/task.md
  - evals/tasks/07-rename-across-files/task.md
  - packages/cli/src/worktree.ts
  - packages/cli/src/verify-runner.ts
constraints:
  - Only add or edit files under evals/tasks/{01-slugify,02-fix-off-by-one,03-extract-function,05-add-tests,07-rename-across-files}/ and add one test file packages/cli/src/evals.test.ts. Do not touch tasks 04, 06, 08, evals/README.md, package.json, the lockfile, tsconfig, other packages or docs.
  - Seeds use only Node built-ins. No package.json dependencies, no install step. TypeScript is run by Node's type stripping, so use erasable syntax only (no enums, no namespaces, no parameter properties), and relative imports include the .ts extension. Tests use node:test and node:assert/strict.
  - Each task.md keeps its id and intent but its `verify` becomes a single command that runs both the visible tests and the hidden check from the repo root, for example `node --test`; adjust `files_to_read` to the real seed files, keep acceptance items checkable, and keep max_retries and review as they are. Set `providers` to [codex, claude].
  - The hidden check files must not be referenced from task.md or seed/. The solution must not live in seed/. Do not include the answer anywhere the implementer reads (task.md, seed/, comments).
  - The seed must fail the hidden check, and must not already pass it. Visible seed tests (if any) may pass or fail but must not reveal the hidden cases.
  - Task 05 (add-tests): the check must measure test quality, not only existence, for example by running the implementer's tests against a few deliberately broken copies of the code (mutants shipped in check/) and requiring failures. Keep it deterministic.
  - Task 03 (extract-function): the check verifies unchanged behavior with fixed cases and that the new exported function exists with the name the task states.
  - Task 07 (rename-across-files): the check verifies the old name no longer appears in the two files (word-boundary search) and that behavior is unchanged.
  - Do not run any claude or codex command.
acceptance:
  - For each of the five tasks the directories seed/, check/ and solution/ exist and contain the files needed; task.md frontmatter parses with parseTaskPackage from @panosu/core and has the single-command verify.
  - evals.test.ts, for each task: copies seed into a temp dir, overlays check/, runs the task's verify command there with the existing runVerifyCommand and asserts it FAILS (exit code non-zero); then overlays solution/ and asserts it PASSES. Temp dirs under os.tmpdir() only, removed afterwards. The test discovers tasks by listing the runnable directories above (a constant list in the test), not by scanning evals/ (the pending tasks have no seed).
  - Everything runs offline in under 30 seconds in total on Node 24+. If the local Node cannot run the chosen test command, say exactly what failed instead of weakening the check.
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 2
review: false
providers: [codex, claude]
---

Keep seeds small (a few files, under ~60 lines each). The golden tasks compare models, so the hidden checks should be unambiguous: every behavior the check demands must be stated in the task's acceptance list. Put a short README.md inside each seed only if the task needs one.
