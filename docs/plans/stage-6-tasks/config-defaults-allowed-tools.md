---
id: config-defaults-allowed-tools
goal: "Change the default Codex model to gpt-6.1-sol and add the opt-in claude.allowedTools config key, as specified in docs/contracts/provider-adapter.md."
files_to_read:
  - "AGENTS.md"
  - "docs/contracts/provider-adapter.md"
  - "docs/contracts/cli.md"
  - "packages/cli/src/config.ts"
  - "packages/cli/src/config.test.ts"
  - "packages/cli/src/delegate.ts"
  - "packages/cli/src/providers/shared.ts"
  - "packages/cli/src/providers/claude.ts"
  - "packages/cli/src/providers/claude.test.ts"
  - "packages/cli/src/real-providers.test.ts"
constraints:
  - "Only edit files under packages/cli/src (sources and tests). Do not touch docs, fixtures, other packages, package.json or the lockfile. Existing tests must keep passing; update an assertion only where the default model change requires it and say which."
  - "No new dependencies. No any. No comments unless explaining a non-obvious why. Do not run any claude or codex command. Tests never start real providers."
acceptance:
  - "Default models in loadConfig change to codex implement `gpt-6.1-sol` and codex review `gpt-6.1-sol` (claude and fake unchanged); every test and helper that asserted the old codex implement default is updated."
  - "Config gets `claude.allowedTools` exactly as docs/contracts/provider-adapter.md specifies: default `[\"Write\",\"Edit\",\"Read\"]`; a non-array, an empty array or a non-string/empty-string item throws a ConfigError naming `claude.allowedTools`. Tests for the default, a custom list, and each invalid form. The Config type exposes it (for example `claude: { allowedTools: string[] }`)."
  - "The Claude adapter takes the list through its options (`allowedTools`, default `[\"Write\",\"Edit\",\"Read\"]`) and passes it as `--allowedTools <tool> <tool> ...` in the same position as today (after `--permission-mode acceptEdits`); delegate passes `config.claude.allowedTools` to createClaudeAdapter. Adapter test: a custom list including `Bash(pnpm *)` appears as separate argv items in order; the default argv is byte-for-byte what it is today. A delegate-level scripted-spawn test shows the config value reaching the spawned argv."
  - "The review command line of the Claude adapter is unchanged (it never gets tools)."
verify: "pnpm lint && pnpm typecheck && pnpm test && node scripts/scan-repo.mjs"
max_retries: 1
review: false
providers: [codex, claude]
---
