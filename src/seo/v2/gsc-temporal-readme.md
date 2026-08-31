# Temporal Cannibalization Signals

`gsc-temporal.js` detects query ownership changes across dated Search Console windows. It intentionally requires dated rows and meaningful impression share before emitting a transition.

Signals are exposed through GSC Intelligence as `temporalCannibalization` and can influence existing opportunity actions and priority scoring without introducing a separate classifier.
