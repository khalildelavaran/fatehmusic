# CODING_STANDARDS.md

> Enterprise SEO Engine v5.0
>
> Fateh Music Academy
>
> Astro 7
>
> JavaScript ES2024
>
> Cloudflare Ready

---

# 1. Purpose

این سند استاندارد رسمی کدنویسی پروژه Fateh Music Academy است.

تمام فایل‌های موجود در پروژه، خصوصاً داخل

```
src/seo/
```

باید بدون هیچ استثنایی مطابق این استاندارد توسعه داده شوند.

این سند مرجع اصلی برای:

- توسعه
- Code Review
- Pull Request
- Refactoring
- Unit Testing
- Documentation

است.

---

# 2. Goals

این استانداردها با اهداف زیر طراحی شده‌اند.

✔ افزایش خوانایی

✔ کاهش Bug

✔ یکنواخت شدن کل پروژه

✔ ساده شدن نگهداری

✔ افزایش Performance

✔ آماده بودن برای توسعه آینده

✔ سازگاری کامل با Astro 7

✔ سازگاری کامل با Cloudflare

✔ سازگاری با ESLint

✔ سازگاری با Prettier

---

# 3. Fundamental Principles

تمام کدهای پروژه باید بر پایه اصول زیر باشند.

## Principle-001

Single Responsibility Principle

هر فایل فقط یک مسئولیت دارد.

---

## Principle-002

Pure Functions

تمام Helperها و Builderها باید Pure باشند.

---

## Principle-003

Immutability

هیچ تابعی اجازه تغییر پارامتر ورودی را ندارد.

---

## Principle-004

Composition Over Inheritance

ترکیب توابع همیشه بر ارث‌بری ارجح است.

---

## Principle-005

Explicit Code

کد باید واضح باشد.

هوشمندی بیش از حد ممنوع است.

---

## Principle-006

Self Documenting Code

نام‌ها باید به اندازه کافی گویا باشند.

---

## Principle-007

Zero Magic

هیچ عدد

هیچ رشته

هیچ مسیر

نباید Hardcode باشد.

---

# 4. Project Structure

ساختار پروژه تغییر نمی‌کند.

```
src/

components/

layouts/

pages/

data/

seo/

styles/

utils/
```

---

داخل موتور SEO

```
seo/

builders/

config/

core/

generators/

helpers/

resolvers/

schema/

types/

validators/
```

---

# 5. File Naming Convention

تمام فایل‌ها

camelCase

هستند.

صحیح

```
metadata.js

graphBuilder.js

courseResolver.js

normalizeText.js
```

---

اشتباه

```
MetaData.js

course_resolver.js

CourseResolver.js

metadata-builder.js
```

---

# 6. Folder Naming

همیشه

lowercase

صحیح

```
helpers

builders

schema

config
```

---

اشتباه

```
Helpers

SEO

Schema

ConfigFiles
```

---

# 7. Variable Naming

تمام متغیرها

camelCase

```js
courseTitle

pageDescription

canonicalUrl

imageWidth
```

---

Constantها

UPPER_SNAKE_CASE

```js
DEFAULT_IMAGE

MAX_DESCRIPTION

DEFAULT_LANGUAGE
```

---

Boolean

```
isPublished

hasImage

canIndex

shouldRender
```

---

# 8. Function Naming

Builder

```js
buildMetadata()

buildSchema()

buildGraph()
```

---

Resolver

```js
resolveCourse()

resolveSite()

resolveInstructor()
```

---

Validator

```js
validateSchema()

validateMetadata()
```

---

Helper

```js
slugify()

normalizeText()

absoluteUrl()
```

---

Getter

```js
getImage()

getCourse()

getSchedule()
```

---

# 9. Import Rules

ترتیب Import همیشه ثابت است.

```js
// External

// Config

// Helpers

// Resolvers

// Builders

// Local
```

نمونه

```js
import { DEFAULT_IMAGE } from "../config/defaults.js";

import { absoluteUrl } from "../helpers/url.js";

import { cleanText } from "../helpers/text.js";

import { resolveCourse } from "../resolvers/course.js";
```

---

# 10. Export Rules

فقط Named Export

```js
export function buildMetadata(){}
```

---

Default Export

فقط

```
index.js
```

---

هیچ فایل دیگری

Default Export

ندارد.

---

# 11. File Header

تمام فایل‌ها با Header زیر شروع می‌شوند.

```js
/**
 * --------------------------------------------------------
 * Enterprise SEO Engine
 * Fateh Music Academy
 *
 * Module:
 * Description:
 *
 * @version 5.0
 * --------------------------------------------------------
 */
```

---

# 12. JSDoc Standard

تمام توابع Public

الزاماً

JSDoc دارند.

```js
/**
 * Builds OpenGraph object.
 *
 * @param {Page} page
 * @returns {OpenGraph}
 */
```

---

توابع Private

حداقل یک توضیح کوتاه دارند.

---

# 13. Function Design

هر تابع فقط

یک مسئولیت

دارد.

---

حداکثر

```
50
```

خط

---

حداکثر

```
5
```

پارامتر

---

بیش از

```
2
```

سطح Nested ممنوع است.

---

Return زودهنگام

تشویق می‌شود.

```js
if (!course) {
    return null;
}
```

---

# 14. Object Rules

Objectها

Immutable

هستند.

---

صحیح

```js
return {

    title,

    description,

};
```

---

اشتباه

```js
object.title = title;
```

---

هیچ تابعی

Object ورودی

را تغییر نمی‌دهد.

---

# 15. Array Rules

از

```
map()

filter()

reduce()
```

استفاده شود.

---

Mutation ممنوع.

---

اشتباه

```js
array.push()
```

در Builderها.

---

صحیح

```js
return [...array, item];
```

---

# 16. String Rules

همیشه

Double Quotes

```js
const title = "Fateh Music Academy";
```

---

Template Literal

فقط در صورت نیاز.

---

# 17. Formatting Rules

Indent

```
4 Spaces
```

---

Max Width

```
100
```

---

Semicolon

اجباری

---

Trailing Comma

اجباری

---

Empty Line

بین بخش‌های منطقی

اجباری

---

# 18. Comment Policy

کامنت دلیل انجام کار را توضیح می‌دهد.

نه خود کد را.

اشتباه

```js
// Create title
```

صحیح

```js
// Google prefers a unique title for every indexable page.
```

---

# 19. Hardcode Policy

کاملاً ممنوع.

اشتباه

```js
"https://fatehmusic.ir"
```

---

صحیح

```js
site.url
```

---

اشتباه

```js
"fa-IR"
```

---

صحیح

```js
DEFAULT_LOCALE
```

---

# 20. Error Handling

از کلاس‌های استاندارد خطا استفاده شود.

```js
SEOError

ValidationError

ResolverError

BuilderError
```

---

استفاده از

```js
throw "Error";
```

ممنوع است.

---

# END OF PART 1
# CODING_STANDARDS.md

## PART 2 — Implementation Standards

---

# 21. Builder Coding Standards

Builderها مسئول تولید خروجی SEO هستند.

Builder هرگز:

- داده خام پروژه را نمی‌خواند.
- URL تولید نمی‌کند.
- فایل Data را Import نمی‌کند.
- وضعیت (State) نگهداری نمی‌کند.
- خروجی HTML تولید نمی‌کند.

Builder فقط Object تولید می‌کند.

---

## Standard Builder Structure

```javascript
/**
 * --------------------------------------------------------
 * Enterprise SEO Engine
 * Module: Metadata Builder
 * --------------------------------------------------------
 */

import ...

const ...

function ...

export function buildMetadata(page, site) {

    ...

}
```

---

## Rule-021

هر Builder فقط یک مسئولیت دارد.

---

## Rule-022

Builder فقط از Contract Object استفاده می‌کند.

---

## Rule-023

Builder نباید بیش از یک خروجی اصلی تولید کند.

---

## Rule-024

Builderها Stateless هستند.

---

## Rule-025

Builderها Pure Function هستند.

---

# 22. Resolver Coding Standards

Resolver تنها محل تبدیل داده خام است.

```
Raw Data

↓

Normalized Object

↓
Builder
```

---

Resolver اجازه ندارد:

- Metadata تولید کند.
- Schema تولید کند.
- OpenGraph تولید کند.
- Twitter تولید کند.

---

Resolver فقط Normalize می‌کند.

---

## Rule-026

Resolverها فقط فایل‌های

```
src/data
```

را می‌شناسند.

---

## Rule-027

Builderها هرگز Data را Import نمی‌کنند.

---

## Rule-028

تمام Resolveها Immutable هستند.

---

# 23. Helper Coding Standards

Helperها عمومی‌ترین بخش موتور هستند.

---

ویژگی‌ها

✔ Stateless

✔ Pure

✔ Framework Independent

✔ Reusable

✔ Unit Testable

---

Helperها نباید:

- Resolver را Import کنند.
- Builder را Import کنند.
- Config را تغییر دهند.

---

## Rule-029

هر Helper فقط یک کار انجام می‌دهد.

---

## Rule-030

Helperها Side Effect ندارند.

---

# 24. Schema Module Standards

هر فایل داخل

```
schema/
```

فقط یک Schema تولید می‌کند.

---

نمونه

```
course.js

↓

Course
```

---

```
offer.js

↓

Offer
```

---

```
review.js

↓

Review
```

---

هیچ Schema دیگری داخل فایل وجود ندارد.

---

## Rule-031

Schema فقط Object معتبر Schema.org تولید می‌کند.

---

## Rule-032

Schema از URL Engine استفاده می‌کند.

---

## Rule-033

Schema نباید Metadata تولید کند.

---

## Rule-034

Schema نباید HTML تولید کند.

---

# 25. Validation Standards

Validatorها فقط بررسی می‌کنند.

هیچ داده‌ای را تغییر نمی‌دهند.

---

Validatorها باید:

✔ سریع

✔ بدون Side Effect

✔ مستقل

باشند.

---

## Rule-035

Validator هیچ Objectی را اصلاح نمی‌کند.

---

## Rule-036

Validator فقط Error Report تولید می‌کند.

---

# 26. Configuration Standards

تمام Configها

Readonly

هستند.

---

نمونه

```javascript
export const DEFAULT_LOCALE = "fa-IR";
```

---

اشتباه

```javascript
DEFAULT_LOCALE = "en-US";
```

---

## Rule-037

هیچ Builder اجازه تغییر Config ندارد.

---

## Rule-038

هیچ Helper اجازه تغییر Config ندارد.

---

# 27. Constants Standards

تمام Constantها

UPPER_SNAKE_CASE

```javascript
MAX_TITLE_LENGTH

DEFAULT_IMAGE

DEFAULT_LANGUAGE
```

---

هیچ Constant داخل Builder تعریف نمی‌شود.

---

# 28. URL Standards

تنها فایل مجاز

```
helpers/url.js
```

است.

---

صحیح

```javascript
absoluteUrl()
```

---

اشتباه

```javascript
`${site.url}/${slug}`
```

داخل Builder

---

## Rule-039

تمام URLها Absolute هستند.

---

## Rule-040

تمام URLها Normalize هستند.

---

# 29. Metadata Standards

Title

حداکثر

```
60
```

کاراکتر

---

Description

حداکثر

```
160
```

کاراکتر

---

Keywords

حداکثر

```
10
```

مورد

---

Canonical

همیشه Absolute

---

Robots

از Config خوانده می‌شود.

---

# 30. Schema Standards

تمام Schemaها باید:

```
@context

@type

@id
```

داشته باشند.

---

هیچ Property ناشناخته‌ای مجاز نیست.

---

# 31. OpenGraph Standards

حداقل فیلدها

```
title

description

image

url

type

locale
```

---

تصویر

حداقل

```
1200×630
```

---

# 32. Twitter Standards

Card

```
summary_large_image
```

پیش‌فرض

---

Image ALT

اجباری

---

# 33. Image Standards

فرمت

```
WebP
```

---

در آینده

```
AVIF
```

---

ابعاد تصویر

باید مشخص باشد.

---

ALT

اجباری

---

# 34. Performance Standards

هیچ Loop تو در تو

بدون دلیل

مجاز نیست.

---

از

```
O(n²)
```

در Builderها اجتناب شود.

---

از محاسبه تکراری جلوگیری شود.

---

# 35. Security Standards

تمام متن‌ها

Normalize

می‌شوند.

---

تمام HTMLها

Sanitize

می‌شوند.

---

تمام URLها

Validate

می‌شوند.

---

هیچ داده‌ای

مستقیماً وارد Schema نمی‌شود.

---

# 36. Logging Standards

فقط Logger

---

```javascript
logger.debug()

logger.warn()

logger.error()
```

---

Console ممنوع.

---

# 37. Testing Standards

هر فایل Public

باید Unit Test داشته باشد.

---

حداقل Coverage

```
95%
```

---

Edge Case

اجباری

---

Null Input

اجباری

---

Invalid Input

اجباری

---

# 38. ESLint Standards

هیچ Warning

مجاز نیست.

---

هیچ Error

مجاز نیست.

---

Unused Variable

ممنوع.

---

Unused Import

ممنوع.

---

# 39. Prettier Standards

Formatting

کاملاً خودکار.

---

هیچ فایل خارج از Format استاندارد Commit نمی‌شود.

---

# 40. Code Review Checklist

قبل از Merge

باید موارد زیر بررسی شوند.

✅ JSDoc

✅ Pure Function

✅ No Hardcode

✅ Immutable

✅ Unit Test

✅ ESLint

✅ Prettier

✅ Naming Convention

✅ Architecture Compliance

✅ No Circular Dependency

---

# END OF PART 2
# CODING_STANDARDS.md

## PART 3 — Enterprise Engineering Standards

---

# 41. Architecture Decision Records (ADR)

هر تصمیم مهم معماری باید ثبت شود.

هیچ تصمیم معماری نباید فقط داخل گفتگوها باقی بماند.

---

ساختار پوشه

```
docs/adr/

ADR-001.md

ADR-002.md

...
```

---

نمونه

```
ADR-001

Use Layered Architecture
```

---

```
ADR-002

Use Pure Functions
```

---

```
ADR-003

Normalize Data Before Builders
```

---

هر ADR شامل:

```
Title

Status

Context

Decision

Consequences
```

---

# 42. Definition of Done (DoD)

هیچ فایل Complete محسوب نمی‌شود مگر اینکه:

✔ Architecture Approved

✔ JSDoc Complete

✔ Unit Test Written

✔ ESLint Passed

✔ Prettier Passed

✔ No Hardcode

✔ No Circular Dependency

✔ Validator Passed

✔ Rich Results Passed

✔ Lighthouse Passed

---

# 43. Cyclomatic Complexity

حداکثر Complexity

```
10
```

---

اگر بیشتر شد

باید Refactor شود.

---

# 44. Cognitive Complexity

حداکثر

```
15
```

---

هدف

```
< 10
```

---

Nested Logic

باید شکسته شود.

---

# 45. Maintainability Index

حداقل

```
85
```

---

هدف

```
90+
```

---

# 46. Function Metrics

حداکثر

```
50
```

خط

---

هدف

```
25
```

خط

---

حداکثر پارامتر

```
5
```

---

هدف

```
3
```

---

# 47. File Metrics

حداکثر

```
300
```

خط

---

هدف

```
200
```

---

اگر فایل بزرگ‌تر شد

Split

الزامی است.

---

# 48. Module Metrics

هر Module

حداکثر

```
10

Public Functions
```

---

هر فایل

یک مسئولیت

---

# 49. Dependency Policy

Dependency فقط یک جهت دارد.

```
API

↓

Builders

↓

Resolvers

↓

Helpers

↓

Config
```

---

Dependency معکوس

کاملاً ممنوع.

---

هیچ Circular Dependency

مجاز نیست.

---

# 50. Import Policy

Import فقط Relative

---

صحیح

```javascript
import { buildMetadata } from "../builders/metadata.js";
```

---

اشتباه

```javascript
import "../../../metadata.js";
```

---

Import بیش از دو سطح

ممنوع.

---

# 51. Magic Numbers

اعداد ثابت

نباید داخل کد باشند.

---

اشتباه

```javascript
if (title.length > 60)
```

---

صحیح

```javascript
MAX_TITLE_LENGTH
```

---

همین قانون برای

```
160

1200

630

404

301

```

نیز برقرار است.

---

# 52. Magic Strings

اشتباه

```javascript
"Course"

"Organization"

"Person"
```

---

صحیح

```javascript
SCHEMA_TYPES.COURSE
```

---

# 53. Configuration Injection

هیچ Builder

Config را Hardcode نمی‌کند.

---

همه تنظیمات

از

```
config/
```

خوانده می‌شوند.

---

# 54. Dependency Injection

Builderها

وابستگی خود را دریافت می‌کنند.

---

نمونه

```javascript
buildMetadata(

page,

config

)
```

---

نه

```javascript
import config ...
```

در صورت امکان.

---

# 55. Error Registry

تمام Errorها

فقط از Registry.

---

نمونه

```
SEO-001

Missing Title
```

---

```
SEO-101

Invalid URL
```

---

```
SEO-205

Broken Graph
```

---

هیچ Error جدید

بدون ثبت

اضافه نمی‌شود.

---

# 56. Logging Policy

سه سطح Log

```
DEBUG

WARN

ERROR
```

---

Production

```
ERROR
```

فقط.

---

هیچ Console

داخل پروژه.

---

# 57. Feature Flags

تمام قابلیت‌های جدید

با Feature Flag.

---

نمونه

```javascript
ENABLE_FAQ_SCHEMA

ENABLE_VIDEO_SCHEMA

ENABLE_HREFLANG

ENABLE_EVENT_SCHEMA
```

---

این Flags

داخل Config قرار دارند.

---

# 58. Documentation Standards

هر Public Function

دارای

```
JSDoc
```

---

هر Module

دارای Header.

---

هر Folder

دارای README.

---

نمونه

```
helpers/

README.md
```

---

# 59. README Standards

هر پوشه شامل:

```
Purpose

Responsibilities

Public API

Dependencies

Examples
```

---

# 60. Git Branch Strategy

Branch اصلی

```
main
```

---

Development

```
develop
```

---

Feature

```
feature/seo-engine

feature/course-schema
```

---

Fix

```
fix/schema-id
```

---

Hotfix

```
hotfix/canonical
```

---

# 61. Commit Convention

Semantic Commit

---

نمونه

```
feat(schema):

Add FAQ Builder
```

---

```
fix(metadata):

Prevent duplicate titles
```

---

```
refactor(url):

Extract URL Engine
```

---

```
docs(architecture):

Update Coding Standards
```

---

# 62. Pull Request Policy

هر PR

باید شامل:

- Summary
- Motivation
- Changed Files
- Testing
- Screenshots (در صورت نیاز)

---

# 63. Release Policy

Release فقط بعد از:

✔ Tests

✔ Validation

✔ SEO Audit

✔ Architecture Review

✔ Code Review

✔ Rich Results

✔ Lighthouse

---

# 64. Documentation Coverage

هدف

```
100%
```

برای Public API

---

حداقل

```
95%
```

برای Internal Modules

---

# 65. Backward Compatibility

Public API

نباید بدون Major Version

شکسته شود.

---

Deprecated

حداقل

یک نسخه

باقی می‌ماند.

---

# 66. Enterprise Checklist

هر فایل باید:

✔ Pure

✔ Stateless

✔ Immutable

✔ Typed via JSDoc

✔ Tested

✔ Documented

✔ Tree Shakable

✔ Framework Independent

✔ Cloudflare Compatible

✔ Astro Compatible

✔ Zero Hardcode

✔ Zero Circular Dependency

✔ Zero Duplicate Logic

---

# 67. Engineering Principles

پروژه بر اساس اصول زیر توسعه می‌یابد.

- SOLID
- DRY
- KISS
- YAGNI
- Composition over Inheritance
- Single Source of Truth
- Functional Programming
- Immutable Data
- Explicit Dependencies
- Defensive Programming

---

# 68. Enterprise Quality Gate

هیچ فایل اجازه Merge ندارد مگر اینکه تمام موارد زیر برقرار باشد.

```
Architecture ✔

Coding Standards ✔

Naming ✔

Formatting ✔

Documentation ✔

Validation ✔

Performance ✔

Security ✔

Tests ✔

SEO Audit ✔
```

---

# END OF CODING STANDARDS

**Document Version**

```
5.0.0
```

**Status**

```
APPROVED
```

**Compliance Level**

```
ENTERPRISE
```