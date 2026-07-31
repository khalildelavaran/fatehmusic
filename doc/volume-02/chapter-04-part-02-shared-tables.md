<!-- ====================================================================== -->

<!-- Document : Volume 02 - Enterprise Data Architecture                    -->

<!-- Chapter  : 04                                                          -->

<!-- Part     : 02                                                          -->

<!-- Title    : Shared Tables                                               -->

<!-- File     : docs/volume-02/chapter-04-part-02-shared-tables.md          -->

<!-- Related Files                                                          -->

<!--   database/schema.prisma                                               -->

<!--   database/migrations/001_shared.sql                                   -->

<!--   packages/database/entities/                                          -->

<!-- ====================================================================== -->

# Chapter 4

# Part 2

# Shared Tables

---

# 4.2.1 Purpose

این بخش جدول‌های پایه (Shared Tables) را معرفی می‌کند.

این جدول‌ها بین تمام Domainهای سیستم مشترک هستند و تقریباً تمام موجودیت‌ها به آن‌ها وابسته‌اند.

هدف از ایجاد این جدول‌ها:

* جلوگیری از تکرار داده
* یکپارچگی اطلاعات
* افزایش قابلیت توسعه
* فراهم کردن Audit و Versioning
* استانداردسازی ارتباط بین Domainها

---

# 4.2.2 Shared Tables Overview

| Table         | Purpose                      |
| ------------- | ---------------------------- |
| users         | کاربران و Agentها            |
| audit_logs    | ثبت تمام عملیات              |
| tags          | برچسب‌ها                     |
| attachments   | فایل‌های پیوست               |
| environments  | محیط‌های اجرایی              |
| feature_flags | قابلیت‌های قابل فعال/غیرفعال |
| settings      | تنظیمات عمومی                |
| statuses      | وضعیت‌های استاندارد          |

---

# 4.2.3 Table : users

## Purpose

نگهداری اطلاعات کاربران انسانی و Agentهای سیستم.

---

## Columns

| Column       | Type         | Nullable | Description                |
| ------------ | ------------ | -------- | -------------------------- |
| id           | UUID         | No       | Primary Key                |
| username     | VARCHAR(100) | No       | نام کاربری                 |
| email        | VARCHAR(255) | No       | ایمیل                      |
| display_name | VARCHAR(255) | No       | نام نمایشی                 |
| user_type    | VARCHAR(30)  | No       | Human / AI Agent / Service |
| status       | VARCHAR(30)  | No       | وضعیت                      |
| created_at   | TIMESTAMPTZ  | No       | زمان ایجاد                 |
| updated_at   | TIMESTAMPTZ  | No       | آخرین بروزرسانی            |
| created_by   | UUID         | Yes      | ایجادکننده                 |
| updated_by   | UUID         | Yes      | آخرین ویرایش‌کننده         |
| version      | INTEGER      | No       | نسخه                       |
| deleted_at   | TIMESTAMPTZ  | Yes      | حذف منطقی                  |

---

## Constraints

* Primary Key (id)
* Unique(username)
* Unique(email)

---

## Indexes

```text
pk_users
uq_users_username
uq_users_email
idx_users_status
idx_users_type
```

---

## Relationships

```text
User

↓

creates

↓

Article

↓

Workflow

↓

Decision

↓

Audit Log
```

---

# 4.2.4 Table : audit_logs

## Purpose

ثبت تمامی عملیات مهم سامانه.

---

## Columns

| Column      | Type        |
| ----------- | ----------- |
| id          | UUID        |
| entity_name | VARCHAR     |
| entity_id   | UUID        |
| operation   | VARCHAR     |
| old_value   | JSONB       |
| new_value   | JSONB       |
| executed_by | UUID        |
| created_at  | TIMESTAMPTZ |

---

## Indexes

```text
idx_audit_entity

idx_audit_created_at

idx_audit_user
```

---

## Notes

هیچ رکوردی از این جدول حذف نمی‌شود.

---

# 4.2.5 Table : tags

## Purpose

برچسب‌های قابل استفاده در تمام Domainها.

---

## Columns

| Column      | Type        |
| ----------- | ----------- |
| id          | UUID        |
| name        | VARCHAR     |
| slug        | VARCHAR     |
| description | TEXT        |
| color       | VARCHAR     |
| status      | VARCHAR     |
| created_at  | TIMESTAMPTZ |
| updated_at  | TIMESTAMPTZ |

---

## Constraints

Unique(slug)

Unique(name)

---

# 4.2.6 Table : attachments

## Purpose

نگهداری اطلاعات فایل‌ها.

---

## Columns

| Column           | Type        |
| ---------------- | ----------- |
| id               | UUID        |
| file_name        | VARCHAR     |
| original_name    | VARCHAR     |
| mime_type        | VARCHAR     |
| file_size        | BIGINT      |
| storage_provider | VARCHAR     |
| storage_path     | TEXT        |
| checksum         | VARCHAR     |
| created_at       | TIMESTAMPTZ |

---

## Notes

فایل در Object Storage ذخیره می‌شود.

Database فقط Metadata را نگهداری می‌کند.

---

# 4.2.7 Table : settings

## Purpose

تنظیمات عمومی سامانه.

---

## Columns

| Column      | Type        |
| ----------- | ----------- |
| id          | UUID        |
| key         | VARCHAR     |
| value       | JSONB       |
| scope       | VARCHAR     |
| environment | VARCHAR     |
| updated_at  | TIMESTAMPTZ |

---

## Constraints

Unique(key, scope, environment)

---

# 4.2.8 Table : feature_flags

## Purpose

فعال یا غیرفعال کردن قابلیت‌های سیستم بدون نیاز به Deploy.

---

## Columns

| Column             | Type    |
| ------------------ | ------- |
| id                 | UUID    |
| name               | VARCHAR |
| enabled            | BOOLEAN |
| rollout_percentage | INTEGER |
| description        | TEXT    |

---

# 4.2.9 Table : environments

## Purpose

مدیریت محیط‌های اجرایی.

---

## Sample Values

```text
development

testing

staging

production
```

---

# 4.2.10 Table : statuses

## Purpose

مرجع وضعیت‌های استاندارد سیستم.

---

## Sample Values

```text
draft

active

published

archived

disabled

deleted
```

---

# 4.2.11 Common Constraints

تمام Shared Tableها باید دارای موارد زیر باشند:

* UUID Primary Key
* created_at
* updated_at
* version
* status
* Soft Delete
* Audit قابلیت ردیابی

---

# 4.2.12 Common Index Strategy

تمام جدول‌ها باید Indexهای زیر را در صورت وجود ستون مربوطه داشته باشند:

```text
idx_created_at

idx_updated_at

idx_status

idx_deleted_at
```

---

# 4.2.13 Related Project Files

```text
database/
├── migrations/
│   └── 001_shared.sql
├── schema.prisma
└── seeds/

packages/
├── database/
│   ├── entities/
│   ├── repositories/
│   └── migrations/
└── shared/

docs/
└── volume-02/
    └── chapter-04-part-02-shared-tables.md
```

---

# 4.2.14 Traceability

این بخش مبنای طراحی جدول‌های تخصصی فصل‌های بعد است.

* Content Tables
* Knowledge Tables
* SEO Tables
* Workflow Tables
* Analytics Tables
* AI Tables

تمام این جدول‌ها به Shared Tables وابسته خواهند بود.

---

# 4.2.15 Architecture Decision Records

## ADR-056

تمام Domainها از مجموعه Shared Tables مشترک استفاده می‌کنند.

---

## ADR-057

جدول **audit_logs** تغییرناپذیر (Immutable) است و هیچ رکوردی از آن حذف یا ویرایش نمی‌شود.

---

## ADR-058

اطلاعات فایل‌ها فقط به‌صورت Metadata در پایگاه داده ذخیره می‌شود و محتوای فایل در Object Storage نگهداری خواهد شد.

---

## ADR-059

تنظیمات سیستم از طریق جدول **settings** و با استفاده از مقادیر JSONB مدیریت می‌شوند.

---

## ADR-060

قابلیت‌های جدید باید از طریق **Feature Flags** قابل فعال یا غیرفعال شدن باشند، بدون نیاز به استقرار (Deployment) مجدد.

---

# End of Chapter 4 — Part 2
