/**
 * ============================================================
 * utils/schedule.js
 * Enterprise Edition
 * Architecture Frozen
 * ============================================================
 */

import { schedules } from "@/data/schedule";
import { instructors } from "@/data/instructors";
import { courses } from "@/data/courses";

/* ============================================================
   مرتب سازی روزهای هفته
============================================================ */

const WEEK_ORDER = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه"
];

/* ============================================================
   روزهای حضور استاد
============================================================ */

export function getInstructorDays(instructorId) {

  const days = schedules
    .filter(item =>
      item.active &&
      item.instructorId === instructorId
    )
    .map(item => item.weekday);

  return [...new Set(days)]
    .sort(
      (a, b) =>
        WEEK_ORDER.indexOf(a) -
        WEEK_ORDER.indexOf(b)
    );

}

/* ============================================================
   متن روزهای حضور استاد
============================================================ */

export function getInstructorDaysText(instructorId) {

  return getInstructorDays(instructorId).join(" • ");

}

/* ============================================================
   روزهای برگزاری یک دوره
============================================================ */

export function getCourseDays(courseId) {

  const course = courses.find(c => c.id === courseId);

  if (!course) return [];

  const instructorId = course.instructor;

  return getInstructorDays(instructorId);

}

/* ============================================================
   متن روزهای برگزاری دوره
============================================================ */

export function getCourseDaysText(courseId) {

  return getCourseDays(courseId).join(" • ");

}

/* ============================================================
   برنامه هفتگی یک استاد
============================================================ */

export function getInstructorSchedule(instructorId) {

  return schedules
    .filter(item =>
      item.active &&
      item.instructorId === instructorId
    )
    .sort(
      (a, b) =>
        WEEK_ORDER.indexOf(a.weekday) -
        WEEK_ORDER.indexOf(b.weekday)
    );

}

/* ============================================================
   اساتید حاضر در یک روز
============================================================ */

export function getInstructorsByDay(weekday) {

  return schedules
    .filter(item =>
      item.active &&
      item.weekday === weekday
    )
    .map(item => {

      const instructor = instructors.find(
        i => i.id === item.instructorId
      );

      return {

        ...item,

        instructor

      };

    });

}

/* ============================================================
   آیا امروز استاد کلاس دارد؟
============================================================ */

export function isInstructorAvailableToday(
  instructorId,
  today
) {

  return schedules.some(item =>
    item.active &&
    item.instructorId === instructorId &&
    item.weekday === today
  );

}