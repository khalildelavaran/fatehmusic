# DATA_MODEL.md

**Version:** 1.0

**Status:** Approved

**Architecture Level:** Enterprise

**Project:** Fateh Music Academy

---

# 1. Purpose

This document defines the complete business domain model of the Fateh Music Academy platform.

It is the authoritative reference for every business entity, relationship, identifier, lifecycle, ownership rule and repository interaction.

The Domain Model is independent from

- Astro
- JavaScript
- Databases
- CMS
- APIs

It represents the business itself.

---

# 2. Design Principles

The data model follows

- Domain Driven Design (DDD)
- Entity-Centric Architecture
- Repository Pattern
- AI-First Design
- Schema.org Compatibility
- SEO-first Modeling

Every object represents a real-world business concept.

---

# 3. Domain Overview

```
Organization

├── Courses
│
├── Instructors
│
├── Course Categories
│
├── Music Styles
│
├── Instruments
│
├── Articles
│
├── Events
│
├── Workshops
│
├── Gallery
│
├── Reviews
│
├── Testimonials
│
├── FAQs
│
├── Contact
│
├── Branches
│
├── Certificates
│
└── Social Networks
```

---

# 4. Core Aggregate Root

The entire system has one Aggregate Root.

```
Organization
```

Everything belongs to the organization.

Nothing exists independently.

---

# 5. Core Entities

Current version contains

```
Organization

Course

Instructor

Article

Category

MusicStyle

Instrument

Schedule

Gallery

GalleryImage

Review

FAQ

ContactInformation

Branch

SocialProfile
```

Future entities

```
Student

Enrollment

Certificate

Practice

Lesson

Assignment

Exam

OnlineCourse

VideoLesson

MusicBook

Composer

MusicPiece

Podcast

Newsletter

EventRegistration
```

---

# 6. Entity Classification

Business Entities

```
Organization

Course

Instructor

Article

Event
```

Supporting Entities

```
Category

Image

FAQ

Review

Schedule
```

Reference Entities

```
Country

City

Language

Tag

MusicStyle

Instrument
```

---

# 7. Universal Entity Contract

Every business entity inherits

```
id

slug

title

status

createdAt

updatedAt

publishedAt

seo

schema

metadata
```

Every entity is uniquely identifiable.

---

# 8. Entity Lifecycle

```
Draft

↓

Review

↓

Published

↓

Archived

↓

Deleted
```

Repositories expose only

Published

entities.

---

# 9. Entity Identity

Each entity owns

```
UUID

↓

Slug

↓

Canonical URL

↓

Schema @id

↓

Repository ID
```

Identity is immutable after publication.

---

# 10. Organization Entity

Organization owns

```
Basic Information

Brand

Address

Contact

Social Profiles

Logo

Cover Image

Mission

Vision

History

Opening Hours

Geo Location

Courses

Teachers
```

Exactly one Organization exists.

---

# 11. Course Entity

Course represents

one educational program.

Properties

```
id

slug

title

subtitle

description

excerpt

level

price

duration

sessions

categoryId

musicStyleIds

instrumentIds

teacherIds

galleryIds

faqIds

reviewIds

seo

schema

status
```

Course is the central educational entity.

---

# 12. Instructor Entity

Represents one teacher.

Properties

```
id

slug

fullName

photo

biography

specialties

experience

education

certifications

socialProfiles

courseIds

galleryIds

articleIds

seo

schema
```

Instructor may teach multiple courses.

---

# 13. Article Entity

Educational content.

Properties

```
id

slug

title

excerpt

content

authorId

categoryId

tags

readingTime

featuredImage

relatedCourseIds

seo

schema
```

Articles strengthen topical authority.

---

# 14. Category Entity

Categories classify

Courses

Articles

Events

Properties

```
id

slug

title

description

parentId

icon

seo
```

Supports hierarchy.

---

# 15. Instrument Entity

Examples

```
Classical Guitar

Piano

Violin

Setar

Santur

Tar

Drums
```

One instrument

may belong to many courses.

---

# 16. Music Style Entity

Examples

```
Classical

Pop

Flamenco

Traditional Persian

Jazz

Rock

Blues
```

Music styles classify

courses

articles

events.

---

# 17. Schedule Entity

Represents

teaching schedule.

Properties

```
courseId

teacherId

weekday

startTime

endTime

room

capacity
```

Future versions may support online schedules.

---

# 18. Gallery Entity

Gallery contains

images

videos

documents

related entities.

Gallery itself is metadata.

Files belong to GalleryItems.

---

# 19. Gallery Image Entity

Properties

```
id

title

alt

caption

width

height

format

copyright

entityId

entityType
```

Supports ImageObject Schema.

---

# 20. Review Entity

Represents

student reviews.

Properties

```
author

rating

review

date

courseId

teacherId

approved
```

Supports AggregateRating.

---

# 21. FAQ Entity

Properties

```
question

answer

displayOrder

entityId

entityType
```

Reusable across entities.

---

# 22. Branch Entity

Supports future expansion.

Properties

```
Branch Name

Address

Phone

Geo

Opening Hours

Images

Manager
```

Current implementation

contains one branch.

Architecture supports many.

---

# 23. Social Profile Entity

Properties

```
Platform

URL

Username

Verified

Priority
```

Reusable across

Organization

Instructor

Events

---

# 24. Relationships

```
Organization

↓

Course

↓

Instructor

↓

Article

↓

Gallery

↓

Review

↓

FAQ
```

Relationships are explicit.

---

# 25. Cardinality

Organization

1 → N Courses

Course

N → N Instructors

Course

N → N Instruments

Course

N → N Styles

Instructor

1 → N Articles

Article

N → N Tags

Gallery

1 → N Images

Course

1 → N Reviews

Course

1 → N FAQ

---

# 26. Repository Ownership

Each entity belongs to

one repository.

```
OrganizationRepository

CourseRepository

InstructorRepository

ArticleRepository

GalleryRepository

ReviewRepository

FAQRepository
```

Ownership is exclusive.

---

# 27. Storage Model

Current

```
JavaScript Objects
```

Future

```
Markdown

↓

JSON

↓

Content Collections

↓

Cloudflare D1

↓

PostgreSQL

↓

CMS
```

Domain Model remains unchanged.

---

# 28. Schema Mapping

Every entity maps directly to Schema.org.

Examples

```
Organization

↓

Organization

Course

↓

Course

Instructor

↓

Person

Article

↓

Article

Gallery Image

↓

ImageObject

FAQ

↓

Question

↓

Answer
```

---

# 29. SEO Mapping

Every entity owns

```
SEO

↓

Canonical

↓

OG

↓

Twitter

↓

Keywords

↓

Description
```

SEO belongs to the entity.

---

# 30. AI Knowledge Model

Every entity contributes to

```
Knowledge Graph

↓

Semantic Relationships

↓

Embeddings

↓

RAG

↓

AI Search

↓

LLM Understanding
```

The domain model is designed for both humans and intelligent systems.

---

# 31. Validation Rules

Every entity must satisfy

✓ Unique ID

✓ Unique Slug

✓ Valid SEO

✓ Valid Schema

✓ Published State

✓ Valid Relationships

✓ Required Fields

Repositories enforce validation.

---

# 32. Future Evolution

Planned entities

```
Student

Enrollment

Certificate

Attendance

Assignment

Exam

Practice Session

Video Lesson

Podcast

Live Stream

Digital Products

Forum

Comments

Notifications

Payments
```

No redesign required.

---

# 33. Architectural Constraints

Business entities

must never contain

Rendering Logic

Astro Components

Browser APIs

HTML

CSS

Database Queries

Only business knowledge.

---

# 34. Compliance Rules

Every new entity must

✓ Represent a real business concept

✓ Have stable identity

✓ Have repository ownership

✓ Support SEO

✓ Support Schema

✓ Support AI

✓ Be documented

Architecture review is mandatory before introducing a new entity.

---

# 35. Final Statement

The Domain Model represents the permanent business foundation of the Fateh Music Academy platform.

Frameworks, databases, APIs and user interfaces may evolve over time, but the Domain Model remains the single source of business truth.

All future development must conform to this model.

---

## Status

Approved

Mandatory

Effective Immediately