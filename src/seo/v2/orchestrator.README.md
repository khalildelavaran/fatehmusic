# Unified SEO/GEO Orchestrator

`orchestrator.js` composes the existing SEO/GEO subsystems. It is intentionally not a second implementation of topics, intents, GSC, content strategy, internal links, or entity graph logic.

Inputs are published posts, courses, topic candidates, optional GSC rows, site URL, and optional audit context. The output is a single view model containing cluster analysis, page semantics, GSC signals, link graph, scored opportunities, and summary metrics.
