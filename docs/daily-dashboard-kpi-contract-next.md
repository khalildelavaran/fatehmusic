# مسیر اجرای KPI داشبورد روزانه

قرارداد KPI در `daily-dashboard-kpi-contract.md` منبع حقیقت شمارش‌های یکتا را مشخص می‌کند.

## وضعیت فعلی

- API داشبورد روزانه `unique_students`، `unique_present_students` و `unique_pending_students` را برمی‌گرداند.
- Command Center از KPIهای authoritative استفاده می‌کند.
- بازه زمانی Command Center دیگر به `16:00–22:00` محدود نیست و بر اساس جلسات همان روز تنظیم می‌شود.

## گام بعدی

`daily-dashboard.js` باید مستقیماً `metrics` پاسخ API را در KPIهای خلاصه مصرف کند؛ شمارش `flatMap(session.students)` فقط برای شمارش‌های عملیاتی مجاز است.

پس از آن، منطق تداخل در کنترلر اصلی باید با دو منبع مستقل Backend هماهنگ شود:

- تداخل مدرس
- تداخل اتاق

نباید یک تداخل فقط وقتی نمایش داده شود که هر دو شرط همزمان برقرار باشند.
