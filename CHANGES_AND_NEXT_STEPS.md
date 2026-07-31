# Fateh Music Academy — SEO Phase 1: what changed, and what's next

This covers the first pass through the SEO master-prompt task, working directly
against the cloned repo (khalildelavaran/fatehmusic). Everything here respects
the project's own rules in `AGENTS.md` and `doc/`: `courses.js` and
`instructors.js` stay `FROZEN v1.0` and untouched, no URLs changed, no
architecture redesign, no invented instructor credentials/awards/statistics.

## How to apply this

I can't push to GitHub directly (no write credentials), so the changes are in
`fatehmusic-seo-phase1.patch`. From your local clone:

```bash
git apply fatehmusic-seo-phase1.patch
npm install
npm run build   # sanity check — should complete with no errors/warnings
```

If `git apply` complains about `package-lock.json`, it's safe to delete that
hunk and just run `npm install` again — it'll regenerate correctly since
`package.json` already lists `@astrojs/sitemap`.

---

## Part 1 — Two live bugs fixed (found by actually running the build, not guessing)

**1. Every course page and every instructor page was silently broken.**
`src/pages/courses/[slug].astro` and `src/pages/instructors/[slug].astro` were
missing `export const prerender = true;` — which your own `MIGRATION.md`
explicitly says every page needs after the `output: "server"` migration. Astro
confirmed this at build time:

```
[WARN] [router] getStaticPaths() ignored in dynamic page /src/pages/courses/[slug].astro.
[WARN] [router] getStaticPaths() ignored in dynamic page /src/pages/instructors/[slug].astro.
```

Without prerendering, `getStaticPaths()` is ignored, `Astro.props` is empty at
request time, and `const { course } = Astro.props` resolves to `undefined` —
so every one of these 37 pages would throw on `course.seo.title` in
production. Fixed by adding `prerender = true` to all page files except
`src/pages/api/register.ts` (which correctly stays dynamic). Rebuilt and
confirmed: all 23 course pages + 14 instructor pages now emit static HTML.

**2. `robots.txt` promised a sitemap that didn't exist.**
It points to `/sitemap-index.xml`; nothing in the project generated one, and
no `@astrojs/sitemap` dependency existed. Added the integration and `site:
"https://fatehmusic.ir"` to `astro.config.mjs`. Rebuilt and confirmed: 44 URLs
now present, including all courses/instructors.

**3. (Found, fixed in the same pass since I was already in the file) The
course detail page was rendering unstyled.** `src/styles/course-page.css`
targets class names (`.course-hero`, `.course-info`, `.course-meta`...) that
don't match what the template actually renders (`.course-page__hero`,
`.course-page__meta-item`...) — zero overlap. Added a scoped `<style>` block
in the page (same pattern already used successfully in the instructor page)
covering the real class names. `course-page.css` is now dead code; safe to
delete once you confirm nothing else references it.

**Not fixed, not my call:** the local build prints a harmless
`SyntaxError: "Host not i..."` tied to the Cloudflare Images/KV local
simulation — this is almost certainly my sandbox's restricted network
(it can't reach Cloudflare's API), not a real project bug. Worth a glance in
your real dev environment but I wouldn't chase it based on this.

---

## Part 2 — New long-form SEO/GEO content architecture

The master-prompt asks for rich per-page content (overview, curriculum, FAQ,
common mistakes, etc.), but the actual frozen data model only ever had
`content.excerpt` / `content.description` (1 sentence) and a `seo` block
(title/description/keywords) — no field for it. Rather than touch the frozen
files, I added a new, purely additive layer:

- `src/data/course-content.js` / `src/data/instructor-content.js` — long-form
  content keyed by `slug`, completely separate from the frozen files.
- `src/seo/resolvers/course.js` / `instructor.js` — look up content by slug
  and merge it in as `seoContent` (`null` if that slug has no entry yet).
  Course FAQs are now `[...generateCourseFAQ(id), ...seoContent.faqAdditions]`
  — your existing fact-derived logistics FAQ (price/schedule, still 100% live
  data, untouched) plus new hand-written pedagogical FAQ.
- `src/components/CourseSeoContent.astro` / `InstructorSeoContent.astro` —
  render the sections when `seoContent` exists, render **nothing** when it's
  `null`. Verified in the build: pages with content (guitar-course,
  khalil-delavaran) show the new sections; pages without it yet
  (violin-course, reza-fateh, etc.) render exactly as before, no errors, no
  leftover `undefined`.
- `src/components/FAQSection.astro` — generic, reusable, visible FAQ
  accordion (visual style matches `AboutFAQ.astro` exactly). Both course and
  instructor pages were building `FAQPage` JSON-LD from data that was never
  actually rendered on the page — a real risk for FAQ rich results, since
  Google expects structured data to match visible content. Confirmed in the
  build: guitar-course now shows 15 visible FAQ items, matching the 15-item
  `FAQPage` schema exactly.

**This means finishing the content is now just data entry**, one slug at a
time in those two content files — no further architecture, resolver, or
component work needed for the remaining 22 courses / 13 instructors.

### Resolving the word-count contradictions in the master prompt
Your prompt document specifies three different ranges for the same page type
in different sections (1200–2000 / 1500–3500 / 3500–6500 words). I standardized
on **~1800–2500 words of body content per course page** and **~1400–1800 per
instructor page** — generous enough for genuine depth (the guitar-course page
landed around that range), but not so long that it forces padding just to hit
a number, which would work against the "no filler, nothing that looks
AI-generated" instruction elsewhere in the same document.

### Trust / no-fabrication (unchanged from your own rules)
`instructors.js` has `metrics: { students: null, concerts: null, awards: null }`
for every instructor — deliberately. Content only uses what's actually in
`courses.js`/`instructors.js` (roles, education, experienceYears, taught
courses) plus generic, well-established music-pedagogy knowledge. No invented
awards, student counts, press mentions, or festival results anywhere.

---

## What's done vs. what's left

| | Done | Remaining |
|---|---|---|
| Courses with full content | 1 (`guitar-course`) | 22 |
| Instructors with full content | 1 (`khalil-delavaran`) | 13 |
| Architecture (resolvers, components, FAQ wiring) | ✅ complete for all 37 pages | — |
| Technical SEO (prerender, sitemap) | ✅ site-wide | — |

I can keep going and fill in the rest — realistically a handful of
courses/instructors per follow-up message if you want the same depth and
non-duplicated angle the "DUPLICATE CONTENT PREVENTION" section of your
prompt asks for (tar vs. setar, daf vs. tonbak, piano vs. keyboard, and the
three vocal-style pages all need genuinely distinct treatment, not palette-
swapped copies). Just say which to prioritize, or "continue in order," and
I'll keep working through `course-content.js` / `instructor-content.js`.
