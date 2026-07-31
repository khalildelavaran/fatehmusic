<!-- ====================================================================== -->

<!-- Document : Volume 02 - Enterprise Data Architecture                    -->

<!-- Chapter  : 04                                                          -->

<!-- Part     : 09                                                          -->

<!-- Title    : Database Constraints, Indexing & Partitioning Strategy      -->

<!-- File     : docs/volume-02/chapter-04-part-09-database-optimization.md  -->

<!-- Related Files                                                          -->

<!--   database/schema.prisma                                               -->

<!--   database/migrations/008_indexes.sql                                  -->

<!--   database/migrations/009_partitioning.sql                             -->

<!--   database/migrations/010_constraints.sql                              -->

<!--   packages/database/                                                   -->

<!-- ====================================================================== -->

# Chapter 4

# Part 9

# Database Constraints, Indexing & Partitioning Strategy

---

# 4.9.1 Purpose

این بخش استانداردهای فنی پایگاه داده را تعریف می‌کند.

این قوانین برای **تمام Domainهای سیستم** اجباری هستند و تضمین می‌کنند که پایگاه داده در مقیاس میلیون‌ها مقاله، میلیاردها Event و هزاران Workflow دارای عملکرد پایدار، قابلیت توسعه و قابلیت نگهداری باشد.

این فصل بر چهار محور اصلی تمرکز دارد:

* Data Integrity
* Performance
* Scalability
* Maintainability

---

# 4.9.2 Database Design Principles

تمام جداول باید از اصول زیر پیروی کنند.

* استفاده از UUID به‌عنوان Primary Key
* رعایت کامل Third Normal Form (3NF)
* حذف وابستگی‌های تکراری
* استفاده از Foreign Key در تمام روابط
* جلوگیری از ذخیره داده مشتق‌شده مگر در Cache Tables
* استفاده از Soft Delete برای موجودیت‌های عملیاتی

---

# 4.9.3 Naming Convention

## Tables

```text id="db01"
snake_case
Plural
```

نمونه

```text id="db02"
articles

article_versions

workflow_jobs

analytics_events
```

---

## Columns

```text id="db03"
snake_case
```

نمونه

```text id="db04"
created_at

updated_at

deleted_at

current_version_id

execution_status
```

---

## Indexes

```text id="db05"
pk_

fk_

uq_

idx_

gin_

brin_
```

نمونه

```text id="db06"
pk_articles

idx_articles_status

uq_articles_slug

fk_article_author

gin_article_search
```

---

# 4.9.4 Standard Constraints

تمام جداول باید حداقل Constraintهای زیر را داشته باشند.

| Constraint         | Required     |
| ------------------ | ------------ |
| Primary Key        | ✔            |
| Foreign Keys       | ✔            |
| Unique Constraints | در صورت نیاز |
| Check Constraints  | در صورت نیاز |
| Default Values     | ✔            |
| NOT NULL           | تا حد امکان  |

---

# 4.9.5 Common Columns

تمام Aggregate Rootها باید ستون‌های زیر را داشته باشند.

| Column     |
| ---------- |
| id         |
| created_at |
| updated_at |
| created_by |
| updated_by |
| version    |
| deleted_at |

---

# 4.9.6 Index Strategy

## Primary Index

```text id="db07"
Primary Key
```

---

## Secondary Index

برای ستون‌های پرتکرار.

نمونه

```text id="db08"
status

language

slug

published_at

created_at
```

---

## Composite Index

نمونه

```text id="db09"
(language, slug)

(article_id, version_number)

(status, created_at)

(priority, scheduled_at)
```

---

## Partial Index

نمونه

```sql
WHERE deleted_at IS NULL
```

---

## Covering Index

برای Queryهای پرتکرار.

نمونه

```text id="db10"
status

published_at

title
```

---

# 4.9.7 Full Text Search Strategy

PostgreSQL Full Text Search

---

تمام مقالات دارای ستون‌های زیر هستند.

```text id="db11"
tsvector
```

---

نمونه

```text id="db12"
title_vector

content_vector
```

---

GIN Index

```text id="db13"
gin_content_search
```

---

# 4.9.8 JSON Strategy

JSONB فقط برای داده‌های Dynamic استفاده می‌شود.

مجاز

* Workflow Context
* Event Payload
* AI Metadata
* Configuration
* Prompt Variables

غیرمجاز

* Article Title
* User Name
* Status
* Slug

---

# 4.9.9 Partition Strategy

## Monthly Partition

برای

```text id="db14"
analytics_events
```

---

## Yearly Partition

برای

```text id="db15"
audit_logs
```

---

## Hash Partition

برای

```text id="db16"
ai_embeddings
```

---

## List Partition

برای

```text id="db17"
language
```

---

# 4.9.10 Archive Strategy

داده‌های قدیمی به Archive منتقل می‌شوند.

نمونه

| Table            | Archive After |
| ---------------- | ------------- |
| analytics_events | 12 Months     |
| workflow_events  | 12 Months     |
| ai_executions    | 24 Months     |
| audit_logs       | Never         |

---

# 4.9.11 Foreign Key Rules

* حذف Cascade فقط در جداول واسط مجاز است.
* حذف مستقیم Aggregate Root ممنوع است.
* تمام FKها Index می‌شوند.
* Circular Reference ممنوع است.

---

# 4.9.12 Transaction Strategy

تمام عملیات مهم داخل Transaction انجام می‌شوند.

Isolation Level

```text id="db18"
Read Committed
```

برای عملیات حساس

```text id="db19"
Serializable
```

---

# 4.9.13 Optimistic Locking

تمام Aggregate Rootها دارای ستون

```text id="db20"
version
```

هستند.

به‌روزرسانی تنها زمانی مجاز است که Version مطابقت داشته باشد.

---

# 4.9.14 Soft Delete Policy

حذف فیزیکی فقط برای موارد زیر مجاز است.

* Cache
* Temporary Data
* Queue History

سایر موجودیت‌ها

```text id="db21"
deleted_at
```

را استفاده می‌کنند.

---

# 4.9.15 Materialized Views

برای گزارش‌های سنگین.

نمونه

```text id="db22"
daily_article_metrics

top_keywords

monthly_ai_costs

popular_topics
```

---

# 4.9.16 Database Maintenance

وظایف دوره‌ای

* VACUUM
* ANALYZE
* REINDEX
* Partition Cleanup
* Statistics Refresh

---

# 4.9.17 Backup Strategy

| Backup      | Frequency  |
| ----------- | ---------- |
| WAL         | Continuous |
| Incremental | Daily      |
| Full        | Weekly     |
| Archive     | Monthly    |

---

# 4.9.18 Monitoring Metrics

موارد زیر مانیتور می‌شوند.

* Slow Queries
* Deadlocks
* Lock Wait
* Buffer Cache Hit
* Index Usage
* Table Size
* Partition Size
* WAL Growth
* Connection Pool
* Replication Lag

---

# 4.9.19 Related Project Files

```text id="db23"
database/
├── migrations/
│   ├── 008_indexes.sql
│   ├── 009_partitioning.sql
│   ├── 010_constraints.sql
│   └── maintenance/

packages/
└── database/
    ├── indexes/
    ├── constraints/
    ├── partitions/
    └── maintenance/

docs/
└── volume-02/
    └── chapter-04-part-09-database-optimization.md
```

---

# 4.9.20 Traceability

این بخش مبنای طراحی موارد زیر است.

* Prisma Schema
* SQL Migration Scripts
* Database Monitoring
* Replication
* Backup & Restore
* Query Optimizer
* Performance Dashboard

---

# 4.9.21 Architecture Decision Records

## ADR-091

تمام موجودیت‌های اصلی از UUID Version 7 به‌عنوان کلید اصلی استفاده می‌کنند تا علاوه بر یکتایی، ترتیب زمانی نیز حفظ شود.

---

## ADR-092

همه Foreign Keyها باید دارای Index باشند و حذف Cascade فقط در جداول واسط (Junction Tables) مجاز است.

---

## ADR-093

داده‌های حجیم و زمان‌محور (مانند Analytics و Workflow Events) با استفاده از **Partitioning** مدیریت می‌شوند تا عملکرد Queryها و نگهداری داده‌ها بهینه شود.

---

## ADR-094

داده‌های پویا فقط در ستون‌های **JSONB** ذخیره می‌شوند و اطلاعات هویتی و قابل جستجو باید به‌صورت رابطه‌ای مدل شوند.

---

## ADR-095

تمام عملیات نگهداری پایگاه داده شامل Backup، Vacuum، Analyze، Reindex و Archive باید به‌صورت خودکار و زمان‌بندی‌شده اجرا شوند.

---

# End of Chapter 4 — Part 9
