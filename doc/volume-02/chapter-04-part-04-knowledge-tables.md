<!-- ====================================================================== -->

<!-- Document : Volume 02 - Enterprise Data Architecture                    -->

<!-- Chapter  : 04                                                          -->

<!-- Part     : 04                                                          -->

<!-- Title    : Knowledge Domain Database Schema                            -->

<!-- File     : docs/volume-02/chapter-04-part-04-knowledge-tables.md       -->

<!-- Related Files                                                          -->

<!--   database/migrations/003_knowledge.sql                                -->

<!--   database/schema.prisma                                               -->

<!--   packages/knowledge/domain/                                           -->

<!--   packages/knowledge/repositories/                                     -->

<!-- ====================================================================== -->

# Chapter 4

# Part 4

# Knowledge Domain Database Schema

---

# 4.4.1 Purpose

Knowledge Domain قلب سیستم هوش مصنوعی است.

تمام Agentها برای تصمیم‌گیری، تولید محتوا، تحلیل سئو، جلوگیری از تولید محتوای تکراری و ایجاد ارتباط بین مقالات از این Domain استفاده می‌کنند.

این Domain بین Content Domain و Vector Database قرار می‌گیرد.

Knowledge Domain تنها مرجع ساخت‌یافته دانش (Structured Knowledge) است.

---

# 4.4.2 Knowledge Architecture

```text
Content

↓

Knowledge Extraction

↓

Knowledge Database

↓

Knowledge Graph

↓

Vector Database

↓

AI Agents
```

Knowledge Database اطلاعات ساخت‌یافته را نگهداری می‌کند.

Knowledge Graph روابط را نگهداری می‌کند.

Vector Database شباهت معنایی را نگهداری می‌کند.

---

# 4.4.3 Tables Overview

| Table                   | Purpose                 |
| ----------------------- | ----------------------- |
| knowledge_topics        | موضوعات اصلی            |
| knowledge_entities      | موجودیت‌های استخراج‌شده |
| knowledge_keywords      | کلیدواژه‌ها             |
| knowledge_concepts      | مفاهیم                  |
| knowledge_relationships | ارتباط بین موجودیت‌ها   |
| knowledge_sources       | منابع دانش              |
| knowledge_synonyms      | مترادف‌ها               |
| knowledge_aliases       | نام‌های جایگزین         |
| knowledge_clusters      | خوشه‌های معنایی         |

---

# 4.4.4 Table : knowledge_topics

## Business View

هر Topic نماینده یک موضوع اصلی در سیستم است.

نمونه

* آموزش گیتار
* آموزش پیانو
* آموزش سنتور
* آموزش آواز
* آموزش موسیقی کودک

---

## Logical Model

| Column           | Type        |
| ---------------- | ----------- |
| id               | UUID        |
| slug             | VARCHAR     |
| title            | VARCHAR     |
| description      | TEXT        |
| language         | VARCHAR(10) |
| popularity_score | NUMERIC     |
| quality_score    | NUMERIC     |
| parent_topic_id  | UUID NULL   |
| created_at       | TIMESTAMPTZ |
| updated_at       | TIMESTAMPTZ |

---

## Constraints

* Unique(slug, language)
* Self Reference(parent_topic_id)

---

## Indexes

```text
pk_knowledge_topics

uq_topic_slug

idx_topic_parent

idx_topic_language
```

---

# 4.4.5 Table : knowledge_entities

## Business View

تمام موجودیت‌هایی که AI استخراج می‌کند.

نمونه

* استاد
* ساز
* سبک موسیقی
* آهنگ
* آهنگساز
* آموزشگاه

---

## Logical Model

| Column          | Type        |
| --------------- | ----------- |
| id              | UUID        |
| entity_type     | VARCHAR     |
| canonical_name  | VARCHAR     |
| normalized_name | VARCHAR     |
| description     | TEXT        |
| confidence      | NUMERIC     |
| source_count    | INTEGER     |
| created_at      | TIMESTAMPTZ |

---

## Constraints

Unique(entity_type, normalized_name)

---

## Indexes

```text
idx_entity_type

idx_entity_name

idx_entity_confidence
```

---

# 4.4.6 Table : knowledge_keywords

## Purpose

تمام Keywordهای استخراج‌شده توسط سیستم.

---

## Columns

| Column        | Type     |
| ------------- | -------- |
| id            | UUID     |
| keyword       | VARCHAR  |
| language      | VARCHAR  |
| search_volume | INTEGER  |
| competition   | NUMERIC  |
| cpc           | NUMERIC  |
| intent        | VARCHAR  |
| priority      | SMALLINT |

---

## Notes

این جدول مرجع اصلی Keywordها است.

SEO Domain داده‌های تحلیلی را به آن اضافه می‌کند.

---

# 4.4.7 Table : knowledge_concepts

## Purpose

نگهداری مفاهیم انتزاعی.

نمونه

* موسیقی
* ریتم
* هارمونی
* تکنیک
* تمرین
* آموزش

---

## Columns

| Column       | Type    |
| ------------ | ------- |
| id           | UUID    |
| concept_name | VARCHAR |
| definition   | TEXT    |
| language     | VARCHAR |

---

# 4.4.8 Table : knowledge_relationships

## Business View

ارتباط بین Entityها.

---

## Logical Model

| Column           | Type        |
| ---------------- | ----------- |
| id               | UUID        |
| source_entity_id | UUID        |
| target_entity_id | UUID        |
| relation_type    | VARCHAR     |
| confidence       | NUMERIC     |
| source_id        | UUID        |
| created_at       | TIMESTAMPTZ |

---

## Sample Relations

```text
Teacher

TEACHES

Course

Instrument

BELONGS_TO

Category

Article

MENTIONS

Teacher

Article

REFERENCES

Article
```

---

# 4.4.9 Table : knowledge_sources

## Purpose

منابع تولید دانش.

---

## Columns

| Column      | Type    |
| ----------- | ------- |
| id          | UUID    |
| source_type | VARCHAR |
| title       | TEXT    |
| url         | TEXT    |
| trust_score | NUMERIC |
| language    | VARCHAR |

---

## Sample Types

```text
Official Website

Book

Research Paper

Wikipedia

Internal Content

Government
```

---

# 4.4.10 Table : knowledge_synonyms

## Purpose

مدیریت مترادف‌ها.

---

## Columns

| Column    | Type    |
| --------- | ------- |
| id        | UUID    |
| entity_id | UUID    |
| synonym   | VARCHAR |

---

## Example

```text
گیتار کلاسیک

=

Classical Guitar
```

---

# 4.4.11 Table : knowledge_aliases

نام‌های جایگزین.

نمونه

```text
ChatGPT

=

OpenAI ChatGPT
```

---

# 4.4.12 Table : knowledge_clusters

## Purpose

خوشه‌بندی موضوعات مشابه.

---

## Columns

| Column       | Type    |
| ------------ | ------- |
| id           | UUID    |
| cluster_name | VARCHAR |
| description  | TEXT    |
| embedding_id | UUID    |

---

# 4.4.13 Relationships

```text
Topic

↓

contains

↓

Entity

↓

has

↓

Keyword

↓

belongs_to

↓

Cluster

↓

references

↓

Source
```

---

# 4.4.14 Data Integrity Rules

* هیچ Entity تکراری مجاز نیست.
* هر Keyword باید Language داشته باشد.
* هر Relationship باید Confidence داشته باشد.
* تمام Topicها دارای Slug هستند.
* تمام Sourceها دارای Trust Score هستند.

---

# 4.4.15 Performance Rules

* Keywordها Index می‌شوند.
* Entity Nameها Index می‌شوند.
* تمام Joinها بر اساس UUID انجام می‌شوند.
* Queryهای Topic باید کمتر از 100ms باشند.
* جداول برای میلیون‌ها رکورد طراحی می‌شوند.

---

# 4.4.16 Related Project Files

```text
database/
├── migrations/
│   └── 003_knowledge.sql
├── schema.prisma
└── seeds/

packages/
├── knowledge/
│   ├── domain/
│   ├── repositories/
│   ├── extractors/
│   ├── graph/
│   └── services/

docs/
└── volume-02/
    └── chapter-04-part-04-knowledge-tables.md
```

---

# 4.4.17 Traceability

این بخش مبنای طراحی موارد زیر است.

* Chapter 5 — Knowledge Graph Schema
* Chapter 6 — Vector Database Schema
* Topic Agent
* Keyword Agent
* Knowledge Agent
* Internal Linking Agent
* Recommendation Engine

---

# 4.4.18 Architecture Decision Records

## ADR-066

Knowledge Domain مرجع اصلی تمام دانش ساخت‌یافته سامانه است.

---

## ADR-067

Knowledge Graph و Knowledge Database دو لایه مستقل با مسئولیت‌های متفاوت هستند.

---

## ADR-068

تمام موجودیت‌های استخراج‌شده دارای شناسه یکتا، نوع و سطح اطمینان (Confidence) هستند.

---

## ADR-069

روابط بین موجودیت‌ها به‌صورت صریح در جدول `knowledge_relationships` ثبت می‌شوند و مبنای ساخت Knowledge Graph خواهند بود.

---

## ADR-070

تمام Agentهای هوش مصنوعی برای استخراج، غنی‌سازی و بازیابی دانش باید از Knowledge Domain به‌عنوان مرجع رسمی استفاده کنند و ایجاد پایگاه دانش مستقل در Agentها مجاز نیست.

---

# End of Chapter 4 — Part 4
