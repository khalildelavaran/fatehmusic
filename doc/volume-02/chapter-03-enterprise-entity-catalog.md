<!-- ====================================================================== -->

<!-- Document : Volume 02 - Enterprise Data Architecture                    -->

<!-- Chapter  : 03                                                          -->

<!-- Title    : Enterprise Entity Catalog                                   -->

<!-- File     : docs/volume-02/chapter-03-enterprise-entity-catalog.md      -->

<!-- Author   : AI Publishing Platform                                      -->

<!-- Version  : 1.0                                                         -->

<!-- Status   : Draft                                                       -->

<!-- ====================================================================== -->

# Chapter 3

# Enterprise Entity Catalog

---

# 3.1 Purpose

هدف این فصل، تعریف تمامی Entityهای سامانه و روابط بین آن‌ها است.

این Chapter مرجع اصلی برای طراحی:

* PostgreSQL
* Neo4j
* Vector Database
* API
* Eventها
* Repositoryها
* Agentها

خواهد بود.

---

# 3.2 Entity Classification

تمام Entityهای سامانه در چهار گروه تقسیم می‌شوند.

```text
Core Entities

Business Entities

System Entities

AI Entities
```

---

# 3.3 Core Business Model

```text
Organization

│

├── Teacher

├── Course

├── Instrument

├── Category

├── Article

├── FAQ

├── Author

└── Image
```

---

# 3.4 Content Domain

### Aggregate Root

```
Article
```

Child Entityها

* Section
* FAQ
* Image
* Reference
* InternalLink
* ExternalLink
* SchemaMarkup

Value Objectها

* Slug
* MetaTitle
* MetaDescription
* ReadingTime
* SEOScore
* QualityScore

---

# 3.5 Course Domain

Aggregate Root

```
Course
```

Childها

* Sessions
* Pricing
* Schedule
* Gallery

Value Objects

* CourseCode
* Duration
* Tuition
* AgeRange

---

# 3.6 Teacher Domain

Aggregate Root

```
Teacher
```

Child Entityها

* Biography
* Skills
* Certificates
* Gallery
* SocialLinks

Value Objects

* FullName
* Phone
* Email
* Experience

---

# 3.7 Instrument Domain

Aggregate Root

```
Instrument
```

Childها

* Family
* Difficulty
* Image

---

# 3.8 Category Domain

Category

دارای ساختار درختی است.

```text
Music

├── Guitar

├── Piano

├── Violin

├── Vocal

└── Children
```

---

# 3.9 Knowledge Domain

Entityها

* Topic
* Entity
* Keyword
* Concept
* Intent
* Cluster
* Source
* Citation

---

# 3.10 SEO Domain

Entityها

* Keyword
* SearchIntent
* SERPFeature
* Competitor
* Ranking
* Sitemap
* Redirect

---

# 3.11 Analytics Domain

Entityها

* Impression
* Click
* Session
* Conversion
* Event
* CTR
* Engagement

---

# 3.12 AI Domain

Entityها

* Agent
* Prompt
* PromptVersion
* AIModel
* Completion
* Embedding
* TokenUsage

---

# 3.13 Workflow Domain

Entityها

* Workflow
* WorkflowStep
* Job
* Task
* Queue
* RetryPolicy

---

# 3.14 Policy Domain

Entityها

* Policy
* Rule
* Exception
* Approval
* Violation

---

# 3.15 Decision Domain

Entityها

* Decision
* DecisionContext
* DecisionResult
* Confidence
* RiskAssessment

---

# 3.16 Configuration Domain

Entityها

* Setting
* SecretReference
* Environment
* FeatureFlag

---

# 3.17 Shared Entities

بین تمام Domainها

مشترک هستند.

* UUID
* Timestamp
* User
* AuditLog
* Attachment
* Tag

---

# 3.18 Aggregate Map

```text
Article
│
├── Section
├── FAQ
├── Image
├── Links
└── Schema

Teacher
│
├── Biography
├── Skill
└── Gallery

Course
│
├── Pricing
├── Session
└── Schedule
```

---

# 3.19 Entity Relationships

```text
Teacher

↓

teaches

↓

Course

↓

uses

↓

Instrument

↓

has

↓

Articles
```

---

# 3.20 Entity Lifecycle

هر Entity دارای Lifecycle است.

```text
Draft

↓

Validated

↓

Active

↓

Archived

↓

Deleted
```

---

# 3.21 Entity Identity

تمام Entityها باید دارای:

* UUID
* CreatedAt
* UpdatedAt
* Version
* Owner
* Status

باشند.

---

# 3.22 Repository Mapping

| Aggregate  | Repository           |
| ---------- | -------------------- |
| Article    | ArticleRepository    |
| Course     | CourseRepository     |
| Teacher    | TeacherRepository    |
| Instrument | InstrumentRepository |
| Policy     | PolicyRepository     |
| Workflow   | WorkflowRepository   |

---

# 3.23 Domain Ownership

| Entity   | Domain    |
| -------- | --------- |
| Article  | Content   |
| Teacher  | Content   |
| Course   | Content   |
| Keyword  | SEO       |
| Topic    | Knowledge |
| Prompt   | AI        |
| Workflow | Workflow  |
| Decision | Decision  |

---

# 3.24 Validation Rules

تمام Entityها باید:

* دارای UUID باشند.
* Version داشته باشند.
* Audit شوند.
* از قوانین Domain تبعیت کنند.
* Aggregate Root را دور نزنند.

---

# 3.25 Related Project Files

```text
docs/
└── volume-02/
    └── chapter-03-enterprise-entity-catalog.md

packages/
├── domain/
├── repositories/
├── entities/
├── value-objects/
└── shared/

schemas/
├── entities/
└── validation/
```

---

# 3.26 Traceability

این Chapter مبنای طراحی فصل‌های زیر است.

* Chapter 4 — Relational Database Schema
* Chapter 5 — Knowledge Graph Schema
* Chapter 6 — Vector Database Schema
* Chapter 11 — API DTO Schema
* Chapter 12 — Agent State Schema

---

# 3.27 Architecture Decision Records

## ADR-046

تمام داده‌های سامانه به صورت **Aggregate Root** مدل‌سازی می‌شوند.

---

## ADR-047

هر Aggregate فقط یک Repository خواهد داشت.

---

## ADR-048

تمام Entityها دارای UUID، Version و Audit Metadata هستند.

---

## ADR-049

تمام روابط بین Aggregateها از طریق شناسه (Reference) انجام می‌شود و نه نگهداری مستقیم اشیاء.

---

## ADR-050

Entity Catalog مرجع اصلی تولید Schemaها، Repositoryها، DTOها و مدل‌های پایگاه داده خواهد بود.

---

# End of Chapter 3
