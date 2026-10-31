# Security policy

Dugout runs the official `claude` and `codex` CLIs on your machine and lets them edit files in git worktrees you point it at. Please treat task packages and provider tool permissions like any other code you run.

## Reporting a vulnerability
Use GitHub's private vulnerability reporting ("Security" tab, "Report a vulnerability") on this repository instead of a public issue. Describe the impact, how to reproduce it and the version or commit. You will get an answer on a best-effort basis.

## What is in scope
- The read-only API (`dugout-serve`): it binds to `127.0.0.1` only and rejects other `Host` headers.
- Event logs and the web board leaking secrets or personal paths.
- Process handling in the CLI (only processes it started are signalled).

## Known limits
- The Claude implementer has no sandbox. By default it gets `Write Edit Read`; extra `Bash(...)` patterns in `claude.allowedTools` are an opt-in, and `acceptEdits` already allows basic filesystem commands inside the working directory.
- Shell command summaries in event logs keep up to three words; a secret passed as one of them is not masked.
