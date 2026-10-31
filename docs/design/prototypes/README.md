# Board design prototypes

Two clickable, self-contained prototypes of the board, built from `fixtures/events/*.jsonl`. They show the same three screens with the same data (task list, task detail, scorecard), so the choice is purely visual.

## Regenerate and open

```
pnpm build                          # the script reads packages/core/dist
node scripts/build-prototypes.mjs   # writes dense.html and airy.html
```

Open `docs/design/prototypes/dense.html` or `airy.html` directly in a browser (file://). No server, no network. Output is deterministic: running the script twice gives identical files.

Sources: `templates/dense.html`, `templates/airy.html` (own CSS and rendering) and `templates/shared.js` (routing, filters, keyboard, formatting), plus the data blob the script computes with the built core package. Edit the templates, not the generated files.

Routes: `#/` list, `#/tasks/<id>` detail, `#/scorecard`. Keys: `j`/`k` or arrows move in the list, `Enter` opens, `Esc` goes back. A visible button toggles light and dark; the default follows the system.

## Dense (developer tool)

Optimizes for:
- Scanning many tasks at once: compact table rows, every column visible on a laptop screen.
- Reading the full event log in order, as a vertical log with offsets.
- A small, restrained palette; status shown as text plus a glyph.

Costs:
- Feels like a terminal; less approachable for a first look or for sharing a screenshot.
- Little visual summary: attempt outcomes and token use are read as numbers, not seen at a glance.

## Airy (visual)

Optimizes for:
- Understanding a task at a glance: attempt dots, token bars, rate rings, step-by-step timeline.
- Comfortable reading and a friendly first impression, with large type and soft colors.
- Scorecard that reads as comparison cards rather than a spreadsheet.

Costs:
- Fewer tasks per screen; scrolling grows with the number of tasks.
- More custom drawing (SVG, layout) to maintain, and the timeline hides low-level events behind each attempt.
