# Getting started

How to use Dugout on your own project, step by step. Everything below assumes Linux or macOS, Node 24+, pnpm, git, and the `claude` and/or `codex` CLIs installed and logged in.

## 1. Install once

```
git clone https://github.com/abdulkadiripek/dugout.git
cd dugout
pnpm install
pnpm build
```

Check that the providers you want are logged in (`codex login status`; run `claude` once interactively). Dugout never reads their credentials, it only starts the official CLIs.

## 2. Make a `dugout` command

The CLI is `packages/cli/dist/bin.js`. Give it a short name, for example in fish:

```
alias dugout 'node ~/path/to/dugout/packages/cli/dist/bin.js'
funcsave dugout
```

bash/zsh: `alias dugout='node ~/path/to/dugout/packages/cli/dist/bin.js'` in your shell profile.

`dugout` alone prints the usage. `dugout list` shows recent tasks.

## 3. Try it without spending quota

Fake mode runs the whole flow (worktree, verify, review, log) with scripted providers:

```
cd your-project            # any git repository with at least one commit
dugout delegate task.md --scenario success
```

`--scenario` can be `success`, `fallback` (first provider hits a limit, the second takes over), `review-issues` or `all-failed`.

## 4. Write a task package

A task package is the only thing the implementer sees. Save it anywhere (it does not have to be committed), for example `task.md`:

```markdown
---
id: add-slugify
goal: "Add slugify(text) in src/slugify.js, with tests."
files_to_read:
  - "src/index.js"
constraints:
  - "No new dependencies."
acceptance:
  - "slugify(\"Hello World\") returns \"hello-world\"."
  - "Leading and trailing separators are removed."
verify: "node --test"
setup: "npm ci"
max_retries: 2
review: true
providers: [codex, claude]
---
```

Rules that matter:

- `verify` is one command; exit code 0 means done. It runs in the task's worktree after every attempt.
- `setup` (optional) runs once before the first attempt. A fresh worktree has no `node_modules`, so use it to install dependencies.
- The worktree is created from the **committed** state of your current branch. Uncommitted changes in your working tree are not included.
- Quote every list item and string in the YAML frontmatter with double quotes: an item that starts with a backtick or contains `: ` breaks YAML. An invalid package stops with exit code 3 before anything is created.
- Every `acceptance` item should be checkable by a command or a test.

More detail: `docs/contracts/task-package.md` and `docs/orchestrator-guide.md`.

## 5. Run it for real

From the project directory (the repository is the git root of the current directory, or pass `--repo`):

```
dugout delegate task.md
```

This spends subscription quota. You get one short block:

```
task: add-slugify-3f2a
status: passed
attempts: 1
providers: codex
review: approve (blocker 0, major 0, minor 0, nit 0)
log: ~/.dugout/events/add-slugify-3f2a.jsonl
```

Exit codes: 0 passed, 1 needs_review, 2 failed, 3 invalid input, 130 interrupted. If Codex reports its usage limit the run continues with Claude on its own (`fallback.triggered` in the log).

## 6. Look at the result and merge it yourself

Dugout never merges. The work is a commit on branch `dugout/<task-id>`, checked out in `.worktrees/<task-id>`:

```
git diff main...dugout/add-slugify-3f2a      # read what changed
git merge dugout/add-slugify-3f2a            # accept it (your decision)
git worktree remove .worktrees/add-slugify-3f2a
```

`needs_review` means the checks passed but the reviewer asked for changes, or the review itself was unavailable (for example the other provider hit its limit); read the issues in the log or board before merging. `failed` means your verify command never passed within the retry budget, or every provider failed.

## 7. Watch it on the board

The board reads the event logs. Two terminals, from the dugout directory:

```
node packages/server/dist/bin.js --repo ~/path/to/your-project     # API on 127.0.0.1:4317
pnpm --filter @dugout/web dev                                       # UI on http://localhost:5173
```

Open `http://localhost:5173`. The `--repo` is where task branches live, so the diff view works. `pnpm demo` opens the same board on the bundled fixture logs without any model calls.

## 8. Let Claude Code drive it

You can ask your Claude Code session to delegate for you. Add this to the `CLAUDE.md` of your project:

```markdown
## Delegating with Dugout
For bounded changes that a command can verify, write a task package (see the dugout repo,
docs/orchestrator-guide.md) and run `dugout delegate <package>` instead of editing yourself.
Read only the short result block; read the diff (`git diff main...dugout/<task-id>`) before
suggesting a merge. Never merge without asking. Real runs spend subscription quota.
```

## 9. Configuration

`~/.dugout/config.json` is optional (models, timeouts, the tools Claude may use). See the README. By default the Claude implementer gets only `Write Edit Read`; add `"Bash(npm *)"` style patterns to `claude.allowedTools` if you want it to run your project's own commands (there is no sandbox on the Claude side, see `SECURITY.md`).

## Troubleshooting

| Symptom | Cause |
|---|---|
| exit 3, "frontmatter" or YAML error | quote the list items; check the field named in the message |
| `status: failed`, 0 attempts | `setup` failed; see `setup.finished` in the log |
| `review unavailable` | the reviewing provider hit a limit or failed; the task is `needs_review` |
| everything falls back, then fails | both providers are out of quota; wait for the reset time shown by the CLI |
| board shows "diff not available" | the API's `--repo` is not the repository that holds the task branch |
