# Daily Dashboard — Phase 1 Verification Checklist

Branch: `feat/daily-dashboard-command-center`

## Implemented

- Action Center UI mounted after the daily summary.
- Financial KPIs: payments today, payment count, overdue terms.
- Renewal KPI using the current renewal business rule.
- Instructor daily status with session count and teacher attendance state.
- Independent instructor/room conflict metrics are consumed by the Command Center API.
- Quick search for students, instructors, and classes.
- Search results and Action Center items provide dashboard focus/navigation behavior.
- Command Center is kept separate from the existing daily dashboard controller until the shared event/state boundary is finalized.

## Known integration follow-ups

1. Move NOW-line rendering into the primary `daily-dashboard.js` timeline renderer so the timeline remains the single source of truth.
2. Add explicit conflict badges to the primary session cards using independent instructor/room conflict predicates.
3. Replace DOM-text based Action Center focusing with session IDs emitted by the primary controller.
4. Define the school timezone explicitly and remove UTC/local fallback ambiguity from daily date handling.
5. Run `astro check`, tests, and production build before merging to `main`.

## Merge policy

Phase 1 remains on this feature branch. No merge to `main` until the checklist and validation pass are reviewed.
