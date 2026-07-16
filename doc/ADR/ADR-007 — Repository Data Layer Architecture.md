# ADR-007 — Repository Data Layer Architecture

**Status:** Accepted

**Version:** 1.0

**Date:** 2026-07-16

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- MASTER_ARCHITECTURE.md
- ADR-001 Repository Pattern
- DATA_MODEL.md
- REPOSITORY_API.md
- SCHEMA_SPECIFICATION.md

---

# 1. Summary

This Architecture Decision Record defines the Repository Data Layer as the canonical business data abstraction of the Fateh Music Academy platform.

The Repository Data Layer separates

- business entities
- storage mechanisms
- presentation
- SEO
- Schema generation

Every piece of business information originates from repositories.

Repositories become the permanent contract between the Domain Model and the rest of the application.

---

# 2. Context

The current implementation stores data inside JavaScript files such as

```
courses.js

instructors.js

schedule.js

gallery.js

articles.js
```

While sufficient for an initial implementation, direct access to these files tightly couples pages to storage.

Future migrations would require rewriting large parts of the application.

The Repository Data Layer eliminates this dependency.

---

# 3. Problem Statement

Without a dedicated data layer

Pages understand storage.

Components understand storage.

Layouts understand storage.

Business rules become scattered.

Changing storage requires widespread code changes.

The architecture becomes fragile.

---

# 4. Requirements

The data layer must provide

Functional

- Entity retrieval
- Relationship resolution
- Validation
- Search
- Filtering
- Aggregation

Architectural

- Storage abstraction
- Stable interfaces
- Repository ownership
- Future compatibility

Non-functional

- Maintainability
- Testability
- Performance
- Predictability
- Scalability

---

# 5. Decision

The project adopts a dedicated Repository Data Layer.

The Data Layer becomes the only architectural layer that understands where business information is physically stored.

Consumers never access storage directly.

---

# 6. Layer Position

```
Storage

↓

Repository Data Layer

↓

SEO Engine

↓

Schema Engine

↓

Layouts

↓

Components

↓

Pages
```

Only repositories communicate with storage.

---

# 7. Storage Independence

Current storage

```
JavaScript Objects
```

Future storage may become

```
Markdown

↓

JSON

↓

SQLite

↓

PostgreSQL

↓

Supabase

↓

Cloudflare D1

↓

REST API

↓

GraphQL

↓

Headless CMS
```

No consumer should require modification.

---

# 8. Repository Responsibilities

Repositories own

✓ Entity loading

✓ Entity validation

✓ Relationship resolution

✓ Derived values

✓ Business rules

✓ Filtering

✓ Sorting

✓ Search

Repositories never own

✗ Rendering

✗ CSS

✗ Astro

✗ Browser APIs

---

# 9. Data Ownership

Every entity has exactly one owner.

Examples

```
CourseRepository

↓

Course
```

```
InstructorRepository

↓

Instructor
```

```
ArticleRepository

↓

Article
```

Ownership is exclusive.

---

# 10. Repository Boundaries

Repositories must never modify

another repository's internal storage.

Cross-domain access occurs only through

public repository methods.

Example

Correct

```
CourseRepository

↓

InstructorRepository.getById()
```

Incorrect

```
CourseRepository

↓

import instructors.js
```

---

# 11. Repository Communication

Communication occurs through

stable contracts.

Example

```
CourseRepository

↓

InstructorRepository

↓

OrganizationRepository
```

No repository reads another repository's files.

---

# 12. Entity Resolution

Storage contains

```
teacherIds
```

Repository returns

```
Teacher Objects
```

Storage remains normalized.

Consumers receive rich objects.

---

# 13. Derived Data

Repositories calculate

```
Duration Labels

Reading Time

Canonical URLs

Breadcrumbs

Related Courses

Featured Items

Popularity Score

Difficulty Labels
```

Derived data never exists in storage.

---

# 14. Validation Layer

Repositories validate

Required fields

Slug uniqueness

Relationship integrity

Publication state

SEO completeness

Schema readiness

Invalid entities never reach presentation.

---

# 15. Repository Contracts

Every repository exposes predictable methods.

Mandatory

```
getAll()

getById()

getBySlug()

exists()

count()
```

Optional

```
search()

filter()

paginate()

getRelated()

getFeatured()

getLatest()
```

Interfaces remain stable.

---

# 16. Query Philosophy

Repositories expose

Business Queries

not

Storage Queries.

Correct

```
getFeaturedCourses()
```

Wrong

```
SELECT *

FROM courses

WHERE featured=1
```

Business language defines the API.

---

# 17. Relationship Graph

```
Organization

↓

Course

↓

Instructor

↓

Schedule

↓

Gallery

↓

Review

↓

FAQ
```

Repositories compose the graph.

Presentation receives completed entities.

---

# 18. Error Strategy

Repositories produce

Predictable errors.

Example

```
EntityNotFound

ValidationError

DuplicateSlug

RelationshipError

ConfigurationError
```

Errors never leak storage details.

---

# 19. Caching

Repository cache hierarchy

```
Memory

↓

Static Build

↓

Cloudflare Edge

↓

Browser
```

Caching remains transparent.

---

# 20. Future Data Sources

Repositories support

```
Content Collections

CMS

SQL

NoSQL

REST

GraphQL

Cloudflare KV

Cloudflare D1

Cloudflare R2

Vector Database
```

Migration affects repositories only.

---

# 21. AI Compatibility

Repositories expose

Structured

Validated

Normalized

Linked

Deterministic

knowledge.

This becomes the foundation for

Knowledge Graphs

Embeddings

RAG

AI Assistants

---

# 22. Testing

Every repository requires

Unit Tests

Validation Tests

Relationship Tests

Search Tests

Pagination Tests

Performance Tests

Regression Tests

Repositories become the primary testing target.

---

# 23. Alternatives Considered

### Direct JavaScript Imports

Rejected

Reason

Tight coupling.

---

### Global Store

Rejected

Reason

Unnecessary for static architecture.

---

### Database-first Design

Rejected

Reason

Premature complexity.

---

### CMS-first Design

Rejected

Reason

Vendor lock-in.

---

# 24. Consequences

Positive

✓ Stable architecture

✓ Storage independence

✓ Easier migration

✓ Better testing

✓ Better AI readiness

✓ Better SEO consistency

✓ Better maintainability

Negative

• Slightly more abstraction.

The abstraction significantly reduces long-term complexity.

---

# 25. Compliance Rules

Every Pull Request must satisfy

✓ No direct storage access outside repositories

✓ One owner per entity

✓ Stable repository contracts

✓ Validation inside repositories

✓ Business queries only

✓ Storage independence preserved

Architectural violations require mandatory review.

---

# 26. Final Decision

The Repository Data Layer is adopted as the permanent abstraction between business knowledge and physical storage.

Repositories become the only layer permitted to understand how data is stored, retrieved and composed.

This decision guarantees long-term maintainability, portability and scalability while preserving a clean separation between the Domain Model and the presentation layer.

---

## Status

Accepted

Mandatory

Effective Immediately