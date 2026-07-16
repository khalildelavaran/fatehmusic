# ADR-002 — Astro Architecture

**Status:** Accepted

**Version:** 1.0

**Date:** 2026-07-16

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- MASTER_ARCHITECTURE.md
- ADR-001 Repository Pattern
- ADR-003 Cloudflare Deployment
- DESIGN_SYSTEM.md

---

# 1. Summary

This Architecture Decision Record defines Astro as the presentation framework for the Fateh Music Academy platform.

Astro has been selected because its architecture aligns directly with the project's long-term objectives:

- Maximum SEO
- AI Discoverability
- Static-first architecture
- High performance
- Minimal JavaScript
- Long-term maintainability
- Cloudflare compatibility

Astro is treated as a rendering engine rather than an application framework.

Business logic remains independent of Astro.

---

# 2. Context

The platform is an educational website whose primary objectives are:

• Educational authority

• Search engine visibility

• AI discoverability

• Excellent Core Web Vitals

• Long-term scalability

Unlike SaaS dashboards, music academy websites are overwhelmingly read-oriented.

Visitors primarily consume content rather than perform complex client-side interactions.

This favors static rendering over client-heavy applications.

---

# 3. Problem Statement

Traditional SPA frameworks often introduce

- unnecessary JavaScript
- hydration overhead
- slower first paint
- SEO complexity
- larger bundles
- unnecessary client state

These disadvantages directly conflict with the goals of the platform.

---

# 4. Requirements

The framework must provide

Functional

- Static Site Generation
- Dynamic Routing
- Markdown Support
- Component Composition
- Asset Optimization

Architectural

- Framework Independence
- Component Reusability
- Minimal Runtime
- Repository Compatibility

Non-functional

- Lighthouse 100
- Core Web Vitals
- AI Readiness
- Fast Builds
- Cloudflare Deployment

---

# 5. Decision

Astro is adopted as the rendering framework for the platform.

Astro is responsible only for

- Rendering HTML
- Page composition
- Routing
- Asset optimization
- Hydration orchestration

Business rules remain outside Astro.

---

# 6. Architectural Position

```
Repositories

↓

SEO Engine

↓

Schema Engine

↓

Astro

↓

HTML

↓

Cloudflare Edge

↓

Browser
```

Astro is the presentation layer.

It never owns business knowledge.

---

# 7. Static-First Philosophy

Every page should be generated statically unless there is a compelling reason not to.

Preferred order

```
Static

↓

Partial Prerendering

↓

SSR

↓

Client Rendering
```

Static HTML is considered the default architecture.

---

# 8. Island Architecture

Interactive behavior is isolated.

Example

```
Static Page

↓

Interactive Gallery

↓

Interactive Map

↓

Interactive Search
```

Only interactive components hydrate.

Entire pages never hydrate.

---

# 9. Hydration Policy

Allowed directives

```
client:visible

client:idle

client:media

client:only

client:load (exception)
```

Preferred priority

```
visible

↓

idle

↓

media

↓

load
```

Hydration must always be justified.

---

# 10. Routing Strategy

Routes are file-based.

Examples

```
/

courses/

courses/[slug]

instructors/

instructors/[slug]

articles/

gallery/

contact/
```

Dynamic routes obtain data exclusively through repositories.

---

# 11. Layout Hierarchy

```
BaseLayout

↓

PageLayout

↓

Section Components

↓

UI Components
```

Layouts own structure.

Components own presentation.

---

# 12. Component Philosophy

Components must

Receive data

Render HTML

Emit events (if interactive)

Components must not

Import repositories

Generate SEO

Generate Schema

Contain business logic

---

# 13. Repository Integration

Pages request data from repositories.

Example flow

```
CourseRepository

↓

Course Page

↓

Layout

↓

Components
```

Astro never bypasses repositories.

---

# 14. SEO Integration

Astro pages request metadata from the SEO Engine.

Example

```
Repository

↓

SEO Engine

↓

Layout

↓

Head
```

Pages never manually assemble metadata.

---

# 15. Schema Integration

Structured data is injected centrally.

```
Repository

↓

Schema Engine

↓

Layout

↓

JSON-LD
```

Components never generate Schema.org markup.

---

# 16. Asset Strategy

Images use

```
astro:assets
```

Requirements

- Responsive
- Optimized
- Lazy-loaded
- Dimensioned

Static assets remain version-controlled.

---

# 17. Styling Strategy

Preferred order

```
Design Tokens

↓

Global Theme

↓

Component Styles

↓

Utility Classes
```

Styles remain scoped whenever possible.

---

# 18. Performance Principles

Astro should achieve

- Minimal JavaScript
- Small HTML
- Optimized CSS
- Fast hydration
- Excellent Core Web Vitals

Performance regressions block releases.

---

# 19. Build Pipeline

```
Repositories

↓

SEO Engine

↓

Schema Engine

↓

Astro Build

↓

Static HTML

↓

Cloudflare Deployment
```

The build must remain deterministic.

---

# 20. Future Compatibility

The architecture anticipates

- Astro Content Collections
- Partial Prerendering
- Server Islands
- View Transitions
- Edge Rendering
- Future Astro releases

Framework evolution must not affect repositories or the domain model.

---

# 21. Alternatives Considered

### Next.js

Rejected

Reason

SSR-first mindset and higher client/runtime complexity than required.

---

### Nuxt

Rejected

Reason

Excellent framework but unnecessary runtime overhead for the project's goals.

---

### SvelteKit

Rejected

Reason

Strong performance, but Astro provides a more suitable content-first architecture.

---

### Hugo

Rejected

Reason

Insufficient flexibility for future AI, repositories and structured domain modeling.

---

### Eleventy

Rejected

Reason

Excellent static generator, but Astro offers superior component composition and asset handling.

---

# 22. Consequences

Positive

✓ Excellent SEO

✓ Outstanding Core Web Vitals

✓ Tiny JavaScript bundles

✓ Cloudflare compatibility

✓ Repository-driven architecture

✓ AI-friendly HTML

✓ Long-term maintainability

Negative

• Some interactive features require explicit hydration.

• Developers must understand Island Architecture.

These trade-offs are acceptable.

---

# 23. Compliance Rules

Every Astro page must

✓ Use repositories

✓ Use SEO Engine

✓ Use Schema Engine

✓ Keep business logic out of components

✓ Minimize hydration

✓ Prefer static rendering

Architectural violations require review.

---

# 24. Final Decision

Astro is adopted as the presentation framework because it best satisfies the educational, SEO, AI and performance goals of the Fateh Music Academy platform.

Astro is considered an implementation detail.

The long-term architecture remains independent of any rendering framework.

---

## Status

Accepted

Mandatory

Effective Immediately