# Design (skeleton)

Visual direction is not decided. Two clickable prototypes (dark/dense developer tool vs airy/visual) will be built from `fixtures/events/*.jsonl`; the chosen one fills the sections marked TBD. Do not start Stage 4 UI work before this file is complete.

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

## TBD after prototype selection
- Color and type tokens
- Component library (candidate: shadcn/ui + Tailwind)
- Density and layout of the timeline
- Diff viewer choice
