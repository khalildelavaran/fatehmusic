# SEO_ARCHITECTURE.md

> Enterprise SEO Engine v5.0
>
> Fateh Music Academy
>
> Astro 7
>
> JavaScript ES Modules
>
> Cloudflare Ready
>
> Enterprise Architecture Specification
>
> Version 5.0

---

# 1. Document Information

| Item | Value |
|------|-------|
| Document | SEO Architecture Specification |
| Project | Fateh Music Academy |
| Engine | Enterprise SEO Engine |
| Framework | Astro 7 |
| Language | JavaScript (ES Modules) |
| Hosting | Cloudflare |
| Architecture | Modular |
| Design Pattern | Layered Architecture |
| Style | Functional Programming |
| Specification Version | 5.0 |

---

# 2. Purpose

این سند، مرجع رسمی طراحی و پیاده‌سازی موتور SEO پروژه Fateh Music Academy است.

تمام فایل‌های موجود در پوشه

```

src/seo/

```

باید دقیقاً مطابق قوانین این سند توسعه داده شوند.

هیچ توسعه‌دهنده‌ای مجاز نیست خارج از این Specification کدی به موتور SEO اضافه کند.

این سند تنها مرجع معتبر برای:

- توسعه
- نگهداری
- بازطراحی
- توسعه آینده

خواهد بود.

---

# 3. Vision

هدف از طراحی این موتور، ایجاد یک Framework داخلی برای مدیریت کامل SEO سایت است؛ نه صرفاً مجموعه‌ای از توابع کمکی.

این موتور باید بتواند بدون تغییر در معماری اصلی از موجودیت‌های زیر پشتیبانی کند:

- Website
- WebPage
- Organization
- LocalBusiness
- MusicSchool
- Instructor
- Course
- CourseInstance
- Offer
- Event
- Article
- FAQ
- Review
- AggregateRating
- ImageObject
- VideoObject
- Blog
- Podcast
- Gallery
- Certificate
- Product

---

# 4. Design Goals

موتور باید دارای ویژگی‌های زیر باشد.

## Goal-001

Zero Duplication

هیچ منطق تکراری در پروژه وجود نداشته باشد.

---

## Goal-002

Single Source of Truth

هر داده فقط یک محل تولید داشته باشد.

---

## Goal-003

Pure Functions

تمام توابع بدون Side Effect باشند.

---

## Goal-004

Tree Shakable

تمام فایل‌ها قابلیت حذف در Build را داشته باشند.

---

## Goal-005

Framework Independent

منطق موتور وابسته به Astro نباشد.

---

## Goal-006

Cloudflare Compatible

هیچ وابستگی به Node Runtime نداشته باشد.

---

## Goal-007

Composable

تمام Builderها قابلیت ترکیب شدن داشته باشند.

---

## Goal-008

Scalable

افزودن قابلیت جدید نباید باعث تغییر در هسته موتور شود.

---

## Goal-009

Testable

تمام توابع مستقل قابل Unit Test باشند.

---

## Goal-010

Readable

خوانایی کد بر کوتاه بودن آن اولویت دارد.

---

# 5. Design Principles

طراحی موتور بر پایه اصول زیر انجام می‌شود.

---

## Principle-001

Single Responsibility Principle

هر فایل فقط یک مسئولیت دارد.

---

## Principle-002

Single Source of Truth

هر داده فقط از یک محل تولید می‌شود.

---

## Principle-003

Functional Programming

تمام Builderها و Helperها Pure Function هستند.

---

## Principle-004

Composition over Inheritance

ترکیب توابع جایگزین ارث‌بری می‌شود.

---

## Principle-005

Dependency Inversion

Builderها به داده خام وابسته نیستند.

آن‌ها فقط با Resolverها کار می‌کنند.

---

## Principle-006

Immutability

هیچ تابعی داده ورودی را تغییر نمی‌دهد.

---

## Principle-007

Predictability

یک ورودی ثابت همیشه خروجی ثابت تولید می‌کند.

---

## Principle-008

Modularity

هر قابلیت داخل ماژول مستقل قرار می‌گیرد.

---

## Principle-009

Extensibility

افزودن قابلیت جدید نباید باعث تغییر Builderهای قبلی شود.

---

## Principle-010

Separation of Concerns

هر لایه تنها مسئول یک Concern است.

---

# 6. Architectural Constraints

قوانین زیر غیرقابل نقض هستند.

---

## Rule-001

Hardcode ممنوع است.

❌

```
https://fatehmusic.ir
```

✔

```js
site.url
```

---

## Rule-002

ساخت URL فقط در URL Engine انجام می‌شود.

---

## Rule-003

هیچ Builder اجازه ساخت URL ندارد.

---

## Rule-004

هیچ Schema اجازه تولید Metadata ندارد.

---

## Rule-005

هیچ Metadata اجازه تولید JSON-LD ندارد.

---

## Rule-006

هیچ Builder داده سایت را تغییر نمی‌دهد.

---

## Rule-007

تمام خروجی‌ها Immutable هستند.

---

## Rule-008

هیچ فایل اجازه Import چرخه‌ای ندارد.

---

## Rule-009

هیچ Helper نباید Builder را Import کند.

---

## Rule-010

هیچ Resolver نباید Builder را Import کند.

---

## Rule-011

تمام Importها باید Relative باشند.

---

## Rule-012

تمام Exportها Named Export هستند.

Default Export فقط برای API فایل مجاز است.

---

## Rule-013

هیچ فایل نباید بیش از یک مسئولیت داشته باشد.

---

## Rule-014

هیچ تابع نباید بیشتر از یک نوع خروجی تولید کند.

---

## Rule-015

تمام Builderها با پیشوند

```
build
```

شروع می‌شوند.

---

## Rule-016

تمام Resolverها با پیشوند

```
resolve
```

شروع می‌شوند.

---

## Rule-017

تمام Getterها با پیشوند

```
get
```

شروع می‌شوند.

---

## Rule-018

تمام Validatorها با پیشوند

```
validate
```

شروع می‌شوند.

---

## Rule-019

تمام Helperها بدون Prefix هستند.

---

## Rule-020

هیچ فایل خارج از Public API مستقیماً توسط صفحات سایت Import نمی‌شود.

تمام صفحات فقط از

```
seo/index.js
```

استفاده می‌کنند.

---

# 7. High-Level Architecture

```
                 Page

                  │

                  ▼

            seo/index.js

                  │

────────────────────────────────

        Metadata Builder

        OpenGraph Builder

        Twitter Builder

        Schema Builder

        Canonical Builder

────────────────────────────────

                  │

              Resolvers

────────────────────────────────

                  │

              Helpers

────────────────────────────────

                  │

             Config/Data

────────────────────────────────

                  │

              site.js

       courses.js

    instructors.js

       navigation.js

```

---

**End of Part 1**
---
# 8. Enterprise Folder Structure

ساختار موتور SEO باید کاملاً ماژولار باشد.

هیچ فایل جدیدی نباید خارج از ساختار زیر ایجاد شود مگر اینکه ابتدا این سند اصلاح گردد.

```
src/
│
├── data/
│   ├── site.js
│   ├── courses.js
│   ├── instructors.js
│   ├── articles.js
│   ├── events.js
│   ├── reviews.js
│   └── navigation.js
│
└── seo/
    │
    ├── index.js
    │
    ├── config/
    │   ├── config.js
    │   ├── constants.js
    │   ├── defaults.js
    │   └── schemaTypes.js
    │
    ├── core/
    │   ├── engine.js
    │   ├── pipeline.js
    │   ├── context.js
    │   └── registry.js
    │
    ├── helpers/
    │   ├── url.js
    │   ├── text.js
    │   ├── clean.js
    │   ├── image.js
    │   ├── geo.js
    │   ├── object.js
    │   ├── array.js
    │   ├── date.js
    │   ├── validation.js
    │   └── logger.js
    │
    ├── resolvers/
    │   ├── site.js
    │   ├── course.js
    │   ├── instructor.js
    │   ├── article.js
    │   ├── event.js
    │   ├── offer.js
    │   ├── review.js
    │   └── image.js
    │
    ├── builders/
    │   ├── metadata.js
    │   ├── canonical.js
    │   ├── robots.js
    │   ├── openGraph.js
    │   ├── twitter.js
    │   ├── schema.js
    │   └── graph.js
    │
    ├── schema/
    │   ├── organization.js
    │   ├── localBusiness.js
    │   ├── musicSchool.js
    │   ├── website.js
    │   ├── webpage.js
    │   ├── breadcrumb.js
    │   ├── instructor.js
    │   ├── course.js
    │   ├── courseInstance.js
    │   ├── offer.js
    │   ├── article.js
    │   ├── faq.js
    │   ├── review.js
    │   ├── aggregateRating.js
    │   ├── event.js
    │   ├── imageObject.js
    │   ├── videoObject.js
    │   └── graph.js
    │
    ├── validators/
    │   ├── metadata.js
    │   ├── schema.js
    │   ├── page.js
    │   ├── links.js
    │   └── performance.js
    │
    ├── generators/
    │   ├── sitemap.js
    │   ├── robots.js
    │   ├── manifest.js
    │   └── feeds.js
    │
    └── types/
        ├── course.js
        ├── instructor.js
        ├── article.js
        ├── event.js
        ├── review.js
        └── image.js
```

---

# 9. Layered Architecture

موتور SEO از هفت لایه تشکیل شده است.

```
Presentation

↓

Public API

↓

Builders

↓

Resolvers

↓

Helpers

↓

Core

↓

Configuration + Data
```

هیچ لایه‌ای اجازه ندارد لایه پایین‌تر از محدوده مجاز خود را دور بزند.

---

# 10. Layer Responsibilities

## Layer 1

Presentation Layer

مسئول:

فایل‌های Astro

این لایه هیچ منطق SEO ندارد.

فقط از

```
seo/index.js
```

استفاده می‌کند.

---

## Layer 2

Public API

```
seo/index.js
```

تنها نقطه ورود موتور.

وظایف:

- Build Metadata
- Build Schema
- Build OpenGraph
- Build Twitter
- Build Canonical

---

## Layer 3

Builder Layer

Builderها فقط خروجی تولید می‌کنند.

هیچ Builder اجازه ندارد:

- URL بسازد
- Data بخواند
- داده را تغییر دهد
- فایل دیگری را ویرایش کند

Builder فقط:

Input

↓

Output

---

## Layer 4

Resolver Layer

تمام داده‌های خام پروژه در اینجا استانداردسازی می‌شوند.

مثال

```
courses.js

↓

resolveCourse()

↓

Builder
```

هیچ Builder مستقیماً courses.js را Import نمی‌کند.

---

## Layer 5

Helper Layer

تمام توابع عمومی.

نمونه:

```
absoluteUrl()

normalizePath()

clean()

truncate()

stripHtml()

imageObject()

postalAddress()

contactPoint()
```

تمام پروژه از همین توابع استفاده می‌کند.

---

## Layer 6

Core Layer

هسته موتور.

وظایف:

- Pipeline
- Context
- Registry
- Engine

تمام Builderها روی Core اجرا می‌شوند.

---

## Layer 7

Configuration Layer

تمام تنظیمات موتور.

مثال:

```
Locale

Timezone

Currency

ThemeColor

Organization

DefaultImage

Twitter

Facebook

Robots

Defaults
```

---

# 11. Dependency Rules

قوانین وابستگی غیرقابل تغییر هستند.

```
Presentation

↓

Public API

↓

Builders

↓

Resolvers

↓

Helpers

↓

Core

↓

Config
```

برعکس این ساختار ممنوع است.

---

## Rule-021

Builder

↓

Resolver

✔

---

## Rule-022

Resolver

↓

Builder

❌

---

## Rule-023

Helper

↓

Builder

❌

---

## Rule-024

Builder

↓

Helper

✔

---

## Rule-025

Builder

↓

Config

✔

---

## Rule-026

Config

↓

Builder

❌

---

## Rule-027

Schema Module

↓

Metadata

❌

---

## Rule-028

Metadata

↓

Schema Module

❌

---

## Rule-029

Graph Builder

↓

Schema Modules

✔

---

## Rule-030

Schema Modules

↓

Graph Builder

❌

---

# 12. Dependency Graph

```
                 index.js

                     │

     ┌───────────────┼───────────────┐

     │               │               │

 Metadata      OpenGraph       Schema

     │               │               │

     └───────────────┼───────────────┘

                     │

                Resolvers

                     │

                 Helpers

                     │

                   Core

                     │

                  Config

                     │

                 Data Files
```

---

# 13. Import Matrix

| From | Allowed |
|--------|----------|
| Presentation | Public API |
| Public API | Builders |
| Builders | Resolvers |
| Builders | Helpers |
| Builders | Config |
| Resolvers | Helpers |
| Resolvers | Config |
| Helpers | Core |
| Core | Config |

---

# 14. Forbidden Imports

موارد زیر کاملاً ممنوع هستند.

```
Schema

↓

Metadata
```

---

```
Metadata

↓

Schema
```

---

```
Helper

↓

Builder
```

---

```
Core

↓

Presentation
```

---

```
Config

↓

Resolver
```

---

```
Schema Module

↓

Course Data
```

---

```
OpenGraph

↓

Courses.js
```

---

```
Twitter

↓

Instructors.js
```

---

```
Builder

↓

Navigation.js
```

بدون عبور از Resolver.

---

# 15. Directory Rules

هر پوشه فقط یک مسئولیت دارد.

هر فایل فقط یک مسئولیت دارد.

هر تابع فقط یک مسئولیت دارد.

هر ماژول فقط یک نوع خروجی تولید می‌کند.

هیچ استثنایی وجود ندارد.

---

# 16. File Ownership

هر فایل فقط یک مالک منطقی دارد.

نمونه

```
canonical.js

↓

Canonical Builder
```

هیچ فایل دیگری اجازه تولید Canonical ندارد.

---

```
url.js

↓

URL Engine
```

تنها محل ساخت URL.

---

```
graph.js

↓

Graph Builder
```

تنها محل ساخت Graph.

---

```
organization.js

↓

Organization Schema
```

تنها محل ساخت Organization Schema.

---

**End of Part 2**
---
# 17. Core Layer Specification

Core Layer هسته اجرایی موتور SEO است.

هیچ منطق مربوط به SEO در این لایه نوشته نمی‌شود.

وظیفه Core فقط مدیریت اجرای موتور است.

```
Page

↓

Engine

↓

Pipeline

↓

Builders

↓

Output
```

Core نباید از موجودیت‌هایی مانند Course یا Instructor اطلاعی داشته باشد.

Core فقط فرآیند اجرا را مدیریت می‌کند.

---

## Core Components

```
core/

engine.js

pipeline.js

context.js

registry.js
```

---

## engine.js

وظیفه:

اجرای کل موتور.

تنها نقطه شروع فرآیند Build.

ورودی:

```
Page Data
```

خروجی:

```
SEO Object
```

---

### مسئولیت‌ها

- ایجاد Context
- اجرای Pipeline
- جمع‌آوری خروجی Builderها
- اجرای Validatorها
- تحویل خروجی نهایی

---

### ممنوع

engine.js نباید:

- URL بسازد
- Schema تولید کند
- Metadata تولید کند
- OpenGraph تولید کند
- Twitter تولید کند

---

## pipeline.js

Pipeline ترتیب اجرای Builderها را مشخص می‌کند.

ترتیب اجرا همیشه ثابت است.

```
Context

↓

Resolver

↓

Metadata

↓

Canonical

↓

Robots

↓

OpenGraph

↓

Twitter

↓

Schema

↓

Validator

↓

Output
```

هیچ Builder اجازه تغییر ترتیب Pipeline را ندارد.

---

## context.js

تمام اطلاعات صفحه داخل Context ذخیره می‌شود.

Context شامل:

```
Page

Site

Locale

Language

Direction

Canonical

Resolved Objects

Images

Configuration
```

Context Immutable است.

بعد از ایجاد، هیچ Builder اجازه تغییر آن را ندارد.

---

## registry.js

Registry محل ثبت Builderها است.

نمونه:

```
metadata

openGraph

twitter

schema

canonical

robots
```

Engine فقط Registry را می‌شناسد.

---

# 18. Configuration Layer

تمام تنظیمات موتور فقط در این لایه قرار می‌گیرند.

```
config/

config.js

constants.js

defaults.js

schemaTypes.js
```

---

## config.js

تنظیمات پروژه.

نمونه:

```
Site URL

Default Locale

Default Language

Theme Color

Currency

Timezone

Organization Name
```

---

## constants.js

فقط ثابت‌ها.

نمونه:

```
IMAGE_TYPES

PAGE_TYPES

SCHEMA_TYPES

SOCIAL_TYPES

ROBOT_TYPES
```

---

## defaults.js

مقادیر پیش‌فرض.

مانند:

```
Default Image

Default Description

Default Robots

Default OpenGraph Image

Default Twitter Image

Default Locale
```

---

## schemaTypes.js

تمام نام‌های Schema فقط اینجا تعریف می‌شوند.

نمونه:

```
Organization

LocalBusiness

MusicSchool

Course

Person

Article

FAQPage

Offer

VideoObject
```

هیچ فایل دیگری مجاز به Hardcode کردن نام Schema نیست.

---

# 19. Helper Layer

تمام Helperها Stateless هستند.

هیچ داده‌ای نگهداری نمی‌کنند.

هیچ Side Effect ندارند.

---

## Helper Categories

```
URL

↓

Text

↓

Image

↓

Object

↓

Array

↓

Geo

↓

Date

↓

Validation

↓

Logger
```

---

## URL Helpers

مسئول:

```
absoluteUrl()

normalizePath()

joinPath()

removeSlash()

ensureSlash()

isAbsolute()

isExternal()
```

هیچ فایل دیگری نباید URL تولید کند.

---

## Text Helpers

```
clean()

stripHtml()

truncate()

normalizeSpaces()

normalizePersian()

escapeHtml()

slugify()

keywords()
```

---

## Image Helpers

```
imageObject()

logoObject()

imageDimensions()

imageType()

imageAlt()
```

---

## Object Helpers

```
deepMerge()

freeze()

clone()

pick()

omit()
```

---

## Array Helpers

```
unique()

compact()

sort()

group()

flatten()
```

---

## Geo Helpers

```
geoObject()

postalAddress()

contactPoint()

openingHours()
```

---

## Date Helpers

```
isoDate()

modifiedDate()

publishedDate()
```

---

## Validation Helpers

```
isURL()

isEmail()

isPhone()

isImage()

isLocale()
```

---

## Logger

فقط برای حالت Development.

در Production غیرفعال است.

---

# 20. URL Engine

تمام URLهای پروژه فقط از این لایه تولید می‌شوند.

```
helpers/url.js
```

---

## URL Rules

---

### Rule-031

ساخت URL فقط اینجا انجام می‌شود.

---

### Rule-032

Builderها حق ساخت URL ندارند.

---

### Rule-033

Schemaها حق ساخت URL ندارند.

---

### Rule-034

OpenGraph حق ساخت URL ندارد.

---

### Rule-035

Twitter حق ساخت URL ندارد.

---

### Rule-036

Canonical فقط از URL Engine استفاده می‌کند.

---

## Public Functions

```
absoluteUrl()

normalizePath()

canonicalPath()

imageUrl()

assetUrl()

pageUrl()

courseUrl()

instructorUrl()

articleUrl()

eventUrl()
```

---

تمام URLها باید Absolute باشند.

---

# 21. Resolver Layer

تمام داده‌های خام پروژه باید ابتدا Resolve شوند.

```
Data

↓

Resolver

↓

Normalized Object

↓

Builder
```

---

## Resolver Files

```
site.js

course.js

instructor.js

article.js

event.js

offer.js

review.js

image.js
```

---

## مسئولیت Resolver

تبدیل داده خام

↓

به

Object استاندارد موتور

---

## Rule-037

Builderها نباید مستقیماً فایل‌های Data را Import کنند.

---

## Rule-038

Resolverها نباید خروجی SEO تولید کنند.

---

## Rule-039

Resolverها فقط Normalize می‌کنند.

---

## Rule-040

تمام Resolverها باید Immutable باشند.

---

# 22. Standard Object Model

بعد از Resolve تمام موجودیت‌ها ساختار استاندارد دارند.

مثال:

Course

```
id

slug

title

description

url

image

instructors

offers

reviews

faq

schedule

updatedAt
```

---

Instructor

```
id

slug

name

headline

bio

image

social

courses

sameAs
```

---

Article

```
id

slug

title

excerpt

author

image

publishedAt

modifiedAt
```

---

Event

```
id

slug

name

startDate

endDate

location

offers
```

---

Review

```
id

author

rating

reviewBody

datePublished
```

---

Image

```
url

width

height

type

caption

alt
```

---

تمام Builderهای پروژه فقط با این مدل استاندارد کار می‌کنند.

هیچ Builder مجاز به استفاده مستقیم از ساختار فایل‌های data نیست.

---

**End of Part 3**
---
# 23. Builder Layer Specification

Builder Layer قلب موتور SEO است.

تمام خروجی‌های SEO فقط توسط Builderها تولید می‌شوند.

هیچ فایل دیگری مجاز به تولید مستقیم خروجی SEO نیست.

```
Input

↓

Resolver Objects

↓

Builder

↓

SEO Output
```

Builderها کاملاً Stateless هستند.

Builderها هیچ State داخلی ندارند.

Builderها Pure Function هستند.

---

## Builder Files

```
builders/

metadata.js

canonical.js

robots.js

openGraph.js

twitter.js

schema.js

graph.js
```

---

## Builder Rules

---

### Rule-041

Builderها فقط خروجی تولید می‌کنند.

---

### Rule-042

Builderها داده پروژه را تغییر نمی‌دهند.

---

### Rule-043

Builderها فقط Object استاندارد Resolver را دریافت می‌کنند.

---

### Rule-044

Builderها هرگز فایل‌های data را Import نمی‌کنند.

---

### Rule-045

Builderها فقط از

```
Helpers

Resolvers

Config
```

استفاده می‌کنند.

---

### Rule-046

Builderها نباید Builder دیگری را Import کنند.

هماهنگی بین Builderها فقط توسط Engine انجام می‌شود.

---

### Rule-047

Builderها نباید خروجی HTML تولید کنند.

تمام خروجی‌ها Object هستند.

---

### Rule-048

Builderها نباید Console Log داشته باشند.

---

### Rule-049

Builderها نباید Fetch انجام دهند.

---

### Rule-050

Builderها Async نیستند.

تمام داده‌ها باید قبل از ورود به Builder آماده باشند.

---

# 24. Metadata Builder

```
builders/metadata.js
```

مسئول تولید تمام Meta Tagهای عمومی.

---

## Allowed Outputs

```
title

description

keywords

author

publisher

creator

generator

applicationName

themeColor

robots

referrer

language

locale

copyright
```

---

## Forbidden

Metadata Builder نباید:

- JSON-LD تولید کند.
- OpenGraph تولید کند.
- Twitter Card تولید کند.
- Canonical تولید کند.
- URL تولید کند.

---

## Public API

```
buildMetadata()

buildTitle()

buildDescription()

buildKeywords()

buildAuthor()

buildPublisher()
```

---

# 25. Canonical Builder

```
builders/canonical.js
```

مسئول تولید Canonical.

---

## Allowed

```
canonical URL
```

---

## Public API

```
buildCanonical()
```

---

## Rules

Canonical همیشه Absolute است.

Canonical همیشه Normalize شده است.

Canonical همیشه از URL Engine استفاده می‌کند.

---

# 26. Robots Builder

```
builders/robots.js
```

---

## مسئولیت

تولید Robots Meta.

---

## Allowed Outputs

```
index

follow

max-snippet

max-image-preview

max-video-preview

noarchive

nosnippet
```

---

## Public API

```
buildRobots()
```

---

## Rule-051

هیچ Builder دیگری Robots تولید نمی‌کند.

---

# 27. OpenGraph Builder

```
builders/openGraph.js
```

---

## Allowed Properties

```
og:title

og:description

og:type

og:url

og:image

og:image:width

og:image:height

og:image:alt

og:site_name

og:locale
```

---

## Public API

```
buildOpenGraph()

buildOGImage()

buildOGType()
```

---

## Rule-052

OpenGraph فقط Object تولید می‌کند.

---

## Rule-053

OpenGraph فقط از URL Engine برای URL استفاده می‌کند.

---

## Rule-054

OpenGraph هیچ Schema تولید نمی‌کند.

---

# 28. Twitter Builder

```
builders/twitter.js
```

---

## Allowed Properties

```
twitter:card

twitter:title

twitter:description

twitter:image

twitter:image:alt

twitter:site

twitter:creator
```

---

## Public API

```
buildTwitter()

buildTwitterCard()

buildTwitterImage()
```

---

## Rule-055

Twitter Builder مستقل از OpenGraph است.

---

## Rule-056

Twitter Builder نباید از خروجی OpenGraph کپی کند.

---

# 29. Schema Builder

```
builders/schema.js
```

بزرگ‌ترین Builder پروژه.

---

## مسئولیت

تولید JSON-LD.

---

Schema Builder هیچ Schema را خودش ایجاد نمی‌کند.

تمام Schemaها از

```
schema/
```

دریافت می‌شوند.

---

## Pipeline

```
Resolver

↓

Schema Modules

↓

Graph Builder

↓

JSON-LD
```

---

## Public API

```
buildSchema()

buildSchemaGraph()
```

---

## Rule-057

Schema Builder نباید اطلاعات سایت را Resolve کند.

---

## Rule-058

Schema Builder نباید Metadata تولید کند.

---

## Rule-059

Schema Builder نباید URL بسازد.

---

## Rule-060

Schema Builder فقط Graph را Assemble می‌کند.

---

# 30. Graph Builder

```
builders/graph.js
```

---

## مسئولیت

مونتاژ Graph نهایی.

---

## ترتیب Graph

```
Organization

↓

LocalBusiness

↓

MusicSchool

↓

Website

↓

WebPage

↓

Breadcrumb

↓

Instructor

↓

Course

↓

CourseInstance

↓

Offer

↓

Event

↓

Article

↓

FAQ

↓

Review

↓

AggregateRating

↓

ImageObject

↓

VideoObject
```

---

Graph Builder فقط ترتیب Graph را مشخص می‌کند.

تولید Nodeها وظیفه Schema Moduleها است.

---

# 31. Schema Modules

هر نوع Schema فقط یک فایل دارد.

---

```
organization.js
```

↓

Organization

---

```
course.js
```

↓

Course

---

```
offer.js
```

↓

Offer

---

```
review.js
```

↓

Review

---

هیچ فایل دیگری مجاز به تولید این Schemaها نیست.

---

## Rule-061

هر فایل فقط یک Schema تولید می‌کند.

---

## Rule-062

هیچ Schema نباید Schema دیگر را Import کند.

---

## Rule-063

ارتباط بین Schemaها فقط از طریق Graph Builder انجام می‌شود.

---

## Rule-064

تمام Schemaها باید Object معتبر Schema.org تولید کنند.

---

# 32. Output Format

تمام Builderها فقط Object برمی‌گردانند.

---

صحیح

```js
return {

title,

description,

canonical

}
```

---

اشتباه

```js
return `
<meta ...>
`
```

---

اشتباه

```js
return "<script>"
```

---

# 33. Builder Composition

Engine خروجی Builderها را ترکیب می‌کند.

```
Metadata

+

Canonical

+

Robots

+

OpenGraph

+

Twitter

+

Schema

↓

SEO Object
```

---

Builderها از وجود یکدیگر اطلاعی ندارند.

---

# 34. SEO Object

خروجی نهایی موتور همیشه ساختار زیر را دارد.

```
{

metadata,

canonical,

robots,

openGraph,

twitter,

schema

}
```

هیچ خروجی دیگری مجاز نیست.

---

# 35. Builder Quality Rules

تمام Builderها باید:

✔ Stateless

✔ Pure

✔ Immutable

✔ Tree Shakable

✔ Side Effect Free

✔ Framework Independent

✔ Unit Testable

✔ Typed

✔ JSDoc Documented

✔ ES Module Compatible

---

**End of Part 4**
---

# 36. Schema Layer Specification

Schema Layer مسئول تولید تمامی موجودیت‌های JSON-LD پروژه است.

این لایه هیچ اطلاعی از Astro، HTML یا Meta Tagها ندارد.

تنها وظیفه این لایه تولید Objectهای معتبر Schema.org است.

```
Resolver Object

↓

Schema Module

↓

Schema Object
```

---

## اهداف

Schema Layer باید دارای ویژگی‌های زیر باشد:

- Stateless
- Pure
- Immutable
- Independent
- Testable
- Reusable
- Modular

---

## Rule-065

هر فایل دقیقاً یک نوع Schema تولید می‌کند.

---

## Rule-066

هیچ فایل Schema نباید بیش از یک موجودیت اصلی تولید کند.

---

## Rule-067

هیچ Schema نباید Graph ایجاد کند.

---

## Rule-068

هیچ Schema نباید Metadata تولید کند.

---

## Rule-069

هیچ Schema نباید Canonical تولید کند.

---

## Rule-070

هیچ Schema نباید Robots تولید کند.

---

# 37. Supported Schema Types

موتور نسخه Enterprise از Schemaهای زیر پشتیبانی می‌کند.

```
Organization

LocalBusiness

MusicSchool

WebSite

WebPage

BreadcrumbList

Person

Course

CourseInstance

Offer

Event

FAQPage

Article

Review

AggregateRating

ImageObject

VideoObject
```

نسخه‌های آینده:

```
MusicAlbum

MusicRecording

PodcastEpisode

Product

HowTo

Service

EducationalOccupationalProgram

Certificate

CollectionPage

SearchResultsPage
```

---

# 38. Organization Schema

```
schema/organization.js
```

مسئول معرفی سازمان.

---

ویژگی‌های اجباری

```
@type

name

url

logo

sameAs
```

---

ویژگی‌های اختیاری

```
telephone

email

address

geo

openingHours

priceRange
```

---

هیچ فایل دیگری اجازه تولید Organization ندارد.

---

# 39. LocalBusiness Schema

```
schema/localBusiness.js
```

مسئول معرفی آموزشگاه.

---

ویژگی‌ها

```
address

geo

telephone

openingHours

priceRange

paymentAccepted

currenciesAccepted
```

---

# 40. MusicSchool Schema

```
schema/musicSchool.js
```

این Schema مهم‌ترین بخش پروژه است.

---

ویژگی‌ها

```
name

description

logo

image

address

geo

telephone

sameAs

openingHours

hasCourse
```

---

## Rule-071

MusicSchool همیشه به Organization وابسته است.

---

# 41. Website Schema

```
schema/website.js
```

---

ویژگی‌ها

```
url

name

publisher

inLanguage
```

---

در آینده

```
SearchAction
```

نیز به آن اضافه خواهد شد.

---

# 42. WebPage Schema

```
schema/webpage.js
```

---

ویژگی‌ها

```
url

name

description

breadcrumb

primaryImage

isPartOf
```

---

# 43. Breadcrumb Schema

```
schema/breadcrumb.js
```

---

ورودی

```
Array<Page>
```

---

خروجی

```
BreadcrumbList
```

---

## Rule-072

Breadcrumb فقط از URL Engine استفاده می‌کند.

---

# 44. Instructor Schema

```
schema/instructor.js
```

---

نوع

```
Person
```

---

ویژگی‌ها

```
name

image

jobTitle

description

sameAs

worksFor
```

---

در کل پروژه از واژه

```
Instructor
```

استفاده می‌شود.

استفاده از

```
Teacher

Teaching

Tutor
```

ممنوع است.

---

# 45. Course Schema

```
schema/course.js
```

---

ویژگی‌ها

```
name

description

provider

image

offers

courseCode

educationalCredentialAwarded
```

---

در آینده

```
hasCourseInstance
```

نیز اضافه خواهد شد.

---

# 46. CourseInstance Schema

```
schema/courseInstance.js
```

---

ویژگی‌ها

```
courseMode

startDate

endDate

location

instructor
```

---

# 47. Offer Schema

```
schema/offer.js
```

---

ویژگی‌ها

```
price

priceCurrency

availability

url

seller
```

---

## Rule-073

Offer فقط توسط Course یا Event استفاده می‌شود.

---

# 48. Event Schema

```
schema/event.js
```

---

ویژگی‌ها

```
name

startDate

endDate

location

offers

performer
```

---

در آینده

کنسرت‌ها

کارگاه‌ها

مسترکلاس‌ها

نیز از همین Schema استفاده می‌کنند.

---

# 49. FAQ Schema

```
schema/faq.js
```

---

ورودی

```
FAQ[]
```

---

خروجی

```
FAQPage
```

---

هر سؤال

```
Question
```

و هر پاسخ

```
Answer
```

است.

---

# 50. Article Schema

```
schema/article.js
```

---

ویژگی‌ها

```
headline

author

publisher

image

datePublished

dateModified
```

---

نسخه آینده

```
BlogPosting
```

نیز پشتیبانی خواهد شد.

---

# 51. Review Schema

```
schema/review.js
```

---

ویژگی‌ها

```
author

reviewBody

reviewRating

datePublished
```

---

# 52. AggregateRating

```
schema/aggregateRating.js
```

---

ویژگی‌ها

```
ratingValue

reviewCount

bestRating

worstRating
```

---

# 53. ImageObject

```
schema/imageObject.js
```

---

ویژگی‌ها

```
url

width

height

caption

representativeOfPage
```

---

# 54. VideoObject

```
schema/videoObject.js
```

---

ویژگی‌ها

```
name

description

thumbnailUrl

uploadDate

duration

contentUrl

embedUrl
```

---

# 55. Graph Assembly

تمام Schemaهای فوق در نهایت توسط Graph Builder مونتاژ می‌شوند.

```
Organization

↓

LocalBusiness

↓

MusicSchool

↓

Website

↓

WebPage

↓

Breadcrumb

↓

Instructor

↓

Course

↓

CourseInstance

↓

Offer

↓

Event

↓

Article

↓

FAQ

↓

Review

↓

AggregateRating

↓

ImageObject

↓

VideoObject

↓

Graph
```

---

## Rule-074

هیچ Schema ترتیب Graph را مشخص نمی‌کند.

---

## Rule-075

ترتیب Graph فقط توسط

```
graph.js
```

مشخص می‌شود.

---

## Rule-076

تمام Nodeهای Graph باید دارای شناسه یکتا (@id) باشند.

---

## Rule-077

تمام ارجاعات بین Nodeها باید از طریق @id انجام شوند و از تکرار اطلاعات جلوگیری شود.

---

## Rule-078

Graph باید معتبر، کامل و بدون Node یتیم (Orphan Node) باشد.

---

## Rule-079

تمام Schemaها باید با آخرین نسخه پایدار Schema.org سازگار باشند.

---

## Rule-080

هیچ Schema نباید وابستگی مستقیم به Astro، Cloudflare یا ساختار صفحات سایت داشته باشد.

---

**End of Part 5**
---

# 56. Data Contracts

تمام داده‌هایی که وارد موتور SEO می‌شوند باید قبل از ورود به Builderها مطابق Data Contract استاندارد شوند.

هیچ Builder نباید ساختار داخلی فایل‌های data را بشناسد.

```
Raw Data

↓

Resolver

↓

Contract Object

↓

Builder
```

---

# 57. Site Contract

```
Site {

    id

    name

    shortName

    legalName

    url

    logo

    image

    slogan

    description

    language

    locale

    timezone

    currency

    email

    telephone

    address

    geo

    openingHours

    sameAs

}
```

---

## Required Fields

```
name

url

logo

language

locale
```

---

## Optional Fields

```
geo

sameAs

openingHours

address

telephone
```

---

# 58. Instructor Contract

```
Instructor {

    id

    slug

    name

    headline

    bio

    image

    email

    telephone

    social

    courses

    awards

    specialties

    sameAs

}
```

---

## Required

```
id

slug

name
```

---

## Optional

```
bio

image

social

awards

courses
```

---

# 59. Course Contract

```
Course {

    id

    slug

    title

    shortTitle

    description

    excerpt

    image

    category

    level

    duration

    instructors

    offers

    faq

    reviews

    syllabus

    schedule

    updatedAt

}
```

---

## Required

```
id

slug

title
```

---

## Optional

```
faq

reviews

offers

schedule

duration
```

---

# 60. Event Contract

```
Event {

    id

    slug

    title

    description

    image

    startDate

    endDate

    location

    organizer

    offers

}
```

---

# 61. Article Contract

```
Article {

    id

    slug

    title

    excerpt

    body

    image

    author

    publishedAt

    modifiedAt

    tags

}
```

---

# 62. Review Contract

```
Review {

    id

    author

    rating

    body

    publishedAt

}
```

---

# 63. Offer Contract

```
Offer {

    id

    price

    currency

    availability

    validFrom

    validUntil

}
```

---

# 64. FAQ Contract

```
FAQ {

    question

    answer

}
```

---

# 65. Image Contract

```
Image {

    src

    width

    height

    type

    alt

    caption

}
```

---

# 66. Video Contract

```
Video {

    title

    description

    thumbnail

    duration

    uploadDate

    contentUrl

    embedUrl

}
```

---

# 67. Resolver Rules

تمام Resolverها باید قوانین زیر را رعایت کنند.

---

## Rule-081

هیچ مقدار Null وارد Builder نشود.

---

## Rule-082

تمام URLها Absolute شوند.

---

## Rule-083

تمام Imageها استاندارد شوند.

---

## Rule-084

تمام تاریخ‌ها ISO8601 باشند.

---

## Rule-085

تمام Localeها Normalize شوند.

---

## Rule-086

تمام شماره تلفن‌ها E.164 باشند.

---

## Rule-087

تمام Emailها Validate شوند.

---

## Rule-088

تمام Objectها Freeze شوند.

---

# 68. Validation Layer

Validation آخرین مرحله موتور است.

```
Builder

↓

Validator

↓

Output
```

---

## Validator Files

```
validators/

metadata.js

schema.js

page.js

performance.js

links.js
```

---

# 69. Metadata Validation

موارد زیر بررسی می‌شوند.

```
Duplicate Title

Missing Title

Missing Description

Long Description

Short Description

Duplicate Canonical

Duplicate Keywords

Missing Language

Missing Locale
```

---

# 70. Schema Validation

```
Missing Organization

Missing Website

Missing WebPage

Missing Course

Broken Graph

Duplicate @id

Missing Offer

Missing FAQ

Missing Review

Invalid AggregateRating

Missing ImageObject
```

---

# 71. OpenGraph Validation

```
Missing Image

Invalid Image Size

Missing Title

Missing Description

Broken URL

Missing Locale
```

---

# 72. Twitter Validation

```
Missing Card

Missing Image

Missing Title

Missing Description
```

---

# 73. Link Validation

```
Broken Canonical

Broken sameAs

Broken Logo

Broken Image

Broken Video

Broken Course URL

Broken Instructor URL
```

---

# 74. Performance Validation

```
Large Description

Large JSON-LD

Duplicate Graph

Duplicate Image

Duplicate URL

Unused Schema

Unused Builder

Unused Resolver
```

---

# 75. Error Codes

تمام خطاهای موتور باید دارای شناسه ثابت باشند.

```
SEO-001

Missing Title
```

---

```
SEO-002

Missing Description
```

---

```
SEO-003

Missing Canonical
```

---

```
SEO-004

Duplicate Title
```

---

```
SEO-005

Duplicate Description
```

---

```
SEO-006

Broken URL
```

---

```
SEO-007

Invalid Image
```

---

```
SEO-008

Invalid Schema
```

---

```
SEO-009

Broken Graph
```

---

```
SEO-010

Missing Organization
```

---

در آینده تمام Errorها فقط از طریق Error Registry توسعه می‌یابند.

---

# 76. Build Pipeline

ترتیب اجرای موتور قابل تغییر نیست.

```
Load Config

↓

Create Context

↓

Resolve Data

↓

Normalize Objects

↓

Metadata Builder

↓

Canonical Builder

↓

Robots Builder

↓

OpenGraph Builder

↓

Twitter Builder

↓

Schema Builder

↓

Graph Builder

↓

Validators

↓

Freeze Output

↓

Return SEO Object
```

---

# 77. Output Immutability

پس از پایان Build:

```
Object.freeze()
```

روی کل خروجی اعمال می‌شود.

هیچ بخش از خروجی نباید بعد از Build تغییر کند.

---

# 78. Public API Contract

تنها خروجی مجاز موتور:

```
{

metadata,

canonical,

robots,

openGraph,

twitter,

schema

}
```

هیچ Builder نباید HTML یا JSX یا Astro Fragment تولید کند.

---

# 79. Extension Policy

برای افزودن قابلیت جدید:

✔ ایجاد Resolver جدید

✔ ایجاد Schema جدید

✔ ثبت در Graph Builder

✔ ثبت در Registry

✔ افزودن Validation

بدون تغییر Builderهای موجود.

---

# 80. Architecture Completion Criteria

معماری زمانی کامل محسوب می‌شود که:

- هیچ وابستگی چرخه‌ای وجود نداشته باشد.
- تمام Builderها Pure Function باشند.
- تمام Resolverها فقط Normalize کنند.
- تمام Schemaها مستقل باشند.
- تمام URLها از URL Engine تولید شوند.
- تمام Validationها قبل از خروجی اجرا شوند.
- تمام خروجی‌ها Immutable باشند.
- هیچ مقدار Hardcode در موتور SEO وجود نداشته باشد.
- هیچ صفحه‌ای مستقیماً Builderها را Import نکند و فقط از `seo/index.js` استفاده شود.

---

# End of Architecture Specification – Part 6

**Status:** Draft Complete (Core Architecture)

**Next Phase:** Enterprise Implementation Specification (Coding Standards, JSDoc Standards, Testing Strategy, Performance Budget, Security Policy, Release Process)
---

# 81. Coding Standards

این فصل قوانین اجباری کدنویسی موتور SEO را مشخص می‌کند.

تمام فایل‌های موجود در

```
src/seo
```

باید دقیقاً مطابق این استاندارد نوشته شوند.

عدم رعایت هر یک از این قوانین، نقص معماری محسوب می‌شود.

---

# 82. JavaScript Standard

نسخه استاندارد پروژه

```
ECMAScript 2024
```

---

Module System

```
ES Modules
```

---

File Extension

```
.js
```

---

هیچ فایل

```
.cjs

.mjs

.ts
```

داخل موتور SEO مجاز نیست.

---

# 83. File Header Standard

تمام فایل‌ها باید با Header زیر آغاز شوند.

```js
/**
 * --------------------------------------------------------
 * Enterprise SEO Engine
 * Fateh Music Academy
 *
 * Module:
 *
 * Description:
 *
 * @author Fateh
 * @version 5.0
 * --------------------------------------------------------
 */
```

---

# 84. File Order Standard

ترتیب اجزای هر فایل باید ثابت باشد.

```
Header

↓

Imports

↓

Constants

↓

Private Helpers

↓

Public Helpers

↓

Resolvers

↓

Builders

↓

Main Function

↓

Exports
```

هیچ فایل مجاز به تغییر این ترتیب نیست.

---

# 85. Import Standard

Imports همیشه به ترتیب زیر نوشته می‌شوند.

```
Node

↓

Third Party

↓

Core

↓

Helpers

↓

Resolvers

↓

Config

↓

Local
```

---

نمونه

```js
import { freeze } from "../helpers/object.js";

import { absoluteUrl } from "../helpers/url.js";

import { resolveCourse } from "../resolvers/course.js";

import { DEFAULT_IMAGE } from "../config/defaults.js";
```

---

# 86. Export Standard

تمام فایل‌ها

Named Export

دارند.

```js
export function buildMetadata(){}
```

---

Default Export

فقط برای API فایل مجاز است.

```js
export default {

buildMetadata

}
```

---

# 87. Function Rules

تمام توابع باید:

✔ کوچک باشند

✔ خوانا باشند

✔ Pure باشند

✔ Immutable باشند

✔ Testable باشند

---

## Rule-089

حداکثر طول تابع

```
50 Lines
```

---

## Rule-090

حداکثر تعداد پارامتر

```
5
```

---

## Rule-091

Nested If

بیش از

```
2
```

سطح ممنوع است.

---

## Rule-092

Switch

فقط برای Enum مجاز است.

---

# 88. Variable Naming

Variable

```
camelCase
```

---

Function

```
camelCase
```

---

Constant

```
UPPER_SNAKE_CASE
```

---

Class

```
PascalCase
```

(در این پروژه استفاده از Class توصیه نمی‌شود.)

---

Folder

```
lowercase
```

---

File

```
camelCase.js
```

---

# 89. Builder Naming

```
buildMetadata

buildSchema

buildTwitter

buildCanonical

buildRobots
```

---

# 90. Resolver Naming

```
resolveSite

resolveCourse

resolveInstructor

resolveOffer
```

---

# 91. Helper Naming

```
absoluteUrl

normalizePath

truncate

clean

slugify
```

---

# 92. Validator Naming

```
validateMetadata

validateSchema

validatePage

validateLinks
```

---

# 93. Getter Naming

```
getCourse

getInstructor

getArticle

getEvent
```

---

# 94. Boolean Naming

همیشه با

```
is

has

can

should
```

شروع می‌شوند.

نمونه

```
isPublished

hasImage

canIndex

shouldFollow
```

---

# 95. JSDoc Standard

تمام توابع Public باید JSDoc داشته باشند.

نمونه

```js
/**
 * Builds Metadata Object.
 *
 * @param {Object} page
 * @returns {Metadata}
 */
```

---

توابع Private نیز باید توضیح مختصر داشته باشند.

---

# 96. Comment Policy

کامنت فقط دلیل انجام کار را توضیح می‌دهد.

نه خود کد را.

اشتباه

```js
// Create URL
```

صحیح

```js
// Google requires absolute URLs for canonical references.
```

---

# 97. Formatting Rules

Indent

```
4 Spaces
```

---

Quotes

```
Double Quotes
```

---

Semicolon

```
Required
```

---

Trailing Comma

```
Always
```

---

Maximum Line Length

```
100
```

---

# 98. Error Handling

هیچ تابعی نباید

```
throw "Error";
```

داشته باشد.

---

تمام Errorها باید از Error Registry استفاده کنند.

```
SEOError

ValidationError

ResolverError

BuilderError
```

---

# 99. Logging Policy

Console فقط در Development.

```
console.log()
```

در Production ممنوع است.

---

Logger استاندارد:

```
logger.debug()

logger.warn()

logger.error()
```

---

# 100. Performance Budget

حداکثر زمان Build

```
5 ms
```

برای یک صفحه.

---

حداکثر حجم JSON-LD

```
50 KB
```

---

حداکثر حجم Metadata

```
10 KB
```

---

حداکثر تعداد Graph Nodes

```
100
```

---

# 101. Memory Policy

هیچ Cache داخلی داخل Builder وجود ندارد.

---

هیچ Global Variable مجاز نیست.

---

هیچ Singleton مجاز نیست.

---

# 102. Testing Policy

تمام فایل‌های Public باید Unit Test داشته باشند.

حداقل پوشش تست

```
95%
```

---

موارد تست

```
Happy Path

Edge Cases

Null Input

Invalid Input

Performance

Regression
```

---

# 103. Security Policy

هیچ ورودی بدون Validate پردازش نمی‌شود.

---

تمام متن‌ها قبل از استفاده Normalize می‌شوند.

---

تمام URLها Validate می‌شوند.

---

تمام HTMLها پاکسازی می‌شوند.

---

هیچ تابعی اجازه تولید HTML خام ندارد.

---

# 104. Git Policy

هر Commit فقط یک مسئولیت.

---

نمونه

```
feat(seo):

Add Course Schema
```

---

```
fix(schema):

Resolve duplicate IDs
```

---

# 105. Versioning Policy

Semantic Versioning

```
MAJOR.MINOR.PATCH
```

---

نمونه

```
5.0.0

5.1.0

5.1.2
```

---

# 106. Deprecation Policy

هیچ تابعی حذف مستقیم نمی‌شود.

ابتدا

```
@deprecated
```

اعلام می‌شود.

---

حداقل

یک نسخه

باقی می‌ماند.

---

# 107. Release Checklist

قبل از هر انتشار باید موارد زیر تأیید شوند.

✅ تمام Validationها Pass شوند.

✅ تمام Unit Testها Pass شوند.

✅ هیچ Circular Dependency وجود نداشته باشد.

✅ هیچ Hardcode وجود نداشته باشد.

✅ تمام Schemaها معتبر باشند.

✅ تمام Metadataها معتبر باشند.

✅ Lighthouse SEO = 100

✅ Rich Results Test بدون خطا.

✅ Schema Validator بدون خطا.

✅ HTML Validator بدون خطا.

---

# 108. Enterprise Quality Gate

هیچ فایل اجازه Merge ندارد مگر اینکه:

- مطابق Architecture Specification باشد.
- مطابق Coding Standards باشد.
- دارای JSDoc باشد.
- دارای Unit Test باشد.
- بدون هشدار ESLint باشد.
- بدون هشدار Validator باشد.
- بدون Duplicate Logic باشد.
- بدون Circular Dependency باشد.

---

# END OF PART 7

این فصل استانداردهای اجباری پیاده‌سازی موتور SEO را تعریف می‌کند و از این مرحله به بعد، تمام فایل‌های JavaScript باید دقیقاً مطابق این قوانین توسعه داده شوند.
---

# 109. SEO Quality Standards

این فصل معیارهای کیفیت موتور SEO را تعریف می‌کند.

تمام خروجی‌های موتور باید قبل از انتشار مطابق این استانداردها باشند.

---

## Quality Pillars

موتور SEO بر چهار ستون اصلی استوار است.

```
Correctness

↓

Consistency

↓

Performance

↓

Maintainability
```

---

## Rule-093

درستی (Correctness) بر سرعت اولویت دارد.

---

## Rule-094

خوانایی بر کوتاه‌نویسی اولویت دارد.

---

## Rule-095

پایداری بر پیچیدگی اولویت دارد.

---

## Rule-096

معماری بر پیاده‌سازی مقدم است.

---

# 110. Performance Strategy

هدف موتور تولید خروجی با کمترین مصرف حافظه و CPU است.

---

## Performance Goals

### Build Time

```
< 5 ms
```

---

### Memory

```
< 1 MB
```

---

### JSON-LD

```
< 50 KB
```

---

### Metadata

```
< 10 KB
```

---

### Heap Allocation

حداقل ممکن

---

### Object Creation

فقط در صورت نیاز

---

## Rule-097

از ایجاد Object غیرضروری جلوگیری شود.

---

## Rule-098

از ایجاد Array موقت خودداری شود.

---

## Rule-099

از Deep Clone بدون نیاز استفاده نشود.

---

## Rule-100

از Recursion غیرضروری استفاده نشود.

---

# 111. Caching Strategy

Builderها Cache داخلی ندارند.

---

Caching فقط در لایه Engine انجام می‌شود.

---

## انواع Cache

```
Runtime Cache

↓

Resolver Cache

↓

Image Cache

↓

Schema Cache
```

---

## Rule-101

هیچ Helper اجازه Cache ندارد.

---

## Rule-102

هیچ Schema Module اجازه Cache ندارد.

---

## Rule-103

Cache باید قابل غیرفعال شدن باشد.

---

# 112. Lazy Evaluation

هر Builder فقط در صورت نیاز اجرا می‌شود.

نمونه

اگر صفحه FAQ نداشته باشد

```
faq.js
```

اجرا نمی‌شود.

---

اگر Review وجود نداشته باشد

```
review.js
```

اجرا نمی‌شود.

---

اگر Video وجود نداشته باشد

```
videoObject.js
```

اجرا نمی‌شود.

---

## Rule-104

Execution باید Demand Driven باشد.

---

# 113. Build Strategy

Pipeline باید افزایشی باشد.

```
Context

↓

Metadata

↓

Canonical

↓

Robots

↓

OpenGraph

↓

Twitter

↓

Schema

↓

Validation
```

---

هیچ مرحله‌ای دوبار اجرا نمی‌شود.

---

## Rule-105

Builderها نباید Builder دیگری را اجرا کنند.

---

# 114. Schema Graph Strategy

Graph فقط یک بار ساخته می‌شود.

```
Nodes

↓

Registry

↓

Graph

↓

JSON-LD
```

---

## Rule-106

هر Node فقط یک بار ساخته می‌شود.

---

## Rule-107

Nodeها دوباره تولید نمی‌شوند.

---

## Rule-108

تمام ارتباطات از طریق

```
@id
```

انجام می‌شود.

---

# 115. URL Strategy

تمام URLها باید Normalize شوند.

---

نمونه

```
https://site.com/course
```

صحیح

---

```
https://site.com/course/
```

اشتباه

(اگر استاندارد پروژه بدون Slash انتهایی باشد.)

---

## Rule-109

هیچ URL دوبار Normalize نمی‌شود.

---

## Rule-110

تمام URLها Absolute هستند.

---

# 116. Image Strategy

تمام تصاویر قبل از ورود به Builder استاندارد می‌شوند.

---

فیلدهای الزامی

```
url

width

height

alt
```

---

فیلدهای اختیاری

```
caption

type

thumbnail
```

---

## Rule-111

هیچ Image بدون ALT وارد Schema نمی‌شود.

---

## Rule-112

تمام تصاویر باید Absolute URL داشته باشند.

---

# 117. Internationalization Strategy

موتور از چندزبانگی پشتیبانی می‌کند.

---

Supported

```
fa

en

ar
```

---

در آینده

```
tr

de

fr
```

---

## Rule-113

Locale فقط از Config خوانده می‌شود.

---

## Rule-114

Builderها Locale را تغییر نمی‌دهند.

---

# 118. Hreflang Strategy

در نسخه Enterprise تولید

```
hreflang
```

پشتیبانی می‌شود.

---

نمونه

```
fa-IR

en-US

ar-SA
```

---

## Rule-115

تمام Alternateها باید Canonical معتبر داشته باشند.

---

# 119. Structured Data Policy

تمام JSON-LD باید معتبر باشد.

---

Validation

```
Schema.org

Google Rich Results

JSON Validator
```

---

## Rule-116

هیچ Property ناشناخته مجاز نیست.

---

## Rule-117

تمام Required Propertyها باید وجود داشته باشند.

---

## Rule-118

Optional Propertyها فقط در صورت وجود داده تولید شوند.

---

# 120. Rich Results Strategy

هدف موتور:

حداکثر سازگاری با Google Rich Results

---

پشتیبانی

```
Course

FAQ

Organization

Breadcrumb

Review

Event

Article

Video
```

---

در آینده

```
Product

HowTo

Recipe

Podcast
```

---

# 121. Lighthouse Strategy

هدف

```
SEO

100
```

---

Accessibility

```
100
```

---

Best Practices

```
100
```

---

Performance

```
95+
```

---

# 122. Astro Integration

موتور نباید وابسته به Astro باشد.

---

تنها فایل وابسته

```
seo/index.js
```

است.

---

تمام Builderها مستقل هستند.

---

## Rule-119

هیچ Builder نباید

Astro API

را Import کند.

---

# 123. Cloudflare Compatibility

موتور باید روی

```
Cloudflare Workers

Cloudflare Pages

Cloudflare SSR
```

بدون تغییر اجرا شود.

---

## Rule-120

هیچ وابستگی به

```
fs

path

process

os
```

وجود ندارد.

---

# 124. Future Compatibility

موتور باید بدون تغییر Core از موارد زیر پشتیبانی کند.

```
Blog

Podcast

Album

Music Recording

Artist

Product

Store

Downloads

Certificates

Events

Gallery
```

---

# 125. Enterprise Readiness Checklist

قبل از انتشار نسخه نهایی موارد زیر باید تأیید شوند.

```
Architecture ✔

Folder Structure ✔

Coding Standards ✔

Dependency Rules ✔

Resolvers ✔

Builders ✔

Schema ✔

Validation ✔

Testing ✔

Performance ✔

Security ✔

Cloudflare ✔

Astro ✔
```

---

# 126. Final Architecture Rules

این قوانین قابل تغییر نیستند.

---

✔ Single Responsibility

✔ Zero Duplication

✔ Single Source of Truth

✔ Functional Programming

✔ Pure Functions

✔ Immutable Objects

✔ Layered Architecture

✔ Dependency Injection

✔ Open/Closed Principle

✔ Composition First

✔ Framework Independent

✔ Cloudflare Ready

✔ Astro Ready

✔ Enterprise Ready

---

# 127. Architecture Status

```
Architecture Version

5.0
```

---

Status

```
APPROVED
```

---

Architecture Level

```
Enterprise
```

---

Implementation Status

```
Ready For Development
```

---

Document Status

```
Reference Specification
```

---

# END OF SEO ARCHITECTURE SPECIFICATION