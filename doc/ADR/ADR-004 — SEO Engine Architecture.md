# ADR-004 — SEO Engine Architecture

**Status:** Accepted

**Version:** 1.0

**Date:** 2026-07-16

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- MASTER_ARCHITECTURE.md
- ADR-001 Repository Pattern
- ADR-002 Astro Architecture
- ADR-005 Schema Engine
- CONTENT_GUIDE.md

---

# 1. Summary

This Architecture Decision Record establishes the SEO Engine as a first-class architectural layer.

SEO is not implemented inside pages.

SEO is not implemented inside components.

SEO is not implemented inside repositories.

Instead, the project uses a dedicated SEO Engine responsible for generating all metadata consistently across the entire platform.

The SEO Engine becomes the single authority for metadata generation.

---

# 2. Context

Modern SEO is significantly more complex than generating

```
<title>

<meta description>
```

A modern educational website requires

- Canonical URLs
- Open Graph
- Twitter Cards
- Robots
- Alternate Languages
- Structured Metadata
- Social Metadata
- AI Metadata
- Indexability Rules
- Breadcrumb Metadata

Managing these independently inside pages inevitably produces inconsistency.

---

# 3. Problem Statement

Without a centralized SEO layer

Pages implement metadata differently.

Developers duplicate logic.

Descriptions become inconsistent.

Canonical URLs differ.

Robots directives drift.

Social previews vary.

Search engines receive conflicting information.

AI crawlers receive incomplete semantic context.

---

# 4. Requirements

The SEO Engine must provide

Functional

- Metadata generation
- Canonical generation
- Open Graph
- Twitter Cards
- Robots
- Keywords
- Alternate URLs

Architectural

- Single source of truth
- Repository integration
- Framework independence
- Predictable interfaces

Non-functional

- Consistency
- Maintainability
- Performance
- AI compatibility

---

# 5. Decision

The project adopts a dedicated SEO Engine.

Pages never manually assemble metadata.

Repositories provide business information.

SEO Engine transforms business information into search metadata.

---

# 6. Architectural Position

```
Repositories

↓

SEO Engine

↓

Layouts

↓

<head>

↓

Search Engines
```

No presentation component participates in SEO generation.

---

# 7. Responsibilities

SEO Engine owns

✓ Title

✓ Description

✓ Canonical

✓ Robots

✓ Keywords

✓ Open Graph

✓ Twitter Card

✓ Alternate URLs

✓ Meta Verification

✓ Theme Color

✓ Viewport

✓ Favicons

SEO Engine never owns

✗ HTML Body

✗ Structured Data

✗ Business Rules

✗ Rendering Logic

---

# 8. Input Model

Repositories expose

```
seo

title

description

excerpt

image

slug

canonical

publishedAt

updatedAt

author

category
```

SEO Engine consumes these values.

---

# 9. Output Model

SEO Engine produces

```
title

description

canonical

robots

openGraph

twitter

alternates

metaTags

verification

themeColor
```

The output format remains stable.

---

# 10. Metadata Hierarchy

Priority

```
Entity SEO

↓

Repository Defaults

↓

Site Defaults
```

Example

```
Course Title

↓

Course Default

↓

Website Default
```

Higher priority always overrides lower priority.

---

# 11. Canonical Strategy

Every page has exactly one canonical URL.

Generated from

```
SITE_URL

+

Entity Slug
```

Never generated manually.

---

# 12. Title Strategy

Pattern

```
Primary Keyword

—

Brand
```

Example

```
Classical Guitar Course | Fateh Music Academy
```

Maximum recommended length

```
60 characters
```

---

# 13. Description Strategy

Descriptions should

Summarize

Educate

Encourage

Avoid keyword stuffing.

Recommended

```
140–160 characters
```

---

# 14. Open Graph

Generate

```
og:title

og:description

og:type

og:url

og:image

og:site_name

og:locale
```

Automatically.

---

# 15. Twitter Cards

Default

```
summary_large_image
```

Generated centrally.

Never duplicated.

---

# 16. Robots Strategy

Allowed values

```
index

noindex

follow

nofollow

max-image-preview

max-snippet

max-video-preview
```

Defaults

```
index

follow
```

---

# 17. Verification Tags

Centralized management

Examples

```
Google

Bing

Yandex

Pinterest

Future Providers
```

Pages never include verification tags.

---

# 18. AI Metadata

Future metadata support

```
Knowledge Category

Entity Type

Educational Level

Reading Time

Learning Time

Semantic Tags

Knowledge Confidence
```

Prepared for AI indexing.

---

# 19. Internal Linking Support

SEO Engine exposes

```
Related Pages

Topic Cluster

Breadcrumb Links

Parent Entity

Sibling Entity
```

Supports topical authority.

---

# 20. Pagination Metadata

Future support

```
Page

Previous

Next

Canonical

Robots
```

Duplicate content avoided.

---

# 21. Multi-language Support

Future architecture

```
English

Persian

Arabic

French

...

hreflang

alternate URLs
```

SEO Engine manages localization.

---

# 22. Performance

Metadata generation occurs

During Build.

No runtime computation.

Static metadata improves

Performance

Caching

SEO

AI crawling.

---

# 23. Validation

SEO Engine validates

✓ Title exists

✓ Description exists

✓ Canonical valid

✓ Image exists

✓ Robots valid

✓ URL valid

Build fails if validation rules are violated.

---

# 24. Future Evolution

Future additions

- Rich AI Metadata
- IndexNow
- Google Merchant
- Educational Metadata
- Academic Citations
- Semantic Scoring
- Automatic Meta Optimization

Architecture remains compatible.

---

# 25. Alternatives Considered

### Manual Metadata

Rejected

Reason

Duplication and inconsistency.

---

### Component-level SEO

Rejected

Reason

Presentation should not own metadata.

---

### Repository-level SEO Rendering

Rejected

Reason

Repositories own business data, not rendering.

---

### Third-party SEO Plugin

Rejected

Reason

Limited flexibility and architectural control.

---

# 26. Consequences

Positive

✓ Centralized metadata

✓ Consistent SEO

✓ AI-ready

✓ Easier maintenance

✓ Better testing

✓ Future-proof

Negative

• One additional architectural layer.

The benefits significantly outweigh the complexity.

---

# 27. Compliance Rules

Every page must

✓ Use SEO Engine

✓ Never manually generate metadata

✓ Never duplicate canonical URLs

✓ Never duplicate Open Graph tags

✓ Validate metadata before deployment

Architectural violations require review.

---

# 28. Final Decision

The SEO Engine is adopted as the exclusive mechanism for generating metadata across the Fateh Music Academy platform.

Metadata generation becomes deterministic, centralized and repository-driven.

This decision ensures long-term consistency across search engines, AI systems and future digital platforms.

---

## Status

Accepted

Mandatory

Effective Immediately