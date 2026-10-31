---
id: scrub-home-paths
goal: Make the CLI event writer replace the user's home directory path with `~` in every string value of an event before writing it, as required by the Privacy section of docs/contracts/events.md.
files_to_read:
  - "AGENTS.md"
  - "docs/contracts/events.md"
  - "packages/cli/src/event-writer.ts"
  - "packages/cli/src/event-writer.test.ts"
  - "packages/cli/src/delegate.ts"
  - "packages/cli/src/cli.ts"
constraints:
  - "Only edit packages/cli/src (event-writer.ts, delegate.ts and their tests, plus tests for the wiring). Do not touch core, docs, package.json, lockfile or tsconfig. Every existing test must keep passing."
  - "No new dependencies. No any. No comments unless explaining a non-obvious why. ESM NodeNext, relative imports end in .js."
  - "Do not run any claude or codex command. Temp dirs only; never touch ~/.dugout, ~/.claude or ~/.codex."
acceptance:
  - "createEventWriter(dir, taskId, opts?: { homedir?: string }) scrubs every string value (recursively through objects and arrays, including the embedded package object, outputTail and message text) so that the home directory prefix is replaced by `~`. A match requires a path boundary: `/hm/ab` is replaced inside `/hm/ab/x` and at the end of a string, but not inside `/hm/abc/x`. An empty or `/` homedir scrubs nothing. Scrubbing happens after schema validation and before the line is written; the object passed to emit() is not mutated."
  - "When opts.homedir is omitted the writer uses os.homedir()."
  - "delegate passes its io.homedir (already resolved in cli.ts) to the writer, so a run with io.homedir set to a temp directory writes `~` for paths under it. Add a delegate-level test: a package whose verify command prints its own working directory (for example `pwd`) while io.homedir is the parent temp directory of the repo; the log's verify.finished outputTail contains `~/` and never the temp directory path. The printed stdout block is unchanged."
  - "Unit tests: nested objects and arrays, boundary cases above, non-string values untouched, mutation-free, default homedir."
verify: pnpm lint && pnpm typecheck && pnpm test
max_retries: 1
review: false
providers: [codex, claude]
---
