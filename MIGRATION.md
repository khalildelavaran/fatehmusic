# راه‌اندازی ذخیره‌سازی و اطلاع‌رسانی ثبت‌نام

## این تغییرات چیست؟

سایت قبلاً کاملاً استاتیک بود (`output: 'static'`، بدون سرور). حالا یک مسیر API واقعی
(`/api/register`) اضافه شده که ثبت‌نام‌ها را در **Cloudflare D1** ذخیره می‌کند و به کادر
آموزشگاه از طریق **Telegram** و/یا **ایمیل** خبر می‌دهد. برای همین، کل سایت به حالت
`output: 'server'` تغییر کرده (فقط همین یک صفحه واقعاً پویاست؛ بقیه‌ی صفحات با
`prerender = true` دقیقاً مثل قبل به‌صورت استاتیک ساخته می‌شوند).

**نسخه‌ها**: `package.json` روی Astro 7.0.6 + `@astrojs/cloudflare` 14.1.1 تنظیم و
دقیقاً با همین دو نسخه تست شده (نه نسخه‌ی قدیمی‌تری که ابتدا نوشته بودم).

### اگر الان با خطای مشابه گیر کرده‌اید

اگر قبلاً یک‌بار `npm install` را با نسخه‌ی اشتباه امتحان کرده‌اید، `node_modules` فعلی‌تان
احتمالاً در وضعیت ناسازگار مانده. یک نصب تمیز بزنید:

```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

## فایل‌های جدید/تغییریافته

- `package.json`, `astro.config.mjs`, `wrangler.jsonc` — **این‌ها را جایگزین نکنید**؛
  با نسخه‌ی واقعی پروژه‌تان merge کنید (مثلاً `lucide-astro` یا هر پکیج دیگری که دارید
  باید در `package.json` نهایی باقی بماند).
- `migrations/0001_create_registrations.sql` — ساختار جدول ثبت‌نام‌ها.
- `src/env.d.ts` — تایپ‌های TypeScript برای secretها.
- `src/server/notifications.ts` — ارسال پیام تلگرام/ایمیل.
- `src/pages/api/register.ts` — مسیر API اصلی.
- `src/scripts/registration/RegistrationApi.ts` و `RegistrationController.ts` — به‌روزرسانی
  شدند تا واقعاً به `/api/register` وصل شوند (قبلاً فقط در کنسول مرورگر چاپ می‌شد).

## مراحل راه‌اندازی

### ۱. نصب و ورود

```bash
npm install
npx wrangler login
```

### ۲. ساخت دیتابیس D1 واقعی

```bash
npx wrangler d1 create fatehmusic-db
```

خروجی این دستور یک `database_id` می‌دهد — آن را در `wrangler.jsonc` جای‌گزین
`REPLACE_WITH_YOUR_DATABASE_ID` کنید.

### ۳. اجرای migration

```bash
npm run db:migrate:local    # برای تست محلی
npm run db:migrate:remote   # برای دیتابیس واقعی روی Cloudflare
```

### ۴. تولید تایپ‌ها

```bash
npx wrangler types
```

### ۵. تنظیم اطلاع‌رسانی (اختیاری، هرکدام را که خواستید فعال کنید)

**تلگرام** (رایگان، چند دقیقه):
1. در تلگرام به `@BotFather` پیام دهید، دستور `/newbot` را بزنید و توکن را بگیرید.
2. ربات را به یک گروه/چت اضافه کنید و chat id آن را پیدا کنید (مثلاً با ارسال یک پیام و
   باز کردن آدرس `https://api.telegram.org/bot<TOKEN>/getUpdates`).
3. این دو مقدار را به‌صورت secret (نه در فایل تنظیمات) ثبت کنید:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

**ایمیل** (با Resend، سه هزار ایمیل رایگان در ماه):
1. در resend.com ثبت‌نام کنید و یک API key بسازید.
2. برای شروع سریع نیازی به تأیید دامنه نیست (فقط به ایمیلی که با آن ثبت‌نام کردید
   می‌رسد)؛ برای ارسال به آدرس دلخواه، دامنه‌ی خودتان را در پنل Resend تأیید کنید و
   `from` را در `src/server/notifications.ts` به‌روزرسانی کنید.

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put NOTIFY_EMAIL
```

اگر هیچ‌کدام از این secretها تنظیم نشوند، ثبت‌نام‌ها همچنان بدون مشکل در D1 ذخیره
می‌شوند؛ فقط اطلاع‌رسانی به‌صورت خاموش نادیده گرفته می‌شود.

### ۶. اضافه کردن `prerender = true` به صفحات موجود

چون کل سایت به `output: 'server'` تغییر کرده، هر صفحه‌ی موجود (`index.astro`,
`about.astro`, `contact.astro`, `courses.astro`, `courses/[slug].astro`, `instructors.astro`,
`instructors/[slug].astro`, `gallery.astro`, و غیره) باید همین خط را به ابتدای
frontmatter (بعد از `---`) اضافه کند تا دقیقاً مثل قبل به‌صورت استاتیک build شود:

```astro
export const prerender = true;
```

`src/pages/api/register.ts` تنها استثناست و از قبل `prerender = false` دارد.

### ۷. تست محلی و انتشار

```bash
npm run dev       # astro dev با D1 محلی شبیه‌سازی‌شده
npm run deploy    # build + انتشار روی Cloudflare Workers
```

## نکات مهم

- تمام مقادیر ثبت‌نام در سمت سرور دوباره اعتبارسنجی می‌شوند (هیچ‌وقت فقط به اعتبارسنجی
  سمت مرورگر اعتماد نکنید).
- کد پیگیری در سرور تولید و برای یکتا بودن با دیتابیس بررسی می‌شود.
- ذخیره‌سازی در D1 همیشه اولویت اول است؛ اگر اطلاع‌رسانی (تلگرام/ایمیل) با خطا مواجه
  شود، ثبت‌نام همچنان با موفقیت ذخیره شده و از دست نمی‌رود.
- برای دیدن ثبت‌نام‌ها: `npx wrangler d1 execute fatehmusic-db --remote --command "SELECT * FROM registrations ORDER BY created_at DESC;"`

## یک باگ نامرتبط که حین تست پیدا شد (خارج از این تسک)

هنگام build گرفتن با تنظیمات جدید، این خطا در `src/pages/about.astro` دیده شد:

```
No matching export in "AboutFAQ.astro" for import "faqs"
```

یعنی `about.astro` سعی می‌کند `{ faqs }` را از `AboutFAQ.astro` وارد کند، اما آن
کامپوننت چنین چیزی را export نمی‌کند. غیرمرتبط با ثبت‌نام است و برای همین تغییرش
ندادم؛ اگر خواستید جدا درستش می‌کنم.
