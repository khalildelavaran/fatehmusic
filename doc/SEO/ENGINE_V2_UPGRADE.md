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
- برای هر action علاوه بر ترافیک کل صفحه، یک semantic query cohort از Queryهای هم‌موضوع با هدف action ثبت می‌شود.
- cohort با همان semantic normalization و featureهای Query engine ساخته می‌شود و outcome مستقل خود را دارد.
- این خروجی causal attribution آماری ادعا نمی‌کند.

### 9. Evidence-aware decision guardrails
- priority اکنون علاوه بر scoring دارای یک decisionGuard است.
- پوشش ناقص یا freshness پایین GSC/market می‌تواند سقف امتیاز تصمیم را کاهش دهد.
- شواهد مستقل بر اساس خانواده منبع شمارش می‌شوند؛ GSC Signal و GSC Ownership یک منبع مستقل محسوب می‌شوند.
- reason codeهای guard برای auditability داخل scoreBreakdown.decisionGuard نگهداری می‌شوند.

### 10. Position-aware CTR Intelligence
- CTR با benchmark همان bucket رتبه مقایسه می‌شود.
- benchmark فقط با sample کافی وارد تصمیم می‌شود.
- ctrGap، ctrRatioToBenchmark و اندازه نمونه برای auditability نگه‌داری می‌شوند.
- در صورت ناکافی بودن benchmark، fallback قبلی حفظ می‌شود.

### 11. GSC Query Intent Evidence
- intent Queryهای واقعی GSC به‌صورت impression-weighted استخراج می‌شود.
- intent واقعی جستجو با searchIntent محتوای پیشنهادی مقایسه می‌شود.
- توافق intent confidence را افزایش و conflict قوی confidence را کاهش می‌دهد.
- mixed intent به‌عنوان ambiguity سیگنال داده می‌شود.
### 12. Competitive keyword gap intelligence
- competitor keyword gaps از دادهٔ واقعی رقیب استخراج می‌شوند و keywordهای موجود در target GSC/organic set حذف می‌شوند.
- gapScore فقط بر اساس volume، difficulty و تعداد competitor domains موجود محاسبه می‌شود و دادهٔ مصنوعی تولید نمی‌کند.
- competitor evidence به‌صورت source family مستقل وارد evidenceStrength می‌شود.
- freshness رقابتی نیز می‌تواند decisionGuard را محدود کند.

### 13. Coverage & freshness hardening
- سقف ingestion استاندارد GSC افزایش یافته و truncation همچنان صریح ثبت می‌شود.
- Query Ownership از محدودیت نمایشی داشبورد جدا شده و برای long-tail ظرفیت بیشتری دارد.
- freshness داده market در evidence و priority لحاظ می‌شود.
- rendered-site measured score اکنون در CI اجرا می‌شود تا کیفیت خروجی build نیز کنار unit/integration checks قابل مشاهده باشد.

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