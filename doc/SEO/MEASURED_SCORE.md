# Measured SEO score

`npm run seo:score` (after `CI=true npm run build`) scores the **rendered HTML** in `dist/client`.
Implementation: `src/seo/v2/measured-score.js`. Tests: `tests/seo/measured-score.test.ts`.

## Why it exists

`auditPage()` scores a context object that each page passes about itself (for example
`auditContext={{ h1Count: 1, missingImageAlt: 0 }}`). Those values are hand-written, so that score
cannot detect a regression. The measured score reads the built HTML instead.

## Rubric (weights sum to 100)

technical 15, metadata 15, structure 10, schema 20, linking 15, content 10, images 10, geo 5.
Each lost point is reported with a reason. Page types (home, listing, course, instructor, location,
about, contact, gallery, blog) have their own expected schema types, minimum words and minimum inbound links.

Site-level penalties: orphan pages, duplicate titles/descriptions, rendered pages missing from the
sitemap, missing `llms.txt`. Sitemap URLs with no static HTML (SSR routes such as `/blog`) are
listed as `unverifiedSitemapRoutes` and are not penalized.

## Gate

`node scripts/seo-score.mjs --min-overall=9 --min-page=9` exits 1 when either threshold is missed.

## What it does not measure

Rankings, content quality, real Core Web Vitals (field data), SSR blog posts (they need D1),
and whether the FAQ text is accurate. A 10/10 means the rubric passes, not that SEO is finished.
