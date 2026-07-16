# ADR-006 — Static Rendering Architecture

**Status:** Accepted

**Version:** 1.0

**Date:** 2026-07-16

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- MASTER_ARCHITECTURE.md
- ADR-001 Repository Pattern
- ADR-002 Astro Architecture
- ADR-003 Cloudflare Deployment
- ADR-004 SEO Engine
- ADR-005 Schema Engine

---

# 1. Summary

This Architecture Decision Record establishes Static Rendering (Static Site Generation - SSG) as the primary rendering strategy for the Fateh Music Academy platform.

All pages should be statically generated during the build process unless a documented architectural decision explicitly requires another rendering strategy.

Static HTML is considered the canonical output of the platform.

---

# 2. Context

The Fateh Music Academy website is primarily an educational platform.

Typical visitor behavior includes

- reading course information
- browsing instructors
- viewing articles
- searching educational resources
- discovering the academy through search engines
- consuming structured knowledge

Nearly all content changes infrequently.

Therefore, pre-rendered HTML provides the optimal balance of performance, scalability and maintainability.

---

# 3. Problem Statement

Choosing an inappropriate rendering strategy may introduce

- unnecessary JavaScript
- server infrastructure complexity
- higher operational cost
- slower page delivery
- inconsistent SEO
- caching challenges
- reduced Core Web Vitals

The platform requires a deterministic rendering strategy.

---

# 4. Requirements

Rendering must provide

Functional

- Dynamic routing
- Static generation
- Repository integration
- Asset optimization

Non-functional

- Excellent SEO
- AI readability
- Low latency
- High cacheability
- Minimal runtime
- Simple deployment

Future

- Partial Prerendering
- Edge Rendering
- Hybrid Rendering

---

# 5. Decision

Static Site Generation (SSG) becomes the default rendering mode.

Every page is rendered during build.

Runtime rendering is considered an exception.

---

# 6. Rendering Hierarchy

Preferred rendering order

```
Static Rendering (SSG)

↓

Partial Prerendering

↓

Edge Rendering

↓

Server Rendering (SSR)

↓

Client Rendering
```

Any deviation requires a separate ADR.

---

# 7. Rendering Pipeline

```
Repositories

↓

SEO Engine

↓

Schema Engine

↓

Astro

↓

Static HTML

↓

Cloudflare Edge

↓

Browser
```

The browser receives fully rendered HTML.

---

# 8. Build-Time Rendering

During build

Repositories resolve entities.

SEO metadata is generated.

Schema.org graphs are generated.

Assets are optimized.

Pages are rendered.

No business logic executes in the browser.

---

# 9. Dynamic Routes

Dynamic pages

Example

```
/courses/[slug]

/instructors/[slug]

/articles/[slug]
```

are resolved through

```
getStaticPaths()

↓

Repository

↓

Static HTML
```

No runtime database queries occur.

---

# 10. Repository Integration

Repositories provide

```
Entity List

↓

Entity Data

↓

Relationships

↓

SEO

↓

Schema
```

Rendering consumes only repository output.

---

# 11. HTML as the Product

The primary product of the build process is

```
HTML
```

JavaScript is considered an enhancement.

HTML must remain

Complete

Semantic

Accessible

AI-readable

---

# 12. JavaScript Philosophy

JavaScript should never be required to

Read a course.

Read an article.

Read an instructor profile.

Navigate the website.

Primary educational content exists in HTML.

---

# 13. SEO Benefits

Static rendering provides

Stable URLs

Complete metadata

Immediate crawlability

Fast indexing

Reliable canonical URLs

Consistent Open Graph

Consistent structured data

Search engines receive complete pages immediately.

---

# 14. AI Benefits

LLMs and semantic crawlers receive

Complete HTML

Complete Schema

Complete Metadata

Complete Relationships

without executing JavaScript.

This improves retrieval quality.

---

# 15. Performance Benefits

Static rendering enables

Excellent TTFB

Edge caching

Minimal CPU usage

Minimal memory usage

Low operational cost

Outstanding Core Web Vitals

---

# 16. Cache Strategy

```
Build

↓

Static HTML

↓

Cloudflare Edge

↓

Browser Cache
```

The same page is served globally.

No runtime rendering cost.

---

# 17. Hydration Rules

Hydration is optional.

Allowed only for

Interactive search

Maps

Media players

Forms

Future dashboards

Hydration never replaces HTML.

---

# 18. Client-side Rendering Policy

Client rendering is prohibited for

Courses

Teachers

Articles

FAQs

Gallery

Educational content

Client rendering may enhance interaction, not content delivery.

---

# 19. Partial Prerendering

Future Astro features may introduce

Partial Prerendering.

Architecture already supports

```
Static Shell

↓

Dynamic Island
```

without repository changes.

---

# 20. SSR Policy

Server-Side Rendering may be introduced only for

Authenticated dashboards

Student Portal

Instructor Portal

Administration

Personalized recommendations

Public educational pages remain static.

---

# 21. Incremental Evolution

Future technologies

Incremental Static Regeneration

Edge Rendering

Streaming

Server Islands

may be adopted without changing

Repositories

SEO Engine

Schema Engine

Domain Model

---

# 22. Alternatives Considered

### Full SSR

Rejected

Reason

Higher infrastructure cost and unnecessary complexity.

---

### SPA

Rejected

Reason

Poor fit for educational content and SEO objectives.

---

### Hybrid by Default

Rejected

Reason

Introduces unnecessary architectural complexity.

---

### Runtime API Rendering

Rejected

Reason

Business data is already available during build.

---

# 23. Consequences

Positive

✓ Fast global delivery

✓ Outstanding SEO

✓ Excellent AI readability

✓ Predictable builds

✓ Reduced operational cost

✓ Simple deployment

✓ Better cache utilization

Negative

• Content updates require rebuilds.

• Personalized pages require separate architecture.

These trade-offs are acceptable.

---

# 24. Compliance Rules

Every public page must

✓ Be statically rendered

✓ Use getStaticPaths() where applicable

✓ Consume repositories

✓ Generate SEO during build

✓ Generate Schema during build

✓ Produce semantic HTML

SSR requires explicit architectural approval.

---

# 25. Future Compatibility

This architecture supports

Astro Server Islands

Cloudflare Workers

Edge Personalization

AI-generated recommendations

Content Collections

Hybrid rendering

without modifying the rendering philosophy.

---

# 26. Final Decision

Static Rendering is adopted as the permanent default rendering strategy for the Fateh Music Academy platform.

The platform prioritizes delivering complete, semantic and machine-readable HTML to every visitor, search engine and AI system.

Runtime rendering is reserved exclusively for scenarios where static generation cannot satisfy functional requirements.

---

## Status

Accepted

Mandatory

Effective Immediately