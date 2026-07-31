<!-- ====================================================================== -->

<!-- Document : Volume 02 - Enterprise Data Architecture                    -->

<!-- Chapter  : 04                                                          -->

<!-- Part     : 03                                                          -->

<!-- Title    : Content Domain Tables                                       -->

<!-- File     : docs/volume-02/chapter-04-part-03-content-tables.md         -->

<!-- Related Files                                                          -->

<!--   database/migrations/002_content.sql                                  -->

<!--   database/schema.prisma                                               -->

<!--   packages/content/domain/                                             -->

<!--   packages/content/repositories/                                       -->

<!-- ====================================================================== -->

# Chapter 4

# Part 3

# Content Domain Tables

---

# 4.3.1 Purpose

این بخش ساختار کامل جداول Domain محتوا (Content Domain) را تعریف می‌کند.

Content Domain هسته اصلی سامانه AI Publishing Platform است و تمام فرآیندهای تولید، بازنویسی، انتشار، به‌روزرسانی و تحلیل مقالات بر پایه این جداول انجام می‌شوند.

در این بخش، مدل داده به‌گونه‌ای طراحی شده است که از:

* تولید خودکار محتوا توسط AI
* انتشار چندزبانه
* نسخه‌بندی مقالات
* تحلیل کیفیت
* سئو
* گردش کار (Workflow)
* اتصال به Knowledge Graph

پشتیبانی کند.

---

# 4.3.2 Content Domain Overview

```text
Article
│
├── Article Version
├── Article Section
├── Article Image
├── Article FAQ
├── Article Keyword
├── Article Category
├── Article Tag
├── Article Author
├── Article Reference
├── Internal Link
└── External Link
```

---

# 4.3.3 Table : articles

## Business View

این جدول Aggregate Root اصلی Domain محتوا است.

هر مقاله صرفاً یک شناسه دائمی دارد و تمام نسخه‌های مقاله به آن وابسته هستند.

---

## Logical Model

| Column             | Type         | Required |
| ------------------ | ------------ | -------- |
| id                 | UUID         | ✔        |
| slug               | VARCHAR(255) | ✔        |
| current_version_id | UUID         | ✔        |
| title              | VARCHAR(300) | ✔        |
| language           | VARCHAR(10)  | ✔        |
| status             | VARCHAR(30)  | ✔        |
| article_type       | VARCHAR(50)  | ✔        |
| publication_state  | VARCHAR(30)  | ✔        |
| canonical_url      | TEXT         | ✖        |
| published_at       | TIMESTAMPTZ  | ✖        |
| created_at         | TIMESTAMPTZ  | ✔        |
| updated_at         | TIMESTAMPTZ  | ✔        |
| created_by         | UUID         | ✔        |
| updated_by         | UUID         | ✔        |
| version            | INTEGER      | ✔        |
| deleted_at         | TIMESTAMPTZ  | ✖        |

---

## Constraints

* Primary Key(id)
* Unique(slug, language)
* Foreign Key(current_version_id)

---

## Physical Model

Indexes

```text
pk_articles

uq_articles_slug_language

idx_articles_status

idx_articles_type

idx_articles_language

idx_articles_published_at
```

---

## Code Mapping

```text
Entity

Article

Repository

ArticleRepository

Aggregate Root

YES
```

---

# 4.3.4 Table : article_versions

## Business View

هر بار که AI مقاله را بازنویسی می‌کند یا ویراستار تغییری اعمال می‌کند، نسخه جدیدی ایجاد می‌شود.

هیچ نسخه‌ای بازنویسی یا حذف نمی‌شود.

---

## Logical Model

| Column            | Type        |
| ----------------- | ----------- |
| id                | UUID        |
| article_id        | UUID        |
| version_number    | INTEGER     |
| title             | TEXT        |
| summary           | TEXT        |
| markdown_content  | TEXT        |
| seo_score         | NUMERIC     |
| readability_score | NUMERIC     |
| quality_score     | NUMERIC     |
| ai_provider       | VARCHAR     |
| ai_model          | VARCHAR     |
| prompt_version    | VARCHAR     |
| created_at        | TIMESTAMPTZ |

---

## Constraints

Unique(article_id, version_number)

---

## Physical Model

Indexes

```text
idx_article_versions_article

idx_article_versions_quality

idx_article_versions_created
```

---

## Notes

نسخه فعال از طریق

```text
articles.current_version_id
```

مشخص می‌شود.

---

# 4.3.5 Table : article_sections

## Purpose

نگهداری بخش‌های مقاله.

هر Section مستقل ذخیره می‌شود.

---

## Columns

| Column        | Type     |
| ------------- | -------- |
| id            | UUID     |
| version_id    | UUID     |
| heading_level | SMALLINT |
| heading       | TEXT     |
| markdown      | TEXT     |
| sort_order    | INTEGER  |

---

## Constraints

Unique(version_id, sort_order)

---

# 4.3.6 Table : article_images

## Purpose

تصاویر مرتبط با هر نسخه مقاله.

---

## Columns

| Column        | Type    |
| ------------- | ------- |
| id            | UUID    |
| version_id    | UUID    |
| attachment_id | UUID    |
| alt_text      | TEXT    |
| caption       | TEXT    |
| width         | INTEGER |
| height        | INTEGER |
| ai_generated  | BOOLEAN |
| sort_order    | INTEGER |

---

## Notes

تصویر در Object Storage ذخیره می‌شود.

---

# 4.3.7 Table : article_faq

## Purpose

FAQهای تولید شده توسط AI

---

## Columns

| Column         | Type    |
| -------------- | ------- |
| id             | UUID    |
| version_id     | UUID    |
| question       | TEXT    |
| answer         | TEXT    |
| schema_enabled | BOOLEAN |
| sort_order     | INTEGER |

---

# 4.3.8 Table : article_keywords

## Purpose

ارتباط مقاله با Keywordها

---

## Columns

| Column       | Type     |
| ------------ | -------- |
| article_id   | UUID     |
| keyword_id   | UUID     |
| keyword_type | VARCHAR  |
| priority     | SMALLINT |

---

## Constraints

Composite Primary Key

```text
(article_id, keyword_id)
```

---

# 4.3.9 Table : article_categories

ارتباط

چند به چند

بین مقاله و Category

---

# 4.3.10 Table : article_tags

ارتباط

چند به چند

بین مقاله و Tag

---

# 4.3.11 Table : article_authors

پشتیبانی از

چند نویسنده

برای هر مقاله

---

# 4.3.12 Table : article_references

منابع استفاده شده

در مقاله

---

## Columns

| Column         | Type    |
| -------------- | ------- |
| id             | UUID    |
| version_id     | UUID    |
| source_title   | TEXT    |
| source_url     | TEXT    |
| source_type    | VARCHAR |
| citation_order | INTEGER |

---

# 4.3.13 Table : article_internal_links

لینک‌های داخلی

---

## Columns

| Column            | Type |
| ----------------- | ---- |
| id                | UUID |
| source_version_id | UUID |
| target_article_id | UUID |
| anchor_text       | TEXT |

---

# 4.3.14 Table : article_external_links

لینک‌های خارجی

---

## Columns

| Column      | Type    |
| ----------- | ------- |
| id          | UUID    |
| version_id  | UUID    |
| url         | TEXT    |
| anchor_text | TEXT    |
| rel         | VARCHAR |

---

# 4.3.15 Entity Relationships

```text
Article
│
├── ArticleVersion
│       │
│       ├── Sections
│       ├── Images
│       ├── FAQ
│       ├── References
│       ├── Internal Links
│       └── External Links
│
├── Authors
├── Categories
└── Keywords
```

---

# 4.3.16 Lifecycle

```text
Draft

↓

AI Generated

↓

Reviewed

↓

Approved

↓

Published

↓

Updated

↓

Archived
```

---

# 4.3.17 Performance Rules

* همه جدول‌های واسط دارای Composite Index هستند.
* متن Markdown فقط در جدول `article_versions` ذخیره می‌شود.
* جدول `articles` فقط Metadata را نگهداری می‌کند.
* نسخه فعال بدون Join اضافی قابل دسترسی است.
* تمام Queryهای انتشار بر اساس `current_version_id` انجام می‌شوند.

---

# 4.3.18 Related Project Files

```text
database/
├── migrations/
│   └── 002_content.sql
├── schema.prisma
└── seeds/

packages/
├── content/
│   ├── domain/
│   ├── repositories/
│   ├── services/
│   └── events/
└── shared/

docs/
└── volume-02/
    └── chapter-04-part-03-content-tables.md
```

---

# 4.3.19 Traceability

این بخش مبنای طراحی موارد زیر است:

* Knowledge Graph
* Search Index
* Vector Database
* Editorial Workflow
* Publishing Pipeline
* Analytics Engine

---

# 4.3.20 Architecture Decision Records

## ADR-061

جدول `articles` فقط اطلاعات هویتی و Metadata مقاله را نگهداری می‌کند و محتوای اصلی در `article_versions` ذخیره می‌شود.

---

## ADR-062

تمام تغییرات محتوایی با ایجاد نسخه جدید انجام می‌شوند و هیچ نسخه‌ای بازنویسی یا حذف نمی‌شود.

---

## ADR-063

نسخه فعال هر مقاله از طریق `current_version_id` مشخص می‌شود تا بازیابی آخرین نسخه بدون جستجوی اضافی انجام شود.

---

## ADR-064

تمام ارتباط‌های چندبه‌چند (Categories، Tags، Keywords و Authors) از طریق جداول واسط مستقل پیاده‌سازی می‌شوند.

---

## ADR-065

هر نسخه مقاله می‌تواند مجموعه مستقل خود از بخش‌ها، تصاویر، پرسش‌های متداول، منابع و لینک‌ها را داشته باشد تا بازتولید کامل هر نسخه در آینده امکان‌پذیر باشد.

---

# End of Chapter 4 — Part 3
