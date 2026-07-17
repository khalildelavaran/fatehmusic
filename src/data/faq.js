/**
 * ============================================================
 * Fateh Music Academy
 * faq.js
 * Production-Ready Edition v1.2
 *
 * Dynamic FAQ Generator (Fully Synced with Frozen Database)
 * ============================================================
 */

import { courses } from "./courses.js";
import { instructors } from "./instructors.js";
import { schedules } from "./schedule.js";
import { pricing } from "./pricing.js";

/*
============================================================
Helper Functions (انطباق ساختاری با دیتابیس)
============================================================
*/

// ۱. استخراج اساتید دوره (سازگار با تک‌استاده instructor و چند‌استاده instructors)
function getCourseInstructors(course) {
    const instructorIds = [];
    if (course.instructor) instructorIds.push(course.instructor);
    if (Array.isArray(course.instructors)) instructorIds.push(...course.instructors);
    
    return instructors.filter(ins => instructorIds.includes(ins.id));
}

// ۲. استخراج و فرمت‌دهی هوشمند روزهای کلاس اساتید
function generateScheduleText(courseInstructors, courseTitle) {
    const instructorIds = courseInstructors.map(ins => ins.id);
    const activeSchedules = schedules.filter(s => instructorIds.includes(s.instructorId) && s.active);

    if (activeSchedules.length === 0) {
        return `برنامه هفتگی کلاس ${courseTitle} به‌زودی اعلام می‌شود.`;
    }

    // گروه‌بندی روزها برای هر استاد
    const instructorDaysMap = {};
    courseInstructors.forEach(ins => {
        const days = activeSchedules
            .filter(s => s.instructorId === ins.id)
            .map(s => s.weekday);
        
        if (days.length > 0) {
            instructorDaysMap[ins.name] = days;
        }
    });

    // تبدیل به متن روان فارسی (پشتیبانی از چند روزه بودن یک استاد)
    const instructorParts = Object.entries(instructorDaysMap).map(([name, days]) => {
        const daysStr = days.join(' و ');
        return `استاد ${name} در روزهای ${daysStr}`;
    });

    return `کلاس ${courseTitle} توسط ${instructorParts.join(' و همچنین ')} برگزار می‌شود.`;
}

// ۳. استخراج امن اطلاعات مالی بر اساس اسلاگ دوره
function getCoursePricing(course) {
    // حل مشکل بزرگ: مپ کردن بر اساس slug به جای id
    const planKey = pricing.coursePricingMap[course.slug];
    if (!planKey) return null;

    const plan = pricing.plans[planKey];
    if (!plan) return null;

    return {
        sessions: plan.duration.sessions,
        period: plan.duration.period,
        fullPrice: plan.paymentOptions.fullTerm.amount.toLocaleString('fa-IR'),
        halfPrice: plan.paymentOptions.halfTerm.amount.toLocaleString('fa-IR'),
        paymentText: plan.paymentOptions.halfTerm.title
    };
}

/*
============================================================
Dynamic FAQ Builder
============================================================
*/

export function generateCourseFAQ(courseId) {
    const course = courses.find(item => item.id === courseId);

    // بررسی فعال بودن دوره
    if (!course || !course.active) return [];

    const courseInstructors = getCourseInstructors(course);
    const price = getCoursePricing(course);
    const faqs = [];

    // نام اساتید به صورت فرمت شده برای استفاده در متن‌ها
    const instructorsListStr = courseInstructors.length > 0
        ? courseInstructors.map(ins => `استاد ${ins.name}`).join(' و ')
        : "اساتید مجرب آموزشگاه";

    // ۱. سوال نحوه برگزاری
    if (price) {
        faqs.push({
            question: `دوره آموزش ${course.title} چگونه برگزار می‌شود؟`,
            answer: `دوره آموزش ${course.title} در آموزشگاه موسیقی فاتح به صورت ${price.sessions} جلسه‌ای و طی یک ترم ${price.period} برگزار می‌شود. کلاس توسط ${instructorsListStr} مدیریت شده و امکان ${price.paymentText} نیز وجود دارد.`
        });
    } else {
        // فالبک برای دوره‌هایی که هنوز قیمت ندارند (مثل آواز و تئوری)
        faqs.push({
            question: `دوره آموزش ${course.title} چگونه برگزار می‌شود؟`,
            answer: `دوره آموزش ${course.title} در آموزشگاه موسیقی فاتح به صورت ترمیک زیر نظر ${instructorsListStr} برگزار می‌شود. جهت کسب اطلاعات دقیق از جزئیات ترم با آموزشگاه تماس بگیرید.`
        });
    }

    // ۲. سوال زمان و روزهای برگزاری کلاس
    if (courseInstructors.length > 0) {
        faqs.push({
            question: `کلاس ${course.title} چه روزهایی برگزار می‌شود؟`,
            answer: generateScheduleText(courseInstructors, course.title)
        });
    }

    // ۳. سوال هزینه کلاس (با احتساب فالبک امن)
    faqs.push({
        question: `هزینه کلاس ${course.title} چقدر است؟`,
        answer: price 
            ? `هزینه کامل دوره ${price.fullPrice} تومان است و امکان پرداخت اقساطی (نیم‌ترم) با مبلغ ${price.halfPrice} تومان وجود دارد.`
            : `جهت استعلام شهریه جاری کلاس ${course.title} و شرایط پرداخت، لطفا از طریق فرم تماس یا شماره‌های آموزشگاه با ما در ارتباط باشید.`
    });

    return faqs;
}