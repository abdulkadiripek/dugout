---
id: review-fixes-cli
goal: "Fix six verified defects in packages/cli found by an independent review, as specified in docs/contracts/cli.md and provider-adapter.md."
files_to_read:
  - "AGENTS.md"
  - "docs/contracts/cli.md"
  - "docs/contracts/provider-adapter.md"
  - "packages/cli/src/delegate.ts"
  - "packages/cli/src/worktree.ts"
  - "packages/cli/src/config.ts"
  - "packages/cli/src/verify-runner.ts"
  - "packages/cli/src/providers/review-prompt.ts"
  - "packages/cli/src/providers/shared.ts"
  - "packages/cli/src/delegate.test.ts"
  - "packages/cli/src/eval.test.ts"
  - "packages/cli/src/verify-runner.test.ts"
  - "packages/cli/src/config.test.ts"
  - "packages/cli/src/worktree.test.ts"
constraints:
  - "Only edit files under packages/cli/src (sources and their tests). Do not touch docs, other packages, package.json or the lockfile. Every existing test must keep passing; change an existing assertion only where the contract change requires it and say which."
  - "No new dependencies. No any. No comments unless explaining a non-obvious why. Do not run any claude or codex command. Your new tests must fail without your fix. Temp dirs only; never touch ~/.dugout, ~/.claude or ~/.codex."
acceptance:
  - "Abort on error: in delegate, any exception escaping runTask (not only SIGINT/SIGTERM) aborts the controller so provider process groups are terminated before the CLI exits; add a test with a scripted spawn whose process never exits and an event writer or dependency that throws mid-stream, asserting the scripted process received killGroup SIGTERM and no timer keeps the test alive."
  - "Stable base: delegate resolves the base ref to a commit hash once at the start (git rev-parse), records the branch name in events exactly as before, and uses the hash for diffStat and for the baseRef given to adapters' review (wrap in the existing adapter wrapper). defaultGetDiff in providers/review-prompt.ts passes `--` after the revision. Test: after the task branch is created, advance the base branch with a new commit in the main repo during the run (from a scripted adapter or verify command), then assert the logged diffStat and the diff handed to review contain only the task's own changes."
  - "Commit hardening: commitAll uses --no-verify and -c commit.gpgsign=false in addition to the fixed identity; delegate prints the result block before committing and a commit failure only writes a warning to stderr, leaving the exit code from the status. Tests: a repo with a failing pre-commit hook and commit.gpgsign=true with a bogus gpg.program still yields the normal block and exit code with a commit created."
  - "Overlay clash: the message returned to the model in outputTail is generic (a reserved path collided; no file name), the path appears only on stderr. Update the existing eval test accordingly and add an assertion that the log never contains the clashing file name."
  - "Timeout validation: loadConfig rejects verifyTimeoutMs (and attemptTimeoutMs if present) that are not integers in 1..2147483647 with a ConfigError naming the key; tests for 0, negative, 3e9, 1.5 and a valid value."
  - "Leftover verify processes: after a verify command exits by itself, runVerifyCommand sends SIGTERM to its process group (ignore ESRCH); test with a command that starts `sleep 30 &` and exits, asserting the sleep is gone shortly afterwards (poll up to 3 s) and the outcome is still the command's own exit code."
verify: "pnpm lint && pnpm typecheck && pnpm test && node scripts/scan-repo.mjs"
max_retries: 1
review: false
providers: [codex, claude]
---
