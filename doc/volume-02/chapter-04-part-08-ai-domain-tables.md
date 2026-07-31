<!-- ====================================================================== -->

<!-- Document : Volume 02 - Enterprise Data Architecture                    -->

<!-- Chapter  : 04                                                          -->

<!-- Part     : 08                                                          -->

<!-- Title    : AI Domain Database Schema                                   -->

<!-- File     : docs/volume-02/chapter-04-part-08-ai-domain-tables.md       -->

<!-- Related Files                                                          -->

<!--   database/migrations/007_ai_domain.sql                                -->

<!--   database/schema.prisma                                               -->

<!--   packages/ai/domain/                                                  -->

<!--   packages/ai/agents/                                                  -->

<!--   packages/ai/providers/                                               -->

<!--   packages/ai/repositories/                                            -->

<!-- ====================================================================== -->

# Chapter 4

# Part 8

# AI Domain Database Schema

---

# 4.8.1 Purpose

AI Domain مسئول مدیریت تمامی مؤلفه‌های مرتبط با هوش مصنوعی در سامانه است.

این Domain صرفاً برای ارسال Prompt به مدل‌های زبانی طراحی نشده است، بلکه چرخه کامل تصمیم‌گیری، تولید، ارزیابی، نسخه‌بندی، حافظه، هزینه، کیفیت و عملکرد Agentهای هوش مصنوعی را مدیریت می‌کند.

تمام Agentهای سامانه از طریق این Domain فعالیت می‌کنند.

---

# 4.8.2 AI Architecture

```text
Editorial Workflow

↓

AI Orchestrator

↓

AI Agent

↓

Prompt Engine

↓

LLM Provider

↓

Response Validator

↓

Knowledge Update

↓

Content Domain
```

---

# 4.8.3 Tables Overview

| Table              | Purpose             |
| ------------------ | ------------------- |
| ai_agents          | Agentهای سیستم      |
| ai_models          | مدل‌های هوش مصنوعی  |
| ai_providers       | ارائه‌دهندگان مدل   |
| ai_prompts         | Promptهای اصلی      |
| ai_prompt_versions | نسخه‌های Prompt     |
| ai_executions      | اجرای Agentها       |
| ai_completions     | پاسخ‌های تولیدشده   |
| ai_embeddings      | Embeddingها         |
| ai_token_usage     | مصرف Token          |
| ai_quality_reviews | ارزیابی کیفیت خروجی |
| ai_memories        | حافظه Agentها       |

---

# 4.8.4 Table : ai_agents

## Business View

هر Agent دارای هویت مستقل، مسئولیت مشخص و تنظیمات اختصاصی است.

نمونه‌ها:

* Topic Agent
* Research Agent
* Writing Agent
* SEO Agent
* Image Agent
* Reviewer Agent
* Publisher Agent

---

## Logical Model

| Column            | Type        |
| ----------------- | ----------- |
| id                | UUID        |
| agent_name        | VARCHAR     |
| description       | TEXT        |
| agent_type        | VARCHAR     |
| default_model_id  | UUID        |
| enabled           | BOOLEAN     |
| max_parallel_jobs | INTEGER     |
| created_at        | TIMESTAMPTZ |
| updated_at        | TIMESTAMPTZ |

---

## Constraints

* Unique(agent_name)

---

## Indexes

```text
pk_ai_agents

uq_ai_agent_name

idx_ai_agent_type

idx_ai_agent_enabled
```

---

# 4.8.5 Table : ai_providers

## Purpose

مدیریت ارائه‌دهندگان مدل‌های هوش مصنوعی.

---

## Columns

| Column        | Type     |
| ------------- | -------- |
| id            | UUID     |
| provider_name | VARCHAR  |
| endpoint      | TEXT     |
| api_version   | VARCHAR  |
| enabled       | BOOLEAN  |
| priority      | SMALLINT |

---

## Sample Providers

```text
OpenAI

Anthropic

Google

xAI

OpenRouter

Local LLM
```

---

# 4.8.6 Table : ai_models

## Purpose

مدیریت مدل‌های قابل استفاده.

---

## Columns

| Column             | Type    |
| ------------------ | ------- |
| id                 | UUID    |
| provider_id        | UUID    |
| model_name         | VARCHAR |
| model_family       | VARCHAR |
| context_window     | INTEGER |
| supports_tools     | BOOLEAN |
| supports_images    | BOOLEAN |
| supports_reasoning | BOOLEAN |
| input_cost         | NUMERIC |
| output_cost        | NUMERIC |
| enabled            | BOOLEAN |

---

## Notes

قیمت‌ها به ازای هر یک میلیون Token ذخیره می‌شوند تا امکان مقایسه و تصمیم‌گیری خودکار وجود داشته باشد.

---

# 4.8.7 Table : ai_prompts

## Purpose

Promptهای منطقی سیستم.

---

## Columns

| Column             | Type        |
| ------------------ | ----------- |
| id                 | UUID        |
| prompt_name        | VARCHAR     |
| description        | TEXT        |
| current_version_id | UUID        |
| owner_agent_id     | UUID        |
| created_at         | TIMESTAMPTZ |

---

---

# 4.8.8 Table : ai_prompt_versions

## Purpose

نسخه‌های Prompt.

---

## Columns

| Column            | Type        |
| ----------------- | ----------- |
| id                | UUID        |
| prompt_id         | UUID        |
| version_number    | INTEGER     |
| system_prompt     | TEXT        |
| user_template     | TEXT        |
| temperature       | NUMERIC     |
| top_p             | NUMERIC     |
| max_output_tokens | INTEGER     |
| created_at        | TIMESTAMPTZ |

---

## Constraints

Unique(prompt_id, version_number)

---

## Notes

Promptها Immutable هستند.

---

# 4.8.9 Table : ai_executions

## Purpose

ثبت هر اجرای Agent.

---

## Columns

| Column            | Type        |
| ----------------- | ----------- |
| id                | UUID        |
| workflow_job_id   | UUID        |
| agent_id          | UUID        |
| prompt_version_id | UUID        |
| model_id          | UUID        |
| execution_status  | VARCHAR     |
| started_at        | TIMESTAMPTZ |
| finished_at       | TIMESTAMPTZ |
| execution_time_ms | INTEGER     |

---

## Sample Status

```text
Queued

Running

Completed

Failed

Cancelled
```

---

# 4.8.10 Table : ai_completions

## Purpose

ذخیره خروجی تولیدشده توسط مدل.

---

## Columns

| Column        | Type        |
| ------------- | ----------- |
| id            | UUID        |
| execution_id  | UUID        |
| response_text | TEXT        |
| finish_reason | VARCHAR     |
| safety_score  | NUMERIC     |
| quality_score | NUMERIC     |
| created_at    | TIMESTAMPTZ |

---

## Notes

این جدول خروجی خام مدل را نگهداری می‌کند.

پردازش‌های بعدی روی نسخه‌ای از این داده انجام می‌شوند.

---

# 4.8.11 Table : ai_embeddings

## Purpose

نگهداری اطلاعات Embedding.

---

## Columns

| Column             | Type        |
| ------------------ | ----------- |
| id                 | UUID        |
| entity_type        | VARCHAR     |
| entity_id          | UUID        |
| embedding_provider | VARCHAR     |
| embedding_model    | VARCHAR     |
| vector_dimension   | INTEGER     |
| vector_reference   | UUID        |
| created_at         | TIMESTAMPTZ |

---

## Notes

بردار عددی در Vector Database ذخیره می‌شود.

این جدول فقط Metadata را نگهداری می‌کند.

---

# 4.8.12 Table : ai_token_usage

## Purpose

ثبت مصرف Token و هزینه.

---

## Columns

| Column         | Type        |
| -------------- | ----------- |
| id             | UUID        |
| execution_id   | UUID        |
| input_tokens   | INTEGER     |
| output_tokens  | INTEGER     |
| total_tokens   | INTEGER     |
| estimated_cost | NUMERIC     |
| currency       | VARCHAR(10) |
| created_at     | TIMESTAMPTZ |

---

# 4.8.13 Table : ai_quality_reviews

## Purpose

ارزیابی کیفیت خروجی AI.

---

## Columns

| Column              | Type    |
| ------------------- | ------- |
| id                  | UUID    |
| completion_id       | UUID    |
| reviewer_agent      | VARCHAR |
| factual_score       | NUMERIC |
| seo_score           | NUMERIC |
| readability_score   | NUMERIC |
| hallucination_score | NUMERIC |
| overall_score       | NUMERIC |

---

# 4.8.14 Table : ai_memories

## Purpose

حافظه بلندمدت Agentها.

---

## Columns

| Column         | Type        |
| -------------- | ----------- |
| id             | UUID        |
| agent_id       | UUID        |
| memory_type    | VARCHAR     |
| summary        | TEXT        |
| related_entity | UUID        |
| last_used_at   | TIMESTAMPTZ |

---

# 4.8.15 Relationships

```text
AI Agent

↓

Prompt

↓

Prompt Version

↓

Execution

↓

Completion

↓

Quality Review

↓

Knowledge Update
```

---

# 4.8.16 Data Integrity Rules

* هر Execution دقیقاً متعلق به یک Agent است.
* هر Completion فقط به یک Execution تعلق دارد.
* Prompt فعال از طریق `current_version_id` تعیین می‌شود.
* Embedding فقط Metadata را در پایگاه داده رابطه‌ای ذخیره می‌کند.
* تمام Tokenها و هزینه‌ها باید قابل ردیابی باشند.

---

# 4.8.17 Performance Rules

* جدول `ai_executions` بر اساس زمان و وضعیت ایندکس می‌شود.
* Promptها Cache می‌شوند.
* Completionهای بزرگ قابلیت Archive دارند.
* Token Usage به‌صورت روزانه تجمیع می‌شود.
* Queryهای Agent باید کمتر از 100 میلی‌ثانیه پاسخ دهند.

---

# 4.8.18 Related Project Files

```text
database/
├── migrations/
│   └── 007_ai_domain.sql
├── schema.prisma
└── seeds/

packages/
├── ai/
│   ├── agents/
│   ├── domain/
│   ├── providers/
│   ├── prompts/
│   ├── repositories/
│   ├── embeddings/
│   └── evaluation/

docs/
└── volume-02/
    └── chapter-04-part-08-ai-domain-tables.md
```

---

# 4.8.19 Traceability

این بخش مبنای طراحی موارد زیر است:

* Chapter 6 — Vector Database Schema
* Chapter 10 — Event Schema
* Chapter 12 — Agent State Schema
* AI Orchestrator
* Prompt Engine
* Model Router
* Cost Optimizer
* Quality Assurance Agent

---

# 4.8.20 Architecture Decision Records

## ADR-086

تمام Agentهای سامانه در Domain مستقل `AI` مدیریت می‌شوند و هیچ Agentی مجاز به نگهداری وضعیت خارج از این Domain نیست.

---

## ADR-087

Promptها نسخه‌بندی شده و تغییرناپذیر (Immutable) هستند؛ هر تغییر تنها با ایجاد نسخه جدید انجام می‌شود.

---

## ADR-088

بردارهای Embedding در Vector Database ذخیره می‌شوند و پایگاه داده رابطه‌ای فقط Metadata و ارجاع آن‌ها را نگهداری می‌کند.

---

## ADR-089

مصرف Token، هزینه و زمان اجرای تمام درخواست‌های هوش مصنوعی باید به‌صورت کامل ثبت و قابل گزارش‌گیری باشد.

---

## ADR-090

تمام خروجی‌های مدل‌های هوش مصنوعی پیش از استفاده در سایر Domainها باید از مرحله ارزیابی کیفیت (Quality Review) عبور کنند.

---

# End of Chapter 4 — Part 8
