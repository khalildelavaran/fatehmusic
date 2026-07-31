<!-- ====================================================================== -->

<!-- Document : Volume 02 - Enterprise Data Architecture                    -->

<!-- Chapter  : 04                                                          -->

<!-- Part     : 05                                                          -->

<!-- Title    : SEO Domain Database Schema                                  -->

<!-- File     : docs/volume-02/chapter-04-part-05-seo-tables.md             -->

<!-- Related Files                                                          -->

<!--   database/migrations/004_seo.sql                                      -->

<!--   database/schema.prisma                                               -->

<!--   packages/seo/domain/                                                 -->

<!--   packages/seo/repositories/                                           -->

<!-- ====================================================================== -->

# Chapter 4

# Part 5

# SEO Domain Database Schema

---

# 4.5.1 Purpose

SEO Domain مسئول مدیریت تمام داده‌های مرتبط با بهینه‌سازی موتورهای جستجو است.

هدف این Domain تنها نگهداری Meta Tagها نیست، بلکه ایجاد یک پایگاه داده تحلیلی است که بتواند:

* انتخاب موضوعات جدید
* تحلیل رقبا
* خوشه‌بندی کلیدواژه‌ها
* مدیریت لینک‌های داخلی
* بررسی کیفیت صفحات
* پایش عملکرد سئو
* ارائه پیشنهاد برای بهبود محتوا

را برای Agentهای هوش مصنوعی فراهم کند.

---

# 4.5.2 SEO Architecture

```text
Editorial Platform

↓

SEO Engine

↓

SEO Database

↓

Search Console

↓

Analytics Engine

↓

Decision Engine
```

SEO Database منبع اصلی اطلاعات سئوی داخلی سامانه است.

---

# 4.5.3 Tables Overview

| Table               | Purpose            |
| ------------------- | ------------------ |
| seo_keywords        | کلیدواژه‌های هدف   |
| seo_clusters        | خوشه‌های کلیدواژه  |
| seo_articles        | اطلاعات سئوی مقاله |
| seo_rankings        | رتبه صفحات         |
| seo_internal_links  | لینک‌های داخلی     |
| seo_redirects       | ریدایرکت‌ها        |
| seo_sitemaps        | نقشه سایت          |
| seo_meta_templates  | قالب‌های Meta      |
| seo_competitors     | رقبا               |
| seo_recommendations | پیشنهادهای AI      |

---

# 4.5.4 Table : seo_keywords

## Business View

مرجع اصلی تمام کلیدواژه‌های هدف سیستم.

هر Keyword فقط یک‌بار ثبت می‌شود.

---

## Logical Model

| Column        | Type         |
| ------------- | ------------ |
| id            | UUID         |
| keyword       | VARCHAR(300) |
| language      | VARCHAR(10)  |
| search_intent | VARCHAR(30)  |
| difficulty    | NUMERIC      |
| search_volume | INTEGER      |
| competition   | NUMERIC      |
| cpc           | NUMERIC      |
| priority      | SMALLINT     |
| status        | VARCHAR(30)  |
| created_at    | TIMESTAMPTZ  |
| updated_at    | TIMESTAMPTZ  |

---

## Constraints

* Unique(keyword, language)

---

## Indexes

```text
pk_seo_keywords

uq_keyword_language

idx_keyword_volume

idx_keyword_priority

idx_keyword_intent
```

---

# 4.5.5 Table : seo_clusters

## Purpose

گروه‌بندی Keywordهای مرتبط.

---

## Columns

| Column            | Type        |
| ----------------- | ----------- |
| id                | UUID        |
| cluster_name      | VARCHAR     |
| parent_cluster_id | UUID NULL   |
| language          | VARCHAR     |
| priority          | SMALLINT    |
| created_at        | TIMESTAMPTZ |

---

## Notes

هر Keyword فقط به یک Cluster اصلی تعلق دارد.

---

# 4.5.6 Table : seo_articles

## Business View

اطلاعات سئوی هر مقاله.

---

## Columns

| Column              | Type         |
| ------------------- | ------------ |
| article_id          | UUID         |
| focus_keyword_id    | UUID         |
| meta_title          | VARCHAR(70)  |
| meta_description    | VARCHAR(170) |
| canonical_url       | TEXT         |
| robots              | VARCHAR      |
| schema_type         | VARCHAR      |
| seo_score           | NUMERIC      |
| readability_score   | NUMERIC      |
| internal_link_score | NUMERIC      |
| updated_at          | TIMESTAMPTZ  |

---

## Constraints

Primary Key(article_id)

---

## Notes

این جدول فقط اطلاعات SEO را نگهداری می‌کند.

محتوا در Content Domain ذخیره می‌شود.

---

# 4.5.7 Table : seo_rankings

## Purpose

ثبت تغییرات رتبه صفحات.

---

## Columns

| Column        | Type        |
| ------------- | ----------- |
| id            | UUID        |
| article_id    | UUID        |
| keyword_id    | UUID        |
| search_engine | VARCHAR     |
| device        | VARCHAR     |
| country       | VARCHAR     |
| ranking       | INTEGER     |
| checked_at    | TIMESTAMPTZ |

---

## Indexes

```text
idx_ranking_keyword

idx_ranking_article

idx_ranking_date
```

---

# 4.5.8 Table : seo_internal_links

## Purpose

تحلیل لینک‌های داخلی.

---

## Columns

| Column            | Type        |
| ----------------- | ----------- |
| id                | UUID        |
| source_article_id | UUID        |
| target_article_id | UUID        |
| anchor_text       | TEXT        |
| link_strength     | NUMERIC     |
| created_at        | TIMESTAMPTZ |

---

# 4.5.9 Table : seo_redirects

## Purpose

مدیریت Redirectها.

---

## Columns

| Column           | Type     |
| ---------------- | -------- |
| id               | UUID     |
| source_path      | TEXT     |
| destination_path | TEXT     |
| redirect_type    | SMALLINT |
| enabled          | BOOLEAN  |

---

## Sample Redirect Types

```text
301

302

307

308
```

---

# 4.5.10 Table : seo_sitemaps

## Purpose

ثبت وضعیت Sitemapها.

---

## Columns

| Column            | Type        |
| ----------------- | ----------- |
| id                | UUID        |
| sitemap_type      | VARCHAR     |
| file_name         | VARCHAR     |
| last_generated_at | TIMESTAMPTZ |
| url_count         | INTEGER     |

---

# 4.5.11 Table : seo_meta_templates

## Purpose

قالب‌های تولید خودکار Meta Title و Meta Description.

---

## Columns

| Column               | Type    |
| -------------------- | ------- |
| id                   | UUID    |
| template_name        | VARCHAR |
| entity_type          | VARCHAR |
| title_template       | TEXT    |
| description_template | TEXT    |
| language             | VARCHAR |

---

# 4.5.12 Table : seo_competitors

## Purpose

ذخیره اطلاعات رقبا برای تحلیل.

---

## Columns

| Column           | Type        |
| ---------------- | ----------- |
| id               | UUID        |
| domain           | VARCHAR     |
| language         | VARCHAR     |
| authority_score  | NUMERIC     |
| last_analyzed_at | TIMESTAMPTZ |

---

# 4.5.13 Table : seo_recommendations

## Purpose

پیشنهادهای تولیدشده توسط AI برای بهبود سئو.

---

## Columns

| Column              | Type        |
| ------------------- | ----------- |
| id                  | UUID        |
| article_id          | UUID        |
| recommendation_type | VARCHAR     |
| priority            | SMALLINT    |
| description         | TEXT        |
| status              | VARCHAR     |
| created_at          | TIMESTAMPTZ |

---

# 4.5.14 Relationships

```text
Keyword
│
├── Cluster
│
├── Ranking
│
└── Article SEO

Article
│
├── Internal Links
├── Meta Data
└── Recommendations
```

---

# 4.5.15 Data Integrity Rules

* هر Keyword فقط یک رکورد فعال برای هر زبان دارد.
* هر مقاله فقط یک رکورد در `seo_articles` دارد.
* تمام Rankingها دارای زمان ثبت هستند.
* تمام Redirectها باید مقصد معتبر داشته باشند.
* هر Recommendation باید به یک مقاله مرتبط باشد.

---

# 4.5.16 Performance Rules

* Keywordها Full Index می‌شوند.
* Rankingها بر اساس تاریخ ایندکس می‌شوند.
* Meta اطلاعات در Joinهای پرتکرار Cache می‌شوند.
* تحلیل Keywordها باید کمتر از 100ms انجام شود.
* جداول Ranking قابلیت Partition بر اساس تاریخ دارند.

---

# 4.5.17 Related Project Files

```text
database/
├── migrations/
│   └── 004_seo.sql
├── schema.prisma
└── seeds/

packages/
├── seo/
│   ├── domain/
│   ├── repositories/
│   ├── analyzers/
│   ├── services/
│   └── recommendations/

docs/
└── volume-02/
    └── chapter-04-part-05-seo-tables.md
```

---

# 4.5.18 Traceability

این بخش مبنای طراحی موارد زیر است.

* Chapter 8 — Content Collections
* Chapter 14 — Analytics Schema
* Keyword Agent
* SEO Agent
* Internal Linking Agent
* Content Optimizer Agent
* Publishing Agent

---

# 4.5.19 Architecture Decision Records

## ADR-071

تمام داده‌های سئو در Domain مستقل **SEO** نگهداری می‌شوند و از Domain محتوا جدا هستند.

---

## ADR-072

جدول `seo_articles` فقط اطلاعات سئو را نگهداری می‌کند و محتوای مقاله در Content Domain ذخیره می‌شود.

---

## ADR-073

تاریخچه رتبه‌بندی کلمات کلیدی به‌صورت کامل در `seo_rankings` نگهداری می‌شود و بازنویسی داده‌های گذشته مجاز نیست.

---

## ADR-074

تمام پیشنهادهای بهینه‌سازی تولیدشده توسط AI در جدول `seo_recommendations` ذخیره و قابل پیگیری هستند.

---

## ADR-075

خوشه‌بندی کلیدواژه‌ها از طریق `seo_clusters` انجام می‌شود و مبنای انتخاب موضوعات، لینک‌سازی داخلی و برنامه‌ریزی تولید محتوا خواهد بود.

---

# End of Chapter 4 — Part 5
