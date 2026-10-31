# ADR 0009: Board UI: airy direction, plain CSS, API-only

Status: accepted (2026-10-31)

## Context
The maintainer chose between two prototypes (dense developer tool vs airy visual) built from the fixture logs, and picked airy. The UI must stay readable, work offline and add few dependencies.

## Decision
- Direction: airy (`docs/design/prototypes/templates/airy.html` is the source of truth for tokens and layout).
- React 19 + Vite, plain CSS built on custom properties for light and dark; inline SVG for charts; a built-in unified-diff renderer. No Tailwind, no component or chart library.
- `packages/web` talks to the server only over HTTP (`docs/contracts/api.md`) and may only `import type` from `@panosu/core` (a test enforces it). Per-screen CSS uses scoped class names.
- Tests: vitest with jsdom and Testing Library; `pnpm demo` serves the fixture logs through the read-only API.

## Alternatives considered
- Dense direction: higher information density, rejected by the maintainer.
- shadcn/Tailwind: faster to assemble, but a larger dependency and style surface than this UI needs.

## Consequences
Few dependencies and full control of the look, at the cost of writing small components by hand. Dark theme and keyboard behavior were checked by tests and contrast calculations, not by eye in every case.
