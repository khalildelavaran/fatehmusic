export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { courses } from "../../../data/courses";
import { schedules } from "../../../data/schedule";

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

const ALLOWED_STATUS = ["pending", "contacted", "confirmed", "cancelled"];

function cleanText(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const result = await db.prepare("SELECT * FROM registrations ORDER BY created_at DESC LIMIT 300").all();

  const courseOptions = courses
    .filter((course: any) => course.active !== false)
    .map((course: any) => ({
      id: Number(course.id),
      title: String(course.title ?? ""),
      slug: String(course.slug ?? "")
    }));

  const weekdayOptions = [...new Set(
    schedules
      .filter((schedule: any) => schedule.active !== false)
      .map((schedule: any) => String(schedule.weekday ?? "").trim())
      .filter(Boolean)
  )];

  return json({
    success: true,
    registrations: result.results,
    editOptions: { courses: courseOptions, weekdays: weekdayOptions }
  });
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  try {
    const body = await request.json() as {
      action?: string;
      id?: number;
      status?: string;
      courseId?: number;
      weekday?: string;
      firstName?: string;
      lastName?: string;
      mobile?: string;
      age?: number;
      gender?: string;
      hasInstrument?: string;
      fatherName?: string;
      idIssuePlace?: string;
      birthYear?: number;
      occupation?: string;
      address?: string;
    };

    const id = cleanInt(body.id);
    if (!id) return json({ success: false, message: "شناسه ثبت‌نام معتبر نیست." }, 422);

    if (body.action === "edit") {
      const existing = await db.prepare(
        "SELECT id, student_id, student_national_code, instructor_id FROM registrations WHERE id = ?"
      ).bind(id).first<any>();
      if (!existing) return json({ success: false, message: "ثبت‌نام پیدا نشد." }, 404);

      const courseId = cleanInt(body.courseId);
      const course = courses.find((item: any) => Number(item.id) === courseId && item.active !== false);
      if (!course) return json({ success: false, message: "دوره انتخاب‌شده معتبر نیست." }, 422);

      const weekday = cleanText(body.weekday, 40);
      const matchingSchedules = schedules.filter(
        (schedule: any) =>
          schedule.active !== false &&
          String(schedule.weekday ?? "").trim() === weekday &&
          Number(schedule.instructorId) === Number(existing.instructor_id)
      );
      if (!matchingSchedules.length) {
        return json({
          success: false,
          message: "برای مدرس فعلی در این روز برنامه‌ای ثبت نشده است. ابتدا برنامه مدرس را اصلاح کنید."
        }, 422);
      }

      const selectedSchedule = matchingSchedules[0];
      const firstName = cleanText(body.firstName, 100);
      const lastName = cleanText(body.lastName, 100);
      const mobile = cleanText(body.mobile, 40);
      const age = cleanInt(body.age);
      const gender = cleanText(body.gender, 20);
      const hasInstrument = cleanText(body.hasInstrument, 40);
      const fatherName = cleanText(body.fatherName, 100);
      const idIssuePlace = cleanText(body.idIssuePlace, 100);
      const birthYear = cleanInt(body.birthYear);
      const occupation = cleanText(body.occupation, 120);
      const address = cleanText(body.address, 500);

      if (!firstName || !lastName || !mobile) {
        return json({ success: false, message: "نام، نام خانوادگی و موبایل الزامی هستند." }, 422);
      }
      if (age < 0 || age > 120) return json({ success: false, message: "سن واردشده معتبر نیست." }, 422);

      await db.prepare(`
        UPDATE registrations SET
          instrument_id = ?,
          instrument_title = ?,
          instrument_slug = ?,
          schedule_id = ?,
          schedule_weekday = ?,
          schedule_classroom = ?,
          schedule_duration = ?,
          student_first_name = ?,
          student_last_name = ?,
          student_mobile = ?,
          student_age = ?,
          student_gender = ?,
          has_instrument = ?,
          student_father_name = ?,
          student_id_issue_place = ?,
          student_birth_year = ?,
          student_occupation = ?,
          student_address = ?
        WHERE id = ?
      `).bind(
        course.id,
        course.title,
        course.slug,
        selectedSchedule.id,
        selectedSchedule.weekday,
        selectedSchedule.classroom ?? null,
        selectedSchedule.sessionDuration ?? null,
        firstName,
        lastName,
        mobile,
        age,
        gender,
        hasInstrument,
        fatherName,
        idIssuePlace,
        birthYear,
        occupation,
        address,
        id
      ).run();

      if (existing.student_id) {
        await db.prepare(`
          UPDATE students SET
            first_name = ?,
            last_name = ?,
            phone = ?,
            father_name = ?,
            birth_year = ?,
            address = ?,
            id_issue_place = ?,
            occupation = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          firstName, lastName, mobile, fatherName,
          birthYear || null, address, idIssuePlace, occupation, existing.student_id
        ).run();
      } else if (existing.student_national_code) {
        await db.prepare(`
          UPDATE students SET
            first_name = ?,
            last_name = ?,
            phone = ?,
            father_name = ?,
            birth_year = ?,
            address = ?,
            id_issue_place = ?,
            occupation = ?,
            updated_at = datetime('now')
          WHERE national_code = ?
        `).bind(
          firstName, lastName, mobile, fatherName,
          birthYear || null, address, idIssuePlace, occupation, existing.student_national_code
        ).run();
      }

      return json({ success: true, message: "اطلاعات ثبت‌نام با موفقیت ویرایش شد." });
    }

    const status = cleanText(body.status, 30);
    if (!ALLOWED_STATUS.includes(status)) {
      return json({ success: false, message: "وضعیت ثبت‌نام معتبر نیست." }, 422);
    }

    await db.prepare("UPDATE registrations SET status=? WHERE id=?").bind(status, id).run();
    return json({ success: true });
  } catch (error) {
    console.error("[admin/registrations] PATCH failed", error);
    return json({ success: false, message: "ذخیره تغییرات انجام نشد." }, 500);
  }
};
