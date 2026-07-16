# ADR-009 — Naming Convention Architecture

**Status:** Accepted

**Version:** 1.0

**Date:** 2026-07-16

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- MASTER_ARCHITECTURE.md
- ADR-001 Repository Pattern
- DATA_MODEL.md
- REPOSITORY_API.md
- DESIGN_SYSTEM.md

---

# 1. Summary

This Architecture Decision Record defines the official naming convention for the Fateh Music Academy platform.

Naming is treated as an architectural concern rather than a coding preference.

Consistent naming improves

- readability
- maintainability
- discoverability
- searchability
- documentation quality
- AI comprehension
- onboarding speed

Every identifier within the project must comply with these standards.

---

# 2. Context

Large software projects evolve over many years and involve multiple developers, AI assistants and automation tools.

Inconsistent naming results in

- duplicated concepts
- unclear ownership
- inconsistent APIs
- difficult maintenance
- poor searchability
- architectural drift

The project therefore requires a unified vocabulary.

---

# 3. Problem Statement

Without a naming standard

```
course.js

courses.js

courseData.js

courseRepository.js

CourseRepo.js

course-service.js
```

may all represent similar concepts.

Developers become uncertain which file is authoritative.

The architecture loses clarity.

---

# 4. Requirements

The naming convention must provide

Functional

- Predictability
- Uniqueness
- Discoverability

Architectural

- Domain consistency
- Repository consistency
- Stable terminology

Non-functional

- Readability
- AI friendliness
- Documentation consistency

---

# 5. Decision

The project adopts a centralized naming convention.

Naming decisions are architectural rules.

Personal naming preferences are not permitted.

---

# 6. Language

All source code

must use

English.

Examples

```
Course

Instructor

Gallery

Organization

Repository

Schema

SEO
```

User-facing content may be Persian or multilingual.

---

# 7. Domain Vocabulary

Official business entities

```
Organization

Course

Instructor

Schedule

Gallery

Article

Review

FAQ

Instrument

MusicStyle

Event

Lesson

Enrollment

Student
```

No synonyms.

---

# 8. Repository Naming

Pattern

```
<Entity>Repository
```

Examples

```
CourseRepository

InstructorRepository

ArticleRepository

GalleryRepository

OrganizationRepository
```

Never

```
CourseService

CourseManager

CourseStore
```

unless a different architectural layer is introduced.

---

# 9. File Naming

JavaScript files

camelCase

Examples

```
courseRepository.js

seoEngine.js

schemaEngine.js

organizationSchema.js

courseSchema.js
```

Astro files

PascalCase

```
BaseLayout.astro

CourseCard.astro

InstructorCard.astro

HeroSection.astro
```

---

# 10. Folder Naming

Folders use

lowercase

Examples

```
components/

repositories/

schemas/

layouts/

pages/

styles/

config/

utils/

constants/

assets/
```

Avoid mixed naming styles.

---

# 11. Entity Naming

Entities are always singular.

Correct

```
Course

Instructor

Article

Gallery
```

Collections

may be plural

```
courses

articles

instructors
```

Domain concepts remain singular.

---

# 12. Variable Naming

Variables represent

one object

```
course

teacher

organization

gallery
```

Collections

```
courses

teachers

articles
```

Names should express intent.

---

# 13. Function Naming

Functions begin with verbs.

Examples

```
getCourse()

searchCourses()

buildSchema()

generateSeo()

validateEntity()

resolveRelationships()

calculateReadingTime()
```

Avoid generic names such as

```
run()

process()

handle()

doStuff()
```

---

# 14. Boolean Naming

Boolean variables begin with

```
is

has

can

should
```

Examples

```
isPublished

hasGallery

canEnroll

shouldIndex
```

Avoid ambiguous names.

---

# 15. Constant Naming

Constants use

UPPER_SNAKE_CASE

Examples

```
SITE_URL

DEFAULT_LANGUAGE

MAX_IMAGE_SIZE

DEFAULT_TIMEZONE

PRIMARY_COLOR
```

Magic values are prohibited.

---

# 16. Enum Naming

Enums use singular nouns.

Examples

```
CourseLevel

CourseStatus

Language

Theme

Weekday
```

Enum values

UPPER_CASE

```
BEGINNER

INTERMEDIATE

ADVANCED
```

---

# 17. Component Naming

Components use

PascalCase

Examples

```
CourseCard

InstructorCard

HeroBanner

FaqAccordion

Breadcrumb
```

Component names describe

what they render,

not where they appear.

---

# 18. Layout Naming

Layouts end with

```
Layout
```

Examples

```
BaseLayout

CourseLayout

ArticleLayout

LandingLayout
```

Purpose is immediately recognizable.

---

# 19. Utility Naming

Utilities describe

their responsibility.

Examples

```
slugify.js

dateFormatter.js

urlBuilder.js

readingTime.js

stringUtils.js
```

Avoid generic names such as

```
helpers.js

misc.js

common.js
```

---

# 20. Schema Naming

Pattern

```
<Entity>Schema
```

Examples

```
CourseSchema

OrganizationSchema

PersonSchema

BreadcrumbSchema

FaqSchema
```

Schema generators follow the same convention.

---

# 21. SEO Naming

Pattern

```
seoEngine

seoDefaults

seoValidator

seoBuilder

seoUtils
```

SEO remains grouped under a single vocabulary.

---

# 22. Route Naming

URLs are

lowercase

kebab-case

Examples

```
/courses

/courses/classical-guitar

/instructors

/articles/music-theory

/contact
```

Never use

camelCase

PascalCase

underscores

spaces

---

# 23. Slug Naming

Rules

Lowercase

ASCII

Hyphen-separated

Permanent

Examples

```
classical-guitar

music-theory

piano-for-children
```

Slugs never contain IDs.

---

# 24. CSS Naming

CSS class names

kebab-case

Examples

```
course-card

hero-banner

section-title

button-primary
```

Avoid presentation-dependent names.

---

# 25. Image Naming

Pattern

```
entity-description.webp
```

Examples

```
classical-guitar-course.webp

guitar-instructor.webp

academy-building.webp
```

Never

```
IMG_0032.jpg

photo-final.png

new-image.webp
```

---

# 26. Documentation Naming

Documents use

UPPER_SNAKE_CASE

Examples

```
MASTER_ARCHITECTURE.md

DATA_MODEL.md

DESIGN_SYSTEM.md

REPOSITORY_API.md

COMPONENT_LIBRARY.md
```

ADR files

```
ADR-001-Repository-Pattern.md
```

---

# 27. Reserved Words

The following architectural names are reserved

```
Repository

Schema

Engine

Layout

Entity

Component

Domain

Knowledge

SEO

Organization
```

They must not be repurposed.

---

# 28. Future Compatibility

The naming convention remains valid for

TypeScript

REST APIs

GraphQL

CMS

Cloudflare

Mobile Apps

Desktop Apps

AI Services

Microservices

The vocabulary remains stable.

---

# 29. Consequences

Positive

✓ Consistent architecture

✓ Easier onboarding

✓ Better documentation

✓ Better AI comprehension

✓ Faster navigation

✓ Reduced ambiguity

Negative

• Developers must follow stricter naming rules.

The consistency gained outweighs this limitation.

---

# 30. Compliance Rules

Every Pull Request must satisfy

✓ English identifiers

✓ Repository naming

✓ Singular entities

✓ Verb-based functions

✓ Stable vocabulary

✓ Approved folder names

✓ Approved route names

✓ Approved documentation names

Naming violations must be corrected before merge.

---

# 31. Final Decision

A single, architecture-wide naming convention is adopted for the Fateh Music Academy platform.

Naming is considered part of the public architecture.

Consistent terminology improves communication between developers, documentation, search tools and AI systems while ensuring that the platform remains understandable and maintainable throughout its lifecycle.

---

## Status

Accepted

Mandatory

Effective Immediately