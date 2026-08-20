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

**2.1 — Certificate number = `registrations.tracking_code`.** Already unique, already shown to the student at signup (format `FM-{year}-{6 digits}`), so no new numbering scheme was needed.

**2.2 — National ID is collected on the public registration form** (permanent personal data, collected once) — **not yet implemented**, tracked as the next piece.

**2.3 — Course completion date is entered manually at certificate-issuance time**, not stored on `registrations` — a student's registration doesn't know in advance when they'll finish, and retrofitting a "completed" status onto the existing pending/contacted/confirmed/cancelled lifecycle would conflate two different concerns (interest in enrolling vs. having finished).

**2.4 — Books are a proper D1 table (`course_books`), not a static file.** The site owner asked explicitly for this to stay extensible without a code deploy: staff can add a new book to any course through `/admin/books` at any time. A book is looked up by `course_slug` (one course can have several books — sequential levels, or alternative methods by different authors); `tar-course` and `setar-course` share one three-volume method, stored as two rows rather than modeling a many-to-many join, so every other query stays a flat SELECT. Seeded from the 13 instruments' worth of real book data the site owner provided (34 cover images now live at `public/images/books/`); the other 10 courses intentionally have zero rows until real data exists for them — no invented book titles.

**2.5 — Backgrounds are original geometric art, generated with code, not sourced from the web.** The site owner asked Claude to make them directly. Sourcing photographs from a search would have created real licensing risk for a document the academy prints and hands to students; a from-scratch geometric design has none. Direction: a restrained Persian/Islamic-influenced compass-rosette motif (concentric rings + radiating petals — an authentic decorative device from Persian manuscript illumination, not a generic "certificate border" clipart look), one accent color per instrument family (string/bowed/keyboard/percussion/wind/vocal/theory/child), all 23 courses individually generated (per the site owner's choice over a shared or per-category background) once the direction is confirmed. First pass produced a version that was too busy (dense stamped-star border, overlapping rotated star layers reading as clutter, not craftsmanship) and was rebuilt into the current calmer version before being shown at all — see `/mnt/skills/public/frontend-design/SKILL.md`'s note on self-critique before presenting.

# 3. Not yet built

- National ID field on the public registration form (migration + `RegistrationValidation`/`Store`/`Controller` changes + real Iranian national-ID checksum validation, not just "10 digits")
- The remaining ~19 course backgrounds (waiting on direction sign-off on the samples shown)
- The actual certificate generator: a PDF library choice that works inside the Cloudflare Workers runtime (no Node `fs`/native bindings — `pdf-lib` is the leading candidate), plus solving Persian/Arabic-script contextual letter-shaping in the rendered text, which most JS PDF libraries do not handle automatically
- The admin page/flow to actually issue one: pick a registration → pick a book from that course's list → enter national ID (once ready) and completion date → generate

# 4. Compliance rules for future changes to this subsystem

✓ Never invent a book title, author, or completion date that wasn't confirmed by the site owner.

✓ Keep `course_books` keyed by `course_slug`, matching `src/data/courses.js` — never introduce a second, parallel course list.

✓ Certificate backgrounds stay original/code-generated, not sourced from search results, given they're printed under the academy's name.
