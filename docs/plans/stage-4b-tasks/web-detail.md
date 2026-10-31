---
id: web-detail
goal: "Replace the DetailScreen placeholder with the full task detail screen of the airy prototype: header, step timeline, attempt cards, verify output, review panel and a built-in diff viewer."
files_to_read:
  - "AGENTS.md"
  - "docs/design.md"
  - "docs/contracts/api.md"
  - "docs/contracts/events.md"
  - "docs/design/prototypes/templates/airy.html"
  - "docs/design/prototypes/templates/shared.js"
  - "packages/web/src/api.ts"
  - "packages/web/src/router.ts"
  - "packages/web/src/App.tsx"
  - "packages/web/src/components/StatusPill.tsx"
  - "packages/web/src/components/ProviderBadges.tsx"
  - "packages/web/src/formatters.ts"
  - "packages/web/src/styles/tokens.css"
  - "packages/web/src/styles/base.css"
  - "packages/web/src/screens/ListScreen.tsx"
  - "packages/web/src/components.test.ts"
  - "packages/web/src/app.test.ts"
  - "docs/design/prototypes/README.md"
  - "fixtures/events/real-fallback-dogfood.jsonl"
  - "fixtures/events/review-issues.jsonl"
  - "fixtures/events/setup-failed.jsonl"
constraints:
  - "Do not edit shared files: packages/web/src/api.ts, router.ts, App.tsx, theme.ts, formatters.ts, styles/tokens.css, styles/base.css, existing components and screens other than the one this task owns, any package.json, root config or docs. Add new files instead; if you truly need a change to a shared file, stop and say so in your final message."
  - "React 19 and the already installed test libraries only; no new dependencies. Plain CSS in your own new stylesheet (imported by your screen file), reuse the design tokens (CSS custom properties) from tokens.css; inline SVG for graphics; no external resources or network calls other than the API client functions from api.ts."
  - "The only import from @dugout/core is `import type`; never import @dugout/server or @dugout/cli (a test enforces this)."
  - "Accessibility: semantic markup, visible focus, status and severity never by color alone, keyboard operable (collapsibles are buttons with aria-expanded), readable at 390px and 1280px, text contrast AA. Light and dark themes come from the tokens."
  - "No any. No comments unless explaining a non-obvious why. TypeScript strict. Small components, one per file, named exports. Component tests live in `.test.tsx` files (JSX is allowed) with `// @vitest-environment jsdom` at the top; tests never touch the network (stub fetch or the api module)."
  - "Do not run any claude or codex command. You cannot open a browser: port the airy prototype faithfully and say what you could not verify visually."
  - "You own packages/web/src/screens/DetailScreen.tsx (replace the placeholder, keep its props), a new folder packages/web/src/components/detail/ and packages/web/src/styles/detail.css."
acceptance:
  - "DetailScreen loads `getTask(id)` and `getDiff(id)` independently: loading, error (ApiError message, retry button) and not-found (404) states for the task; the diff failing (404 no branch, 409 unreadable) shows an inline 'diff not available' note and never blocks the rest."
  - "Header: status pill, goal, package id, providers, baseRef and branch, duration, tokens, start time; unreadable tasks show their reason and nothing else."
  - "Horizontal step timeline derived from the events (setup, each attempt with provider and reason, verify results, fallback, review) as in the airy prototype; each step is focusable and scrolls to its card."
  - "Attempt cards: provider and model, reason (initial/retry/fallback), exit reason with human text, duration, tokens, the verify result with the output tail in a monospace block, and a collapsible section (button with aria-expanded) listing tool calls and messages. A setup.finished event shows as its own card. Derivation logic lives in a pure module (for example src/components/detail/derive.ts) with unit tests using real fixture lines read from fixtures/events in the test."
  - "Review panel: reviewer provider and model, verdict, summary, issues grouped by severity with file:line; an 'review unavailable' blocker issue is shown plainly. A task without review shows nothing for it."
  - "Diff viewer: a built-in unified-diff renderer (file headings, added/removed/context line styling with +/- markers, line numbers optional, a visible truncation notice when the API says truncated, long lines scroll horizontally, rendered with React elements never dangerouslySetInnerHTML). Unit tests for the parser with a multi-file diff, a binary file marker, an empty diff and the truncation marker line."
  - "Component tests for DetailScreen with stubbed API data built from the real fixture event logs (success, retry/fallback, review-issues, setup-failed, real-fallback-dogfood): the right cards appear, the review issues render, the diff shows or degrades, the error and 404 states work, keyboard toggling of collapsibles works."
verify: "pnpm lint && pnpm typecheck && pnpm test && pnpm build && node scripts/scan-repo.mjs"
max_retries: 1
review: false
providers: [codex, claude]
---


