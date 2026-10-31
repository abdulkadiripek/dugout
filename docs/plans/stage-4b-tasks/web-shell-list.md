---
id: web-shell-list
goal: Build the React app shell, the typed API client, the shared styles and components, and the task list screen of the board in packages/web, porting the airy prototype faithfully.
files_to_read:
  - "AGENTS.md"
  - "docs/design.md"
  - "docs/contracts/api.md"
  - "docs/design/prototypes/README.md"
  - "docs/design/prototypes/templates/airy.html"
  - "docs/design/prototypes/templates/shared.js"
  - "packages/web/package.json"
  - "packages/web/tsconfig.json"
  - "packages/web/vite.config.ts"
  - "packages/web/src/App.tsx"
  - "packages/web/src/main.tsx"
  - "packages/core/src/api-schemas.ts"
constraints:
  - "Only add or edit files under packages/web (src, index.html, vite.config.ts). Do not touch package.json files, the lockfile, root config, docs or other packages. React 19 and the already installed test libraries only; no new dependencies."
  - "Talk to the server only over HTTP (`/api/...`, relative URLs). The only import from @dugout/core allowed is `import type { ... }` (types, never runtime values); never import @dugout/server or @dugout/cli."
  - "Plain CSS only (no Tailwind, no CSS-in-JS library, no icon or chart libraries), tokens and styling taken from the airy prototype; inline SVG for graphics. No external fonts, scripts or network calls other than /api. Light and dark themes via prefers-color-scheme plus a visible toggle (remember the choice in localStorage inside try/catch; the app must work when storage throws)."
  - "Accessibility: semantic landmarks, visible focus, status never by color alone (icon or text), keyboard: j/k or arrow keys move through the list, Enter opens, Esc goes back; readable at 390px and 1280px widths, text contrast AA."
  - "No any. No comments unless explaining a non-obvious why. ESM, TypeScript strict. Components are small, one per file, named exports."
  - "Do not run any claude or codex command. Tests never touch the network: stub fetch."
acceptance:
  - "src/api.ts exports typed functions `getTasks({ limit?, status? })`, `getTask(id)`, `getDiff(id)`, `getScorecard()` for every route in api.md, returning the API types via type-only imports from @dugout/core (TaskSummary, Event, scorecard types); non-2xx responses throw an `ApiError` with status and the server's `error` message. Add a test with a stubbed fetch for success and for 404/400 mapping."
  - "A hash router (`#/`, `#/tasks/<id>`, `#/scorecard`; unknown hashes show a friendly not-found view) as a small hook in src/router.ts, plus tests."
  - "App.tsx renders the shell (header with product name, nav links to the list and scorecard, theme toggle, main landmark) and chooses the screen from the route. DetailScreen and ScorecardScreen live in src/screens/DetailScreen.tsx and src/screens/ScorecardScreen.tsx as minimal placeholder components (they receive `id` / nothing, render a heading and the id) which other tasks will replace; do not put real logic in them."
  - "src/screens/ListScreen.tsx implements the list exactly as in the airy prototype: cards with status pill (icon + label), task id, goal, providers used, attempt dots, duration, tokens, filters for status and provider (state kept in the URL query inside the hash is optional), loading, empty ('where logs come from' text, mention `pnpm demo`) and error states with a retry button, keyboard navigation as above. Unreadable and interrupted tasks are shown with their reason where present."
  - "Shared components in src/components/: StatusPill, ProviderBadges, AttemptDots (derived from a TaskSummary alone is not enough for dots: render dots from `providers` and `attempts` count as the prototype does, check shared.js), plus a formatters module (duration, tokens, relative or absolute time) with unit tests."
  - "Component tests with @testing-library/react (jsdom via a `// @vitest-environment jsdom` docblock at the top of each such test file): list renders summaries from a stubbed fetch, filter by status hides others, empty and error states, keyboard navigation opens a task (hash changes), theme toggle works and survives throwing localStorage."
  - "`pnpm --filter @dugout/web build` produces a bundle without errors and the bundle contains no http(s) URLs other than the XML namespace."
verify: pnpm lint && pnpm typecheck && pnpm test && pnpm build
max_retries: 2
review: false
providers: [codex, claude]
---

Define the API-facing types once in src/api.ts re-exports so other screens import from there. Keep the stylesheet split: src/styles/tokens.css (custom properties for both themes), src/styles/base.css (reset, layout, shared components). Later tasks add their own per-screen CSS files; do not reserve names for them.
