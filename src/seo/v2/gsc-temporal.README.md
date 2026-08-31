# Temporal Cannibalization

`gsc-temporal.js` detects query ownership changes between dated Google Search Console windows.

It is intentionally additive to `gsc-signal-resolver.js`: the existing semantic resolver remains responsible for current-window cannibalization, while this module detects cross-window ownership transitions.

Rows must include `startDate`/`endDate` (or snake_case equivalents). The Search Console sync preserves these fields so historical windows can be compared without a second data model.
