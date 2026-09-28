# SEO Intelligence Engine — Upgrade Notes

## Scope

این فاز موتور SEO/GEO را از یک مجموعه ابزارهای مستقل به یک لایه تصمیم‌گیری متصل‌تر ارتقا می‌دهد.

## New core layers

### 1. Canonical Semantic Query Layer
- `src/seo/helpers/query.js`
- نرمال‌سازی واحد Queryهای فارسی
- حذف توکن‌های عمومی برای تحلیل ownership
- تشخیص Queryهای brand-navigation
- phrase matching مبتنی بر مرز واژه

### 2. GSC Intelligence
- Query Ownership با aggregation قبل از threshold
- وضعیت مالکیت: `STABLE`, `SPLIT`, `EMERGING`, `NO_OWNER`
- کیفیت سیگنال: `HIGH`, `MEDIUM`, `LOW`, `TRACE`
- کیفیت داده GSC شامل completeness، freshness و truncation
- جداسازی snapshotهای current/previous

### 3. Market Intelligence
- `src/seo/v2/providers/ahrefs.js`
- `src/seo/v2/market-opportunities.js`
- اتصال Ahrefs به opportunity scoring
- semantic matching بین بازار و Queryهای واقعی GSC
- کشف `STRIKING_DISTANCE`, `CONTENT_EXPANSION`, `MARKET_ONLY` و سایر وضعیت‌ها
- بدون ساخت volume/difficulty جعلی

### 4. Explicit Knowledge Graph
- `src/seo/v2/knowledge-graph.js`
- Node/Edge model مستقل از JSON-LD
- relation traversal
- validation
- اتصال Organization، LocalBusiness، Course، Person و Article

### 5. Graph → Schema Compiler
- `src/seo/schema/compiler.js`
- تبدیل رابطه‌های Graph به referenceهای Schema.org
- عدم overwrite کردن relationshipهای از قبل معتبر

### 6. Schema Registry
- `src/seo/schema/registry.js`
- type registry مرکزی
- validation
- build-time rejection برای Schema type ناشناس

### 7. Diagnostics
- `src/seo/v2/diagnostics.js`
- weighted category scores
- evidence coverage
- issue severity
- recommendation generation
- AI/GEO readiness signals

### 8. Closed Loop Measurement
- `src/seo/v2/action-attribution.js`
- تفسیر before/after برای CTR، position و impressions
- تفکیک `POSITIVE`, `NEGATIVE`, `NEUTRAL`, `INSUFFICIENT_DATA`
- این خروجی causal attribution آماری ادعا نمی‌کند.

## Decision model

Opportunity scoring اکنون می‌تواند هم‌زمان از این شواهد استفاده کند:

`Content Priority + GSC Signal + Query Ownership + Intent Confidence + Market Signal + Data Quality + Cannibalization`

همچنین `decisionConfidence` جدا از `priority` نگه داشته می‌شود.

## Quality gates

هر تغییر اصلی همراه با regression/unit tests اضافه شده است.

CI باید این مراحل را سبز کند:
- dependency audit
- type check
- unit tests
- production build
- rendered-site SEO audit

## Important limitations

- `decisionConfidence` یک evidence score deterministic است، نه احتمال آماری.
- Ahrefs market score ابزار اولویت‌بندی است، نه پیش‌بینی رتبه یا ترافیک.
- GSC هر snapshot می‌تواند در صورت رسیدن به سقف ingestion truncated باشد؛ این وضعیت اکنون در data quality منعکس می‌شود.
- Diagnostics بدون evidence لازم، score را مصنوعی بالا نمی‌برد و coverage را جداگانه گزارش می‌کند.