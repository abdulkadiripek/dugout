# Design

**Direction: airy / visual** (chosen by the maintainer on 2026-10-31 from two prototypes). The source of truth for colors, type, spacing and layout is `docs/design/prototypes/templates/airy.html` (and the rendering logic in `templates/shared.js`); the React UI ports it, it does not reinvent it. The dense prototype stays in the repo as the rejected alternative.

## Principles (already decided)
- Retrospective first; the board is read-only in v1.
- Every screen is derivable from event logs and git diffs, nothing else.
- Works offline, no external fonts or analytics.
- Light and dark themes, keyboard navigable, readable at laptop widths.

## Screens

| Screen | Purpose | Key content |
|---|---|---|
| Task list | Scan recent work | status, task id, goal, provider(s) used, attempts, duration, tokens |
| Task detail | Understand one task | timeline of events, attempt cards (provider, reason, exit), verify output tail, review verdict and issues, diff viewer |
| Scorecard | Compare models | per provider/model: tasks, first-try pass rate, mean retries, duration, tokens, review issues found |
| Empty/demo state | First run | explains where logs come from; `pnpm demo` loads fixtures |

## Information architecture
- `/` task list (filters: status, provider, date)
- `/tasks/:id` task detail
- `/scorecard`
- Status vocabulary and colors must map 1:1 to `passed`, `needs_review`, `failed`, `interrupted`.

## Decisions after prototype selection
- Color and type tokens: taken from the airy prototype's CSS custom properties; light and dark via `prefers-color-scheme` plus a visible toggle.
- Component library: none. Plain CSS (one stylesheet of tokens plus per-component CSS); no Tailwind, no shadcn. Reason: the prototype is already hand-written CSS and the dependency list stays short.
- Timeline: horizontal step view with the attempt cards below; tool calls and messages in a collapsible section per attempt.
- Charts: inline SVG only (attempt dots, first-try donut, token and severity bars).
- Diff viewer: a small built-in unified-diff renderer (added/removed line styling, file headings, truncation notice); no diff library.
- Data: the UI reads only the API of `docs/contracts/api.md`.
