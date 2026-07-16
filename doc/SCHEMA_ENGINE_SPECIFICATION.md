# SCHEMA_ENGINE_SPECIFICATION.md

**Version:** 2.0

**Status:** Approved

**Architecture Level:** Enterprise

**Project:** Fateh Music Academy

---

# 1. Purpose

This document defines the complete architecture of the centralized Schema Engine.

The Schema Engine is responsible for generating every JSON-LD Schema.org object across the platform.

It transforms business entities into machine-readable semantic data.

The engine is independent of

- Astro
- HTML
- Components
- Layouts
- Rendering

---

# 2. Vision

The Schema Engine exists to make the entire website understandable by

- Google
- Bing
- Yandex
- ChatGPT
- Gemini
- Claude
- Perplexity
- Knowledge Graphs
- Future AI Systems

Schema generation is automatic.

Developers never manually write JSON-LD.

---

# 3. Architectural Position

```
Repositories

↓

Schema Engine

↓

SEO Engine

↓

Layouts

↓

HTML

↓

Search Engines

↓

AI Systems
```

The engine consumes entities.

It never consumes pages.

---

# 4. Responsibilities

The Schema Engine owns

✓ JSON-LD

✓ Entity Relationships

✓ Schema Validation

✓ @id Generation

✓ URL Mapping

✓ Organization Identity

✓ Breadcrumb Graph

✓ Knowledge Graph

✓ Schema Versioning

✓ Multi-schema Pages

---

# 5. Non Responsibilities

Schema Engine never

Render HTML

Render Components

Generate Meta Tags

Generate Open Graph

Generate Twitter Cards

Store Business Data

Read Browser APIs

---

# 6. Folder Structure

```
src/

schemas/

SchemaEngine.js

SchemaRegistry.js

SchemaBuilder.js

SchemaValidator.js

EntityResolver.js

GraphBuilder.js

IdBuilder.js

UrlResolver.js

SchemaDefaults.js
```

Individual schemas

```
OrganizationSchema.js

CourseSchema.js

PersonSchema.js

ArticleSchema.js

FAQSchema.js

ReviewSchema.js

BreadcrumbSchema.js

ImageSchema.js

VideoSchema.js

LocalBusinessSchema.js
```

---

# 7. Public API

Main interface

```javascript
SchemaEngine.generate(entity)
```

Returns

```javascript
JSON-LD Object
```

Multiple entities

```javascript
SchemaEngine.generateMany()
```

Returns

```javascript
@graph
```

---

# 8. Supported Schema Types

Current implementation

```
Organization

EducationalOrganization

Course

Person

Article

ImageObject

BreadcrumbList

FAQPage

Question

Answer

Review

AggregateRating

LocalBusiness

WebSite

WebPage
```

Future

```
VideoObject

PodcastEpisode

MusicRecording

MusicAlbum

MusicGroup

Event

Offer

Product

HowTo

SpeakableSpecification
```

---

# 9. Schema Registry

Every schema registers itself.

```
Course

↓

CourseSchema

Person

↓

PersonSchema

Article

↓

ArticleSchema
```

Registry eliminates hardcoded mappings.

---

# 10. Entity Resolution

Schema generation starts from

Business Entity

not

URL

not

Page

not

Component

Repositories provide the entity.

---

# 11. Organization Identity

The Organization schema is the root.

Everything references

```
Organization

↓

@id
```

Example

```
https://example.com/#organization
```

The identifier never changes.

---

# 12. @id Strategy

Every entity owns

```
Canonical URL

+

Anchor
```

Example

```
/courses/classical-guitar#course

/articles/music-theory#article

/instructors/ali-ahmadi#person
```

Permanent identifiers are mandatory.

---

# 13. Graph Generation

Preferred output

```json
{
 "@context":"https://schema.org",

 "@graph":[]
}
```

All schemas belong to one graph.

---

# 14. Relationships

Schemas reference each other.

Example

```
Organization

↓

Course

↓

Instructor

↓

Article

↓

Image
```

Relationships use @id.

Never duplicate entities.

---

# 15. Course Schema

Generated from

Course Repository

Includes

```
Provider

Teacher

Duration

Level

Description

Image

Language

URL
```

Supports Google's Course rich results.

---

# 16. Organization Schema

Contains

```
Name

Logo

Address

Geo

Telephone

Email

SameAs

Opening Hours

Images
```

Generated once per page.

---

# 17. Person Schema

Generated for instructors.

Includes

```
Name

Photo

Biography

Job Title

Affiliation

SameAs

KnowsAbout
```

Person connects to Course.

---

# 18. Article Schema

Contains

```
Headline

Description

Image

Author

Publisher

DatePublished

DateModified

Reading Time

Language
```

Publisher references Organization.

---

# 19. FAQ Schema

Automatically generated

from

FAQ Repository.

Each question

maps to

```
Question

↓

Answer
```

No duplicated content.

---

# 20. Breadcrumb Schema

Generated from

Navigation Repository.

Uses

```
BreadcrumbList
```

Matches visible breadcrumb.

---

# 21. Review Schema

Generated from

Review Repository.

Includes

```
Rating

Author

Review Body

Date

Reviewed Item
```

Supports AggregateRating.

---

# 22. Image Schema

Every important image

receives

```
ImageObject
```

Contains

Width

Height

Caption

Creator

License

Content URL

RepresentativeOfPage

---

# 23. Local Business

Supports

```
Address

Geo

Hours

Phone

Maps

Social Profiles
```

Future branch support included.

---

# 24. Validation

Every schema validates

Required Properties

Property Types

Relationships

Canonical URLs

Duplicate IDs

Build fails if validation fails.

---

# 25. Schema Composition

Pages may contain

```
Organization

+

WebPage

+

Breadcrumb

+

Course

+

FAQ

+

Review
```

One graph.

Many entities.

---

# 26. Performance

Schema generation

occurs

at build time.

Target

```
<2 ms

per entity
```

No runtime computation.

---

# 27. Testing

Required

✓ Organization

✓ Course

✓ Article

✓ FAQ

✓ Breadcrumb

✓ Image

✓ Validation

✓ Duplicate Detection

Coverage target

100%.

---

# 28. Future Compatibility

Designed for

Google Rich Results

↓

Knowledge Graph

↓

AI Search

↓

Vector Search

↓

Entity APIs

↓

Knowledge APIs

↓

RAG Systems

No redesign required.

---

# 29. Security

Never expose

Internal IDs

Private Metadata

Draft Content

Temporary URLs

Server Information

Schema contains public knowledge only.

---

# 30. Governance

Changes affecting

Schema Types

Relationships

Validation

@id Strategy

Graph Structure

require architectural review.

---

# 31. Compliance Rules

Every entity must

✓ Generate Schema

✓ Have stable @id

✓ Use canonical URL

✓ Resolve relationships

✓ Pass validation

✓ Belong to @graph

✓ Avoid duplicated entities

No page may manually create JSON-LD.

---

# 32. Final Statement

The Schema Engine is the semantic backbone of the Fateh Music Academy platform.

It converts structured business entities into a unified Knowledge Graph that is consumable by search engines, AI assistants and future semantic systems while remaining completely independent from rendering technologies.

---

## Status

Approved

Mandatory

Effective Immediately