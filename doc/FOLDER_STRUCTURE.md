# FOLDER_STRUCTURE.md

**Version:** 2.0

**Status:** Approved

**Architecture Level:** Enterprise

**Project:** Fateh Music Academy

---

# 1. Purpose

This document defines the official directory structure of the Fateh Music Academy platform.

The directory structure is considered part of the software architecture.

It is designed to maximize

- Scalability
- Maintainability
- Discoverability
- SEO
- AI Readability
- Developer Experience
- Long-term Stability

Every source file must belong to one architectural layer.

---

# 2. Design Principles

The project structure follows

- Domain Driven Design (DDD)
- Repository Pattern
- Feature Isolation
- Layer Separation
- Astro Best Practices
- AI-First Architecture

Folders represent responsibilities rather than technologies.

---

# 3. Root Structure

```
/

├── public/
├── src/
├── docs/
├── scripts/
├── tests/
├── config/
├── .github/
├── package.json
├── astro.config.mjs
├── tsconfig.json
├── README.md
└── LICENSE
```

---

# 4. Source Structure

```
src/

├── assets/
├── components/
├── config/
├── content/
├── data/
├── layouts/
├── pages/
├── repositories/
├── schemas/
├── seo/
├── services/
├── styles/
├── types/
├── utils/
├── constants/
├── middleware/
└── integrations/
```

Everything inside `src` has exactly one responsibility.

---

# 5. assets/

```
assets/

├── fonts/
├── icons/
├── images/
├── logos/
├── videos/
└── audio/
```

Only optimized source assets belong here.

---

# 6. images/

```
images/

├── organization/
├── courses/
├── instructors/
├── gallery/
├── blog/
├── events/
├── instruments/
├── music-styles/
└── seo/
```

Folders follow business domains.

---

# 7. components/

```
components/

├── common/
├── layout/
├── navigation/
├── sections/
├── cards/
├── media/
├── forms/
├── feedback/
├── seo/
├── schema/
└── ui/
```

Components never contain business data.

---

# 8. common/

```
common/

Container.astro

Heading.astro

SectionTitle.astro

Button.astro

Badge.astro

Icon.astro

Divider.astro
```

Pure reusable UI.

---

# 9. layout/

```
layout/

Header.astro

Footer.astro

Sidebar.astro

PageContainer.astro

HeroLayout.astro
```

Responsible only for page composition.

---

# 10. cards/

```
cards/

CourseCard.astro

InstructorCard.astro

ArticleCard.astro

ReviewCard.astro

GalleryCard.astro

EventCard.astro
```

One component per business entity.

---

# 11. sections/

```
sections/

HeroSection.astro

CoursesSection.astro

TeachersSection.astro

GallerySection.astro

TestimonialsSection.astro

FaqSection.astro

StatisticsSection.astro

CTASection.astro

ContactSection.astro
```

Large reusable page sections.

---

# 12. layouts/

```
layouts/

BaseLayout.astro

DefaultLayout.astro

LandingLayout.astro

CourseLayout.astro

ArticleLayout.astro
```

Layouts define page skeletons.

---

# 13. pages/

```
pages/

index.astro

about/

contact/

courses/

teachers/

articles/

gallery/

events/

faq/

privacy/

terms/
```

Pages remain very small.

Pages assemble layouts and components.

---

# 14. Dynamic Routes

```
pages/

courses/

[slug].astro

teachers/

[slug].astro

articles/

[slug].astro

events/

[slug].astro
```

Dynamic pages consume repositories only.

---

# 15. repositories/

```
repositories/

OrganizationRepository.js

CourseRepository.js

InstructorRepository.js

ArticleRepository.js

GalleryRepository.js

ReviewRepository.js

FaqRepository.js

CategoryRepository.js

MusicStyleRepository.js

InstrumentRepository.js
```

Repositories are the Business API.

---

# 16. data/

```
data/

organization.js

courses.js

teachers.js

articles.js

gallery.js

faq.js

reviews.js

musicStyles.js

instruments.js
```

Temporary storage layer.

Future storage migrations occur here.

---

# 17. content/

Future

```
content/

articles/

courses/

teachers/

events/

pages/
```

Prepared for Astro Content Collections.

---

# 18. schemas/

```
schemas/

OrganizationSchema.js

CourseSchema.js

PersonSchema.js

ArticleSchema.js

FaqSchema.js

BreadcrumbSchema.js

ReviewSchema.js

ImageSchema.js

VideoSchema.js
```

Every Schema has its own file.

---

# 19. seo/

```
seo/

SeoEngine.js

SeoDefaults.js

Canonical.js

OpenGraph.js

TwitterCard.js

MetaBuilder.js

BreadcrumbBuilder.js

Robots.js

Sitemap.js
```

Centralized SEO Engine.

---

# 20. services/

```
services/

SearchService.js

ImageService.js

AnalyticsService.js

NavigationService.js

ContentService.js
```

Services orchestrate workflows.

They never own business data.

---

# 21. styles/

```
styles/

global.css

variables.css

typography.css

layout.css

utilities.css

animations.css
```

No page-specific styles.

---

# 22. types/

Future

```
types/

course.d.ts

teacher.d.ts

article.d.ts

gallery.d.ts

seo.d.ts

schema.d.ts
```

Prepared for TypeScript migration.

---

# 23. utils/

```
utils/

slugify.js

urlBuilder.js

readingTime.js

dateFormatter.js

imageHelper.js

stringUtils.js

validation.js
```

Utility functions only.

---

# 24. constants/

```
constants/

routes.js

colors.js

breakpoints.js

languages.js

site.js

social.js
```

Magic values are prohibited.

---

# 25. config/

```
config/

site.js

seo.js

schema.js

navigation.js

analytics.js
```

Application configuration only.

---

# 26. middleware/

Future

```
middleware/

security.js

headers.js

redirects.js

logging.js
```

Prepared for future server capabilities.

---

# 27. integrations/

```
integrations/

cloudflare/

google/

facebook/

instagram/

youtube/
```

Third-party integrations remain isolated.

---

# 28. public/

```
public/

favicon/

robots.txt

manifest.webmanifest

icons/

downloads/

documents/

music/
```

Only public static files.

No source assets.

---

# 29. docs/

```
docs/

00-Architecture/

01-SEO/

02-Schema/

03-Content/

04-Development/

05-Deployment/

06-ADR/

07-API/

08-Guidelines/

09-Future/
```

Complete project documentation.

---

# 30. tests/

```
tests/

repositories/

components/

seo/

schema/

integration/

performance/

accessibility/
```

Architecture-driven testing.

---

# 31. scripts/

```
scripts/

generate-sitemap.js

generate-schema.js

optimize-images.js

validate-content.js

build-search-index.js
```

Automation only.

---

# 32. Naming Rules

Folders

```
lowercase
```

Files

```
camelCase.js

PascalCase.astro

UPPER_SNAKE_CASE.md
```

Never mix naming conventions.

---

# 33. Forbidden Structures

Never create

```
helpers/

misc/

commonUtils/

temp/

new/

old/

backup/

copy/

test2/

final/

final-final/
```

Every folder must have a clearly defined architectural responsibility.

---

# 34. Future Expansion

Reserved folders

```
api/

workers/

ai/

embeddings/

rag/

vector/

mobile/

desktop/

storybook/
```

The architecture is prepared without requiring structural changes.

---

# 35. Final Directory Tree

```
/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── config/
│   ├── constants/
│   ├── content/
│   ├── data/
│   ├── integrations/
│   ├── layouts/
│   ├── middleware/
│   ├── pages/
│   ├── repositories/
│   ├── schemas/
│   ├── seo/
│   ├── services/
│   ├── styles/
│   ├── types/
│   └── utils/
├── docs/
├── scripts/
├── tests/
├── astro.config.mjs
├── package.json
├── README.md
└── LICENSE
```

---

# 36. Compliance Rules

Every Pull Request must satisfy

✓ Files placed in the correct architectural layer

✓ One responsibility per folder

✓ Official naming conventions

✓ No duplicate responsibilities

✓ No miscellaneous folders

✓ Domain-first organization

Folder restructuring requires architectural approval.

---

# 37. Final Statement

The directory structure is a permanent architectural contract for the Fateh Music Academy platform.

Every source file must have a clearly defined responsibility and belong to exactly one architectural layer.

The structure is intentionally designed to support long-term scalability, clean separation of concerns, AI-assisted development and future migration to additional platforms without architectural redesign.

---

## Status

Approved

Mandatory

Effective Immediately