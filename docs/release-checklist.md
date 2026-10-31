# Release checklist (maintainer decisions)

Nothing here has been done automatically. The tool never pushes, never rewrites history and never picks a license.

1. **License and name.** Pick a license (MIT is the suggestion) and the public repository name; add `LICENSE` and the license line in `README.md`.
2. **History.** The first commits of this repository contain personal context (see `git log --stat` for the earliest commits). Before the first public push either create a fresh history (`git checkout --orphan public && git add -A && git commit -m "Initial public version"` on a clean tree, then use that branch) or rewrite the early commits; review `git log -p` for personal paths and emails with `node scripts/scan-repo.mjs` plus a manual look at the first commits. `scripts/scan-repo.mjs` only checks the current tree.
3. **Local-only files.** Confirm `git check-ignore CLAUDE.local.md .proje` prints both, and `git ls-files | grep -E "^(\.proje|CLAUDE\.local)"` prints nothing.
4. **CI.** `.github/workflows/ci.yml` has never run on GitHub. After the first push, check the run (lint, typecheck, test, build, repo scan). Node 24 in CI (the golden evals need Node 24).
5. **Remote.** `git remote add origin <url>` and push only after the steps above. Adding a remote and pushing is an outward-facing action.
6. **Quota-dependent checks (optional).** When Codex quota is available, run one small real task through `dugout delegate` with both providers to see a successful Codex-first run and a live approve review, and `dugout eval 01 --providers codex,claude` to see the golden task flow with a real model.
