# ADR 0005: Retrospective board first, live view later

Status: accepted (2026-10-31)

## Context
Wanting to "see everything" can mean a live terminal stream or a review of finished work. Live views need streaming, terminal embedding and tmux, and are the most fragile part.

## Decision
v1 shows finished tasks from event logs: attempts, verify results, review, diffs, token and time, and a per-model scorecard. Live streaming (SSE) and controls come after the retrospective board works.

## Alternatives considered
- Live-first with tmux and xterm.js: impressive demo, more moving parts, `tmux` not installed.

## Consequences
The board is simple and robust, and works on fixtures for the public demo. The event log already contains what a live view needs, so adding SSE later does not change the format.
