---
# DATA_MODEL_SPECIFICATION.md

Enterprise SEO Engine v5.0

Fateh Music Academy

---

# 1. Purpose

این سند مدل داده رسمی کل پروژه Fateh Music Academy را تعریف می‌کند.

تمام فایل‌های داخل

```
src/data/
```

و

```
src/seo/
```

باید مطابق این سند توسعه داده شوند.

هیچ ساختار داده‌ای خارج از این سند معتبر نیست.

---

# 2. Design Principles

مدل داده بر پایه اصول زیر طراحی شده است.

✔ Single Source of Truth

✔ Immutable Data

✔ Stable IDs

✔ Normalized Objects

✔ SEO Friendly

✔ Future Proof

✔ Schema Compatible

✔ Database Ready

✔ CMS Ready

✔ Multi Language Ready

---

# 3. Root Entity

کل سیستم فقط یک Root Entity دارد.

```
Site
```

تمام موجودیت‌ها در نهایت متعلق به Site هستند.

```
Site

├── Organization

├── MusicSchool

├── Courses

├── Instructors

├── Articles

├── Events

├── Reviews

├── Pages

└── Navigation
```

---

# 4. Entity Relationship Diagram

```
Site
 │
 ├───────────────┐
 │               │
 ▼               ▼
Organization   Website
 │
 ▼
MusicSchool
 │
 ├─────────────┐
 ▼             ▼
Courses     Instructors
 │             ▲
 │             │
 └──────┬──────┘
        │
        ▼
 CourseInstances
        │
        ▼
     Schedule
```

---

# 5. Primary Entities

نسخه Enterprise دارای موجودیت‌های زیر است.

```
Site

Organization

MusicSchool

Course

Instructor

Schedule

Offer

Review

Article

FAQ

Event

Page

Image

Video
```

---

# 6. Site Entity

Cardinality

```
1
```

در کل پروژه فقط یک Site وجود دارد.

---

Primary Key

```
site.id
```

---

Unique Fields

```
url

locale
```

---

# 7. Organization Entity

```
1 : 1
```

هر سایت فقط یک Organization دارد.

---

```
Site

↓

Organization
```

---

# 8. MusicSchool Entity

```
1 : 1
```

هر Organization فقط یک MusicSchool دارد.

---

```
Organization

↓

MusicSchool
```

---

# 9. Course Entity

```
1 : N
```

هر آموزشگاه

چندین دوره دارد.

---

```
MusicSchool

↓

Courses
```

---

Primary Key

```
course.id
```

---

Unique

```
slug
```

---

# 10. Instructor Entity

```
1 : N
```

هر آموزشگاه

چند مدرس دارد.

---

Primary Key

```
instructor.id
```

---

Unique

```
slug
```

---

# 11. Course ↔ Instructor

رابطه

```
Many to Many
```

```
Course

↓

Instructor
```

هر دوره

چند مدرس

---

هر مدرس

چند دوره

---

در مدل داده

```
course.instructors[]

instructor.courses[]
```

---

# 12. Course Instance

```
Course

↓

Instances
```

هر دوره می‌تواند

چندین نوبت برگزاری داشته باشد.

---

نمونه

```
تابستان ۱۴۰۵

پاییز ۱۴۰۵

زمستان ۱۴۰۵
```

---

# 13. Schedule

```
CourseInstance

↓

Schedule
```

هر Instance

فقط یک برنامه زمانی دارد.

---

Cardinality

```
1 : 1
```

---

# 14. Offer

```
Course

↓

Offer
```

یک دوره

می‌تواند

چند قیمت داشته باشد.

---

نمونه

```
Regular

Discount

VIP
```

---

# 15. Review

```
Course

↓

Reviews
```

Cardinality

```
1 : N
```

---

Review همیشه متعلق به

یک Course است.

---

# 16. FAQ

```
Course

↓

FAQ
```

---

هر Course

می‌تواند

چندین FAQ داشته باشد.

---

# 17. Article

```
Instructor

↓

Article
```

---

هر مقاله

یک نویسنده دارد.

---

Cardinality

```
Instructor

1 : N

Article
```

---

# 18. Event

```
MusicSchool

↓

Events
```

---

نمونه

```
کنسرت

ورکشاپ

مسترکلاس

جشنواره
```

---

# 19. Image

تمام موجودیت‌ها

می‌توانند

چند تصویر داشته باشند.

---

```
Course

↓

Images[]
```

---

```
Instructor

↓

Images[]
```

---

```
Article

↓

Images[]
```

---

# 20. Video

```
Course

↓

Videos[]
```

---

```
Article

↓

Videos[]
```

---

```
Instructor

↓

Videos[]
```

---

# 21. ID Policy

تمام شناسه‌ها

Immutable هستند.

---

نمونه

```
course-guitar-classical

course-piano

course-santoor
```

---

Instructor

```
inst-khalil-delavaran
```

---

هیچ ID

بعداً تغییر نمی‌کند.

---

# 22. Slug Policy

Slug

همیشه

Unique است.

---

```
classical-guitar

persian-vocal

piano
```

---

تغییر Slug

نیازمند Redirect است.

---

# 23. URL Policy

URL

از روی Slug

تولید می‌شود.

---

```
/courses/classical-guitar
```

---

```
/instructors/khalil-delavaran
```

---

هیچ URL

Hardcode نیست.

---

# 24. Image Policy

تمام تصاویر

دارای

```
ALT

WIDTH

HEIGHT
```

هستند.

---

فرمت

```
WebP
```

---

در آینده

```
AVIF
```

نیز اضافه خواهد شد.

---

# 25. SEO Ownership

هر موجودیت

SEO اختصاصی دارد.

---

```
Course

↓

Metadata
```

---

```
Instructor

↓

Metadata
```

---

```
Article

↓

Metadata
```

---

# 26. Schema Ownership

هر موجودیت

Schema مخصوص خود را تولید می‌کند.

---

```
Course

↓

Course Schema
```

---

```
Instructor

↓

Person Schema
```

---

```
Event

↓

Event Schema
```

---

# 27. Extensibility

در آینده

بدون تغییر ساختار

موارد زیر افزوده می‌شوند.

```
Albums

Products

Podcast

Downloads

Certificates

Students

Enrollment

Orders

Payments

Coupons
```

---

# 28. Backward Compatibility

تغییر مدل داده

نباید

Builderها را بشکند.

---

تمام تغییرات

فقط در

Resolver

اعمال می‌شوند.

---

# 29. Versioning

نسخه مدل داده

```
1.0.0
```

---

هر تغییر

MAJOR

نیازمند

Migration است.

---

# 30. Completion Criteria

مدل داده زمانی کامل است که:

✔ تمام موجودیت‌ها شناسه یکتا داشته باشند.

✔ تمام روابط مشخص باشند.

✔ تمام Cardinalityها تعریف شده باشند.

✔ تمام URLها قابل تولید باشند.

✔ تمام Schemaها قابل ساخت باشند.

✔ تمام Builderها فقط Contractها را دریافت کنند.

✔ هیچ وابستگی مستقیم به فایل‌های data وجود نداشته باشد.

---

# END OF DATA MODEL SPECIFICATION