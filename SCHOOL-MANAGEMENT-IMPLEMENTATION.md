# Fateh Music Academy — School Management System
## سند جامع پیاده‌سازی قابلیت‌های جدید

**Repository:** `khalildelavaran/fatehmusic`  
**Domain:** `fatehmusic.ir`  
**Application:** آموزشگاه موسیقی فاتح  
**Language:** فارسی  
**UI Direction:** RTL  

---

# 1. هدف

هدف این سند توسعه پروژه فعلی `fatehmusic` به یک **سامانه جامع مدیریت آموزشگاه موسیقی** است.

سیستم باید چرخه کامل مدیریت هنرجو را پوشش دهد:

```text
ثبت‌نام → پرونده هنرجو → قرارداد → دوره / ساز → Instructor → کلاس → برنامه کلاسی → جلسات → حضور و غیاب → شهریه و پرداخت → تمرین → ارزیابی → پیشرفت → اتمام دوره → گواهینامه
```

تمام قابلیت‌های موجود پروژه باید حفظ شوند.

---

# 2. قانون بسیار مهم قبل از شروع

قبل از هرگونه تغییر در کد:

1. کل Repository را بررسی کن.
2. ساختار فعلی `src` را بررسی کن.
3. تمام migrationهای موجود را بررسی کن.
4. مدل‌های فعلی را پیدا کن.
5. APIهای موجود را بررسی کن.
6. Authentication و Authorization فعلی را بررسی کن.
7. ساختار فعلی `Student` را بررسی کن.
8. ساختار فعلی `Instructor` را بررسی کن.
9. ساختار فعلی `Course` را بررسی کن.
10. ساختار `Branch` را بررسی کن.
11. Registration، Contract و Certificate را بررسی کن.
12. از ایجاد مدل یا جدول duplicate خودداری کن.

**اگر موجودیتی از قبل در پروژه وجود دارد، مدل جدیدی برای آن نساز؛ همان مدل موجود را توسعه بده.**

به‌خصوص:

```text
Instructor
Student
Course
Branch
Registration
Contract
Certificate
User / Authentication
```

نباید بدون بررسی دوباره ساخته شوند.

---

# 3. اصطلاحات رسمی پروژه

در کل پروژه از اصطلاحات زیر استفاده شود:

| مفهوم | نام صحیح |
|---|---|
| مدرس | `Instructor` |
| هنرجو | `Student` |
| دوره | `Course` |
| شعبه | `Branch` |
| کلاس | `Class` |
| جلسه | `Class Session` |
| حضور و غیاب | `Attendance` |
| شهریه | `Invoice` |
| پرداخت | `Payment` |
| ارزیابی | `Evaluation` |
| تمرین | `Assignment` |
| گواهینامه | `Certificate` |

**هرگز از `Teacher` در کد جدید استفاده نکن.**

---

# 4. نقش‌های سیستم

Roleهای فعلی پروژه ابتدا بررسی شوند.

در صورت نیاز:

```text
ADMIN
INSTRUCTOR
STUDENT
```

در آینده امکان اضافه‌شدن:

```text
SUPER_ADMIN
BRANCH_MANAGER
ACCOUNTANT
RECEPTION
```

وجود دارد.

## ADMIN

دسترسی کامل به Students، Instructors، Courses، Classes، Branches، Schedule، Attendance، Finance، Evaluations، Assignments، Certificates، Reports و Settings.

## INSTRUCTOR

فقط اطلاعات مرتبط با خودش: Dashboard، Classes، Students، Schedule، Attendance، Evaluations، Assignments، Educational Notes و Profile.

## STUDENT

فقط اطلاعات خودش: Dashboard، Profile، Classes، Schedule، Attendance، Tuition، Payments، Assignments، Evaluations، Certificates، Notifications و Password.

---

# 5. فاز صفر — بررسی Architecture

قبل از شروع توسعه، یک گزارش داخلی از ساختار پروژه تهیه کن.

بررسی کن:

```text
src/
├── pages/
├── components/
├── layouts/
├── scripts/
├── server/
├── styles/
└── ...
```

و مشخص کن:

```text
Authentication:
Authorization:
Database:
API Pattern:
Server Pattern:
UI Pattern:
Existing Student Model:
Existing Instructor Model:
Existing Course Model:
Existing Branch Model:
Existing Registration Model:
Existing Certificate Model:
```

بعد از این بررسی، معماری قابلیت‌های جدید را با معماری موجود تطبیق بده.

---

# 6. فاز اول — پرونده جامع Student

اگر `Student` از قبل وجود دارد، آن را توسعه بده.

هدف این است که هر هنرجو یک پرونده کامل داشته باشد.

ساختار منطقی:

```text
Student
│
├── Personal Information
├── Contact Information
├── Registration
├── Contract
├── Courses
├── Instructors
├── Classes
├── Attendance
├── Invoices
├── Payments
├── Assignments
├── Evaluations
└── Certificates
```

اطلاعات احتمالی:

```text
first_name
last_name
national_code
phone
email
birth_date
address
emergency_contact
notes
status
```

اگر این فیلدها از قبل وجود دارند، duplicate ایجاد نکن.

---

# 7. فاز دوم — Instructor Management

اگر `Instructor` در پروژه وجود دارد، همان موجودیت استفاده شود.

مدیریت Instructor شامل نام، تماس، ایمیل، تخصص، سازهای آموزشی، بیوگرافی، شعبه و وضعیت فعال/غیرفعال است.

Admin بتواند Instructor را Create، Read، Update و Deactivate کند.

حذف فیزیکی Instructor در صورت وجود سابقه آموزشی توصیه نمی‌شود و بهتر است `is_active = false` استفاده شود.

---

# 8. ارتباط Student و Instructor

اگر معماری فعلی رابطه مستقیم را پشتیبانی نمی‌کند، رابطه مناسب ایجاد شود.

یک Student ممکن است در طول زمان چند Instructor داشته باشد و یک Instructor نیز چند Student داشته باشد.

رابطه باید امکان مشخص‌کردن `start_date`، `end_date`، `course` و `status` را داشته باشد.

---

# 9. فاز سوم — Classes

Class باید از Course مستقل باشد:

```text
Course = چه چیزی آموزش داده می‌شود
Class = چه کسانی، با کدام Instructor، در چه زمان و مکانی آموزش می‌بینند
```

Class باید بتواند شامل `title`، `course`، `instructor`، `branch`، `room`، `class_type`، `capacity`، `level`، `start_date`، `end_date` و `status` باشد.

Class Type:

```text
individual
group
workshop
online
```

در صورت وجود Course/Branch فعلی، از همان Foreign Keyها استفاده شود.

---

# 10. فاز چهارم — Class Students

هر Class باید فهرست هنرجویان خود را داشته باشد و رابطه باید امکان ثبت `enrollment_date` و `status` را داشته باشد.

یک Student نباید دوبار در یک Class فعال ثبت شود.

---

# 11. فاز پنجم — Weekly Schedule

برای هر Class برنامه هفتگی شامل Day، Start Time، End Time، Branch و Room ایجاد شود.

روزهای هفته:

```text
شنبه
یکشنبه
دوشنبه
سه‌شنبه
چهارشنبه
پنجشنبه
جمعه
```

---

# 12. جلوگیری از Schedule Conflict

سیستم باید قبل از ذخیره Schedule تداخل را بررسی کند.

نباید یک Instructor همزمان دو Class داشته باشد و نباید یک Room در یک Branch همزمان به دو Class اختصاص داده شود.

---

# 13. فاز ششم — Class Sessions

Schedule برنامه تکرارشونده است؛ Session جلسه واقعی است.

Session باید وضعیت داشته باشد:

```text
scheduled
completed
cancelled
makeup
```

و شامل `class`، `date`، `start_time`، `end_time`، `status`، `notes` و `cancellation_reason` باشد.

---

# 14. تولید خودکار Sessions

در صورت مناسب‌بودن معماری پروژه، امکان Generate کردن جلسات از روی Schedule اضافه شود و از ایجاد Session تکراری جلوگیری شود.

---

# 15. فاز هفتم — Attendance

برای هر Session فهرست Studentهای همان Class نمایش داده شود.

Status:

```text
present
absent
late
excused
```

هر Student برای هر Session فقط یک Attendance Record داشته باشد.

---

# 16. Attendance توسط Instructor

Instructor فقط بتواند Attendance کلاس‌های خودش را مدیریت کند.

این کنترل باید Server-side باشد، نه فقط UI.

---

# 17. Attendance توسط Admin

Admin بتواند مشاهده، ثبت و ویرایش Attendance را انجام دهد.

تمام تغییرات مهم باید قابل Audit باشند.

---

# 18. Attendance Statistics

برای هر Student آمار Total Sessions، Present، Absent، Late، Excused و Attendance Rate نمایش داده شود.

درصد حضور:

```text
(Present + Late) / Total Sessions × 100
```

در صورت نیاز سیاست آموزشگاه برای Late و Excused قابل تنظیم باشد.

---

# 19. فاز هشتم — Tuition / Finance

مفهوم:

```text
Invoice = بدهی / شهریه
Payment = پرداخت
```

هر Student می‌تواند چند Invoice داشته باشد و هر Invoice می‌تواند چند Payment داشته باشد.

---

# 20. Invoice

اطلاعات: `student`، `registration`، `course`، `title`، `amount`، `due_date`، `status` و `description`.

Status:

```text
unpaid
partial
paid
cancelled
```

---

# 21. Payment

اطلاعات: `invoice`، `student`، `amount`، `payment_date`، `payment_method`، `tracking_code` و `description`.

روش پرداخت:

```text
cash
card
transfer
gateway
```

اگر Payment Gateway فعلاً وجود ندارد، فقط ساختار آن آماده باشد.

---

# 22. محاسبه بدهی

```text
Invoice Amount - Sum(Payments) = Remaining Balance
```

مبلغ باقی‌مانده هرگز از Client دریافت نشود؛ Server باید آن را محاسبه کند.

---

# 23. Finance Dashboard

Admin بتواند درآمد امروز، درآمد این هفته، درآمد این ماه، کل مطالبات، مطالبات سررسیدشده و تعداد بدهکاران را ببیند.

گزارش بر اساس Branch، Course، Instructor و Date در صورت وجود ارتباطات ارائه شود.

---

# 24. فاز نهم — Evaluation

Instructor بتواند عملکرد Student را ارزیابی کند.

شاخص‌های پیشنهادی:

```text
Technique
Rhythm
Theory
Performance
Discipline
Overall
```

امتیاز 0 تا 100 باشد، مگر اینکه سیستم grading موجود پروژه متفاوت باشد.

---

# 25. Evaluation History

برای هر Student تاریخچه ارزیابی نمایش داده شود. Student فقط اطلاعات خودش، Instructor فقط Studentهای مرتبط و Admin دسترسی کامل داشته باشد.

---

# 26. Instructor Comments

Instructor بتواند برای هر Evaluation توضیح آموزشی ثبت کند.

---

# 27. فاز دهم — Assignments

Instructor بتواند برای Student تمرین تعریف کند.

اطلاعات شامل عنوان، توضیح و مهلت باشد.

Status:

```text
assigned
in_progress
completed
reviewed
```

---

# 28. Assignment Review

Student بتواند وضعیت تمرین را تغییر دهد و Instructor بتواند آن را بررسی، تأیید، رد و Comment کند.

---

# 29. Educational Notes

Instructor بتواند برای هر Student یادداشت آموزشی ثبت کند. این اطلاعات فقط برای Admin و Instructor مربوطه قابل مشاهده باشد.

---

# 30. فاز یازدهم — Instructor Portal

Dashboard شامل کلاس‌های امروز، هنرجویان من، جلسات امروز و تمرین‌های در انتظار بررسی باشد.

منو:

```text
Dashboard
Classes
Students
Schedule
Attendance
Evaluations
Assignments
Notes
Profile
```

---

# 31. Instructor Dashboard

تمام داده‌ها باید واقعی و از Database باشند. Mock Data در Production ممنوع است.

---

# 32. Instructor Classes

Instructor فقط Classهای خودش را ببیند. برای هر Class Course، Branch، Room، Schedule، Students، Next Session و Attendance نمایش داده شود.

---

# 33. Instructor Students

لیست Studentهای Instructor با Search و Filter نمایش داده شود.

---

# 34. Student Portal

پنل Student فعلی توسعه داده شود و Authentication فعلی حفظ شود.

Dashboard اطلاعات کلاس بعدی، Instructor، زمان، Branch، Room، درصد حضور، شهریه، تمرین و آخرین Evaluation را نمایش دهد.

---

# 35. Student Menu

```text
Dashboard
Profile
My Classes
Weekly Schedule
Attendance
Tuition
Payments
Assignments
Evaluations
Certificates
Notifications
Change Password
Logout
```

از ساختار موجود استفاده شود.

---

# 36. فاز دوازدهم — Notifications

Notification داخلی سیستم ایجاد شود.

انواع:

```text
class_reminder
payment_due
attendance
assignment
evaluation
certificate
system
```

در Phase اول Notification داخل سایت کافی است؛ معماری برای SMS در آینده آماده باشد.

---

# 37. Class Reminder

قبل از جلسه Notification یادآوری نمایش داده شود.

---

# 38. فاز سیزدهم — Makeup Sessions

برای غیبت موجه امکان درخواست جلسه جبرانی فراهم شود.

Status:

```text
pending
approved
rejected
scheduled
completed
```

Admin یا مسئول مربوطه درخواست را بررسی کند.

---

# 39. فاز چهاردهم — Admin Dashboard

Dashboard شامل:

```text
هنرجویان فعال
Instructorهای فعال
کلاس‌های فعال
کلاس‌های امروز
جلسات امروز
بدهکاران
درآمد ماه
گواهینامه‌های صادرشده
```

---

# 40. گزارش هنرجویان

تعداد کل Studentها، Studentهای فعال، Studentهای غیرفعال، ثبت‌نام‌های جدید و Studentهای فارغ‌التحصیل قابل گزارش باشد.

---

# 41. گزارش Instructor

تعداد Instructorها، Instructorهای فعال، تعداد کلاس هر Instructor، تعداد Student هر Instructor، میانگین حضور و میانگین Evaluation قابل گزارش باشد.

---

# 42. گزارش کلاس‌ها

کلاس‌های فعال، لغوشده، امروز، ظرفیت کلاس‌ها و ظرفیت خالی گزارش شود.

---

# 43. گزارش مالی

درآمد روزانه، درآمد ماهانه، مطالبات، پرداخت‌های انجام‌شده، پرداخت‌های ناقص و بدهکاران گزارش شود.

---

# 44. گزارش آموزشی

میانگین حضور، بیشترین غیبت، میانگین Evaluation و Studentهای در معرض افت گزارش شود.

---

# 45. گزارش Branch

اگر Branch در پروژه موجود است، گزارش‌ها بر اساس Branch قابل فیلتر باشند.

---

# 46. فاز پانزدهم — Audit Log

عملیات حساس Admin و Instructor ثبت شوند.

حداقل:

```text
actor
action
entity
entity_id
metadata
timestamp
```

---

# 47. Security

تمام APIها باید Authorization واقعی داشته باشند. UI به‌تنهایی امنیت محسوب نمی‌شود.

---

# 48. جلوگیری از IDOR

تمام Endpointهای Student باید Session کاربر را بررسی کنند. Student ID نباید تنها از Query String به‌عنوان مکانیزم Authorization دریافت شود.

---

# 49. Instructor Authorization

Instructor فقط می‌تواند داده‌هایی را تغییر دهد که متعلق به Classهای خودش هستند. این کنترل باید Server-side باشد.

---

# 50. Admin Authorization

عدم وجود Session معتبر باید 401 و نداشتن Permission باید 403 برگرداند.

---

# 51. Validation

تمام ورودی‌های API Validate شوند؛ شامل IDs، Dates، Times، Amounts، Scores، Statuses و Roles.

هیچ Input مستقیماً وارد SQL نشود.

---

# 52. SQL Safety

تمام Queryها باید Parameterized باشند. از String Concatenation برای Query استفاده نکن.

---

# 53. Database Migrations

Migrationهای قبلی را تغییر نده. برای تغییرات جدید Migration جدید ایجاد کن. شماره Migration باید مطابق آخرین Migration واقعی Repository تعیین شود.

---

# 54. Database Indexes

برای Foreign Keyها و فیلترهای پرتکرار Index ایجاد شود، اما ابتدا Indexهای موجود بررسی شوند و Duplicate Index ساخته نشود.

---

# 55. API Structure

قبل از ایجاد Endpoint جدید، Endpointهای مشابه موجود را بررسی کن. اگر معماری فعلی convention دیگری دارد، همان convention حفظ شود.

---

# 56. Admin API

منطقی است APIهای مربوط به Students، Instructors، Courses، Classes، Schedule، Sessions، Attendance، Invoices، Payments، Evaluations، Assignments، Notifications، Reports و Audit وجود داشته باشند؛ اما قبل از ساخت، APIهای موجود بررسی شوند.

---

# 57. Instructor API

منطقی است APIهای `me`، `classes`، `students`، `schedule`، `attendance`، `evaluations`، `assignments`، `notes` و `notifications` وجود داشته باشند و Instructor فقط Scope خودش را دریافت کند.

---

# 58. Student API

منطقی است APIهای `me`، `classes`، `schedule`، `attendance`، `invoices`، `payments`، `evaluations`، `assignments`، `certificates` و `notifications` وجود داشته باشند و Student فقط Scope خودش را دریافت کند.

---

# 59. Server Architecture

Business Logic را داخل Astro Page قرار نده. اگر معماری فعلی پروژه Server Service دارد، از همان استفاده کن.

---

# 60. UI

تمام صفحات جدید باید RTL، Responsive، Mobile Friendly، Accessible و Consistent باشند و از Design System موجود پروژه استفاده کنند.

---

# 61. Persian Date

کاربر باید تاریخ‌ها را به صورت شمسی ببیند. اگر Date Picker شمسی موجود است، همان استفاده شود.

---

# 62. Time

فرمت نمایش `HH:mm` باشد و Timezone در کل سیستم یکسان باشد.

---

# 63. Search

لیست‌های بزرگ باید Search داشته باشند. Student بر اساس نام، کد ملی و تلفن؛ Instructor بر اساس نام و تخصص؛ Class بر اساس نام، Course، Instructor و Branch.

---

# 64. Filters

فیلترهای متناسب شامل Branch، Course، Instructor، Status، Date و Level باشد.

---

# 65. Pagination

لیست‌های Admin نباید تمام Database را یکجا Load کنند. Pagination سمت Server استفاده شود.

---

# 66. Export

در مرحله اول CSV برای گزارش‌های مهم اضافه شود. معماری برای Excel و PDF در آینده آماده باشد.

---

# 67. Integration با Registration

Registration فعلی حفظ شود. مسیر منطقی:

```text
Registration → Approval → Student → Contract → Enrollment
```

Registration جدید بدون دلیل ایجاد نشود.

---

# 68. اتصال Registration به Student

ارتباطات داخلی با ID رکوردهای Database انجام شود و National Code تنها برای شناسایی/جستجوی مناسب استفاده شود.

---

# 69. Contract

سیستم Contract فعلی حفظ شود و Contract در پرونده Student قابل دسترسی باشد.

---

# 70. Certificate

سیستم Certificate فعلی حفظ شود و ارتباط منطقی Student → Course Completion → Evaluation → Certificate → Verification برقرار باشد.

---

# 71. Certificate Security

صفحه Verify عمومی باشد، اما اطلاعات حساس Student منتشر نشود. National Code در URL عمومی قرار نگیرد. از Certificate Number یا Verification Token استفاده شود.

---

# 72. AI Features — مرحله آینده

بعد از تکمیل Data Layer:

### AI Progress Assistant

بر اساس Attendance، Evaluation، Assignments و Level پیشنهاد آموزشی تولید کند.

### AI Instructor Assistant

برای Student بر اساس مشکلات آموزشی برنامه تمرینی پیشنهاد دهد.

### AI Admin Assistant

امکان پرسش درباره ثبت‌نام، Course، غیبت و درآمد را فراهم کند.

AI نباید بدون کنترل روی Database عملیات حساس انجام دهد.

---

# 73. قابلیت‌های آینده

```text
SMS Gateway
Payment Gateway
WhatsApp Notifications
Online Classes
Video Lessons
Audio Assignment Upload
PWA
Advanced Accounting
Instructor Payroll
Instrument Rental
Workshop Management
Festival Management
Inventory
```

این موارد در این Phase اجباری نیستند.

---

# 74. Performance

الزامات: Pagination، Indexes، Prepared Statements، Efficient Queries، No N+1 Queries، Server-side Filtering و Server-side Authorization.

---

# 75. Caching

داده‌های کم‌تغییر مانند Courses، Branches و Public Settings در صورت نیاز Cache شوند. اطلاعات حساس Student نباید بدون بررسی Authorization Cache عمومی شوند.

---

# 76. Testing

برای Business Logic تست بنویس.

حداقل برای Attendance، Schedule، Finance، Evaluation و Authorization تست‌های مثبت و منفی وجود داشته باشد.

---

# 77. Integration Tests

Endpointهای اصلی Student، Instructor، Admin و Certificate Verification تست شوند.

---

# 78. Regression Testing

بعد از هر تغییر مطمئن شو Registration، Contract Generation، Contract PDF، Student Login، Student Logout، Password Change، Student Portal، Certificate Generation، Certificate Verification و Admin Portal همچنان کار می‌کنند.

---

# 79. Build Validation

در پایان هر Phase:

```bash
npm run check
npm run test
npm run build
```

اگر Scriptهای پروژه متفاوت هستند، ابتدا `package.json` را بررسی کن و از Scriptهای واقعی پروژه استفاده کن.

---

# 80. Git Strategy

هر Phase یک Commit مستقل داشته باشد.

نمونه:

```text
feat(student): enhance student profiles
feat(instructor): enhance instructor management
feat(class): add class management
feat(schedule): add weekly scheduling
feat(session): add class sessions
feat(attendance): add attendance management
feat(finance): add tuition and payments
feat(evaluation): add student evaluations
feat(assignment): add assignments
feat(instructor-portal): add instructor dashboard
feat(student-portal): enhance student dashboard
feat(notification): add notifications
feat(makeup): add makeup requests
feat(report): add admin reports
feat(audit): add audit logging
```

---

# 81. ترتیب دقیق اجرای پروژه

```text
PHASE 0  Repository & Architecture Audit
PHASE 1  Student Profile
PHASE 2  Instructor Management
PHASE 3  Classes
PHASE 4  Class Students
PHASE 5  Weekly Schedule
PHASE 6  Class Sessions
PHASE 7  Attendance
PHASE 8  Finance
PHASE 9  Evaluations
PHASE 10 Assignments
PHASE 11 Instructor Portal
PHASE 12 Student Portal Upgrade
PHASE 13 Notifications
PHASE 14 Makeup Sessions
PHASE 15 Admin Dashboard
PHASE 16 Reports
PHASE 17 Audit Log
PHASE 18 Security Audit
PHASE 19 Testing
PHASE 20 Production Build
```

---

# 82. قانون اجرای هر Phase

برای هر Phase:

```text
1. Inspect
2. Identify existing implementation
3. Design
4. Database Migration
5. Server Logic
6. API
7. Authorization
8. Validation
9. UI
10. Tests
11. Check
12. Build
```

اگر قابلیت قبلاً در پروژه وجود دارد، آن را Rebuild نکن؛ Extend کن.

---

# 83. ممنوعیت‌های مهم

- ساختن `Teacher` به جای `Instructor`.
- ساختن `teachers` در Database در حالی که `instructors` موجود است.
- ساختن Student Model جدید در حالی که Student موجود است.
- ساختن Authentication جدید.
- ساختن Contract System جدید.
- ساختن Certificate System جدید.
- استفاده از Mock Data در Production.
- Hard-code کردن اطلاعات.
- ذخیره Password به صورت Plain Text.
- قرار دادن Secret در Git.
- ویرایش Migrationهای قبلی.
- اعطای دسترسی Student به اطلاعات Student دیگر.
- اعطای دسترسی Instructor به کلاس Instructor دیگر.
- قرار دادن Authorization فقط در Frontend.

---

# 84. Data Model نهایی

مدل منطقی مورد انتظار:

```text
                    ┌──────────────┐
                    │   BRANCH     │
                    └──────┬───────┘
                           │
┌──────────────┐     ┌─────▼───────┐
│   COURSE     │────▶│    CLASS    │
└──────────────┘     └─────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐             ┌─────▼─────┐
        │ INSTRUCTOR│             │  STUDENT  │
        └─────┬─────┘             └─────┬─────┘
              │                         │
              │                    ┌────▼──────┐
              │                    │ ATTENDANCE│
              │                    └───────────┘
              │
        ┌─────▼──────┐
        │ EVALUATION │
        └────────────┘

STUDENT
   ├── Registration
   ├── Contract
   ├── Classes
   ├── Attendance
   ├── Invoices
   │      └── Payments
   ├── Assignments
   ├── Evaluations
   └── Certificates
```

---

# 85. دستور نهایی به AI Developer

این فایل را به‌عنوان **Implementation Specification اصلی** پروژه در نظر بگیر.

قبل از نوشتن حتی یک Migration یا Component:

1. Repository را کامل بررسی کن.
2. موجودیت‌های فعلی را پیدا کن.
3. مخصوصاً `Instructor` را پیدا و بررسی کن.
4. از `Teacher` در هیچ بخش جدیدی استفاده نکن.
5. مدل‌های موجود را دوباره نساز.
6. Authentication موجود را حفظ کن.
7. Registration موجود را حفظ کن.
8. Contract موجود را حفظ کن.
9. Certificate موجود را حفظ کن.
10. Database Schema فعلی را بررسی کن.
11. Migration جدید را فقط در صورت نیاز ایجاد کن.
12. Architecture فعلی پروژه را بر هر پیشنهاد عمومی این سند اولویت بده.

سپس Phaseها را به ترتیب اجرا کن.

بعد از هر Phase:

```bash
npm run check
npm run test
npm run build
```

یا در صورت تفاوت Scriptهای پروژه، معادل واقعی موجود در `package.json` را اجرا کن.

اگر Build یا Test شکست خورد:

```text
STOP
↓
Diagnose
↓
Fix
↓
Run Tests Again
↓
Continue
```

هیچ Phase ناقصی را به‌عنوان Completed اعلام نکن.

---

# 86. معیار نهایی

در پایان، `fatehmusic` باید از یک وب‌سایت + سیستم ثبت‌نام، به یک:

**Music Academy Management System**

تبدیل شده باشد که بتواند:

```text
Student
Instructor
Course
Branch
Class
Schedule
Session
Attendance
Finance
Assignment
Evaluation
Notification
Certificate
Report
Audit
```

را به‌صورت یکپارچه مدیریت کند.

**اولویت اصلی: صحت Data Model، امنیت Authorization، استفاده از ساختار موجود پروژه و عدم ایجاد Duplicate Implementation است.**
