---
id: web-scorecard
goal: "Replace the ScorecardScreen placeholder with the scorecard screen of the airy prototype: implementer rows with first-try donut, retries, duration and token bars; reviewer rows with severity bars; excluded counts."
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
  - "packages/core/src/api-schemas.ts"
  - "packages/core/src/scorecard.ts"
constraints:
  - "Do not edit shared files: packages/web/src/api.ts, router.ts, App.tsx, theme.ts, formatters.ts, styles/tokens.css, styles/base.css, existing components and screens other than the one this task owns, any package.json, root config or docs. Add new files instead; if you truly need a change to a shared file, stop and say so in your final message."
  - "React 19 and the already installed test libraries only; no new dependencies. Plain CSS in your own new stylesheet (imported by your screen file), reuse the design tokens (CSS custom properties) from tokens.css; inline SVG for graphics; no external resources or network calls other than the API client functions from api.ts."
  - "The only import from @dugout/core is `import type`; never import @dugout/server or @dugout/cli (a test enforces this)."
  - "Accessibility: semantic markup, visible focus, status and severity never by color alone, keyboard operable (collapsibles are buttons with aria-expanded), readable at 390px and 1280px, text contrast AA. Light and dark themes come from the tokens."
  - "No any. No comments unless explaining a non-obvious why. TypeScript strict. Small components, one per file, named exports. Component tests live in `.test.tsx` files (JSX is allowed) with `// @vitest-environment jsdom` at the top; tests never touch the network (stub fetch or the api module)."
  - "Do not run any claude or codex command. You cannot open a browser: port the airy prototype faithfully and say what you could not verify visually."
  - "You own packages/web/src/screens/ScorecardScreen.tsx (replace the placeholder), a new folder packages/web/src/components/scorecard/ and packages/web/src/styles/scorecard.css."
acceptance:
  - "ScorecardScreen loads `getScorecard()`: loading, error with retry and empty ('no finished tasks yet', mention `pnpm demo`) states."
  - "Implementer section: one card per provider+model with tasks, passed, a first-try pass-rate donut (inline SVG with an accessible text alternative showing the percentage), mean retries, mean duration, and input/output token bars normalized across rows; rows are in the order the API returns them."
  - "Reviewer section: one card per provider+model with review count and stacked severity bars (blocker, major, minor, nit) with text counts, never color alone."
  - "A note line shows the excluded counts (interrupted and unreadable) in plain words."
  - "Pure chart-geometry helpers (donut arc path, bar widths with a zero-max guard) in their own module with unit tests including zero, one, and large values; formatting uses the shared formatters without modifying them."
  - "Component tests with a stubbed scorecard payload (use numbers from a hand-built example, not from running the server): both sections render, the donut shows the right percentage text, empty and error states work."
verify: "pnpm lint && pnpm typecheck && pnpm test && pnpm build && node scripts/scan-repo.mjs"
max_retries: 1
review: false
providers: [codex, claude]
---


