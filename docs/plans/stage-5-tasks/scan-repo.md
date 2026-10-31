---
id: scan-repo
goal: Add scripts/scan-repo.mjs, a dependency-free scanner that fails when tracked files contain secrets, absolute home paths, personal emails or tracked local-only files, so the public repo stays clean.
files_to_read:
  - "AGENTS.md"
  - ".gitignore"
  - "vitest.config.ts"
  - "scripts/build-prototypes.mjs"
constraints:
  - "Only add scripts/scan-repo.mjs and scripts/scan-repo.test.mjs. Do not touch any other file (config, docs, packages, lockfile)."
  - "Node built-ins only (node:child_process execFileSync with git and an argument array, node:fs, node:path). No new dependencies. ESM. No comments unless explaining a non-obvious why."
  - "The scanner must never print a matched secret in full: show file, line number, rule name and at most the first 4 characters of the match followed by `…`."
  - "Do not run any claude or codex command. Tests use temp directories under os.tmpdir() with their own `git init`; never scan or touch anything outside them except for the final check of the repo itself."
acceptance:
  - "`scan(repoDir)` is exported and returns an array of findings `{ file, line, rule, preview }`; `node scripts/scan-repo.mjs [dir]` scans `git ls-files` of the directory (default: the git root of the current directory), prints one line per finding and a summary, and exits 1 when there are findings, 0 otherwise."
  - "Rules: absolute home paths (`/home/<name>/`, `/Users/<name>/`, `C:\\Users\\<name>\\`, but not the generic `~/` and not `/home/runner/` or `/home/user/`); email addresses other than ones ending in `@localhost` and `@example.com` and `@users.noreply.github.com`; secret-looking tokens (`sk-` followed by 20+ alphanumerics, `ghp_`/`gho_`/`github_pat_` tokens, `AKIA` followed by 16 uppercase alphanumerics, `-----BEGIN ... PRIVATE KEY-----`, `xox[baprs]-` Slack tokens); tracked files named `.env`, `.env.*` (except `.env.example`), `CLAUDE.local.md`, anything under `.proje/`, or `.claude/settings.local.json`."
  - "Binary files and files over 1 MB are skipped; a file listed in `git ls-files` but missing on disk is skipped."
  - "Tests (scripts/scan-repo.test.mjs, vitest-compatible ES module using `import { describe, it, expect } from \"vitest\"`): every rule triggers on a planted example and not on a clean near-miss; previews never contain more than 4 characters of the match; exit code behavior of the CLI via child_process on a clean and a dirty temp repo; untracked files are ignored."
  - "Running `node scripts/scan-repo.mjs` in this repository itself exits 0. If it reports real findings in the repo, do not hide them with an allowlist: stop and list them in your final message."
verify: pnpm lint && pnpm typecheck && pnpm test && node scripts/scan-repo.mjs
setup: pnpm install --offline --frozen-lockfile
max_retries: 1
review: true
providers: [codex, claude]
---

Keep the file small and readable: a list of rule objects (name, regex), one function that scans a text and one that walks the tracked files.
