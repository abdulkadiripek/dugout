---
id: shell-summary
goal: "Make provider.tool summaries for shell commands follow the new contract line: program plus at most two words, no wrapper, NAME=value cut, 60 characters, for both the Codex and the Claude adapter."
files_to_read:
  - "AGENTS.md"
  - "docs/contracts/events.md"
  - "docs/contracts/provider-adapter.md"
  - "packages/cli/src/providers/codex.ts"
  - "packages/cli/src/providers/claude.ts"
  - "packages/cli/src/providers/shared.ts"
  - "packages/cli/src/providers/codex.test.ts"
  - "packages/cli/src/providers/claude.test.ts"
  - "fixtures/providers/codex/exec-json-tools.sample.jsonl"
  - "fixtures/providers/claude/stream-json-implement.sample.jsonl"
constraints:
  - "Only edit files under packages/cli/src/providers (adapters, shared helpers and their tests). Do not touch docs, fixtures, other packages, package.json or the lockfile. Existing tests must keep passing; adjust an existing assertion only where the new contract line in events.md changes the expected summary, and say which."
  - "No new dependencies. No any. No comments unless explaining a non-obvious why. Do not run any claude or codex command. Tests must not start real providers (spawnReal is blocked under vitest anyway)."
acceptance:
  - "A shared pure helper `shellSummary(command: string, cwd?: string): string` implements the shell-command summary rule of docs/contracts/events.md: strip one leading wrapper of the form `bash -lc`, `/usr/bin/bash -lc`, `sh -c` (with its surrounding single or double quotes), take the first line, keep the program and at most the next two whitespace-separated words, cut a word containing `=` to `NAME=…` (everything after the first `=` replaced by `…`), remove an absolute cwd prefix from words, and truncate the result to 60 characters. Empty or whitespace-only input gives an empty string."
  - "The Codex adapter uses it for command_execution tool events (name stays `command`); replaying fixtures/providers/codex/exec-json-tools.sample.jsonl gives the summary `cat AGENTS.md` for the `bash -lc 'cat AGENTS.md'` item."
  - "The Claude adapter maps assistant tool_use items named Bash to a provider.tool event with name `bash` and summary shellSummary(input.command, cwd); all other Claude tools keep their current behavior (file_path relative to cwd)."
  - "Unit tests for shellSummary cover: wrapper removal with both quote styles, multi-line commands (first line only), `FOO=secret pnpm test` becoming `FOO=… pnpm test`, `export TOKEN=abc123` becoming `export TOKEN=…`, a cwd prefix, a 200-character single word truncated to 60, empty input; plus adapter tests with scripted lines for a Claude Bash tool_use (including one with a secret-looking `API_KEY=sk-test` word) asserting the summary never contains the secret value."
verify: "pnpm lint && pnpm typecheck && pnpm test && node scripts/scan-repo.mjs"
setup: "pnpm install --offline --frozen-lockfile"
max_retries: 2
review: true
providers: [codex, claude]
---
