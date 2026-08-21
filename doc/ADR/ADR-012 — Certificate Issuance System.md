# ADR-012 — Certificate Issuance System

**Status:** In Progress (this ADR is being written incrementally as pieces land, not after the fact)

**Version:** 0.2

**Date:** 2026-08-20

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- migrations/0006_create_course_books.sql
- src/data/courses.js (source of truth for the 23 course slugs referenced throughout)
- registrations table (existing, migrations/0001)

---

# 1. Summary

A print-ready (A4 landscape) certificate for students who finish a course: student name, national ID, course/book completed, completion date, certificate number, teacher and academy director names, academy logo, and a course-specific decorative background. This ADR tracks the pieces as they're built; it is not a finished design written after the fact.

# 2. Decisions made so far

**2.1 — Certificate number = `registrations.tracking_code`.** Already unique, already shown to the student at signup (format `FM-{year}-{6 digits}`), so no new numbering scheme was needed. Confirmed directly by the site owner after reviewing real historical certificates that used a different-looking, inconsistently-formatted number (sometimes Persian digits, sometimes Latin, no clear generation logic) -- those were manually assigned one-offs, not a scheme to reproduce.

**2.2 — National ID is collected on the public registration form** (permanent personal data, collected once) — **not yet implemented**, tracked as the next piece.

**2.3 — Course completion date is entered manually at certificate-issuance time**, not stored on `registrations` — a student's registration doesn't know in advance when they'll finish, and retrofitting a "completed" status onto the existing pending/contacted/confirmed/cancelled lifecycle would conflate two different concerns (interest in enrolling vs. having finished).

**2.4 — Books are a proper D1 table (`course_books`), not a static file.** The site owner asked explicitly for this to stay extensible without a code deploy: staff can add a new book to any course through `/admin/books` at any time. A book is looked up by `course_slug` (one course can have several books — sequential levels, or alternative methods by different authors); `tar-course` and `setar-course` share one three-volume method, stored as two rows rather than modeling a many-to-many join, so every other query stays a flat SELECT. Seeded from the 13 instruments' worth of real book data the site owner provided (34 cover images now live at `public/images/books/`); the other 10 courses intentionally have zero rows until real data exists for them — no invented book titles.

**2.5 — [Superseded, see Amendment below] Backgrounds are original geometric art, generated with code, not sourced from the web.**

---

# Amendment (2026-08-21) — real reference certificates changed the design and the rendering approach

The site owner sent five real, currently-used certificates (as .docx files) plus the actual logo. They look nothing like the geometric design in §2.5 above: light background, a real **photograph of the instrument** bleeding off the left edge, an abstract blue "wave" graphic top-right, a large decorative student name, a formal certification paragraph (student, national ID, date, discipline, sometimes the specific book + a curriculum clause, the Ministry of Culture license number `۱۴۰۱۱۷-۲۳۰۰۳۸۰`, city), a circular "LEVEL" badge on adult-instrument certificates, and a footer of director / round academy seal / instructor. A children's-course sample uses a completely different, colorful splash-of-paint background instead of the blue wave. The geometric design was rejected outright and rebuilt around these real examples instead of guesswork.

**Instrument photos**: sourcing these from a generic web image search would carry the same licensing risk flagged in the original §2.5 -- most results were retailer/blog photos, not clearly licensed for reprinting on a commercial document, and this got worse for distinctive Persian instruments (santur, tar, daf, ney-anban) where clean royalty-free stock barely exists. Cloudflare's browser sandbox that Claude runs in also has a restricted egress allowlist that does not include general image hosts (confirmed directly -- Wikimedia Commons, which does have clearly-licensed photos, returned "cache-only, cannot be fetched"). Decision: the site owner is providing real photos of the academy's own instruments directly. `instrumentPhotoUrl` in the template is a placeholder path (`/images/cert-photos/{course_slug}.jpg`) until those arrive -- swapping them in later is a data change, not a template change.

**Rendering engine**: pdf-lib (the "leading candidate" originally guessed in §3 below) is the wrong tool here and was not built. No JS PDF-construction library does Arabic/Persian contextual letter-shaping or RTL bidi correctly on its own -- getting that right by hand would have been a serious, easy-to-get-subtly-wrong undertaking. **Cloudflare Browser Run** (`env.BROWSER.quickAction("pdf", { html })`, a real headless Chromium instance reachable from a Worker binding) renders standard HTML+CSS instead, which means Persian text shaping is simply correct, for free, because it is normal browser text rendering. This needs a `browser` binding added to `wrangler.jsonc` (done) and a compatibility_date of 2026-03-24 or later (already satisfied). The certificate is now an HTML/CSS template (`src/server/certificates/template.ts`) rather than a hand-positioned PDF layout.

---

# 3. Not yet built

- National ID field on the public registration form (migration + `RegistrationValidation`/`Store`/`Controller` changes + real Iranian national-ID checksum validation, not just "10 digits")
- The 23 real instrument photos (site owner is providing these) and the round academy seal logo as a clean standalone file (the two PNGs sent so far are a different, wordmark-style logo, not the round seal actually used on certificates -- still need to confirm which to use, or get the seal as its own file)
- Whether "لوح تقدیر" (a separate merit/appreciation-award document seen in one sample, with no national ID or book reference at all) is in scope, or only "گواهی پایان دوره" (course-completion) -- current work assumes the latter only, matching the site owner's original detailed spec
- The admin page/flow to actually issue one: search a registration → pick a book from that course's list (optional) → enter national ID and completion date and level → generate. `/api/admin/certificate-generate` (built) takes exactly these as a POST body already; only the pick-a-student UI around it is missing
- Real-device verification of `env.BROWSER.quickAction("pdf", ...)` -- built and locally layout-tested via a local proxy (wkhtmltopdf, for positioning only; it lacks internet access to load the Google Fonts used, and has its own old-WebKit text-justification quirks), but not yet run against the actual Cloudflare binding

# 4. Compliance rules for future changes to this subsystem

✓ Never invent a book title, author, or completion date that wasn't confirmed by the site owner.

✓ Keep `course_books` keyed by `course_slug`, matching `src/data/courses.js` — never introduce a second, parallel course list.

✓ Certificate backgrounds stay original/code-generated, not sourced from search results, given they're printed under the academy's name.
