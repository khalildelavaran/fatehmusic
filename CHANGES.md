# تغییرات این بسته

همه فایل‌ها raw هستن (نه patch) — چون محیط ویندوزی با CRLF مشکل پچ داره.
مسیر هر فایل داخل zip دقیقاً همون مسیرش توی ریپو هست؛ فقط جایگزین کن.

---

## ۱. جریان ثبت‌نام (auto-skip + لینک مستقیم)

فایل‌ها:
- `src/scripts/registration/RegistrationController.ts` (بازنویسی منطق انتخاب/رزولوشن)
- `src/scripts/registration/RegistrationRenderer.ts` (متدهای جدید: نوار خلاصه، فیلتر ساز بر اساس استاد)
- `src/scripts/registration/RegistrationStore.ts` (فیلد `auto` روی instructor/schedule)
- `src/scripts/registration/RegistrationUtils.ts` + `RegistrationUtils.test.ts` (تابع `resolveSingleOption` + تست)
- `src/components/registration/RegistrationFlow.astro` (کانتینر نوار خلاصه)
- `src/components/registration/steps/InstrumentStep.astro` + `cards/InstrumentCard.astro` (data attribute برای فیلتر)
- `src/components/registration/styles/registration.css` (استایل نوار خلاصه + بج «انتخاب خودکار»)
- `src/pages/courses/[slug].astro` (دکمه ثبت‌نام → `?course=slug`)
- `src/pages/instructors/[slug].astro` (دکمه ثبت‌نام جدید → `?instructor=slug`)

منطق:
- اگه دوره فقط ۱ استاد فعال داشته باشه، یا استاد فقط ۱ زمان داشته باشه، بدون کلیک انتخاب می‌شه و می‌ره مرحله بعد. محتوای واقعی مرحله (کارت استاد/زمان) همچنان رندر می‌شه تا اگه هنرجو با دکمه «بازگشت» برگرده، چیز خالی نبینه.
- نوار «ساز · استاد · زمان» بعد از هر تغییر (دستی یا خودکار) آپدیت می‌شه؛ کنار مقادیر خودکار یه برچسب «پیشنهادی» کوچیک هست.
- `/register?course=slug` یا `/register?instructor=slug` مرحله خوش‌آمدگویی رو رد می‌کنه و می‌ره سراغ رزولوشن. اگه یه استاد چند دوره تدریس کنه، مرحله انتخاب ساز فقط دوره‌های همون استاد رو نشون می‌ده.
- روی نمونه واقعی داده‌ها تست شد: از ۲۳ دوره، ۲۰ تاشون ۱ استاد دارن؛ از ۱۴ استاد، ۹ تاشون ۱ زمان دارن؛ ۱۱ دوره کاملاً تک‌گزینه‌ان (صفر کلیک تا فرم مشخصات).

---

## ۲. یکپارچه‌سازی استایل گواهینامه/کتاب

فایل‌ها: `src/pages/admin/certificates.astro`, `src/styles/admin/certificates.css`, `src/pages/admin/books.astro`

پیدا شد و درست شد:
- باکس جستجوی `/admin/certificates` کلاس بی‌ربط خودش رو داشت (radius ۱۰px، بدون افکت فوکوس طلایی) و بر خلاف فرم پایین همون صفحه، قاب/کارت هم نداشت. حالا از `.admin-form` مشترک استفاده می‌کنه (همون چیزی که posts/topics/books ازش استفاده می‌کنن).
- برچسب بالای `/admin/books` اشتباهاً «گواهینامه‌ها» بود (ظاهراً کپی از certificates.astro) → شد «مدیریت کتاب‌ها».
- ایمپورت بلااستفاده‌ی `topics.css` از certificates.astro حذف شد.

نکته جانبی: `AGENTS.md` به `docs/00_AI_CONTEXT.md`, `01_PROJECT_MEMORY.md` و... اشاره می‌کنه و می‌گه «مستندسازی منبع حقیقت است»، ولی پوشه‌ی `docs/` اصلاً توی ریپو وجود نداره (نه الان، نه توی تاریخچه گیت). چیزی نساختم چون نمی‌خواستم محتوا حدس بزنم — اگه می‌خوای شروعش کنم بگو.

---

## ۳. تشخیص خودکار کد ملی در فرم گواهینامه

فایل‌ها: `src/scripts/admin/certificates.js`, `src/pages/admin/certificates.astro`

با انتخاب هنرجو از نتایج جستجو، فیلد «کد ملی هنرجو» از `student_national_code` همون ثبت‌نام پر می‌شه (این فیلد از قبل توی پاسخ API بود، فقط استفاده نمی‌شد). یه یادداشت کوچیک زیرش نشون می‌ده از ثبت‌نام گرفته شده؛ اگه ثبت‌نامی قدیمی‌تر از این فیلد باشه و خالی باشه، هشدار می‌ده که دستی وارد بشه. فیلد همچنان قابل ویرایشه.

---

## ۴. بج ثبت‌نام روی کارت‌های دوره و استاد

فایل‌ها:
- `src/components/Courses.astro`, `src/styles/courses.css`
- `src/components/Instructors.astro`, `src/styles/instructors.css`

هر دو کارت (توی `/courses` و `/instructors`، همون کامپوننتی که توی صفحه اصلی هم استفاده می‌شه) از یک `<a>` بزرگ به یک `<div>` تغییر کردن، چون یه `<a>` نمی‌تونه `<a>` دیگه‌ای داخلش داشته باشه:

- خود عکس یه لینک جداست (`.course-image-link` / `.instructor-image-link`) → صفحه دوره/استاد
- عنوان هم یه لینک جداست (`.course-title-link` / `.instructor-title-link`) → همون صفحه
- بج «ثبت‌نام» یه لینک سومه، شناور روی گوشه‌ی پایین‌چپ عکس (همون فاصله ۱۸px که بج «مدیر آموزشگاه» گوشه‌ی بالا‌راست داره)، به `?course=slug` یا `?instructor=slug` می‌ره — دقیقاً همون پارامترهایی که `RegistrationController` توی بخش ۱ برای رد کردن مراحل ازش استفاده می‌کنه
- استایل بج: پیش‌فرض شیشه‌ای نیمه‌شفاف (`rgba(11,11,11,.4)` + `backdrop-filter:blur`)، موقع هاور با انیمیشن پر می‌شه از طلایی سایت (`rgba(212,175,55,.95)`) و کمی بالا میاد (`translateY(-4px) scale(1.05)`)
- بقیه‌ی افکت‌های هاور کارت (بزرگ‌شدن عکس، درخشش لبه) دست‌نخورده موند — چون فقط تگ بیرونی از `<a>` به `<div>` عوض شد، نه کلاسش

---

## تأیید

- `npm run test` → ۴۸/۴۸ (شامل تست جدید resolveSingleOption + یه فایل تست قدیمی ثبت‌نام که در vitest.config.ts include نبود و بی‌صدا اجرا نمی‌شد — این هم درست شد)
- `npm run check` → با git stash مقایسه شد (هم قبل از بخش ۱-۳ و هم بعد از بخش ۴)؛ همون ۹ خطای از قبل موجود (بی‌ربط: worker.ts, login.astro, admin-auth.ts, و یه fbq قدیمی در همین کنترلر) هنوز هست، صفر خطای جدید
- `npm run build` → کامل و بدون خطا؛ حضور `card-register-badge` توی خروجی کامپایل‌شده‌ی هر دو کامپوننت هم چک شد

`package-lock.json` توی این zip نیست — فقط برای نصب و اجرای تست‌ها لوکال ران شد، چیزی به dependencies اضافه نشده.
