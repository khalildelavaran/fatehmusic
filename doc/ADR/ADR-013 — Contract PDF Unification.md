# ADR-013 — Contract PDF Unification

**Status:** Complete

**Version:** 1.0

**Date:** 2026-08-29

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- ADR-012 — Certificate Issuance System.md (same `env.BROWSER.quickAction("pdf", ...)` mechanism; same reasoning for rejecting pdf-lib in favor of real Chromium rendering for Persian text shaping)
- src/scripts/registration/ContractTemplates.ts (`buildContract` — untouched; still the single source of contract content/business logic)
- migrations/0008_add_contract_fields.sql, 0009_add_term_number.sql

---

# 1. Summary

"قرارداد هنرجویی" (student contract) had **three independent implementations** by the time this ADR was written, one of them dead code and none of them agreeing with each other visually. This ADR unifies all of them behind one HTML template and one PDF-generation pipeline, reusing the `env.BROWSER.quickAction("pdf", ...)` mechanism ADR-012 already established for certificates, and adds a fourth (new) surface — the registration wizard's own Success step — as a real PDF instead of the browser's native print dialog.

# 2. What was found

Three surfaces needed a contract PDF; auditing them turned up four separate HTML/CSS implementations, not one:

1. **Registration wizard Success step** (`SuccessStep.astro`, inline `<script>`) — opened a new window and called `window.print()`. Not a real PDF: relied on the visitor manually choosing "Save as PDF" from the browser's own print dialog. This script ran in the **capture phase** with `stopImmediatePropagation()`, silently shadowing a second, dead implementation of the same thing in `RegistrationController.ts` (`printContract()`, unreachable — confirmed by tracing event propagation, not by assumption).
2. **Admin panel + student portal**, both pointed at `/api/admin/contract-generate` (`registrations.js`'s `[data-print-contract]` button; `student/index.astro`'s `PDF قرارداد` link). This one *was* a real PDF via `env.BROWSER`, but with its own, differently-styled HTML template — no logo, generic header, and no bidi handling on the tracking code it displayed (the exact class of RTL bug already fixed elsewhere for mobile numbers and tuition amounts, just not here).
3. **A fourth, dead template** inside `src/pages/api/admin/registrations.ts`'s `POST` handler — confirmed unreachable: nothing in the codebase calls `POST /api/admin/registrations` (only `GET` and `PATCH` are used). Removed rather than fixed.

None of the four agreed on border color, header layout, or footer content, despite all four claiming to render the same legal document.

# 3. What was built

**3.1 — One template, one pipeline**, mirroring ADR-012's certificate split:

- `src/server/contracts/template.ts` — pure function `buildContractHtml(contract, meta)`. The canonical design is the most-iterated of the three predecessors (the one that lived in `SuccessStep.astro`'s script): double gold border frame, logo, single-page A4 fit. Ported as-is rather than redesigned, since it was the one already refined against real print output.
- `src/server/contracts/generate.ts` — `loadRegistrationForContract()` (D1 lookup by numeric id *or* tracking code) and `generateContractPdf()` (row → `buildContract()` → `buildContractHtml()` → `env.BROWSER.quickAction("pdf", ...)`). Same `format:"a4"` / zero-margin / `printBackground:true` PDF options ADR-012 uses, `landscape:false` instead of `true`.
- The tracking code (`FM-2026-123456`) is now shown in the header on all three surfaces, isolated with `direction:ltr; unicode-bidi:embed` — the same fix already applied to mobile numbers and tuition amounts in `ContractTemplates.ts`, extended to cover this Latin-character field too.

**3.2 — Two route files, one shared trust boundary:**

- `src/pages/api/admin/contract-generate.ts` — unchanged URL and behavior for the admin panel and student portal. Still session-gated (`requireRole` for admin/registrar, or a matching student session), still looked up by `registration_id`. Now delegates to the shared pipeline instead of carrying its own template.
- `src/pages/api/contract-pdf.ts` — **new**, public, POST-only, looked up by `tracking_code` instead. This is the wizard's own Success step's endpoint: right after `api/register.ts` succeeds, the browser has a tracking code but no admin or student session (student portal login is a separate, later step). Knowing the tracking code *is* the credential here, the same trust model an order-confirmation code uses — it is server-generated, unique, and only ever returned to whoever just submitted that one registration. It grants access to nothing but that one document. This is not a lowering of the previous trust bar: the Success step was, until this change, rendering the exact same data straight from unauthenticated client-side state, no server check of any kind.
- Kept as two route files rather than one with branching auth, so each file's trust model stays legible on its own — `/api/admin/...` stays session-only, the public one is separately named and never touches an admin path.

**3.3 — Dead code removed, not left alongside the fix:**

- `RegistrationController.ts`'s unreachable `printContract()` iframe/print implementation → replaced with the real implementation (fetches `/api/contract-pdf`, opens the result the same "blank tab first, swap in the blob" way the admin panel's button already did, so popup blockers can't interfere).
- `SuccessStep.astro`'s capture-phase shadow script → removed entirely; the controller's own `bindEvents()` dispatch now actually runs, instead of being silently overridden.
- `admin/registrations.ts`'s dead `POST` handler and its unused `buildContract` import → removed.
- `RegistrationRenderer.renderContract()`'s `.print-contract-header` / `.print-contract-footer` divs → removed. Confirmed via a full-repo search that neither class had *any* CSS rule anywhere in the project; they rendered unstyled (including the logo `<img>` at native resolution — the source PNG is 4500×4588px) at the top of the on-page contract preview, and existed only to be read from / stripped out by the script that's now gone. The on-page preview's own `.contract-body::before` pseudo-element already supplies a styled title, making these redundant on top of being unstyled.

# 4. Validation performed

- `npx astro check`: baseline (unmodified repo) is 64 pre-existing errors / 6 hints, unrelated to this work (Cloudflare Workers' `crypto.subtle` types, D1's `.first<T>()` generic pattern used throughout the codebase including the untouched `certificates/generate.ts`, an unrelated `student/login.astro` null-check, `window.fbq` typing). After this change: 59 errors / 4 hints — net improvement, and the only remaining errors touching new/changed files are the pre-existing `.first<T>()` pattern (kept for consistency with `certificates/generate.ts`, which has the identical pattern) and the pre-existing, untouched `fbq` line.
- `npx vitest run`: 70/70 passing, including all 20 `ContractTemplates.test.ts` cases (`buildContract` itself was not touched).
- `npm run build`: completes through `astro build`'s full server + client bundling (the only failure afterward is `wrangler`'s remote-preview step needing a `CLOUDFLARE_API_TOKEN`, which is a sandbox credential limitation, not a build error).
- HTML output sanity-checked directly (balanced tags, no `undefined`/`NaN`/`[object Object]`, all expected content present, tracking code renders in correct left-to-right order) against realistic `buildContract()` output.
- A rough visual render (`wkhtmltoimage`, the same tool ADR-012 already flagged as "layout-only... has its own old-WebKit text-justification quirks") initially showed clipped RTL text. Isolated to confirm it's that exact known engine limitation and not a real bug: a minimal `dir="rtl"; text-align:justify` div with no grid or absolute positioning reproduces the identical clipping on its own, and the full HTML source was confirmed to contain complete, untruncated text throughout. Real Chromium (what `env.BROWSER` actually runs) does not share this limitation — it's the same engine already rendering this exact CSS correctly today via the live site's browser-based print flow. Not yet verified against the actual `env.BROWSER` binding, same as ADR-012's certificate template at the time it was written.

# 5. Compliance rules for future changes to this subsystem

✓ There is exactly one contract HTML template (`src/server/contracts/template.ts`). A new surface that needs a contract PDF calls `generateContractPdf()`, it does not grow its own HTML string.

✓ Any Latin-character field placed in the header/footer (tracking codes, dates with Latin punctuation, etc.) gets `direction:ltr; unicode-bidi:embed` isolation, not a Persian-digit conversion — those are different bugs with different fixes; see `ContractTemplates.ts`'s own doc comment for the digit-conversion case.

✓ `/api/contract-pdf` (public, tracking-code-authenticated) stays scoped to *reading back one document the visitor's own browser just submitted*. It must not grow a way to enumerate, list, or look up registrations by anything other than an exact tracking-code match.
