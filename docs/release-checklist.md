# Release checklist

Done on 2026-10-31:

- [x] Name: Dugout (ADR 0010); name search found no AI-agent product with this name.
- [x] License: MIT (`LICENSE`).
- [x] History: personal context in the first commits and the two personal author e-mails were removed while keeping all commits (rewritten with `git filter-branch`: early `CLAUDE.md`, `README.md` and `.claude/settings.json` versions replaced, authors mapped to the GitHub noreply address). Every commit tree, message and author line was scanned before publishing.
- [x] Public repository: https://github.com/abdulkadiripek/dugout (MIT, topics set, private vulnerability reporting on).
- [x] CI: first run on GitHub found four environment-only failures (a fixture test that depended on the home directory, an `ESRCH` case in a process test, and the golden evals needing Node 24); fixed, now green on Node 24.

Still open:

1. **Live check with Codex quota.** Run one small real task through `dugout delegate` with both providers to see a successful Codex-first run and a live `approve` review, and `dugout eval 01 --providers codex,claude` to see a golden task with a real model.
2. **Keep the dev history clean.** The pre-publication history only exists in a local branch (`backup/pre-public`); never push it. Delete it when you no longer need it (`git branch -D backup/pre-public`).
3. **Optional polish:** a social preview image for the repository (Settings, General), a short demo recording of `pnpm demo`, pinned repository on the profile.
