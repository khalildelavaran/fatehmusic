# ADR-011 — Content Intelligence Engine

**Status:** Accepted

**Version:** 1.0

**Date:** 2026-08-18

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- CONTENT_ENGINE_SPECIFICATION.md
- doc/AI Blog Automation System.md (Domain A — Topic Discovery, FR-001–FR-020)
- ADR-010 AI-First Architecture
- FOLDER_STRUCTURE.md (§34, `ai/` reserved folder)
- migrations/0005_create_content_topics.sql

---

# 1. Summary

This ADR records the first implemented slice of the Content Intelligence system described at a full-enterprise scope in `doc/AI Blog Automation System.md` and in the uploaded `fateh-content-intelligence-architecture.md` working document.

It replaces the random topic pick previously inside `ai-post-generator.ts` with a real title/topic engine — candidate generation from actual course data, normalization, deduplication, intent classification, transparent scoring, and a review queue in `/admin/topics` — and replaces Cloudflare Workers AI (`@cf/zai-org/glm-4.7-flash`) with the DeepSeek API for the article-writing step itself.

---

# 2. Context

Both existing planning documents describe a system spanning ten functional domains (Topic Discovery, Keyword Intelligence, Competitor Analysis, Content Generation, Image Generation, SEO Engine, Publishing Engine, Analytics Engine, Optimization Engine, System Management) with 180 functional requirements. Building all of it is out of scope for one implementation pass, and both source documents say so explicitly: `fateh-content-intelligence-architecture.md` §99 calls for a "vertical slice" (discovery → scoring → admin panel) before article generation, publishing automation, or competitor crawling.

This work implements Topic Discovery plus the article-writing handoff — the piece the site owner asked for directly ("موتور تولید عنوان... مقاله‌ساز هم deepseek هست").

---

# 3. Decision

**3.1 — Where the code lives.** `src/ai/content-engine/` (using the `ai/` folder FOLDER_STRUCTURE.md already reserved for this), plus `src/data/content-engine-seeds.ts` for the template/seed data, following the existing split where `src/data/` holds structured data and `src/server/`-style modules hold logic.

**3.2 — Candidate generation is deterministic, not LLM-generated.** Titles come from courses.js (the frozen source of truth for the 23 real courses) combined with hand-written Persian templates, not from asking an LLM to invent topics. This makes every candidate reproducible, free, instantly unit-testable, and reviewable — an admin can see exactly why a title exists. LLM-assisted semantic expansion beyond this fixed template space is a documented future step, not part of this slice.

**3.3 — No fabricated keyword/trend data.** No Google Trends, SERP, or keyword-volume provider is connected to this Worker. Per this project's own rule against invented statistics (see CHANGES_AND_NEXT_STEPS.md's "no fabrication" note on instructor metrics, applied here to search data), `providers/keyword-provider.ts` defines an adapter interface with `NullKeywordProvider` as the default, which honestly reports "unavailable" rather than inventing a volume number. Scoring treats an unavailable signal as neutral, not zero.

**3.4 — Scoring is per-course, not per-instrument.** `courses.js` deliberately keeps some instrument families as multiple distinct Landing Pages (e.g. four vocal-style courses all share `instrument: "voice"` but are four separate pages). Content-gap and freshness scoring in `scoring.ts` are keyed by `related_course_slug`, matching that page-level model rather than collapsing them.

**3.5 — DeepSeek, thinking mode explicitly disabled.** `providers/deepseek.ts` calls `deepseek-v4-flash` (the current model ID — the legacy `deepseek-chat` alias retires 2026-07-24) with `thinking: { type: "disabled" }`. DeepSeek's v4 models default thinking mode to *on*, which reproduces the exact failure this project already hit once with Workers AI's `glm-4.7-flash` (reasoning consumes the token budget, `content` comes back empty). This is the single most important line in that file; do not remove it without re-reading this ADR.

**3.6 — The title is fixed before the article is written.** The old flow let the LLM invent the title as part of the same call that wrote the body. Now `article-generator.ts` passes the approved title to DeepSeek as a fixed instruction ("عنوان مقاله از قبل مشخص شده... آن را عوض نکن") and only asks it to write the body — otherwise the scoring/dedup work from the topic engine would be silently discardable by the model.

**3.7 — Graceful fallback, not a hard dependency.** If `content_topics` has no approved row yet (e.g. right after this deploys, before anyone has clicked "تولید موضوعات جدید"), `article-generator.ts` falls back to the same random-pick logic the old code used, so the daily cron does not go silent on day one.

---

# 4. Alternatives Considered

- **Full combinatorial generation** (every instrument × every audience × every level × every modifier, per the uploaded doc's larger design) was rejected for v1: most combinations are not real content needs for a single-city academy, and AGENTS.md explicitly warns against generating low-value pages "Authority is more important than Page Count."
- **PostgreSQL / FastAPI**, mentioned as an option in the uploaded doc, was rejected — this project is already committed to Cloudflare D1/Workers (ADR-003), and introducing a second backend/database for one feature would contradict "inspect existing architecture before changing it."
- **A full job-queue system** (Domain J, System Management) was rejected in favor of the same single-function-call pattern `generateDailyPost()` already used, via two plain functions (`runTopicDiscovery`, `runDailyArticleGeneration`) — `content_topic_runs` gives just enough run history for the admin UI without building infrastructure nothing here needs yet.

---

# 5. Consequences

- The candidate pool is finite (~500–600 titles from the current 23 courses × modifier templates). At roughly one post/day this is over a year of runway, but it will eventually need either more hand-written templates/courses, or a real keyword-expansion provider wired into `KeywordProvider` — tracked as follow-up, not done here.
- `DEEPSEEK_API_KEY` must be set as a Cloudflare Secret (`wrangler secret put DEEPSEEK_API_KEY`) before the article-writing step will work; without it, `runDailyArticleGeneration` returns a clear Persian error rather than silently failing or falling back to a different model.
- `src/server/ai-post-generator.ts` no longer exists — replaced by `src/ai/content-engine/article-generator.ts`. Both `src/worker.ts` and `/api/admin/generate-post` were updated to the new import.

---

# 6. Compliance Rules

Future changes to this subsystem must:

✓ Keep candidate generation free of fabricated search-volume/trend numbers — extend `KeywordProvider`, never hardcode a number.

✓ Keep `thinking` explicitly disabled on DeepSeek calls unless a specific reason to change it is documented here first.

✓ Key any new scoring factor by `related_course_slug`, not by the broader `instrument` field, to respect the "never merge distinct Landing Pages" rule.

✓ Route new topic-selection logic through `src/ai/content-engine/db.ts` rather than writing raw SQL inline in a page or API route.

---

## Status

Accepted

Effective Immediately
