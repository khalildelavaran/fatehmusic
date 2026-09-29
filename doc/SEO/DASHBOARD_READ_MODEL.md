# SEO Intelligence Dashboard Read Model

## هدف

مسیر `/admin/content-strategy` فقط یک پنل مشاهده و کنترل است. این مسیر نباید برای هر درخواست، موتور کامل SEO Intelligence را از ابتدا اجرا کند.

موتور کامل در `src/seo/v2/orchestrator.js` منبع تصمیم‌گیری است و می‌تواند در workflowهای زمان‌بندی‌شده، build/CI یا عملیات صریح اجرا شود. پنل مدیریت از `src/seo/v2/dashboard-intelligence.js` یک Read Model سبک دریافت می‌کند.

## چرا

Astro با Cloudflare برای صفحات SSR، HTML را در Worker به‌صورت on-demand تولید می‌کند. اجرای semantic clustering، GSC ownership، cannibalization، competitive gaps و ساخت graph در مسیر GET باعث مصرف CPU غیرضروری و در صورت عبور از limit موجب `exceededCpu` می‌شود.

در Read Model:

- تصمیم‌ها از `content_topics` و Snapshotهای ذخیره‌شده خوانده می‌شوند.
- سیگنال‌های GSC به‌صورت aggregate و با سقف نمایش مشخص خوانده می‌شوند.
- Query ownership از دادهٔ ذخیره‌شده ساخته می‌شود و وضعیت truncation صریح است.
- Snapshotهای Ahrefs با `target` و `country` پیکربندی‌شدهٔ همان سایت محدود می‌شوند.
- دادهٔ بازار برای پنل bounded است؛ منبع کامل Snapshot دست‌نخورده باقی می‌ماند.
- execution کامل `buildSEOIntelligence` هرگز بخشی از GET این صفحه نیست.

## اصل معماری

```
Persistent Sources
  ├─ GSC snapshots
  ├─ Ahrefs snapshots
  └─ content_topics / seo_action_log
           │
           ▼
   SEO Decision Engine
   src/seo/v2/orchestrator.js
           │
           ▼
     persisted decisions
           │
           ▼
 Dashboard Read Model
 src/seo/v2/dashboard-intelligence.js
           │
           ▼
 /admin/content-strategy
```

## کیفیت و محدودیت

Read Model عمداً جایگزین Decision Engine نیست. بعضی تحلیل‌های سنگین، مانند semantic cannibalization لحظه‌ای، برای request پنل محاسبه نمی‌شوند. UI باید این وضعیت را شفاف نمایش دهد و مقدار صفر را به‌عنوان «عدم وجود تعارض» تفسیر نکند.

هر تغییری که `buildSEOIntelligence()` را به SSR این صفحه برگرداند باید به‌عنوان regression عملکردی تلقی شود.

## تست

`src/seo/v2/dashboard-intelligence.test.js` قرارداد اصلی Read Model را با D1 mock پوشش می‌دهد و تضمین می‌کند خروجی bounded، دادهٔ ownership و متادیتای Snapshot حفظ شود.
