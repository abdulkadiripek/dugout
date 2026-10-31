---
id: web-list-polish
goal: "Fix small defects in the list screen found by looking at the running board: duplicated attempt text on cards, and verify the empty-attempt card layout."
files_to_read:
  - "AGENTS.md"
  - "packages/web/src/components/TaskCard.tsx"
  - "packages/web/src/components/AttemptDots.tsx"
  - "packages/web/src/components.test.ts"
  - "packages/web/src/screens/ListScreen.tsx"
  - "fixtures/events/setup-failed.jsonl"
constraints:
  - "Only edit packages/web/src/components/TaskCard.tsx, AttemptDots.tsx and their tests (components.test.ts or a new .test.tsx file). Do not touch other files."
  - "No new dependencies. No any. No comments unless explaining a non-obvious why. Do not run any claude or codex command. You cannot open a browser."
acceptance:
  - "A task with zero attempts (for example a failed setup) shows a single clear line such as 'no attempts' on its card, never 'no attempts 0 attempts'; tasks with attempts are unchanged ('1 attempt', '3 attempts')."
  - "The zero-attempt card keeps the same height rhythm as the others without an empty progress bar track or a stray divider gap; a test asserts the rendered text for 0, 1 and 3 attempts."
verify: "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
max_retries: 1
review: false
providers: [codex, claude]
---


