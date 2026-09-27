# GSC و حلقه‌ی بسته‌ی SEO

## داده‌های لازم

Worker از این Secretها استفاده می‌کند:

- GSC_CLIENT_EMAIL
- GSC_PRIVATE_KEY
- GSC_SITE_URL

Service Account باید دسترسی مشاهده به Property آموزشگاه در Google Search Console داشته باشد.

## چرخه‌ی روزانه

1. Search Console برای دو پنجره‌ی ۲۸روزه‌ی اخیر و قبلی همگام می‌شود.
2. بلافاصله بعد از sync، Topic Discovery با impressionهای واقعی queryها اجرا می‌شود.
3. صف محتوایی بر اساس پوشش، intent، ارتباط تجاری، محلی بودن و demand امتیاز می‌گیرد.
4. Worker از بهترین topic تأییدشده یک draft تولید می‌کند.
5. draft به‌عنوان یک SEO action ثبت می‌شود.
6. پس از publish، action به وضعیت published می‌رود.
7. syncهای بعدی عملکرد URL منتشرشده را ثبت می‌کنند.
8. داشبورد CTR، position و impressions را بین پنجره‌های اندازه‌گیری نشان می‌دهد.

## نکته درباره‌ی search volume

Search Console impression معادل حجم جستجوی ماهانه نیست. موتور آن را به‌عنوان تقاضای مشاهده‌شده استفاده می‌کند و تا وقتی یک provider واقعی keyword research متصل نشده، volume یا difficulty ساختگی تولید نمی‌کند.

## ابعاد GSC

ذخیره‌سازی جدید country، device و search appearance را نیز پشتیبانی می‌کند. scoring فقط ردیف canonical بدون breakdown را می‌خواند تا یک query/page به‌خاطر چند dimension دوباره شمرده نشود.

برای ذخیره‌ی breakdownهای country/device می‌توان Secret/Variable زیر را فعال کرد:

GSC_SYNC_BREAKDOWNS=1

## Production audit

npm run seo:live-audit از build audit جداست و status code، canonical، robots، sitemap و redirects نسخه‌ی آنلاین را بررسی می‌کند. GitHub Actions این audit را روزانه اجرا می‌کند.
