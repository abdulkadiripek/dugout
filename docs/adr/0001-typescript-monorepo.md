# ADR 0001: TypeScript monorepo

Status: accepted (2026-10-31)

## Context
The project needs a CLI, an API and a visually polished web UI. Node and pnpm are already installed; the maintainer wants one language across the stack and a readable portfolio repo.

## Decision
One pnpm workspace in TypeScript: `core`, `cli`, `server` (Hono), `web` (React + Vite). Tests with vitest. Schemas in zod, types inferred from them.

## Alternatives considered
- Python backend + React frontend: simpler for some, but two toolchains and duplicated schemas.
- Go/Rust CLI: faster binaries, slower to iterate, weaker UI story, harder for the maintainer to review.

## Consequences
Shared schemas between CLI, API and UI. One lint/test/CI setup. Node is a hard requirement. Lint tool (oxlint vs eslint) is chosen in Stage 1 with its own note.
