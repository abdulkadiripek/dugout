# ADR 0007: oxlint, with boundaries enforced by tsconfig and lint

Status: accepted (2026-10-31)

## Context
ADR 0001 left the lint tool open (oxlint vs eslint). Package boundaries from `AGENTS.md` must be enforced mechanically: `core` imports nothing from the repo, `web` never imports `server` or `cli`.

## Decision
Use oxlint with `.oxlintrc.json` at the repo root. Boundaries are enforced in two layers:
- Imports by package name: `no-restricted-imports` per package via `overrides` (checked: `@panosu/cli` in `core` and `@panosu/server` in `web` fail lint).
- Relative imports out of a package: each package sets `rootDir: src` with `composite`, so `tsc -b` fails with TS6059/TS6307 (checked with a temporary file).

Relative-path patterns in the lint rule were tried and dropped: they did not match multi-segment paths and would also forbid legitimate imports inside a package.

## Alternatives considered
- eslint + typescript-eslint: more rules and plugins, but a long dependency list and slower for a small repo.
- dependency-cruiser: precise graph rules, but a third tool for a rule tsc and lint already cover.

## Consequences
One small dependency. Type-aware lint rules are not available; typecheck covers types. Revisit if a rule is needed that oxlint cannot express.
