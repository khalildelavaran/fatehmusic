# ADR-005 — Schema Engine Architecture

**Status:** Accepted

**Version:** 1.0

**Date:** 2026-07-16

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- MASTER_ARCHITECTURE.md
- ADR-001 Repository Pattern
- ADR-004 SEO Engine
- DATA_MODEL.md
- SCHEMA_SPECIFICATION.md

---

# 1. Summary

This Architecture Decision Record establishes the Schema Engine as the centralized system responsible for generating all Schema.org structured data throughout the Fateh Music Academy platform.

Structured data is treated as an architectural layer rather than page-specific markup.

Every JSON-LD document is generated through the Schema Engine.

Pages never manually construct Schema.org objects.

---

# 2. Context

Modern search engines and AI systems rely heavily on structured data.

Schema.org enables machines to understand

- entities
- relationships
- educational content
- organizations
- instructors
- events
- navigation
- reviews
- media

Without a centralized architecture, schema implementations inevitably become inconsistent.

---

# 3. Problem Statement

If each page generates its own JSON-LD

Different structures appear.

Properties become inconsistent.

Identifiers change.

Relationships break.

Duplicate entities emerge.

Knowledge Graph quality deteriorates.

AI systems lose semantic confidence.

---

# 4. Requirements

The Schema Engine must provide

Functional

- JSON-LD generation
- Entity resolution
- Relationship generation
- Identifier generation
- Graph composition

Architectural

- Repository integration
- Stable contracts
- Central governance
- Framework independence

Non-functional

- Maintainability
- AI readiness
- Search compatibility
- Validation
- Extensibility

---

# 5. Decision

The project adopts a dedicated Schema Engine.

Repositories expose business entities.

Schema Engine transforms business entities into Schema.org objects.

Layouts inject JSON-LD.

Components never generate structured data.

---

# 6. Architectural Position

```
Repositories

↓

Schema Engine

↓

Layouts

↓

JSON-LD

↓

Search Engines

↓

Knowledge Graphs

↓

AI Systems
```

Structured data becomes an independent architectural layer.

---

# 7. Responsibilities

Schema Engine owns

✓ Schema generation

✓ @context

✓ @type

✓ @graph

✓ @id

✓ Relationship mapping

✓ URL generation

✓ Graph composition

✓ Validation

✓ Entity identity

Schema Engine never owns

✗ HTML

✗ CSS

✗ SEO metadata

✗ Rendering

✗ Business rules

---

# 8. Supported Schema Types

Current

```
Organization

LocalBusiness

MusicSchool

Course

CourseInstance

Person

BreadcrumbList

FAQPage

Article

ImageObject

Review

AggregateRating

WebSite

WebPage

CollectionPage

ContactPage
```

Future

```
VideoObject

AudioObject

MusicComposition

MusicRecording

Offer

Event

EducationalOccupationalProgram

HowTo

SpeakableSpecification

LearningResource
```

---

# 9. Graph Philosophy

The platform produces

one connected Knowledge Graph.

Preferred

```
@graph
```

instead of multiple unrelated JSON-LD blocks.

Entities reference each other through stable identifiers.

---

# 10. Entity Identity

Every entity owns

```
@id

Canonical URL

Repository ID

Slug

Knowledge Identifier
```

Identifiers never change after publication.

---

# 11. Organization Root

Organization is the root entity.

Example

```
Organization

↓

Courses

↓

Teachers

↓

Articles

↓

Events

↓

Gallery
```

All entities ultimately connect to the organization.

---

# 12. Relationship Rules

Relationships are explicit.

Examples

```
Course

↓

hasCourseInstance

↓

CourseInstance
```

```
Course

↓

provider

↓

Organization
```

```
Course

↓

teacher

↓

Person
```

No implicit relationships.

---

# 13. Repository Integration

Repositories expose

```
Entity

↓

Schema Object

↓

Schema Engine

↓

JSON-LD
```

Repositories never build JSON-LD directly.

---

# 14. Schema Modules

Each Schema Type is implemented separately.

Example

```
organizationSchema.js

courseSchema.js

personSchema.js

articleSchema.js

breadcrumbSchema.js

faqSchema.js
```

Composition occurs inside Schema Engine.

---

# 15. Graph Assembly

Example

```
Organization

↓

Course

↓

Instructor

↓

FAQ

↓

Breadcrumb

↓

Review

↓

AggregateRating

↓

WebPage
```

The Schema Engine combines these into a single graph.

---

# 16. Validation

Every schema validates

✓ Required properties

✓ URL format

✓ Identifier format

✓ Relationships

✓ Duplicate IDs

✓ Schema type

✓ Context

Invalid schema blocks deployment.

---

# 17. Schema Versioning

Internal schema definitions follow semantic versioning.

Example

```
Schema Engine

v1

↓

v2

↓

v3
```

Backward compatibility is preferred.

---

# 18. AI Optimization

Schema is optimized for

Google

Gemini

ChatGPT

Claude

Perplexity

Copilot

Apple Intelligence

Knowledge Graphs

Semantic Crawlers

Structured data exists primarily for machine understanding.

---

# 19. Performance

JSON-LD generation occurs

during build.

No runtime schema generation.

No client-side schema injection.

---

# 20. Schema Inheritance

Avoid inheritance.

Prefer composition.

Example

```
Base Entity

+

SEO

+

Schema Fragment

+

Relationships

↓

Final Schema
```

Composition improves maintainability.

---

# 21. Future Extensions

Architecture supports

```
Learning Resources

Music Pieces

Composers

Albums

Exercises

Assignments

Certificates

Online Lessons

Practice Sessions
```

No redesign required.

---

# 22. Alternatives Considered

### Manual JSON-LD

Rejected

Reason

High duplication.

---

### Page-specific Schema

Rejected

Reason

Inconsistent implementation.

---

### Third-party Schema Plugin

Rejected

Reason

Insufficient control over architecture.

---

### Repository-generated JSON

Rejected

Reason

Violates separation of concerns.

---

# 23. Consequences

Positive

✓ Centralized Schema

✓ Better AI understanding

✓ Better Google Knowledge Graph

✓ Stable entity identity

✓ Easier maintenance

✓ Predictable implementation

Negative

• Additional architectural layer.

This complexity is justified.

---

# 24. Compliance Rules

Every published entity

must

✓ Have Schema

✓ Have Stable @id

✓ Be Connected to Organization

✓ Pass Validation

✓ Use Repository Data

✓ Be Generated by Schema Engine

Manual JSON-LD is prohibited.

---

# 25. Final Decision

The Schema Engine becomes the exclusive mechanism responsible for generating structured data across the Fateh Music Academy platform.

Structured data is recognized as a permanent architectural layer equal in importance to the Repository Layer and the SEO Engine.

This decision establishes a stable, AI-ready Knowledge Graph capable of supporting search engines, semantic indexing and future intelligent systems.

---

## Status

Accepted

Mandatory

Effective Immediately