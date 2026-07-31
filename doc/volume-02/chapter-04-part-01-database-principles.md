<!-- ====================================================================== -->

<!-- Document : Volume 02 - Enterprise Data Architecture                    -->

<!-- Chapter  : 04                                                          -->

<!-- Part     : 01                                                          -->

<!-- Title    : Relational Database Design Principles                       -->

<!-- File     : docs/volume-02/chapter-04-part-01-database-principles.md    -->

<!-- Related Files                                                          -->

<!--   database/schema.prisma                                               -->

<!--   database/migrations/                                                 -->

<!--   packages/database/                                                   -->

<!-- ====================================================================== -->

# Chapter 4

# Part 1

# Relational Database Design Principles

---

# 4.1 Purpose

این فصل اصول طراحی پایگاه داده رابطه‌ای سامانه را تعریف می‌کند.

هدف این بخش طراحی جدول‌ها نیست.

بلکه تعریف استانداردهایی است که **تمام جدول‌های آینده باید از آن پیروی کنند.**

هیچ جدولی خارج از این قوانین ایجاد نخواهد شد.

---

# 4.2 Database Philosophy

پایگاه داده باید ویژگی‌های زیر را داشته باشد.

* Highly Normalized
* Read Optimized
* Write Safe
* Audit Ready
* Version Aware
* Event Driven
* Cloud Native

---

# 4.3 Database Engine

پایگاه داده اصلی پروژه

```
PostgreSQL
```

حداقل نسخه پیشنهادی

```
17.x
```

دلایل انتخاب

* ACID
* JSONB
* Full Text Search
* Generated Columns
* Partitioning
* Logical Replication
* Row Level Security
* Mature Ecosystem

---

# 4.4 Database Naming Rules

## Database

```
ai_publishing
```

---

## Schema

```
public
```

در آینده امکان ایجاد Schemaهای مستقل مانند:

```
analytics

workflow

knowledge

audit
```

وجود دارد.

---

## Table Naming

تمام جدول‌ها

```
snake_case
```

نمونه

```
articles

teachers

courses

workflow_jobs

decision_logs
```

---

## Column Naming

همه ستون‌ها

```
snake_case
```

نمونه

```
created_at

updated_at

published_at

quality_score
```

---

## Primary Keys

همه Primary Keyها

```
id
```

نام دارند.

نوع داده

```
UUID
```

---

## Foreign Keys

فرمت

```
table_name_id
```

نمونه

```
teacher_id

course_id

article_id
```

---

# 4.5 Universal Columns

تمام جدول‌ها

بدون استثناء

دارای ستون‌های زیر هستند.

| Column     | Type             |
| ---------- | ---------------- |
| id         | UUID             |
| created_at | TIMESTAMPTZ      |
| updated_at | TIMESTAMPTZ      |
| created_by | UUID             |
| updated_by | UUID             |
| version    | INTEGER          |
| status     | VARCHAR          |
| deleted_at | TIMESTAMPTZ NULL |

---

# 4.6 UUID Standard

تمام شناسه‌ها

```
UUID v7
```

خواهند بود.

دلایل

* مرتب‌سازی زمانی
* مناسب برای Distributed Systems
* عدم وابستگی به Sequence
* عملکرد بهتر Index نسبت به UUIDهای کاملاً تصادفی

---

# 4.7 Timestamp Standard

تمام زمان‌ها

```
TIMESTAMP WITH TIME ZONE
```

یا

```
TIMESTAMPTZ
```

هستند.

Timezone استاندارد

```
UTC
```

---

# 4.8 Soft Delete

هیچ رکوردی

مستقیماً حذف نمی‌شود.

ستون

```
deleted_at
```

تنها شاخص حذف منطقی است.

تمام Queryهای برنامه باید به‌صورت پیش‌فرض رکوردهای حذف‌شده را نادیده بگیرند.

---

# 4.9 Optimistic Locking

تمام Aggregate Rootها

دارای

```
version
```

هستند.

هر Update

نسخه را افزایش می‌دهد.

در صورت مغایرت نسخه،

Update رد می‌شود.

---

# 4.10 Status Model

تمام Entityها

دارای Status هستند.

مقادیر استاندارد

```
draft

active

published

archived

disabled

deleted
```

---

# 4.11 Auditability

تمام تغییرات مهم

باید قابل ردیابی باشند.

حداقل اطلاعات ثبت‌شده

* زمان تغییر
* کاربر یا Agent
* مقدار قبلی
* مقدار جدید
* علت تغییر

---

# 4.12 Constraints

تمام جدول‌ها

باید دارای Constraint باشند.

نمونه‌ها

* Primary Key
* Foreign Key
* Unique
* Check Constraint
* Not Null

هیچ اعتبارسنجی مهمی نباید فقط در لایه برنامه انجام شود.

---

# 4.13 Index Strategy

تمام Indexها

دارای نام استاندارد هستند.

نمونه

```
pk_articles

fk_articles_teacher

idx_articles_slug

idx_articles_status

idx_articles_created_at

uq_articles_slug
```

---

# 4.14 Transaction Rules

تمام عملیات حساس

داخل Transaction اجرا می‌شوند.

نمونه

* Publish Article
* Rewrite Article
* Generate FAQ
* Update Decision
* Update Knowledge

هیچ Aggregate نباید به‌صورت نیمه‌کاره ذخیره شود.

---

# 4.15 Data Integrity Rules

* هیچ Foreign Key شکسته مجاز نیست.
* هیچ UUID تکراری مجاز نیست.
* هیچ Aggregate بدون Owner ایجاد نمی‌شود.
* هر رکورد باید Lifecycle معتبر داشته باشد.
* داده‌ها باید با قوانین Domain سازگار باشند.

---

# 4.16 Performance Principles

طراحی باید برای میلیون‌ها رکورد آماده باشد.

اصول

* Index First
* Avoid N+1 Queries
* Pagination Required
* Batch Operations
* Prepared Statements
* Connection Pooling

---

# 4.17 Security Rules

* تمام Queryها پارامتری هستند.
* Dynamic SQL ممنوع است مگر با اعتبارسنجی کامل.
* Least Privilege رعایت می‌شود.
* Row Level Security برای داده‌های حساس قابل فعال‌سازی است.

---

# 4.18 Backup Strategy

* Full Backup روزانه
* WAL Archiving
* Point-in-Time Recovery
* Backup Verification
* دوره نگهداری بر اساس سیاست‌های عملیاتی

---

# 4.19 Related Project Files

```text
database/
├── schema.prisma
├── migrations/
└── seeds/

packages/
└── database/

apps/
└── api/

docs/
└── volume-02/
    └── chapter-04-part-01-database-principles.md
```

---

# 4.20 Traceability

این Part مبنای طراحی بخش‌های زیر است.

* Chapter 4 — Part 2 (Shared Tables)
* Chapter 4 — Part 3 (Content Tables)
* Chapter 4 — Part 4 (Knowledge Tables)
* Chapter 4 — Part 5 (SEO Tables)
* تمام Migrationهای پایگاه داده
* تمام Entityهای TypeScript
* تمام Prisma Modelها

---

# 4.21 Architecture Decision Records

## ADR-051

PostgreSQL پایگاه داده رابطه‌ای اصلی سامانه است.

---

## ADR-052

تمام Primary Keyها از **UUID v7** استفاده می‌کنند.

---

## ADR-053

تمام جدول‌ها دارای ستون‌های استاندارد Audit و Version هستند.

---

## ADR-054

تمام حذف‌ها به‌صورت **Soft Delete** انجام می‌شوند.

---

## ADR-055

تمام Aggregate Rootها از **Optimistic Locking** مبتنی بر Version استفاده می‌کنند.

---

# End of Chapter 4 — Part 1
