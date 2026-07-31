<!-- ====================================================================== -->

<!-- Document : Volume 02 - Enterprise Data Architecture                    -->

<!-- Chapter  : 04                                                          -->

<!-- Part     : 06                                                          -->

<!-- Title    : Analytics Domain Database Schema                            -->

<!-- File     : docs/volume-02/chapter-04-part-06-analytics-tables.md       -->

<!-- Related Files                                                          -->

<!--   database/migrations/005_analytics.sql                                -->

<!--   database/schema.prisma                                               -->

<!--   packages/analytics/domain/                                           -->

<!--   packages/analytics/repositories/                                     -->

<!-- ====================================================================== -->

# Chapter 4

# Part 6

# Analytics Domain Database Schema

---

# 4.6.1 Purpose

Analytics Domain مسئول جمع‌آوری، نگهداری و تحلیل داده‌های رفتاری و عملکردی سامانه است.

این Domain پایه تصمیم‌گیری برای Agentهای هوش مصنوعی، موتور سئو، سیستم پیشنهاد محتوا و داشبورد مدیریتی محسوب می‌شود.

Analytics Domain فقط داده‌ها را ذخیره نمی‌کند؛ بلکه امکان تحلیل روندها، شناسایی الگوها و پیش‌بینی رفتار کاربران را فراهم می‌کند.

---

# 4.6.2 Analytics Architecture

```text id="an01"
Website

↓

Event Collector

↓

Analytics Database

↓

Aggregation Engine

↓

Reporting API

↓

AI Decision Engine
```

---

# 4.6.3 Tables Overview

| Table                 | Purpose               |
| --------------------- | --------------------- |
| analytics_events      | رویدادهای خام کاربران |
| analytics_sessions    | نشست‌های کاربران      |
| analytics_page_views  | بازدید صفحات          |
| analytics_conversions | تبدیل‌ها              |
| analytics_searches    | جستجوهای داخلی        |
| analytics_referrers   | منابع ورودی           |
| analytics_devices     | اطلاعات دستگاه        |
| analytics_metrics     | شاخص‌های تجمیعی       |
| analytics_reports     | گزارش‌های تولیدشده    |
| analytics_predictions | پیش‌بینی‌های AI       |

---

# 4.6.4 Table : analytics_events

## Business View

تمام رویدادهای سیستم ابتدا در این جدول ذخیره می‌شوند.

نمونه:

* Page View
* Click
* Scroll
* Form Submit
* Search
* Download
* Video Play

---

## Logical Model

| Column      | Type        |
| ----------- | ----------- |
| id          | UUID        |
| session_id  | UUID        |
| event_type  | VARCHAR     |
| entity_type | VARCHAR     |
| entity_id   | UUID        |
| metadata    | JSONB       |
| occurred_at | TIMESTAMPTZ |

---

## Constraints

* Primary Key(id)

---

## Indexes

```text id="an02"
pk_analytics_events

idx_events_session

idx_events_type

idx_events_entity

idx_events_time
```

---

# 4.6.5 Table : analytics_sessions

## Purpose

نگهداری اطلاعات نشست کاربران.

---

## Columns

| Column           | Type        |
| ---------------- | ----------- |
| id               | UUID        |
| started_at       | TIMESTAMPTZ |
| ended_at         | TIMESTAMPTZ |
| duration_seconds | INTEGER     |
| visitor_hash     | VARCHAR     |
| device_id        | UUID        |
| referrer_id      | UUID        |
| country          | VARCHAR     |
| language         | VARCHAR     |

---

## Notes

IP واقعی ذخیره نمی‌شود.

فقط شناسه هش‌شده برای حفظ حریم خصوصی نگهداری می‌شود.

---

# 4.6.6 Table : analytics_page_views

## Purpose

ثبت تمام بازدیدهای صفحات.

---

## Columns

| Column           | Type        |
| ---------------- | ----------- |
| id               | UUID        |
| session_id       | UUID        |
| article_id       | UUID        |
| url              | TEXT        |
| title            | VARCHAR     |
| duration_seconds | INTEGER     |
| scroll_depth     | NUMERIC     |
| created_at       | TIMESTAMPTZ |

---

## Indexes

```text id="an03"
idx_page_article

idx_page_session

idx_page_created
```

---

# 4.6.7 Table : analytics_conversions

## Purpose

ثبت اهداف تحقق‌یافته (Conversions).

---

## Sample Conversions

* ثبت‌نام کلاس
* ارسال فرم تماس
* کلیک روی واتساپ
* تماس تلفنی
* دانلود فایل
* ثبت درخواست مشاوره

---

## Columns

| Column          | Type        |
| --------------- | ----------- |
| id              | UUID        |
| session_id      | UUID        |
| conversion_type | VARCHAR     |
| article_id      | UUID        |
| value           | NUMERIC     |
| created_at      | TIMESTAMPTZ |

---

# 4.6.8 Table : analytics_searches

## Purpose

جستجوهای داخلی سایت.

---

## Columns

| Column         | Type        |
| -------------- | ----------- |
| id             | UUID        |
| session_id     | UUID        |
| keyword        | VARCHAR     |
| results_count  | INTEGER     |
| clicked_result | UUID        |
| searched_at    | TIMESTAMPTZ |

---

# 4.6.9 Table : analytics_referrers

## Purpose

منابع ورود کاربران.

---

## Columns

| Column       | Type    |
| ------------ | ------- |
| id           | UUID    |
| source       | VARCHAR |
| medium       | VARCHAR |
| campaign     | VARCHAR |
| referrer_url | TEXT    |

---

## Sample Sources

```text id="an04"
Google

Bing

Instagram

WhatsApp

Telegram

Direct

Referral
```

---

# 4.6.10 Table : analytics_devices

## Purpose

اطلاعات دستگاه کاربران.

---

## Columns

| Column            | Type    |
| ----------------- | ------- |
| id                | UUID    |
| device_type       | VARCHAR |
| browser           | VARCHAR |
| operating_system  | VARCHAR |
| screen_resolution | VARCHAR |

---

# 4.6.11 Table : analytics_metrics

## Purpose

ذخیره شاخص‌های تجمیعی.

---

## Columns

| Column            | Type    |
| ----------------- | ------- |
| id                | UUID    |
| metric_name       | VARCHAR |
| metric_date       | DATE    |
| metric_value      | NUMERIC |
| aggregation_level | VARCHAR |

---

## Sample Metrics

```text id="an05"
Daily Visitors

CTR

Bounce Rate

Average Session Duration

Conversion Rate

Organic Traffic
```

---

# 4.6.12 Table : analytics_reports

## Purpose

گزارش‌های تولیدشده.

---

## Columns

| Column       | Type        |
| ------------ | ----------- |
| id           | UUID        |
| report_name  | VARCHAR     |
| report_type  | VARCHAR     |
| generated_at | TIMESTAMPTZ |
| file_path    | TEXT        |

---

# 4.6.13 Table : analytics_predictions

## Purpose

پیش‌بینی‌های تولیدشده توسط AI.

---

## Columns

| Column          | Type        |
| --------------- | ----------- |
| id              | UUID        |
| prediction_type | VARCHAR     |
| target_entity   | UUID        |
| confidence      | NUMERIC     |
| predicted_value | JSONB       |
| generated_at    | TIMESTAMPTZ |

---

# 4.6.14 Relationships

```text id="an06"
Session

↓

Events

↓

Page Views

↓

Conversions

↓

Metrics

↓

Reports

↓

Predictions
```

---

# 4.6.15 Data Integrity Rules

* هر Event باید به یک Session تعلق داشته باشد.
* هر Conversion باید قابل ردیابی باشد.
* شاخص‌های تجمیعی فقط از داده‌های خام محاسبه می‌شوند.
* Predictionها هرگز داده خام را تغییر نمی‌دهند.
* هیچ داده تحلیلی نباید اطلاعات هویتی مستقیم کاربر را ذخیره کند.

---

# 4.6.16 Performance Rules

* جدول `analytics_events` به‌صورت ماهانه Partition می‌شود.
* ایندکس زمانی برای تمام جداول تحلیلی الزامی است.
* داده‌های قدیمی قابل Archive هستند.
* گزارش‌ها از داده‌های تجمیعی تولید می‌شوند، نه از داده خام.
* پردازش‌های سنگین به‌صورت Batch اجرا می‌شوند.

---

# 4.6.17 Privacy Rules

* IP کامل ذخیره نمی‌شود.
* اطلاعات شخصی کاربران ناشناس‌سازی (Anonymize) می‌شود.
* شناسه نشست‌ها قابل بازیابی به هویت واقعی نیست.
* حذف داده‌های شخصی باید مطابق سیاست‌های نگهداری داده انجام شود.
* Analytics Domain باید با الزامات حریم خصوصی قابل انطباق باشد.

---

# 4.6.18 Related Project Files

```text id="an07"
database/
├── migrations/
│   └── 005_analytics.sql
├── schema.prisma
└── seeds/

packages/
├── analytics/
│   ├── domain/
│   ├── collectors/
│   ├── aggregators/
│   ├── repositories/
│   └── reporting/

docs/
└── volume-02/
    └── chapter-04-part-06-analytics-tables.md
```

---

# 4.6.19 Traceability

این بخش مبنای طراحی موارد زیر است:

* Dashboard Service
* KPI Engine
* Recommendation Engine
* AI Decision Engine
* Reporting Service
* Trend Analyzer
* Forecast Agent

---

# 4.6.20 Architecture Decision Records

## ADR-076

تمام رویدادهای کاربر ابتدا به‌صورت خام در جدول `analytics_events` ثبت می‌شوند و مبنای محاسبات بعدی قرار می‌گیرند.

---

## ADR-077

جداول تحلیلی با حجم بالا (مانند `analytics_events` و `analytics_page_views`) به‌صورت زمان‌محور (Time-Based Partitioning) پارتیشن‌بندی می‌شوند.

---

## ADR-078

هیچ اطلاعات هویتی مستقیم (PII) در Analytics Domain ذخیره نمی‌شود و داده‌ها پیش از ذخیره‌سازی ناشناس‌سازی می‌شوند.

---

## ADR-079

تمام شاخص‌های مدیریتی و داشبوردها از جدول `analytics_metrics` یا داده‌های تجمیعی تولید می‌شوند و مستقیماً روی داده‌های خام اجرا نمی‌شوند.

---

## ADR-080

پیش‌بینی‌های تولیدشده توسط هوش مصنوعی فقط در جدول `analytics_predictions` ذخیره می‌شوند و مجاز به تغییر یا بازنویسی داده‌های خام نیستند.

---

# End of Chapter 4 — Part 6
